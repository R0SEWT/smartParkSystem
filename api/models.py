from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class SensorEvent(BaseModel):
    sensor_id: str
    occupied: bool
    ts: Optional[datetime] = None
    payload: Optional[Dict[str, Any]] = None


class OccupancyPoint(BaseModel):
    lot_id: int
    ts: Optional[datetime] = None
    occupied_spaces: int = Field(..., ge=0)
    total_spaces: int = Field(..., gt=0)

    @property
    def occupancy_ratio(self) -> float:
        if self.total_spaces == 0:
            return 0.0
        return self.occupied_spaces / self.total_spaces
