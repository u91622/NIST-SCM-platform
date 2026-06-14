"""
ML Risk Prediction Service
──────────────────────────
Features  : bom_level, procurement_type (OHE), supplier_count
Target    : customs_delay_risk (1 = single-source HIGH/CRITICAL, 0 = otherwise)
Model     : Random Forest Classifier  (scikit-learn)
Extras    : SHAP-style feature importance, predict_proba for risk scores
"""
import os, json, pickle, warnings
from dataclasses import dataclass, asdict
from typing import Any, Optional

import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

# Lazy-import sklearn so the rest of the app boots even if not installed
try:
    from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
    from sklearn.preprocessing import LabelEncoder, StandardScaler
    from sklearn.model_selection import train_test_split, cross_val_score
    from sklearn.metrics import (
        classification_report, roc_auc_score, confusion_matrix, accuracy_score
    )
    from sklearn.pipeline import Pipeline
    from sklearn.compose import ColumnTransformer
    from sklearn.preprocessing import OneHotEncoder
    SKLEARN_OK = True
except ImportError:
    SKLEARN_OK = False

from app.models.models import Product, Dataset

# ── model store (in-memory, per-dataset) ─────────────────────────────────
_MODEL_STORE: dict[str, Any] = {}  # code → trained Pipeline
_META_STORE:  dict[str, Any] = {}  # code → training metadata

MODEL_DIR = os.path.join(os.path.dirname(__file__), "../../models")
os.makedirs(MODEL_DIR, exist_ok=True)


def _model_path(code: str) -> str:
    return os.path.join(MODEL_DIR, f"{code}_rf_model.pkl")

def _meta_path(code: str) -> str:
    return os.path.join(MODEL_DIR, f"{code}_meta.json")


# ── Feature engineering ───────────────────────────────────────────────────
BOM_LABEL_MAP = {
    "Finished Good": 1, "Sub-Assembly": 2, "Component": 3, "Raw Part": 4,
    "Unknown": 3,
}
PROC_CATEGORIES = ["OTS", "MTS", "COTS", "Custom", "Unknown"]

def _build_dataframe(products: list) -> pd.DataFrame:
    rows = []
    for p in products:
        attrs = p.attributes or {}

        # BOM level  (GPS has it; fall back to ordinal from risk flag)
        bom_raw = attrs.get("bom_level") or attrs.get("BOM Level")
        if bom_raw is not None:
            try:
                bom_level = int(bom_raw)
            except (ValueError, TypeError):
                bom_level = BOM_LABEL_MAP.get(str(bom_raw), 3)
        else:
            bom_level = 3   # neutral default

        # Procurement type
        proc_raw = attrs.get("procurement_type") or attrs.get("Procurement Type") or "Unknown"
        proc = str(proc_raw).strip() or "Unknown"
        if proc not in PROC_CATEGORIES:
            proc = "Custom"

        # Supplier count (always available)
        sup_cnt = int(p.supplier_count or 0)

        # Additional signal: phase / revision available?
        has_phase    = 1 if attrs.get("phase") else 0
        has_revision = 1 if attrs.get("revision") else 0

        # ── Target variable ───────────────────────────────────────────────
        # "Will this item cause a customs / supply delay?"
        # Proxy: CRITICAL or HIGH risk_flag → 1, else 0
        # (In a real project this would come from historical customs records)
        is_at_risk = 1 if p.risk_flag in ("CRITICAL", "HIGH") else 0

        rows.append({
            "product_id":   p.id,
            "source_id":    p.source_id,
            "name":         p.name,
            "bom_level":    bom_level,
            "proc_type":    proc,
            "supplier_count": sup_cnt,
            "has_phase":    has_phase,
            "has_revision": has_revision,
            "risk_flag":    p.risk_flag,
            "dep_score":    float(p.dependency_score or 0),
            "is_at_risk":   is_at_risk,
        })
    return pd.DataFrame(rows)


