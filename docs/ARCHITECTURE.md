# Technical Architecture & Systems Specification (PlayCanvas Engine Architecture)

## Project: AI-Enabled Drone & Counter-Drone Threat Simulation Trainer (Project Interceptor)
**3D Engine**: PlayCanvas Engine (`playcanvas` standalone npm package, WebGL2 / WebGPU)  
**UI & Frontend Framework**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons  
**Visual Target**: Unreal Engine-Grade Realism (PBR Materials, Clustered Forward Lighting, Cascaded Shadows, Physical Sky)  
**Simulation Core**: Headless Pure TypeScript State Machine, Telemetry Bus & Scoring Engine  

---

## 1. High-Level System Architecture

```mermaid
graph TD
    subgraph Browser Client (PlayCanvas + React DOM)
        App[App Root] --> CanvasContainer[PlayCanvas Viewport Canvas]
        App --> HUD[Tactical HUD Layer<br/><i>Tailwind DOM Overlay</i>]
        
        CanvasContainer --> PCApp[pc.Application<br/><i>PlayCanvas WebGL2/WebGPU</i>]
        
        subgraph PlayCanvas Scene Graph (ECS)
            PCApp --> EnvEntity[Environment Entity<br/><i>PBR Terrain, Structures, Fences</i>]
            PCApp --> LightEntity[Lighting & Sky<br/><i>Directional Sun, Cascaded Shadows, Physical Sky</i>]
            PCApp --> PlayerEntity[Player Observer Entity<br/><i>Camera Component, FPS Script, Zoom Rig</i>]
            PCApp --> DroneEntity[Drone Threat Entity<br/><i>GLB Mesh, Spline Script, Audio Component</i>]
            PCApp --> ProbeEntity[Visibility Probe<br/><i>pc.Frustum + Raycast Occlusion</i>]
        end
        
        HUD --> Compass[Compass / Bearing Tape]
        HUD --> Reticle[Crosshair Reticle & Optical Vignette]
        HUD --> MarkBtn[Mark Detection Trigger]
        HUD --> Modals[Classification & Decision Modals]
        HUD --> AARDash[AAR Dashboard & Timeline]
        
        Bridge[PlayCanvas-React Bridge<br/><i>Event Bus & Zustand Store</i>] <--> PCApp
        Bridge <--> HUD
        
        subgraph Headless Simulation Core (Pure TypeScript)
            Bridge <--> ScenarioMgr[ScenarioManager]
            ScenarioMgr --> Kinematics[DroneKinematics & SwarmManager]
            ScenarioMgr --> Telemetry[TelemetryLogger]
            ScenarioMgr --> Scoring[ScoringEngine]
            ScenarioMgr --> Difficulty[DifficultyProfileEngine]
        end
    end
    
    subgraph Data & Persistence Layer
        Telemetry --> IndexedDB[(Browser IndexedDB<br/><i>Trainee Profiles & Session History</i>)]
        Telemetry -.-> ExportJSON[Raw Telemetry JSON Export]
        Telemetry -.-> CompanionAPI[Python FastAPI Companion Service]
    end
```

---

## 2. Directory & Module Structure

