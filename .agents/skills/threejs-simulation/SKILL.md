---
name: threejs-simulation
description: React Three Fiber & Three.js 3D Web Simulation Specialist. Covers R3F Canvas, PointerLockControls FPS cameras, CatmullRomCurve3 spline flight kinematics, Raycaster line-of-sight visibility, and Day/Night HDRI lighting.
---

# React Three Fiber & Three.js 3D Web Simulation Skill

This skill provides expert patterns, conventions, and implementations for high-performance 3D simulations running in the browser with Three.js, React Three Fiber (R3F), and `@react-three/drei`.

---

## 1. Architectural Guardrails

### 1.1 The "Iron Separation" Rule
- **Pure TypeScript (`src/simulation/`)**:
  - Flight spline mathematical interpolation.
  - Telemetry event bus, microsecond timing, and JSON serialization.
  - Deterministic scoring engine calculations.
  - Visibility raycasting and angular subtense threshold formulas.
- **R3F Components (`src/components/3d/`)**:
  - Canvas setup, lighting, camera rigs, GLTF model rendering, and shader materials.
- **DOM / Tailwind (`src/components/ui/`)**:
  - Tactical HUD overlays, compass heading tape, crosshairs, modal dialogs, and results cards.

---

## 2. 3D Spline Flight Trajectory (`CatmullRomCurve3`)

```typescript
import * as THREE from 'three';

export class DroneSplineFlight {
  private curve: THREE.CatmullRomCurve3;
  private currentDistance: number = 0;
  public totalLength: number;
  public speedMps: number;

  constructor(waypoints: THREE.Vector3[], speedMps: number = 18.0) {
    this.curve = new THREE.CatmullRomCurve3(waypoints, false, 'catmullrom', 0.5);
    this.totalLength = this.curve.getLength();
    this.speedMps = speedMps;
  }

  public update(deltaSeconds: number): { position: THREE.Vector3; rotation: THREE.Euler; isCompleted: boolean } {
    this.currentDistance += this.speedMps * deltaSeconds;
    const progress = Math.min(1.0, this.currentDistance / this.totalLength);

    const position = this.curve.getPointAt(progress);
    const tangent = this.curve.getTangentAt(progress).normalize();

    const matrix = new THREE.Matrix4().lookAt(
      position,
      position.clone().add(tangent),
      new THREE.Vector3(0, 1, 0)
    );
    const rotation = new THREE.Euler().setFromRotationMatrix(matrix);

    return { position, rotation, isCompleted: progress >= 1.0 };
  }
}
```

---

## 3. Optical Visibility & Ground-Truth Raycasting

```typescript
import * as THREE from 'three';

export function isDroneVisible(
  camera: THREE.PerspectiveCamera,
  dronePosition: THREE.Vector3,
  colliders: THREE.Object3D[],
  droneDiameterMeters: number = 0.5,
  minAngularSubtenseDeg: number = 0.05
): boolean {
  // 1. Frustum Check
  const frustum = new THREE.Frustum();
  frustum.setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
  );
  if (!frustum.containsPoint(dronePosition)) {
    return false;
  }

  // 2. Angular Subtense (Resolution) Check
  const distanceMeters = camera.position.distanceTo(dronePosition);
  if (distanceMeters <= 0.1) return false;

  const angularSubtenseDeg = (droneDiameterMeters / distanceMeters) * (180 / Math.PI);
  if (angularSubtenseDeg < minAngularSubtenseDeg) {
    return false;
  }

  // 3. Multi-Ray Line-of-Sight Occlusion Check
  const raycaster = new THREE.Raycaster();
  const direction = dronePosition.clone().sub(camera.position).normalize();
  raycaster.set(camera.position, direction);
  raycaster.far = distanceMeters;

  const hits = raycaster.intersectObjects(colliders, true);
  // If first hit is closer than drone position, target is occluded
  return hits.length === 0;
}
```

---

## 4. Free-Roam FPS Controller Pattern

```tsx
import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';

export const FPSController: React.FC<{ onBearingChange?: (deg: number) => void }> = ({ onBearingChange }) => {
  const { camera } = useThree();
  const velocity = useRef(new THREE.Vector3());
  const keys = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { keys.current[e.code] = true; };
    const onKeyUp = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useFrame((_, delta) => {
    const moveSpeed = 12.0 * delta;
    const dir = new THREE.Vector3();

    if (keys.current['KeyW']) dir.z -= 1;
    if (keys.current['KeyS']) dir.z += 1;
    if (keys.current['KeyA']) dir.x -= 1;
    if (keys.current['KeyD']) dir.x += 1;

    dir.normalize();
    velocity.current.x = dir.x * moveSpeed;
    velocity.current.z = dir.z * moveSpeed;

    camera.translateX(velocity.current.x);
    camera.translateZ(velocity.current.z);
    camera.position.y = 1.75; // Lock eye height

    // Calculate azimuth bearing (0 - 360 deg)
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0;
    forward.normalize();
    let bearing = Math.atan2(forward.x, forward.z) * (180 / Math.PI);
    if (bearing < 0) bearing += 360;
    onBearingChange?.(Math.round(bearing));
  });

  return <PointerLockControls />;
};
```
