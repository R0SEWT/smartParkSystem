from datetime import datetime
from typing import Any, Dict, Optional, Literal

from pydantic import BaseModel, Field


class SensorEvent(BaseModel):
    sensor_id: int
    estacionamiento_id: str
    estado: Literal["ocupado", "libre"]
    ts: Optional[datetime] = None
    payload: Optional[Dict[str, Any]] = None