```text
src/
├── simulation/                      # Headless TypeScript Core (ZERO DOM/Engine dependencies)
│   ├── types.ts                     # Telemetry types, enums, scenario schemas
│   ├── ScenarioManager.ts           # State machine, timers, lifecycle coordinator
│   ├── DroneKinematics.ts           # 3D spline mathematical trajectory calculations
│   ├── SwarmManager.ts              # Multi-drone swarm formation coordinator (Phase 2)
│   ├── VisibilityProbe.ts           # Pure math: line-of-sight raycast & angular subtense
│   ├── TelemetryLogger.ts           # Microsecond event logger, pub/sub bus, JSON export
│   ├── ScoringEngine.ts             # Deterministic decision-tree mathematical scoring
│   ├── DifficultyProfile.ts         # Recruit, Operator, Specialist parameter modulators
│   └── SensorDegradation.ts         # Sensor noise & degradation pipeline (Phase 2)
├── playcanvas/                      # PlayCanvas 3D Engine Systems & Scripts
│   ├── PlayCanvasApp.ts             # Application bootstrapper, canvas setup, asset loader
│   ├── scripts/
│   │   ├── FPSController.ts         # Pointer lock, WASD locomotion, ground collision raycast
│   │   ├── OpticalZoom.ts           # Smooth 3x magnification FOV interpolator
│   │   ├── DroneFlight.ts           # Spline navigation, rotor spin animation, motor audio
│   │   └── VisibilityProbeScript.ts # pc.Frustum check & raycast collision probe
│   └── scene/
│       ├── EnvironmentBuilder.ts    # Tactical compound geometry, PBR materials, collision meshes
│       └── LightingSetup.ts         # Directional sunlight, soft cascaded shadows, physical skybox
├── store/
│   ├── useSimulationStore.ts        # Reactive Zustand bridge connecting PlayCanvas to HUD
│   └── useTraineeHistoryStore.ts    # IndexedDB trainee profiles & historical trend records
├── components/
│   ├── PlayCanvasViewport.tsx       # Canvas wrapper component mounting PlayCanvasApp
│   └── ui/                          # Tactical HUD & DOM Overlays (Tailwind CSS)
│       ├── TacticalHUD.tsx          # Full-screen pointer-events-none HUD coordinator
│       ├── CompassTape.tsx          # Dynamic 360-degree heading azimuth tape
│       ├── ReticleOverlay.tsx       # Crosshair with pitch/yaw readouts and zoom vignette
│       ├── MarkDetectionBtn.tsx     # High-contrast primary detection trigger (Spacebar)
│       ├── ClassificationModal.tsx  # 4-category threat classification selector
│       ├── DecisionModal.tsx        # SOP engagement decision selector
│       ├── ResultsScreen.tsx        # Scorecard & interactive horizontal event timeline
│       └── AARDashboard.tsx         # Cross-session trainee history & trend analytics
└── assets/
    ├── models/                      # GLTF/GLB models (quadcopter.glb, compound.glb)
    ├── textures/                    # PBR maps (diffuse, normal, roughness, metallic, AO)
    └── audio/                       # Tactical clicks, drone motor hum, alert cues
```

---

## 3. PlayCanvas Core Components & Unreal-Grade Realism

### 3.1 `PlayCanvasApp.ts` Bootstrapper
Configures the engine for maximum photorealism:
```typescript
import * as pc from 'playcanvas';

export class SimulationPlayCanvasApp {
  public app: pc.Application;
  public cameraEntity: pc.Entity;
  public droneEntity: pc.Entity;

  constructor(canvas: HTMLCanvasElement) {
    this.app = new pc.Application(canvas, {
      mouse: new pc.Mouse(canvas),
      keyboard: new pc.Keyboard(window),
      touch: new pc.Touch(canvas),
      graphicsDeviceOptions: {
        alpha: false,
        antialias: true,
        powerPreference: 'high-performance',
      }
    });

    this.app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    this.app.setCanvasResolution(pc.RESOLUTION_AUTO);

    // Clustered Lighting & Tonemapping (Unreal Engine Look)
    this.app.scene.toneMapping = pc.TONEMAP_ACES;
    this.app.scene.exposure = 1.1;
    this.app.scene.clusteredLightingEnabled = true;
    this.app.scene.ambientLight = new pc.Color(0.08, 0.1, 0.14);

    this.setupLighting();
    this.setupCamera();
  }

  private setupLighting(): void {
    const sun = new pc.Entity('SunLight');
    sun.addComponent('light', {
      type: 'directional',
      color: new pc.Color(1.0, 0.98, 0.92),
      intensity: 2.5,
      castShadows: true,
      shadowResolution: 2048,
      shadowDistance: 150,
      shadowType: pc.SHADOW_PCF5,
    });
    sun.setEulerAngles(45, 30, 0);
    this.app.root.addChild(sun);
  }

  private setupCamera(): void {
    this.cameraEntity = new pc.Entity('PlayerCamera');
    this.cameraEntity.addComponent('camera', {
      clearColor: new pc.Color(0.1, 0.15, 0.2),
      fov: 75,
      nearClip: 0.1,
      farClip: 1000,
    });
    this.cameraEntity.setPosition(0, 1.75, 0);
    this.app.root.addChild(this.cameraEntity);
  }

  public start(): void {
    this.app.start();
  }
}
```

