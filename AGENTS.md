# AGENTS.md — Project Interceptor (Drone Threat Simulation Trainer)

This file defines the project constitution, multi-agent engineering architecture, and operational standards for AI coding agents operating on this repository.

---

## 🎯 Project Overview
**Drone Threat Simulation Trainer — MVP (Phase 1)**  
A high-performance 3D web simulation built with **Three.js, React Three Fiber (R3F), TypeScript, and Tailwind CSS**. Trainees enter a 3D environment with free-roam first-person controls, detect an incoming aerial drone, classify it, select an abstract operational response, and receive a deterministic performance score based on latency and accuracy.

**Core Loop**:  
`Scenario -> Observation -> Detection -> Classification -> Decision -> Scoring -> Result`

---

## 📚 Key Project Documents

All agents must consult the authoritative documentation in `docs/`:
* **[`docs/PRD.md`](docs/PRD.md)** — Complete Product Requirements Document & Feature Specs.
* **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)** — Three.js WebGL Architecture, Module Hierarchy, Telemetry & Scoring formulas.
* **[`docs/VIBECODING_GUIDE.md`](docs/VIBECODING_GUIDE.md)** — Agent Prompting Guide, Tactical UI Aesthetics, and Guardrails.
* **[`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md)** — Sprint-by-sprint task checklist and acceptance criteria.

---

## 🤖 Multi-Agent Team Architecture (Three.js WebGL Core)

```
                         ┌────────────────────────────────────┐
                         │   Antigravity Root Orchestrator    │
                         └─────────────────┬──────────────────┘
                                           │
         ┌─────────────────────────────────┴─────────────────────────────────┐
         │                                                                   │
┌────────▼────────────────────────┐                       ┌──────────────────▼───────────────────┐
│     THREE.JS ENGINEERING CORE   │                       │   TELEMETRY & QA SPECIALISTS         │
├─────────────────────────────────┤                       ├──────────────────────────────────────┤
│ • webgl_threejs_lead            │                       │ • telemetry_scoring_lead             │
│ • simulation_kinematics_lead    │                       │ • qa_test_engineer                   │
│ • frontend_tactical_lead        │                       └──────────────────────────────────────┘
└────────────────┬────────────────┘
                 │ (Spawns on demand for parallel flow)
┌────────────────▼────────────────┐
│       junior_ts_worker          │
└─────────────────────────────────┘
```

### 1. Senior Engineering Roles
* **WebGL & Three.js Lead (`webgl_threejs_lead`)**: R3F Canvas configuration, Free-roam `PointerLockControls` FPS camera, PBR shaders, HDRI lighting (Day/Night), and GLTF asset optimization.
* **Simulation Kinematics Lead (`simulation_kinematics_lead`)**: 3D `CatmullRomCurve3` spline trajectories, drone speed profiles, and Three.js `Raycaster` + Frustum ground-truth visibility probe.
* **Frontend Tactical Lead (`frontend_tactical_lead`)**: Military-grade tactical HUD (Compass tape, dynamic crosshair reticle, azimuth/elevation readouts, alert indicators, classification/decision modals, results timeline).
* **Telemetry & Scoring Lead (`telemetry_scoring_lead`)**: High-precision microsecond event stream, deterministic scoring formulas, JSON export, and browser persistence (IndexedDB).
* **QA & Systems Test Lead (`qa_test_engineer`)**: Vitest headless simulation tests, score calculation verification, and frame-rate benchmark harnesses.

---

## 🧱 The "Iron Separation" Rule (Strict)

To ensure this project remains clean, modular, and maintainable by AI coding agents:

1. **Pure TypeScript ONLY for Simulation Core & Intelligence (`src/simulation/`)**:
   * `ScenarioManager.ts` (State machine, lifecycle, timers)
   * `TelemetryLogger.ts` (Event bus, microsecond timestamps, JSON export)
   * `ScoringEngine.ts` (Deterministic mathematical evaluation)
   * `DroneKinematics.ts` & `VisibilityProbe.ts` (Trajectory math and line-of-sight checks)
   * **Rule**: Zero React or DOM imports in `src/simulation/`. 100% headless testable via Vitest.
2. **React Three Fiber ONLY for 3D Scene Graph (`src/components/3d/`)**:
   * Canvas setup, camera controllers, GLTF mesh instances, lights, shadows, and environment maps.
3. **React 19 + Tailwind CSS ONLY for Tactical HUD & UI (`src/components/ui/`)**:
   * Heads-up display overlays, typography, glassmorphism containers, modals, and results scorecard.

---

## 📊 Telemetry Contract

Every scenario run must log the following 7 events in strict chronological order with millisecond/microsecond timestamps:
1. `SCENARIO_STARTED`
2. `DRONE_SPAWNED`
3. `DRONE_VISIBLE` (Ground truth: unobstructed raycast + FOV check + angular subtense $\ge 0.05^\circ$)
4. `PLAYER_DETECTION` (Trainee input: Mark Detection / Spacebar)
5. `CLASSIFICATION_SUBMITTED` (Trainee input: Benign / Unknown / Concern / Threat)
6. `RESPONSE_SELECTED` (Trainee input: Observe / Info / Escalate / Engage)
7. `SCENARIO_COMPLETED`

---

## 🧮 Scoring Engine Rule

* Scoring is **100% deterministic** (no non-deterministic AI in Phase 1).
* Weights:
  * Detection Latency: **30%** (Linear decay up to 10.0s threshold)
  * Classification Accuracy: **30%** (100 exact, 60 adjacent caution, 0 miss)
  * Decision SOP Match: **30%** (100 SOP match, scaled penalties for under/over escalation)
  * Response Latency: **10%** (Decision speed from detection to action selection)
