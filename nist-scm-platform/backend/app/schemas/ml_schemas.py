from pydantic import BaseModel
from typing import Optional

class TrainingResultOut(BaseModel):
    dataset_code: str
    n_samples: int
    n_positive: int
    n_negative: int
    train_accuracy: float
    cv_roc_auc: float
    feature_importance: dict
    class_report: str
    confusion_matrix: list

class ModelMetaOut(BaseModel):
    dataset_code: str
    n_samples: int
    n_positive: int
    n_negative: int
    train_accuracy: float
    cv_roc_auc: float
    feature_importance: dict
    confusion_matrix: list

class SinglePredictionOut(BaseModel):
    product_id: int
    source_id: str
    name: str
    risk_flag: str
    dep_score: float
    delay_probability: float
    risk_level: str
    top_features: dict

class BatchPredictionItem(BaseModel):
    product_id: int
    source_id: str
    name: str
    bom_level: int
    proc_type: str
    supplier_count: int
    delay_probability: float
    predicted_risk: str
    actual_risk_flag: str

class BatchPredictionOut(BaseModel):
    dataset_code: str
    total: int
    items: list[BatchPredictionItem]
    model_meta: Optional[ModelMetaOut] = None
