# Implementation Plan & Sprint Roadmap

## Project: Drone Threat Simulation Trainer — Phase 1 (MVP)
**Methodology**: Iterative milestones with test-driven telemetry verification.

---

## Sprint 1: Foundations & Telemetry Subsystems
**Goal**: Build the core data schemas, event bus, and scenario definition loader.

- [ ] **Task 1.1: UE5 Project Configuration**
  - Set up Unreal Engine 5.4 C++ project (`ProjectInterceptor`).
  - Configure `.uproject` plugins (Json, EnhancedInput).
  - Verify compile and headless engine startup.
- [ ] **Task 1.2: Data Models & Types (`TrainingSessionTypes.h`)**
  - Define `ETrainingEventType`, `ETrainingClassification`, `ETrainingResponseAction`, `EScenarioState`.
  - Create `FTrainingEvent` and `FScenarioDefinition` structs.
- [ ] **Task 1.3: Telemetry Event Subsystem (`UTrainingEventSubsystem`)**
  - Implement `LogEvent` with millisecond timestamps.
  - Implement dynamic delegate `OnTrainingEventLogged`.
  - Implement JSON exporter for session records.
- [ ] **Task 1.4: Unit Tests for Event Serialization**
  - Create automated test verifying event ordering and JSON format validity.

---

## Sprint 2: Core Simulation & Drone Dynamics
**Goal**: Implement the autonomous drone actor and ground-truth visibility probe.

- [ ] **Task 2.1: Drone Actor (`ADroneActor`)**
  - Attach `USplineComponent` for flight trajectory pathing.
  - Implement constant/variable velocity movement along the spline curve.
  - Add audio component with spatialized propeller loop sound.
- [ ] **Task 2.2: Ground-Truth Visibility Detection System**
  - Implement raycasting line-of-sight checks against observer camera.
  - Add angular subtense threshold check (minimum visual resolvable size).
  - Dispatch ground-truth `DRONE_VISIBLE` event when first observed unobstructed.
- [ ] **Task 2.3: Scenario Manager State Machine (`AScenarioManager`)**
  - Implement state lifecycle: `Standby` → `Running` → `DroneVisible` → `Detected` → `Completed`.
  - Handle drone spawn timing and scenario timeout triggers.

---

## Sprint 3: Player Observation & Tactical HUD
**Goal**: Create first-person observation controls and the tactical heads-up display.

- [ ] **Task 3.1: Observation Pawn (`ATrainingPawn`)**
  - Smooth camera yaw/pitch rotation.
  - Binocular zoom / magnification toggle with post-process vignette.
  - Bind "Mark Detection" action (`Spacebar` / Gamepad button).
- [ ] **Task 3.2: Tactical HUD (`UTrainingHUDWidget`)**
  - Top compass / bearing tape showing azimuth angle.
  - Mission elapsed time counter.
  - High-contrast Detection Button with audio click feedback.
  - Status indicator (Scanning / Object Detected).

---

## Sprint 4: Classification, Decision & Scoring Engine
**Goal**: Complete the decision-making loop and deterministic scoring calculation.

- [ ] **Task 4.1: Classification Modal (`UClassificationModalWidget`)**
  - 4 categories: `Benign`, `Unknown`, `Potential Concern`, `Simulated Threat`.
  - Confidence slider / discrete selector (50%, 75%, 100%).
  - Logs `CLASSIFICATION_SUBMITTED` event.
- [ ] **Task 4.2: Decision Modal (`UDecisionModalWidget`)**
  - 4 actions: `Continue Observation`, `Request Info`, `Escalate/Report`, `Initiate Response`.
  - Logs `RESPONSE_SELECTED` event.
- [ ] **Task 4.3: Deterministic Scoring Subsystem (`UScoringSubsystem`)**
  - Implement detection latency scoring (30% weight).
  - Implement classification accuracy scoring (30% weight).
  - Implement decision quality scoring (30% weight).
  - Implement overall response latency scoring (10% weight).
  - Generate final `FTrainingScoreResult`.

---

## Sprint 5: Results Screen, Environment & Day/Night Polish
**Goal**: Deliver the end-of-mission screen, polished rural/semi-industrial level, and day/night toggling.

- [ ] **Task 5.1: Results & Timeline Screen (`UResultsScreenWidget`)**
  - Display score summary card (0-100 score + letter grade).
  - Visual breakdown of latency and accuracy components.
  - Interactive horizontal timeline plotting:
    `DRONE_VISIBLE` ➔ `PLAYER_DETECTION` ➔ `CLASSIFIED` ➔ `DECISION`.
- [ ] **Task 5.2: Rural / Semi-Industrial Environment**
  - Build basic terrain, roads, fences, warehouse structures, and foliage sightlines.
  - Tune drone flight path through natural occlusion geometry.
- [ ] **Task 5.3: Day / Night Lighting Profiles**
  - Configure directional sun, skylight, and post-process volume for Day preset.
  - Configure moonlit / high-contrast night preset with increased detection difficulty.
- [ ] **Task 5.4: End-to-End Verification**
  - Complete 5 consecutive runs validating repeatable scores and JSON telemetry export.
