# Implementation Plan & Multi-Phase Roadmap (SIH26247 Compliant)

## Project: AI-Enabled Drone & Counter-Drone Threat Simulation Trainer (Project Interceptor)
**Stack**: React 19, TypeScript, React Three Fiber (R3F), Three.js, Vite, Tailwind CSS v4, Zustand.

---

## 🗺️ Multi-Phase Strategic Overview

```
Phase 1: MVP Core Simulation Loop (Sprints 1 – 5)  ◄ CURRENT ACTIVE SPRINT
├── Desktop 3D WebGL in browser / Codespaces at 60+ FPS
├── Free-roam FPS patrol observer with 3x optical binocular zoom
├── Rural / semi-industrial compound with natural occlusion geometry
├── Day / Night environmental lighting presets
├── Single-drone Catmull-Rom 3D spline trajectory
├── Microsecond ground-truth visibility probe (raycasting + angular subtense)
├── 4-tier threat classification & SOP engagement decision modals
├── Deterministic decision-tree scoring engine (100% mathematical)
└── Results screen with interactive horizontal AAR event timeline

Phase 2: Tactical Swarms, Sensors & Trainee Profiles (Sprints 6 – 8)
├── Multi-drone swarm formations (V-formation, trail, scattered attack vectors)
├── Degraded sensor simulation (optical noise, thermal clutter, EMI feed jitter)
├── Adjustable difficulty profiles (Recruit, Operator, Specialist)
├── Trainee profile management & persistent IndexedDB session storage
└── Cross-session comparative AAR dashboard with historical trend analytics

Phase 3: AI Procedural Engine, Urban Terrain & WebXR (Sprints 9 – 11)
├── Procedural scenario generator (algorithmic corridor synthesis)
├── Dense Urban tactical terrain with vertical canyon challenges
├── WebXR / VR immersive mode (@react-three/xr) for VR headsets
├── Unit / Squad aggregated readiness reporting
└── LLM-powered personalized after-action debrief narrative
```

---

## Phase 1: MVP Sprints (Current Execution Target)

### Sprint 1: Project Scaffolding & Headless Simulation Core
**Goal**: Initialize the Vite + React + Three.js project, implement headless TypeScript simulation core, telemetry bus, and deterministic scoring unit tests.

- [ ] **Task 1.1: Web Project Initialization**
  - Initialize Vite + React 19 + TypeScript project.
  - Install dependencies: `three`, `@types/three`, `@react-three/fiber`, `@react-three/drei`, `zustand`, `lucide-react`, `tailwindcss`.
  - Configure Tailwind CSS and path aliases (`@/*`).
- [ ] **Task 1.2: Core Data Types (`src/simulation/types.ts`)**
  - Define `TrainingEventType`, `TrainingClassification`, `TrainingResponseAction`, `ScenarioState`, `DifficultyTier`.
  - Create interfaces: `TrainingEvent`, `ScenarioDefinition`, `ScoreResult`, `TraineeProfile`.
- [ ] **Task 1.3: Telemetry Logger (`src/simulation/TelemetryLogger.ts`)**
  - High-precision timestamp recording (`performance.now()`).
  - Pub/sub event listener subscription pattern for UI reactivity.
  - JSON serialization and export methods.
- [ ] **Task 1.4: Deterministic Scoring Engine (`src/simulation/ScoringEngine.ts`)**
  - Implement formulas: 30% detection latency, 30% classification, 30% decision SOP, 10% response speed.
  - Vitest test suite verifying exact score computations.
- [ ] **Task 1.5: Zustand Store Bridge (`src/store/useSimulationStore.ts`)**
  - Connect headless core to reactive store for HUD updates (bearing, timer, events, modal states).

---

### Sprint 2: 3D Viewport, Camera Rig & FPS Controls
**Goal**: Build the 3D viewport canvas, free-roaming FPS controller with ground collision, and smooth optical binocular zoom.

- [ ] **Task 2.1: Simulation Canvas & Lighting (`SimulationCanvas.tsx`)**
  - Setup R3F `<Canvas>` with perspective camera, tone mapping (ACESFilmic), and antialiasing.
  - Setup directional sun, ambient light, and sky dome.
- [ ] **Task 2.2: Free-Roam FPS Controller (`FPSController.tsx`)**
  - Integrate Three.js `PointerLockControls` for mouse pitch/yaw.
  - Implement WASD movement with velocity acceleration and damping.
  - Implement downward raycaster against terrain keeping player eye level at $y = 1.75\text{m}$.
  - Continuously update azimuth bearing ($0^\circ - 360^\circ$) in Zustand store.
- [ ] **Task 2.3: Optical Zoom Rig (`OpticalZoomRig.tsx`)**
  - Right-click / Shift smoothly interpolates camera FOV from $75^\circ$ down to $25^\circ$ ($3\times$ optical zoom).
  - Activate tactical vignette and reticle crosshair magnification overlay.

