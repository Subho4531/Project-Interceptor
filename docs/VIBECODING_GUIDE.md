# Vibecoding Playbook & Agent Guidelines (Three.js WebGL Architecture)

## Project: Drone Threat Simulation Trainer
**Philosophy**: Architect in pure TypeScript, render via React Three Fiber (R3F), style tactical HUD in Tailwind CSS, steer via targeted Agent Prompts.

---

## 1. What is "Vibecoding" in Three.js & Simulation?

Vibecoding is high-leverage development where:
1. **You steer**: Define data contracts, high-level architecture, tactile aesthetic targets ("vibes"), and acceptance criteria.
2. **AI Agents code**: The agent generates production-grade TypeScript simulation classes, Three.js scene components, GLTF model loaders, Zustand stores, and Tailwind tactical HUDs.
3. **You verify**: Instant hot-reload in any desktop browser (local Vite server or GitHub Codespaces) with zero 100GB engine installation or compilation delay.

---

## 2. The Iron Separation Rule

> [!IMPORTANT]
> **Keep simulation intelligence strictly decoupled from React render loops!**  
> Never bury flight kinematics, line-of-sight raycasts, or scoring formulas inside deeply nested React components.

| System Domain | Language / Tool | Rationale |
| :--- | :--- | :--- |
| **Simulation Core & State Machine** | **Pure TypeScript** (`ScenarioManager.ts`) | Clean state transitions, 100% testable via Vitest headless tests. |
| **Telemetry & Event Bus** | **Pure TypeScript** (`TelemetryLogger.ts`) | Immutable event records, microsecond precision, JSON serialization. |
| **Scoring Formula** | **Pure TypeScript** (`ScoringEngine.ts`) | Deterministic mathematical functions, unit tests. |
| **Reactive Store Bridge** | **Zustand** (`useSimulationStore.ts`) | Atomic UI updates without unnecessary re-renders of the 3D canvas. |
| **3D Rendering & Lighting** | **React Three Fiber** (`@react-three/drei`, `three`) | Declarative 3D scene graph, PBR shaders, HDRI lighting. |
| **Camera & Controls** | **Three.js** (`PointerLockControls`) | Free-roam FPS navigation, ground collision raycast, smooth optical zoom. |
| **Tactical HUD & Modals** | **React 19 + Tailwind CSS** | Monospaced typography, glassmorphism, responsive compass tape & reticle. |

---

## 3. Tactical Aesthetic Guidelines ("The Vibe")

The simulation should feel like a **modern defense tactical training console**:

* **Color Palette**:
  * Background / Glass: Deep slate / Charcoal (`#080C13` with `backdrop-blur-md bg-slate-950/80`)
  * Border Trim: `#1E293B` (Subtle 1px tactical borders)
  * Status Nominal / Cyan: `#00F0FF` (Telemetry readouts, bearing indicators)
  * Active Radar / Emerald: `#00FF88` (Confirmed detection, friendly targets)
  * Advisory / Amber: `#FFB300` (Potential concern, unknown classification)
  * Critical Alarm / Coral: `#FF2A55` (Simulated threat, immediate escalation)
* **Typography**:
  * Headers & Numeric Tapes: Monospaced uppercase with letter-spacing (`JetBrains Mono`, `Rajdhani`, or `Inter`)
  * Data labels: 10-12pt muted slate (`#64748B`), values: 14-18pt bright cyan or amber.
* **HUD Layout**:
  * Dynamic compass heading tape at the top center.
  * Elapsed mission timer at top-right.
  * Primary **MARK DETECTION** button or keyboard binding (`Spacebar`).
  * Minimalist crosshair / reticle with angular coordinate readouts and zoom vignette.
* **Audio Feedback**:
  * Positional drone propeller hum via Three.js `PositionalAudio` or Web Audio API.
  * Tactile mechanical click on detection mark.
  * Tactical alert chimes on classification and decision modals.

---

## 4. Agent Prompts Library (Copy-Paste Prompts)

### Prompt 1: Headless Simulation Core & Telemetry
```markdown
Context: Three.js Drone Threat Simulation Trainer in TypeScript.
Task: Create the headless simulation core: types.ts, TelemetryLogger.ts, and ScoringEngine.ts.
Requirements:
1. Define TrainingEvent interface with eventId, sessionId, scenarioId, timestamp, eventType, and data.
2. Implement TelemetryLogger supporting the 7 core events, microsecond timing, and JSON export.
3. Implement ScoringEngine calculating 30% detection latency, 30% classification, 30% decision SOP, and 10% response speed.
4. Export pure TypeScript functions with zero React or DOM dependencies.
```

### Prompt 2: Drone Entity with CatmullRomCurve3 Spline
```markdown
Context: React Three Fiber (R3F) Drone Component.
Task: Implement DroneActor.tsx moving along a 3D spline trajectory.
Requirements:
1. Accept waypoints (Vector3[]), speedMps, and onComplete callback.
2. Animate drone position and orientation along CatmullRomCurve3 in useFrame(state, delta).
3. Add spinning quadcopter rotor meshes and position audio emitter.
4. Expose drone world position ref for visibility raycasting.
```

### Prompt 3: Free-Roam FPS Controller with PointerLockControls
```markdown
Context: React Three Fiber FPS Controls.
Task: Implement FPSController.tsx with ground collision and optical zoom.
Requirements:
1. Integrate PointerLockControls for mouse pitch/yaw look.
2. Support WASD keyboard navigation with velocity acceleration and ground raycasting.
3. Implement smooth optical zoom (Right Click / Shift) interpolating camera FOV between 75° and 25°.
4. Sync camera bearing (azimuth degrees 0-360) and pitch to Zustand store.
```

### Prompt 4: Tactical HUD & Compass Tape
```markdown
Context: React 19 + Tailwind CSS Tactical HUD.
Task: Create TacticalHUD.tsx, CompassTape.tsx, and ReticleOverlay.tsx.
Requirements:
1. CompassTape renders a 360-degree horizontal tape with cardinal directions (N, E, S, W) centered on current camera azimuth.
2. ReticleOverlay renders a minimalist tactical crosshair with elevation/azimuth coordinates and binocular zoom vignette.
3. MarkDetectionBtn triggers DETECTION event with audio click feedback and visual status change.
```

---

## 5. Coding Agent Quality Checklist

Before committing code written by an agent, verify:
- [ ] **Zero DOM in Simulation Core**: `src/simulation/` contains only pure TypeScript and Three.js math classes.
- [ ] **Frame-Rate Independent Math**: All movement and physics multiply by `delta` seconds in `useFrame`.
- [ ] **Clean Asset Preloading**: GLTF models and HDRI textures use `@react-three/drei`'s `useGLTF.preload` and `useEnvironment`.
- [ ] **Responsive Full-Viewport Layout**: HUD uses `pointer-events-none` container with `pointer-events-auto` on interactive buttons.
- [ ] **Telemetry Integrity**: All 7 lifecycle events trigger chronologically in the console and export cleanly to JSON.
