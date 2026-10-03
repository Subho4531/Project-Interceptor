# AGENTS.md — Project Interceptor (Drone Threat Simulation Trainer)

This file defines the project constitution, multi-agent engineering architecture, and operational standards for AI coding agents operating on this repository.

---

## 🎯 Project Overview
**Drone Threat Simulation Trainer — MVP (Phase 1)**  
A high-performance 3D web simulation built with **PlayCanvas Engine (WebGL2 / WebGPU), TypeScript, React 19, and Tailwind CSS**. Trainees enter a photorealistic PBR tactical compound with free-roam first-person controls, detect an incoming aerial drone flying along a realistic trajectory, classify it, select an abstract operational response, and receive a deterministic performance score based on latency and accuracy.

**Core Loop**:  
`Scenario -> Observation -> Detection -> Classification -> Decision -> Scoring -> Result`

---

## ⛔ Enforced Engineering & Aesthetic Guardrails

All coding agents operating on this repository MUST strictly follow these rules:

1. **NO Procedural 3D Objects**:
   - Never generate procedural 3D primitives (boxes, cylinders, spheres) on the fly as standalone objects or placeholders.
   - All 3D geometry must be imported from validated PBR assets (`.glb` / `.gltf`) specified in [`docs/ASSET_MANIFEST.md`](docs/ASSET_MANIFEST.md).

2. **NO Procedural Maps — Always Import Real Environments**:
   - Do not generate algorithmic terrain grids or random low-poly maps in code.
   - Always import real terrain meshes, satellite PBR texture packs, and real HDR environment maps.

3. **NO Arcade Status Indicators (No Saturated Green/Red Traffic Lights)**:
   - Eliminate toyish, high-saturation bright green (`#00FF00`) and red (`#FF0000`) buttons or badges.
   - Enforce a professional, defense-grade tactical palette:
     * Deep tactical slate / void: `#080C13` with `backdrop-blur-md bg-slate-950/85`
     * Subtle structural borders: `#1E293B`
     * Subdued operational cyan: `#00E5FF` (telemetry readouts, bearing coordinates)
     * Muted tactical amber: `#D97706` / `#F59E0B` (advisory status, scanning)
     * Desaturated threat crimson: `#BE123C` / `#E11D48` (confirmed threat classification)

4. **Professional Aerospace / Defense UI Graphics**:
   - Monospaced technical typography (`JetBrains Mono`, `Rajdhani`, `Inter`).
   - Clean, razor-sharp vector crosshairs, bearing tapes, and coordinate readouts.
   - Minimal visual clutter; maximize trainee observational sightlines.

5. **Brevity & Conciseness (Be Less Verbal)**:
   - Provide crisp, technical, direct responses with zero conversational fluff.
   - Output structured diffs, exact commands, and direct status updates.

---

## 📚 Key Project Documents

All agents must consult the authoritative documentation in `docs/`:
* **[`docs/PRD.md`](docs/PRD.md)** — Complete Product Requirements Document & Feature Specs.
* **[`docs/ASSET_MANIFEST.md`](docs/ASSET_MANIFEST.md)** — Explicit 3D models, textures, and audio manifests required to start work.
* **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)** — PlayCanvas Architecture, ECS Modules, Telemetry & Scoring formulas.
* **[`docs/VIBECODING_GUIDE.md`](docs/VIBECODING_GUIDE.md)** — Agent Prompting Guide, Tactical UI Aesthetics, and Guardrails.
* **[`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md)** — Sprint-by-sprint task checklist and acceptance criteria.

---

## 🤖 Multi-Agent Team Architecture (PlayCanvas Core)

```
                         ┌────────────────────────────────────┐
                         │   Antigravity Root Orchestrator    │
                         └─────────────────┬──────────────────┘
                                           │
         ┌─────────────────────────────────┴─────────────────────────────────┐
         │                                                                   │
┌────────▼────────────────────────┐                       ┌──────────────────▼───────────────────┐
│   PLAYCANVAS & 3D CORE TEAM     │                       │   TELEMETRY & QA SPECIALISTS         │
├─────────────────────────────────┤                       ├──────────────────────────────────────┤
│ • playcanvas_engine_lead        │                       │ • telemetry_scoring_lead             │
│ • simulation_kinematics_lead    │                       │ • qa_test_engineer                   │
│ • frontend_tactical_lead        │                       └──────────────────────────────────────┘
└────────────────┬────────────────┘
                 │ (Spawns on demand for parallel flow)
┌────────────────▼────────────────┐
│       junior_ts_worker          │
└─────────────────────────────────┘
```

### 1. Senior Engineering Roles
* **PlayCanvas Engine Lead (`playcanvas_engine_lead`)**: `pc.Application` configuration, clustered forward lighting, cascaded PCF5 shadows, physical sky, PBR materials, and free-roam FPS camera script.
* **Simulation Kinematics Lead (`simulation_kinematics_lead`)**: 3D Catmull-Rom spline flight paths, realistic banking/pitch aerodynamics, rotor spin animation, and ground-truth visibility probe (`pc.Frustum` + raycast + angular subtense).
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
   * **Rule**: Zero React or PlayCanvas imports in `src/simulation/`. 100% headless testable via Vitest.
2. **PlayCanvas Engine ONLY for 3D Scene Graph & ECS (`src/playcanvas/`)**:
   * Application bootstrap, camera controller scripts, GLB mesh instances, PBR materials, clustered lights, and shadows.
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
  * Detection Latency: **30%** (Linear decay up to $T_{\max}$ threshold)
  * Classification Accuracy: **30%** (100 exact, 60 adjacent caution, 0 miss)
  * Decision SOP Match: **30%** (100 SOP match, scaled penalties for under/over escalation)
  * Response Latency: **10%** (Decision speed from detection to action selection)