---

### Sprint 3: Drone Flight Kinematics & Visibility Raycaster
**Goal**: Implement the drone entity moving along a 3D CatmullRom spline and ground-truth optical visibility probe.

- [ ] **Task 3.1: Drone Entity Component (`DroneActor.tsx`)**
  - Construct 3D spline trajectory using Three.js `CatmullRomCurve3`.
  - Animate position and tangent orientation along the curve in `useFrame`.
  - Add rotating quadcopter propeller meshes and spatial audio hum.
  - Fire `DRONE_SPAWNED` and `SCENARIO_COMPLETED` events.
- [ ] **Task 3.2: Ground-Truth Visibility Detection (`VisibilityProbe.ts`)**
  - Frustum containment check: `frustum.containsPoint(dronePos)`.
  - Angular subtense calculation: $\theta \ge 0.05^\circ$ thresholding.
  - Multi-point raycasting (Center, Top, Bottom) against terrain and building colliders using Three.js `Raycaster`.
  - Dispatch ground-truth `DRONE_VISIBLE` event on first unobstructed detection frame.

---

### Sprint 4: Tactical HUD & Decision Modals
**Goal**: Create the responsive military-grade heads-up display overlay and interactive decision modals.

- [ ] **Task 4.1: Tactical HUD Overlay (`TacticalHUD.tsx`)**
  - Full-screen `pointer-events-none` container with glassmorphism widgets.
  - Elapsed scenario mission timer at top-right.
  - Real-time azimuth/elevation coordinate telemetry.
- [ ] **Task 4.2: Dynamic Compass Heading Tape (`CompassTape.tsx`)**
  - Horizontal scrolling ribbon showing $0^\circ - 360^\circ$ with cardinal markers (`N`, `E`, `S`, `W`).
  - Smoothly tracks camera yaw rotation.
- [ ] **Task 4.3: Reticle & Primary Detection Button (`MarkDetectionBtn.tsx`)**
  - Central tactical crosshair with status indicator (`SCANNING` / `TARGET ACQUIRED`).
  - Prominent detection button bound to `Spacebar`.
  - Logs `PLAYER_DETECTION` event and calculates detection latency.
- [ ] **Task 4.4: Classification & Decision Modals**
  - `ClassificationModal.tsx`: 4 threat categories with confidence slider; logs `CLASSIFICATION_SUBMITTED`.
  - `DecisionModal.tsx`: 4 SOP actions; logs `RESPONSE_SELECTED`.

---

### Sprint 5: PBR Environment, Day/Night Lighting & Results Screen
**Goal**: Build the rural/semi-industrial perimeter, Day/Night lighting presets, and After-Action Review results screen.

- [ ] **Task 5.1: Rural / Semi-Industrial 3D Environment**
  - Procedural/textured ground terrain with access road.
  - Perimeter fences, industrial warehouse buildings, and utility poles providing natural line-of-sight occlusion.
- [ ] **Task 5.2: Day / Night Lighting Presets**
  - Day Preset: Bright directional sunlight, clear sky dome, crisp shadows.
  - Night Preset: Moonlit low-light atmosphere, high-contrast spotlighting, elevated detection challenge.
- [ ] **Task 5.3: Results Screen & Interactive Timeline (`ResultsScreen.tsx`)**
  - Mission summary card with final score ($0-100$), letter grade, and latency breakdown.
  - Interactive horizontal chronological timeline visualizer plotting all 7 events with delta callouts.
  - One-click "Export Telemetry JSON" download button.
  - Scenario restart button.
- [ ] **Task 5.4: End-to-End Test & Verification**
  - Complete 5 full test runs in browser / Codespaces verifying 60+ FPS and telemetry accuracy.

---

## Phase 2: Tactical Swarms & Profiles (Future Sprints 6 – 8)

- **Sprint 6: Swarm Formations (`SwarmManager.ts`)**: Coordinated multi-drone flight along synchronized formation offsets (V-formation, Trail, Scattered).
- **Sprint 7: Degraded Sensors & Difficulty Tiers**: Sensor noise shader, thermal clutter simulation, and Recruit / Operator / Specialist parameter modulators.
- **Sprint 8: Trainee Profiles & AAR Dashboard**: IndexedDB session persistence, historical trend charts, and recurring error identification.

---

## Phase 3: AI Procedural Engine & WebXR (Future Sprints 9 – 11)

- **Sprint 9: Procedural Scenario Generator**: Algorithmic flight corridor and randomized threat synthesis to permanently eliminate rote memorization.
- **Sprint 10: Urban Tactical Terrain**: Multi-story urban environment with vertical canyons and rooftop vantage points.
- **Sprint 11: WebXR VR Headset Mode & LLM AAR**: Stereoscopic WebXR controller support via `@react-three/xr` and AI debriefing report generator.
