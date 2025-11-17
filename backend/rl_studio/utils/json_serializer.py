"""
JSON serializer for NumPy types
Converts NumPy int64, float64, etc. to native Python types
"""

import numpy as np
import json
from typing import Any


def convert_numpy_types(obj: Any) -> Any:
    """Recursively convert NumPy types to native Python types for JSON serialization"""
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, dict):
        return {key: convert_numpy_types(value) for key, value in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [convert_numpy_types(item) for item in obj]
    elif isinstance(obj, set):
        return [convert_numpy_types(item) for item in obj]
    else:
        return obj


def serialize_for_json(obj: Any) -> Any:
    """Serialize object for JSON, converting all NumPy types"""
    return convert_numpy_types(obj)

