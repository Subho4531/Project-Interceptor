import pytest
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel

class TrainingEventType(str, Enum):
    SCENARIO_STARTED = "SCENARIO_STARTED"
    DRONE_SPAWNED = "DRONE_SPAWNED"
    DRONE_VISIBLE = "DRONE_VISIBLE"
    PLAYER_DETECTION = "PLAYER_DETECTION"
    CLASSIFICATION_SUBMITTED = "CLASSIFICATION_SUBMITTED"
    RESPONSE_SELECTED = "RESPONSE_SELECTED"
    SCENARIO_COMPLETED = "SCENARIO_COMPLETED"

class TrainingClassification(str, Enum):
    BENIGN = "benign"
    UNKNOWN = "unknown"
    POTENTIAL_CONCERN = "potential_concern"
    SIMULATED_THREAT = "simulated_threat"

class TrainingResponseAction(str, Enum):
    CONTINUE_OBSERVATION = "continue_observation"
    REQUEST_INFO = "request_info"
    ESCALATE_REPORT = "escalate_report"
    INITIATE_RESPONSE = "initiate_response"

def calculate_deterministic_score(
    t_visible: float,
    t_detect: float,
    selected_class: TrainingClassification,
    expected_class: TrainingClassification,
    selected_action: TrainingResponseAction,
    expected_action: TrainingResponseAction,
    t_response: float,
) -> dict:
    # 1. Detection Latency (30%)
    latency = max(0.0, t_detect - t_visible)
    detection_score = max(0.0, 100.0 * (1.0 - (latency / 10.0)))

    # 2. Classification Accuracy (30%)
    if selected_class == expected_class:
        class_score = 100.0
    elif (selected_class == TrainingClassification.POTENTIAL_CONCERN and 
          expected_class == TrainingClassification.SIMULATED_THREAT):
        class_score = 60.0
    else:
        class_score = 0.0

    # 3. Decision SOP Match (30%)
    decision_score = 100.0 if selected_action == expected_action else 40.0

    # 4. Response Speed (10%)
    decision_latency = max(0.0, t_response - t_detect)
    speed_score = max(0.0, 100.0 * (1.0 - (decision_latency / 15.0)))

    # Composite Final Score
    final_score = (
        0.30 * detection_score +
        0.30 * class_score +
        0.30 * decision_score +
        0.10 * speed_score
    )

    letter_grade = "A" if final_score >= 85.0 else ("B" if final_score >= 70.0 else "C")

    return {
        "detection_latency": latency,
        "detection_score": detection_score,
        "classification_score": class_score,
        "decision_score": decision_score,
        "speed_score": speed_score,
        "final_score": round(final_score, 2),
        "letter_grade": letter_grade,
    }

def test_perfect_scenario():
    res = calculate_deterministic_score(
        t_visible=10.0,
        t_detect=10.0,  # 0.0s latency -> 100 pts
        selected_class=TrainingClassification.SIMULATED_THREAT,
        expected_class=TrainingClassification.SIMULATED_THREAT,
        selected_action=TrainingResponseAction.INITIATE_RESPONSE,
        expected_action=TrainingResponseAction.INITIATE_RESPONSE,
        t_response=10.0, # 0.0s latency -> 100 pts
    )
    assert res["final_score"] == 100.0
    assert res["letter_grade"] == "A"

def test_realistic_scenario():
    res = calculate_deterministic_score(
        t_visible=15.4,
        t_detect=19.8,  # 4.4s latency -> 56 pts
        selected_class=TrainingClassification.SIMULATED_THREAT,
        expected_class=TrainingClassification.SIMULATED_THREAT,
        selected_action=TrainingResponseAction.INITIATE_RESPONSE,
        expected_action=TrainingResponseAction.INITIATE_RESPONSE,
        t_response=28.7, # 8.9s decision latency -> 40.67 pts
    )
    assert res["detection_latency"] == pytest.approx(4.4, abs=0.01)
    assert res["classification_score"] == 100.0
    assert res["decision_score"] == 100.0
    assert 75.0 <= res["final_score"] <= 90.0