# ── Build sklearn pipeline ────────────────────────────────────────────────
def _build_pipeline() -> Any:
    num_features  = ["bom_level", "supplier_count", "has_phase", "has_revision"]
    cat_features  = ["proc_type"]

    preprocessor = ColumnTransformer(transformers=[
        ("num", StandardScaler(), num_features),
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), cat_features),
    ])

    clf = RandomForestClassifier(
        n_estimators=200,
        max_depth=6,
        min_samples_leaf=3,
        class_weight="balanced",
        random_state=42,
    )
    return Pipeline(steps=[("prep", preprocessor), ("clf", clf)])


# ── Train ─────────────────────────────────────────────────────────────────
@dataclass
class TrainingResult:
    dataset_code: str
    n_samples: int
    n_positive: int
    n_negative: int
    train_accuracy: float
    cv_roc_auc: float
    feature_importance: dict
    class_report: str
    confusion_matrix: list

def train(db: Session, dataset_code: str) -> TrainingResult:
    if not SKLEARN_OK:
        raise RuntimeError("scikit-learn is not installed. Run: pip install scikit-learn")

    ds = db.query(Dataset).filter_by(code=dataset_code).first()
    if not ds:
        raise ValueError(f"Dataset '{dataset_code}' not ingested yet.")

    products = db.query(Product).filter_by(dataset_id=ds.id).all()
    if len(products) < 10:
        raise ValueError("Need at least 10 products to train a model.")

    df = _build_dataframe(products)
    FEATURES = ["bom_level", "proc_type", "supplier_count", "has_phase", "has_revision"]
    X = df[FEATURES]
    y = df["is_at_risk"]

    if y.nunique() < 2:
        raise ValueError("All samples have the same label — cannot train binary classifier.")

    pipeline = _build_pipeline()

    # Cross-validation AUC (before final fit)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        cv_scores = cross_val_score(pipeline, X, y, cv=min(5, len(df)//5 or 2),
                                    scoring="roc_auc")

    # Final fit on all data
    pipeline.fit(X, y)

    # Feature importance from the RF step
    prep      = pipeline.named_steps["prep"]
    clf       = pipeline.named_steps["clf"]
    num_names = ["bom_level", "supplier_count", "has_phase", "has_revision"]
    cat_names = list(prep.named_transformers_["cat"]
                     .get_feature_names_out(["proc_type"]))
    all_names = num_names + cat_names
    importances = {
        name: round(float(imp), 4)
        for name, imp in zip(all_names, clf.feature_importances_)
    }
    importances = dict(sorted(importances.items(), key=lambda x: -x[1]))

    # Accuracy + confusion matrix on training set (for display)
    y_pred = pipeline.predict(X)
    y_proba = pipeline.predict_proba(X)[:, 1]
    acc = round(float(accuracy_score(y, y_pred)), 4)
    cm  = confusion_matrix(y, y_pred).tolist()
    report = classification_report(y, y_pred, target_names=["Low-Risk","At-Risk"])

    # Save
    with open(_model_path(dataset_code), "wb") as f:
        pickle.dump(pipeline, f)
    meta = {
        "dataset_code": dataset_code,
        "n_samples": len(df),
        "n_positive": int(y.sum()),
        "n_negative": int((y == 0).sum()),
        "train_accuracy": acc,
        "cv_roc_auc": round(float(cv_scores.mean()), 4),
        "feature_importance": importances,
        "confusion_matrix": cm,
    }
    with open(_meta_path(dataset_code), "w") as f:
        json.dump(meta, f, indent=2)

    _MODEL_STORE[dataset_code] = pipeline
    _META_STORE[dataset_code]  = meta

    return TrainingResult(
        **meta,
        class_report=report,
    )


# ── Load model from disk ──────────────────────────────────────────────────
def _load_model(code: str) -> Any:
    if code in _MODEL_STORE:
        return _MODEL_STORE[code]
    path = _model_path(code)
    if not os.path.exists(path):
        return None
    with open(path, "rb") as f:
        pipeline = pickle.load(f)
    _MODEL_STORE[code] = pipeline
    meta_p = _meta_path(code)
    if os.path.exists(meta_p):
        with open(meta_p) as f:
            _META_STORE[code] = json.load(f)
    return pipeline


