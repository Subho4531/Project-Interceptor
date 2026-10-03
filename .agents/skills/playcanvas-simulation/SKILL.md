---
name: playcanvas-simulation
description: PlayCanvas WebGL2/WebGPU 3D Engine Specialist. Covers pc.Application setup, Entity-Component-System (ECS), clustered forward lighting, cascaded PCF5 shadows, PBR standard materials, FPS camera scripts with PointerLock, and raycast line-of-sight checks.
---

# PlayCanvas Engine 3D Simulation Skill

This skill provides expert patterns, conventions, and implementations for high-fidelity 3D simulations running in the browser using the **PlayCanvas Engine** (`playcanvas` standalone npm library).

---

## 1. Architectural Guardrails

### 1.1 The "Iron Separation" Rule
- **Pure TypeScript (`src/simulation/`)**:
  - Flight spline mathematical interpolation.
  - Telemetry event bus, microsecond timing, and JSON serialization.
  - Deterministic scoring engine calculations.
  - Visibility raycasting and angular subtense threshold formulas.
  - **Rule**: Zero DOM or PlayCanvas imports in simulation core; 100% testable via Vitest.
- **PlayCanvas Engine (`src/playcanvas/`)**:
  - `pc.Application` setup, clustered lighting, camera rigs, GLB model loading, PBR materials, and script components.
- **DOM / Tailwind (`src/components/ui/`)**:
  - Tactical HUD overlays, compass heading tape, crosshairs, modal dialogs, and results cards.

---

## 2. Bootstrapping PlayCanvas with Unreal-Grade PBR Realism

```typescript
import * as pc from 'playcanvas';

export function createSimulationApp(canvas: HTMLCanvasElement): pc.Application {
  const app = new pc.Application(canvas, {
    mouse: new pc.Mouse(canvas),
    keyboard: new pc.Keyboard(window),
    graphicsDeviceOptions: {
      alpha: false,
      antialias: true,
      powerPreference: 'high-performance',
    }
  });

  app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);

  // Clustered Forward Lighting & ACES Tonemapping
  app.scene.toneMapping = pc.TONEMAP_ACES;
  app.scene.exposure = 1.15;
  app.scene.clusteredLightingEnabled = true;
  app.scene.ambientLight = new pc.Color(0.08, 0.1, 0.14);

  // Directional Sun with PCF5 Cascaded Soft Shadows
  const sun = new pc.Entity('DirectionalSun');
  sun.addComponent('light', {
    type: 'directional',
    color: new pc.Color(1.0, 0.98, 0.92),
    intensity: 2.8,
    castShadows: true,
    shadowResolution: 2048,
    shadowDistance: 200,
    shadowType: pc.SHADOW_PCF5,
    shadowBias: 0.05,
    normalOffsetBias: 0.05
  });
  sun.setEulerAngles(45, 35, 0);
  app.root.addChild(sun);

  return app;
}
```

---

## 3. Optical Visibility & Ground-Truth Raycasting in PlayCanvas

```typescript
import * as pc from 'playcanvas';

export function isDroneVisibleInPlayCanvas(
  cameraEntity: pc.Entity,
  droneEntity: pc.Entity,
  app: pc.Application,
  droneDiameterMeters: number = 0.5,
  minAngularSubtenseDeg: number = 0.05
): boolean {
  if (!cameraEntity || !droneEntity) return false;

  const camPos = cameraEntity.getPosition();
  const dronePos = droneEntity.getPosition();

  // 1. Frustum Check
  const frustum = cameraEntity.camera.frustum;
  if (!frustum.containsPoint(dronePos)) {
    return false;
  }

  // 2. Angular Subtense Check
  const distanceMeters = camPos.distance(dronePos);
  if (distanceMeters <= 0.1) return false;

  const angularSubtenseDeg = (droneDiameterMeters / distanceMeters) * (180 / Math.PI);
  if (angularSubtenseDeg < minAngularSubtenseDeg) {
    return false;
  }

  // 3. Line of Sight Raycast Occlusion Check
  const hit = app.systems.rigidbody.raycastFirst(camPos, dronePos);
  return !hit || hit.entity === droneEntity;
}
```

---

## 4. Free-Roam FPS Locomotion Script Pattern

```typescript
import * as pc from 'playcanvas';

export class FPSControllerScript extends pc.ScriptType {
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