### 3.2 Free-Roam FPS Locomotion (`FPSController.ts`)
Implements first-person movement, pointer lock mouse-look, and ground collision:
```typescript
import * as pc from 'playcanvas';

export class FPSControllerScript extends pc.ScriptType {
  private velocity: pc.Vec3 = new pc.Vec3();
  private yaw: number = 0;
  private pitch: number = 0;

  initialize(): void {
    const canvas = this.app.graphicsDevice.canvas;
    canvas.addEventListener('click', () => {
      if (!pc.Mouse.isPointerLocked()) canvas.requestPointerLock();
    });

    this.app.mouse.on(pc.EVENT_MOUSEMOVE, this.onMouseMove, this);
  }

  private onMouseMove(e: pc.MouseEvent): void {
    if (!pc.Mouse.isPointerLocked()) return;
    this.yaw -= e.dx * 0.15;
    this.pitch = Math.max(-85, Math.min(85, this.pitch - e.dy * 0.15));
    this.entity.setEulerAngles(this.pitch, this.yaw, 0);
  }

  update(dt: number): void {
    const moveSpeed = 12.0 * dt;
    const forward = this.entity.forward;
    const right = this.entity.right;
    
    // Flatten vectors for ground navigation
    forward.y = 0; forward.normalize();
    right.y = 0; right.normalize();

    const dir = new pc.Vec3();
    if (this.app.keyboard.isPressed(pc.KEY_W)) dir.add(forward);
    if (this.app.keyboard.isPressed(pc.KEY_S)) dir.sub(forward);
    if (this.app.keyboard.isPressed(pc.KEY_D)) dir.add(right);
    if (this.app.keyboard.isPressed(pc.KEY_A)) dir.sub(right);

    dir.normalize().scale(moveSpeed);
    const newPos = this.entity.getPosition().clone().add(dir);
    newPos.y = 1.75; // Eye height
    this.entity.setPosition(newPos);
  }
}
```

### 3.3 Ground-Truth Line-of-Sight & Visibility Probe
```typescript
import * as pc from 'playcanvas';

export class VisibilityProbeScript extends pc.ScriptType {
  public cameraEntity: pc.Entity;
  public droneEntity: pc.Entity;
  public onDroneVisible: () => void;

  update(): void {
    if (!this.cameraEntity || !this.droneEntity) return;

    const camPos = this.cameraEntity.getPosition();
    const dronePos = this.droneEntity.getPosition();

    // 1. Frustum Check
    const cameraComponent = this.cameraEntity.camera;
    const frustum = cameraComponent.frustum;
    if (!frustum.containsPoint(dronePos)) return;

    // 2. Angular Subtense Check
    const distanceMeters = camPos.distance(dronePos);
    if (distanceMeters <= 0.1) return;
    const subtenseDeg = (0.5 / distanceMeters) * (180 / Math.PI);
    if (subtenseDeg < 0.05) return;

    // 3. Line of Sight Raycast Occlusion Check
    const hit = this.app.systems.rigidbody.raycastFirst(camPos, dronePos);
    if (!hit || hit.entity === this.droneEntity) {
      this.onDroneVisible?.();
    }
  }
}
```

---

## 4. Realistic Tactical Compound Environment

* **Terrain Geometry**: High-resolution heightmap terrain mesh ($400\text{m} \times 400\text{m}$) with PBR normal, roughness, and diffuse maps (packed gravel, soil, asphalt road).
* **Industrial Perimeter**: Concrete base buildings, metal hangars with metallic-roughness reflections, chain-link security fences, watchtowers, and utility structures.
* **Occlusion Masking**: Carefully placed warehouse walls and foliage clusters to create realistic visual line-of-sight occlusions along the drone's incursion vector.
* **Atmospheric Presets**:
  * **Daytime Preset**: High sun angle, sharp shadows, clear sky.
  * **Night Operations Preset**: Low-light moonlit environment ($0.05$ lux), perimeter sodium-vapor spotlights, requiring trainees to identify faint rotor silhouettes against the horizon.

---

## 5. Scoring & Telemetry Contract

The simulation records the standard 7 chronological events with microsecond timestamps:
1. `SCENARIO_STARTED`
2. `DRONE_SPAWNED`
3. `DRONE_VISIBLE` (Ground truth via `VisibilityProbeScript`)
4. `PLAYER_DETECTION` (Trainee Spacebar mark)
5. `CLASSIFICATION_SUBMITTED` (Benign / Unknown / Concern / Threat)
6. `RESPONSE_SELECTED` (Observe / Info / Escalate / Intercept)
7. `SCENARIO_COMPLETED`

Scoring is 100% deterministic:
$$\text{Final Score} = 0.30 \cdot S_{\text{detect}} + 0.30 \cdot S_{\text{class}} + 0.30 \cdot S_{\text{decision}} + 0.10 \cdot S_{\text{speed}}$$
