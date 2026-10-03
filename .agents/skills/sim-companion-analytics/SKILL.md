---
name: sim-companion-analytics
description: Lightweight simulation telemetry companion service & After-Action Review (AAR) analytics. Validates event JSON streams, calculates statistical latency percentiles, and serves interactive timelines.
---

# Simulation Companion & Telemetry Analytics Skill

This skill provides schemas, test harnesses, and an AAR (After-Action Review) companion API for parsing, validating, and visualizing telemetry output from the Drone Threat Simulation Trainer.

---

## 1. Pydantic Telemetry Schema Validation

```python
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, UUID4

class TrainingEventType(str, Enum):
    SCENARIO_STARTED = "SCENARIO_STARTED"
    DRONE_SPAWNED = "DRONE_SPAWNED"
    DRONE_VISIBLE = "DRONE_VISIBLE"
    PLAYER_DETECTION = "PLAYER_DETECTION"
    CLASSIFICATION_SUBMITTED = "CLASSIFICATION_SUBMITTED"
    RESPONSE_SELECTED = "RESPONSE_SELECTED"
    SCENARIO_COMPLETED = "SCENARIO_COMPLETED"

class TrainingEvent(BaseModel):
    event_id: str
    session_id: str
    scenario_id: str
    trainee_id: str = "Trainee_01"
    timestamp: float = Field(..., ge=0.0, description="Elapsed seconds since scenario start")
    event_type: TrainingEventType
    data: Dict[str, Any] = Field(default_factory=dict)

class SessionSummary(BaseModel):
    session_id: str
    scenario_id: str
    trainee_id: str
    start_time_utc: str
    duration_seconds: float
    detection_latency: Optional[float] = None
    classification_accuracy: float
    decision_accuracy: float
    total_score: float
    letter_grade: str
    events: List[TrainingEvent]
```

---

## 2. Telemetry Timeline Extraction & Metrics Calculator

```python
def analyze_telemetry_stream(events: List[TrainingEvent]) -> Dict[str, Any]:
    events_by_type = {e.event_type: e for e in events}
    
    t_visible = events_by_type.get(TrainingEventType.DRONE_VISIBLE)
    t_detect = events_by_type.get(TrainingEventType.PLAYER_DETECTION)
    t_class = events_by_type.get(TrainingEventType.CLASSIFICATION_SUBMITTED)
    t_resp = events_by_type.get(TrainingEventType.RESPONSE_SELECTED)
    
    metrics = {
        "detection_latency": None,
        "classification_latency": None,
        "decision_latency": None,
        "total_reaction_time": None
    }
    
    if t_visible and t_detect:
        metrics["detection_latency"] = max(0.0, t_detect.timestamp - t_visible.timestamp)
    if t_detect and t_class:
        metrics["classification_latency"] = max(0.0, t_class.timestamp - t_detect.timestamp)
    if t_class and t_resp:
        metrics["decision_latency"] = max(0.0, t_resp.timestamp - t_class.timestamp)
    if t_visible and t_resp:
        metrics["total_reaction_time"] = max(0.0, t_resp.timestamp - t_visible.timestamp)
        
    return metrics
```

---

## 3. Companion Fast API Server for AAR

```python
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Drone Threat Sim - AAR Companion API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/sessions/evaluate")
async def evaluate_session(session: SessionSummary):
    metrics = analyze_telemetry_stream(session.events)
    return {
        "status": "success",
        "session_id": session.session_id,
        "score": session.total_score,
        "grade": session.letter_grade,
        "metrics": metrics
    }
```
