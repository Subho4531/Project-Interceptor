---
name: sim-telemetry-scoring
description: Simulation telemetry bus and deterministic scoring engine. Implements microsecond event logging, JSON schemas, detection latency decay curves, classification matrices, and automated test harnesses.
---

# Simulation Telemetry & Deterministic Scoring Skill

This skill provides mathematical formulas, event contracts, and evaluation logic for deterministic training simulations.

---

## 1. Telemetry Event Contract

Every scenario run must log the following 7 events in strict chronological order:
1. `SCENARIO_STARTED`
2. `DRONE_SPAWNED`
3. `DRONE_VISIBLE` (Ground truth: unobstructed raycast + FOV check)
4. `PLAYER_DETECTION` (Trainee input: Mark Detection)
5. `CLASSIFICATION_SUBMITTED` (Trainee input: Benign / Unknown / Concern / Threat)
6. `RESPONSE_SELECTED` (Trainee input: Observe / Info / Escalate / Engage)
7. `SCENARIO_COMPLETED`

---

## 2. Deterministic Scoring Mathematical Formulas

The total score $S_{\text{total}} \in [0, 100]$ is computed as:

$$S_{\text{total}} = 0.30 \cdot S_{\text{detect}} + 0.30 \cdot S_{\text{class}} + 0.30 \cdot S_{\text{decision}} + 0.10 \cdot S_{\text{speed}}$$

### 2.1 Detection Latency ($S_{\text{detect}}$)
Let $\Delta t_{\text{detect}} = t_{\text{PLAYER\_DETECTION}} - t_{\text{DRONE\_VISIBLE}}$.  
Given maximum acceptable threshold $T_{\max} = 10.0\text{ seconds}$:

$$S_{\text{detect}} = \max\left(0.0, 100.0 \cdot \left(1.0 - \frac{\Delta t_{\text{detect}}}{T_{\max}}\right)\right)$$

If the player never detects the drone before the scenario ends, $S_{\text{detect}} = 0.0$.

### 2.2 Classification Accuracy ($S_{\text{class}}$)
Evaluated against the ground-truth threat status using a stepped matrix:

| Actual \ Selected | Benign | Unknown | Potential Concern | Simulated Threat |
| :--- | :--- | :--- | :--- | :--- |
| **Simulated Threat** | 0 pts | 25 pts | 60 pts | 100 pts |
| **Potential Concern** | 25 pts | 50 pts | 100 pts | 75 pts |
| **Unknown** | 50 pts | 100 pts | 50 pts | 25 pts |
| **Benign** | 100 pts | 50 pts | 25 pts | 0 pts |

### 2.3 Decision SOP Match ($S_{\text{decision}}$)
Evaluated against expected Standard Operating Procedure (SOP):
- Exact SOP Match: $100$ pts
- Cautious Step (e.g. Escalate vs Engage): $60$ pts
- Inappropriate Action (Under-escalation or Reckless Action): $0 - 20$ pts

### 2.4 Response Latency ($S_{\text{speed}}$)
Let $\Delta t_{\text{decision}} = t_{\text{RESPONSE\_SELECTED}} - t_{\text{PLAYER\_DETECTION}}$.  
Given target window $T_{\text{target}} = 15.0\text{s}$:

$$S_{\text{speed}} = \max\left(0.0, 100.0 \cdot \left(1.0 - \frac{\Delta t_{\text{decision}}}{T_{\text{target}}}\right)\right)$$

---

## 3. C++ Pure Scoring Implementation

```cpp
struct FTrainingScoreResult
{
    float DetectionScore = 0.0f;
    float ClassificationScore = 0.0f;
    float DecisionScore = 0.0f;
    float SpeedScore = 0.0f;
    float FinalScore = 0.0f;
    FString LetterGrade;
    float DetectionLatencySeconds = 0.0f;
    float DecisionLatencySeconds = 0.0f;
};

FTrainingScoreResult CalculateScore(
    float DroneVisibleTime,
    float PlayerDetectTime,
    ETrainingClassification SelectedClass,
    ETrainingClassification ExpectedClass,
    ETrainingResponseAction SelectedAction,
    ETrainingResponseAction ExpectedAction,
    float ResponseSubmitTime)
{
    FTrainingScoreResult Result;
    
    // 1. Detection Latency
    Result.DetectionLatencySeconds = FMath::Max(0.0f, PlayerDetectTime - DroneVisibleTime);
    Result.DetectionScore = FMath::Clamp(100.0f * (1.0f - (Result.DetectionLatencySeconds / 10.0f)), 0.0f, 100.0f);

    // 2. Classification
    Result.ClassificationScore = (SelectedClass == ExpectedClass) ? 100.0f : 
        (IsAdjacentClassification(SelectedClass, ExpectedClass) ? 60.0f : 0.0f);

    // 3. Decision
    Result.DecisionScore = (SelectedAction == ExpectedAction) ? 100.0f : 40.0f;

    // 4. Response Speed
    Result.DecisionLatencySeconds = FMath::Max(0.0f, ResponseSubmitTime - PlayerDetectTime);
    Result.SpeedScore = FMath::Clamp(100.0f * (1.0f - (Result.DecisionLatencySeconds / 15.0f)), 0.0f, 100.0f);

    // Composite
    Result.FinalScore = (0.30f * Result.DetectionScore) +
                        (0.30f * Result.ClassificationScore) +
                        (0.30f * Result.DecisionScore) +
                        (0.10f * Result.SpeedScore);

    if (Result.FinalScore >= 90.0f) Result.LetterGrade = TEXT("A");
    else if (Result.FinalScore >= 80.0f) Result.LetterGrade = TEXT("B");
    else if (Result.FinalScore >= 70.0f) Result.LetterGrade = TEXT("C");
    else Result.LetterGrade = TEXT("F");

    return Result;
}
```
