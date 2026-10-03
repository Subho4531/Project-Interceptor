# Vibecoding Playbook & Agent Guidelines (PlayCanvas WebGL Engine)

## Project: Drone Threat Simulation Trainer
**Philosophy**: Architect in pure TypeScript, render with PlayCanvas Engine (Unreal-grade realism in browser), style tactical HUD in Tailwind CSS, steer via targeted Agent Prompts.

---

## 1. What is "Vibecoding" in PlayCanvas & Simulation?

Vibecoding is high-leverage development where:
1. **You steer**: Define data contracts, high-level architecture, tactile aesthetic targets ("vibes"), and acceptance criteria.
2. **AI Agents code**: The agent generates production-grade TypeScript simulation classes, PlayCanvas scene entities, GLTF model loaders, ECS scripts, Zustand stores, and Tailwind tactical HUDs.
3. **You verify**: Instant hot-reload in any desktop browser (local Vite server or GitHub Codespaces) with Unreal-grade PBR rendering and zero engine compile delays.

---

## 2. The Iron Separation Rule

> [!IMPORTANT]
> **Keep simulation intelligence strictly decoupled from engine render loops!**  
> Never bury flight kinematics, line-of-sight raycasts, or scoring formulas inside deeply nested engine components.

| System Domain | Language / Tool | Rationale |
| :--- | :--- | :--- |
| **Simulation Core & State Machine** | **Pure TypeScript** (`ScenarioManager.ts`) | Clean state transitions, 100% testable via Vitest headless tests. |
| **Telemetry & Event Bus** | **Pure TypeScript** (`TelemetryLogger.ts`) | Immutable event records, microsecond precision, JSON serialization. |
| **Scoring Formula** | **Pure TypeScript** (`ScoringEngine.ts`) | Deterministic mathematical functions, unit tests. |
| **3D Rendering & PBR Lighting** | **PlayCanvas Engine** (`playcanvas` npm) | Clustered forward lighting, physical sky, soft cascaded shadows, GLB models. |
| **Camera & Controls** | **PlayCanvas Scripts** (`FPSController.ts`) | Free-roam FPS navigation, ground collision raycast, smooth optical zoom. |
| **Tactical HUD & Modals** | **React 19 + Tailwind CSS** | Monospaced typography, glassmorphism, responsive compass tape & reticle. |

---

## 3. Defense-Grade Tactical Aesthetics & Asset Guardrails

The simulation must present a **defense-grade operational console**—never an arcade game:

* **Strict Color Restrictions (NO Toyish Red/Green Indicators)**:
  * Prohibit bright neon green (`#00FF00`) and emergency red (`#FF0000`) buttons/badges.
  * **Tactical Glass**: `#080C13` at 85% opacity (`backdrop-blur-md bg-slate-950/85`).
  * **Muted Structural Borders**: `#1E293B` (ultra-clean 1px border stroke).
  * **Operational Telemetry**: Subdued Cyan (`#00E5FF`) for bearings and digital timers.
  * **Advisory Status**: Desaturated Tactical Amber (`#D97706` / `#F59E0B`).
  * **Confirmed Threat**: Deep Crimson (`#BE123C` / `#E11D48`) used sparingly with low saturation.
* **3D Asset & Map Restrictions**:
  * **NEVER generate procedural 3D primitives** (boxes, spheres, cylinders) as object placeholders.
  * **NEVER generate procedural terrain grids in code**.
  * All 3D models (drone, buildings, fences, towers) and environment maps MUST be imported from validated PBR assets specified in [`docs/ASSET_MANIFEST.md`](ASSET_MANIFEST.md).
* **Typography & Symbology**:
  * Technical monospaced typography (`JetBrains Mono`, `Rajdhani`, `Inter`).
  * Clean vector crosshairs, bearing tapes, and coordinate readouts.
  * Zero decorative visual clutter; maximize trainee observational sightlines.
* **Verbal Restraint (Military Brevity)**:
  * Keep all communication concise, technical, and direct. Zero conversational fluff.

---

## 4. PlayCanvas Agent Prompts Library (Copy-Paste Prompts)

### Prompt 1: Headless Simulation Core & Telemetry
```markdown
Context: PlayCanvas Drone Threat Simulation Trainer in TypeScript.
Task: Create the headless simulation core: types.ts, TelemetryLogger.ts, and ScoringEngine.ts.
Requirements:
1. Define TrainingEvent interface with eventId, sessionId, scenarioId, timestamp, eventType, and data.
2. Implement TelemetryLogger supporting the 7 core events, microsecond timing, and JSON export.
3. Implement ScoringEngine calculating 30% detection latency, 30% classification, 30% decision SOP, and 10% response speed.
4. Export pure TypeScript functions with zero React or DOM dependencies.
```

### Prompt 2: PlayCanvas Application Setup & Clustered PBR Lighting
```markdown
Context: PlayCanvas standalone in Vite + TypeScript.
Task: Implement PlayCanvasApp.ts with Unreal Engine-grade visual fidelity.
Requirements:
1. Instantiate pc.Application on canvas with antialiasing and ACES tone mapping.
2. Setup directional sun with clustered lighting and 2048 cascaded soft shadows.
3. Configure ambient lighting and prefiltered environment reflections.
4. Export start(), destroy(), and scene entity attachment hooks.
```

### Prompt 3: Free-Roam FPS Controller Script
```markdown
Context: PlayCanvas FPS Camera Script.
Task: Implement FPSController.ts with ground collision and optical zoom.
Requirements:
1. PointerLockControls for mouse pitch/yaw look.
2. WASD locomotion with ground collision raycast against terrain mesh.
3. Smooth 3x optical binocular zoom interpolating camera FOV between 75° and 25°.
4. Broadcast azimuth bearing degrees (0-360) and pitch for HUD sync.
```

### Prompt 4: Drone Spline Flight & Visibility Probe Script
```markdown
Context: PlayCanvas Drone Entity & Optics Probe.
Task: Implement DroneFlight.ts and VisibilityProbeScript.ts.
Requirements:
1. Move drone GLB model along Catmull-Rom 3D waypoint curve with banking rotation.
2. Animate quadcopter rotors and emit 3D positional motor audio.
3. In VisibilityProbeScript, perform pc.Frustum check, angular subtense (>= 0.05°), and raycast occlusion check against compound colliders.
4. Trigger onDroneVisible callback upon first unobstructed line-of-sight.
```

---

## 5. Coding Agent Quality Checklist

Before committing code written by an agent, verify:
- [ ] **Zero DOM in Simulation Core**: `src/simulation/` contains only pure TypeScript classes.
- [ ] **Frame-Rate Independent Math**: All movement and physics multiply by `dt` seconds in `update(dt)`.
- [ ] **Clean Asset Preloading**: GLB models and textures load via PlayCanvas asset loader.
- [ ] **Responsive Full-Viewport Layout**: HUD uses `pointer-events-none` container with `pointer-events-auto` on interactive buttons.
- [ ] **Telemetry Integrity**: All 7 lifecycle events trigger chronologically and export cleanly to JSON.
