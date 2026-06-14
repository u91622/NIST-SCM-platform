from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from dataclasses import asdict
from app.db.database import get_db
from app.services.ml_risk import (
    train, predict_product, predict_batch,
    get_model_meta, SKLEARN_OK,
)
from app.schemas.ml_schemas import (
    TrainingResultOut, SinglePredictionOut,
    BatchPredictionOut, BatchPredictionItem, ModelMetaOut,
)

router = APIRouter(prefix="/ml", tags=["ml-risk"])


@router.post("/train", response_model=TrainingResultOut, summary="Train RF risk model")
def train_model(dataset: str = Query(...), db: Session = Depends(get_db)):
    """
    Train a Random Forest classifier on all products in the given dataset.
    Features: bom_level, procurement_type (OHE), supplier_count, has_phase, has_revision
    Target  : is_at_risk (1 = CRITICAL/HIGH risk_flag, 0 = MEDIUM/LOW)
    """
    if not SKLEARN_OK:
        raise HTTPException(500, "scikit-learn not installed — run: pip install scikit-learn shap")
    try:
        result = train(db, dataset)
        return TrainingResultOut(**asdict(result))
    except (ValueError, RuntimeError) as e:
        raise HTTPException(400, str(e))


@router.get("/model-info", summary="Get trained model metadata")
def model_info(dataset: str = Query(...)):
    meta = get_model_meta(dataset)
    if not meta:
        raise HTTPException(404, f"No trained model found for '{dataset}'. POST /ml/train first.")
    return meta


@router.get("/predict/{product_id}", response_model=SinglePredictionOut,
            summary="Predict delay risk for one product")
def predict_one(product_id: int, db: Session = Depends(get_db)):
    try:
        result = predict_product(db, product_id)
        return SinglePredictionOut(**asdict(result))
    except (ValueError, RuntimeError) as e:
        raise HTTPException(400, str(e))


@router.get("/predict-batch", response_model=BatchPredictionOut,
            summary="Batch predict all products in a dataset")
def predict_all(dataset: str = Query(...), db: Session = Depends(get_db)):
    try:
        items = predict_batch(db, dataset)
        meta  = get_model_meta(dataset)
        return BatchPredictionOut(
            dataset_code=dataset,
            total=len(items),
            items=[BatchPredictionItem(**asdict(i)) for i in items],
            model_meta=ModelMetaOut(**meta) if meta else None,
        )
    except (ValueError, RuntimeError) as e:
        raise HTTPException(400, str(e))