def get_model_meta(code: str) -> Optional[dict]:
    if code in _META_STORE:
        return _META_STORE[code]
    meta_p = _meta_path(code)
    if os.path.exists(meta_p):
        with open(meta_p) as f:
            d = json.load(f)
        _META_STORE[code] = d
        return d
    return None


# ── Predict single item ───────────────────────────────────────────────────
@dataclass
class SinglePrediction:
    product_id: int
    source_id: str
    name: str
    risk_flag: str
    dep_score: float
    delay_probability: float   # 0-100 %
    risk_level: str            # CRITICAL / HIGH / MEDIUM / LOW
    top_features: dict

def predict_product(db: Session, product_id: int) -> SinglePrediction:
    prod = db.query(Product).filter_by(id=product_id).first()
    if not prod:
        raise ValueError(f"Product {product_id} not found.")
    ds = db.query(Dataset).filter_by(id=prod.dataset_id).first()
    if not ds:
        raise ValueError("Dataset not found.")

    pipeline = _load_model(ds.code)
    if pipeline is None:
        raise RuntimeError(f"No trained model for dataset '{ds.code}'. Call /ml/train first.")

    df = _build_dataframe([prod])
    FEATURES = ["bom_level", "proc_type", "supplier_count", "has_phase", "has_revision"]
    prob = float(pipeline.predict_proba(df[FEATURES])[0][1]) * 100

    risk_level = (
        "CRITICAL" if prob >= 80
        else "HIGH"    if prob >= 60
        else "MEDIUM"  if prob >= 40
        else "LOW"
    )

    meta = get_model_meta(ds.code) or {}
    top_features = dict(list(meta.get("feature_importance", {}).items())[:5])

    return SinglePrediction(
        product_id=prod.id,
        source_id=prod.source_id,
        name=prod.name,
        risk_flag=prod.risk_flag,
        dep_score=float(prod.dep_score if hasattr(prod,"dep_score") else prod.dependency_score),
        delay_probability=round(prob, 1),
        risk_level=risk_level,
        top_features=top_features,
    )


# ── Batch predict all products in a dataset ───────────────────────────────
@dataclass
class BatchPrediction:
    product_id: int
    source_id: str
    name: str
    bom_level: int
    proc_type: str
    supplier_count: int
    delay_probability: float
    predicted_risk: str
    actual_risk_flag: str

def predict_batch(db: Session, dataset_code: str) -> list[BatchPrediction]:
    ds = db.query(Dataset).filter_by(code=dataset_code).first()
    if not ds:
        raise ValueError(f"Dataset '{dataset_code}' not ingested.")
    pipeline = _load_model(dataset_code)
    if pipeline is None:
        raise RuntimeError(f"No trained model for '{dataset_code}'. Call /ml/train first.")

    products = db.query(Product).filter_by(dataset_id=ds.id).all()
    df = _build_dataframe(products)
    FEATURES = ["bom_level", "proc_type", "supplier_count", "has_phase", "has_revision"]
    probas = pipeline.predict_proba(df[FEATURES])[:, 1] * 100

    results = []
    for i, row in df.iterrows():
        prob = float(probas[i])
        pred_risk = (
            "CRITICAL" if prob >= 80
            else "HIGH"    if prob >= 60
            else "MEDIUM"  if prob >= 40
            else "LOW"
        )
        results.append(BatchPrediction(
            product_id=int(row["product_id"]),
            source_id=str(row["source_id"]),
            name=str(row["name"]),
            bom_level=int(row["bom_level"]),
            proc_type=str(row["proc_type"]),
            supplier_count=int(row["supplier_count"]),
            delay_probability=round(prob, 1),
            predicted_risk=pred_risk,
            actual_risk_flag=str(row["risk_flag"]),
        ))
    return sorted(results, key=lambda r: -r.delay_probability)
