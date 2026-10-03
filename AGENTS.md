# AGENTS.md — Project Interceptor (Drone Threat Simulation Trainer)

This file defines the project constitution, coding guidelines, and operational standards for AI coding agents (Antigravity, Cursor, Claude Code, etc.) working on this repository.

---

## 🎯 Project Overview
**Drone Threat Simulation Trainer — MVP (Phase 1)**  
A lightweight 3D desktop simulation built in Unreal Engine 5 (C++ / Blueprints). Trainees observe a virtual environment, detect an incoming drone, classify it, select an abstract response, and receive a deterministic score based on latency and accuracy.

**Core Loop**:  
`Scenario -> Observation -> Detection -> Classification -> Decision -> Scoring -> Result`

---

## 📚 Key Project Documents

All agents must consult the following authoritative documents in `docs/`:
* **[`docs/PRD.md`](docs/PRD.md)** — Complete Product Requirements Document & Feature Specs.
* **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)** — Subsystems, C++ Class Hierarchy, Telemetry & Scoring formulas.
* **[`docs/VIBECODING_GUIDE.md`](docs/VIBECODING_GUIDE.md)** — Agent Prompting Guide, Tactical UI Aesthetics, and Guardrails.
* **[`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md)** — Sprint-by-sprint task checklist and acceptance criteria.

---

## 🧱 The "Iron Separation" Rule (Strict)

To ensure this project remains cleanly maintainable and editable by AI coding agents:

1. **C++ ONLY for Core Logic & Intelligence**:
   * `AScenarioManager` (State machine, lifecycle, timers)
   * `UTrainingEventSubsystem` (Event bus, JSON export, microsecond telemetry)
   * `UScoringSubsystem` (Deterministic mathematical evaluation)
   * `ADroneActor` flight calculations & raycast visibility checks
   * Data schemas, structs, and enums
2. **Blueprints / UMG ONLY for Presentation & Art**:
   * Widget styling, layout anchors, typography, animations
   * Material instances, lighting presets (Day / Night), post-processing
   * Particle effects, audio spatialization cues, level actor placement

> [!WARNING]
> DO NOT construct complex game logic or state machines inside Blueprint node graphs. Keep logic in C++ and expose clean `BlueprintCallable` / `BlueprintNativeEvent` interfaces for visual hooks.

---

## 📊 Telemetry Contract

Every scenario run must log the following 7 events in strict chronological order with microsecond timestamps:
1. `SCENARIO_STARTED`
2. `DRONE_SPAWNED`
3. `DRONE_VISIBLE` (Ground truth: unobstructed raycast + FOV check)
4. `PLAYER_DETECTION` (Trainee input: Mark Detection)
5. `CLASSIFICATION_SUBMITTED` (Trainee input: Benign / Unknown / Concern / Threat)
6. `RESPONSE_SELECTED` (Trainee input: Observe / Info / Escalate / Engage)
7. `SCENARIO_COMPLETED`

---

## 🧮 Scoring Engine Rule

* Scoring is **100% deterministic** in Phase 1 (no non-deterministic AI in the evaluation loop).
* Weights:
  * Detection Latency: **30%**
  * Classification Accuracy: **30%**
  * Decision SOP Match: **30%**
  * Response Latency: **10%**
