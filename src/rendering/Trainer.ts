import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { AssetContainer } from '@babylonjs/core/assetContainer';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/core/Culling/ray';
import { buildEnvironment } from './environment';
import { environment, createScenario } from '../simulation/config';
import { Simulation, lerp, FIXED_STEP } from '../simulation/Simulation';
import { moveObserver, terrainHeight } from '../simulation/world';
import type { TraineeState, DroneAssetDefinition, Conditions, Quality, Vec3, EnvironmentConfig, ExerciseId } from '../simulation/types';
type Callbacks = { progress: (label: string, progress: number) => void; state: (state: TraineeState) => void; ready: (warnings: string[], aerialReady: boolean) => void; error: (error: string) => void; locked: (locked: boolean) => void; notice: (text: string) => void; diagnostics?: (state: TrainerDiagnostics) => void };
interface Catalog { assets: DroneAssetDefinition[]; status: string; reason?: string; }
type Environment = NonNullable<Awaited<ReturnType<typeof buildEnvironment>>>;
const vector = (p: Vec3) => new Vector3(p.x, p.y, p.z);
export type TrainerOptions = { environment: EnvironmentConfig; exercise: ExerciseId; quietPeriod: number; conditions: Conditions; quality: Quality };
export class Trainer {
  private engine: Engine;
  private scene: Scene;
  private camera: FreeCamera;
  private world?: Environment;
  private sim?: Simulation;
  private controller = new AbortController();
  private templates = new Map<string, { container: AssetContainer; definition: DroneAssetDefinition }>();
  private visuals = new Map<string, { root: TransformNode; dispose: () => void }>();
  private keys = new Set<string>();
  private zoom = false;
  private previousFrame = 0;
  private nextUI = 0;
  private cleanup: (() => void)[] = [];
  private initialized = false;
  private warnings: string[] = [];
  private options: TrainerOptions;
  constructor(private canvas: HTMLCanvasElement, private callbacks: Callbacks, options?: TrainerOptions) {
    this.options = options ?? { environment, exercise: 'patrol', quietPeriod: 25, conditions: { timeOfDay: 'day', visibility: 'clear' }, quality: 'standard' };
    const context = canvas.getContext('webgl2', { antialias: true, alpha: false, stencil: true, preserveDrawingBuffer: true });
    if (!context) throw new Error('WebGL2 is unavailable. Use desktop Chrome or Edge with hardware acceleration enabled.');
    this.engine = new Engine(context, true, { preserveDrawingBuffer: true, stencil: true });
    this.engine.setHardwareScalingLevel(Math.max(1, window.devicePixelRatio));
    this.scene = new Scene(this.engine);
    this.scene.imageProcessingConfiguration.toneMappingEnabled = true;
    this.scene.imageProcessingConfiguration.toneMappingType = 1;
    this.scene.imageProcessingConfiguration.exposure = 1.05;
    this.scene.imageProcessingConfiguration.contrast = 1.08;
    this.camera = new FreeCamera('observer', vector(this.options.environment.observerSpawn), this.scene);
    this.camera.minZ = .08; this.camera.maxZ = 2800; this.camera.fov = 1.1;
    this.resetCamera();
    this.installControls();
    this.engine.onContextLostObservable.add(() => { this.pause('renderer-context-lost'); callbacks.error('The graphics context was lost. Reload the environment to recover.'); });
    void this.initialize().catch(e => { if (!this.controller.signal.aborted) callbacks.error(String(e)); });
  }
  private async initialize() {
    const signal = this.controller.signal;
    const world = await buildEnvironment(this.scene, this.options.environment, this.callbacks.progress, signal);
    if (!world || signal.aborted) return;
    this.world = world;
    const warnings = [...world.errors];
    const available = new Set<string>();
    try {
      const response = await fetch('./assets/drones/catalog.json', { signal });
      if (!response.ok) throw new Error(`Asset catalog returned ${response.status}`);
      const catalog: Catalog = await response.json();
      if (!Array.isArray(catalog.assets)) throw new Error('Invalid aerial asset catalog');
      for (const [index,definition] of catalog.assets.entries()) {
        if (definition.status !== 'available') continue;
        this.callbacks.progress(`Loading aerial models (${index + 1}/${catalog.assets.length})`, .92 + .07 * index / catalog.assets.length);
        try {
          if (!definition.identity || !definition.provenance?.sourceUrl || !definition.provenance.license?.url || Object.values(definition.dimensions).some(v => !Number.isFinite(v) || v <= 0) || !Number.isFinite(definition.scaleCorrection) || definition.scaleCorrection <= 0 || !Object.values(definition.orientationCorrection).every(Number.isFinite)) throw new Error('Model has incomplete dimensions or provenance');
          if (new URL(definition.modelUrl,location.href).origin !== location.origin) throw new Error('Aerial assets must be hosted locally');
          const container = await LoadAssetContainerAsync(definition.modelUrl, this.scene);
          if (signal.aborted) { container.dispose(); return; }
          if (!container.meshes.some(m => m.getTotalVertices() > 0)) { container.dispose(); throw new Error('Model contains no geometry'); }
          this.templates.set(definition.id, { container, definition }); available.add(definition.id);
        } catch (e) { if (signal.aborted) return; warnings.push(`Aerial model ${definition.id}: ${String(e)}`); }
      }
    } catch (e) { if (signal.aborted) return; warnings.push(`Aerial asset catalog unavailable: ${String(e)}`); }
    const scenario = createScenario(this.options.environment,this.options.exercise);
    scenario.quietPeriod = this.options.quietPeriod; scenario.conditions = { ...this.options.conditions };
    this.sim = new Simulation(scenario, this.options.environment, available);
    this.world.setConditions(this.options.conditions); this.setQuality(this.options.quality); this.warnings = warnings;
    this.initialized = true;
    this.callbacks.progress('Ready', 1); this.callbacks.ready(warnings, scenario.entities.every(e => available.has(e.assetId)));
    this.publish(); this.engine.runRenderLoop(this.frame);
    // Explicit diagnostic mode is opt-in. Trainee HUD never receives scenario truth.
    if (new URLSearchParams(location.search).has('qa')) {
      Object.assign(window, { __trainerQA: {
        snapshot: () => this.diagnostics(), start: () => { this.sim!.start(); this.publish(); },
        pause: () => this.pause(), resume: () => { this.sim!.resume(); this.previousFrame = 0; this.publish(); },
        reset: () => this.reset(), conditions: (c: Conditions) => this.setConditions(c), quality: (q: Quality) => this.setQuality(q),
        move: (dx: number, dz: number) => this.move(dx, dz), turn: (heading: number, pitch = 0) => { this.camera.rotation.set(pitch, heading, 0); },
        zoom: () => this.setZoom(!this.zoom), observe: () => this.observe(),
      } });
    }
  }
  private on(target: EventTarget, event: string, listener: EventListener, options?: AddEventListenerOptions) {
    target.addEventListener(event, listener, options); this.cleanup.push(() => target.removeEventListener(event, listener, options));
  }
  private installControls() {
    this.on(window, 'resize', () => this.engine.resize());
    this.on(document, 'pointerlockchange', () => {
      const locked = document.pointerLockElement === this.canvas;
      this.callbacks.locked(locked); this.keys.clear();
      if (!locked) this.pause('pointer-lock-lost');
    });
    this.on(document, 'pointerlockerror', () => { this.pause('pointer-lock-error'); this.callbacks.notice('Mouse capture was blocked. Click Resume to try again.'); });
    this.on(document, 'visibilitychange', () => {
      this.keys.clear(); this.previousFrame = 0;
      this.sim?.setHidden(document.hidden);
      if (document.hidden) { if (document.pointerLockElement === this.canvas) document.exitPointerLock(); this.engine.stopRenderLoop(this.frame); }
      else if (this.initialized && !this.controller.signal.aborted) this.engine.runRenderLoop(this.frame);
      this.publish();
    });
    this.on(window, 'blur', () => { this.keys.clear(); this.pause('window-blur'); });
    this.on(document, 'keydown', e => {
      const event = e as KeyboardEvent;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight'].includes(event.code) && document.pointerLockElement === this.canvas) { event.preventDefault(); this.keys.add(event.code); }
      if (event.repeat) return;
      if (event.code === 'Escape') { this.pause('escape'); return; }
      if (event.code === 'KeyP') { if (this.sim?.status === 'running') this.pause(); else if (this.sim?.status === 'paused') void this.enter(); }
      if (this.sim?.status !== 'running') return;
      if (event.code === 'KeyZ') this.setZoom(!this.zoom);
      if (event.code === 'KeyE') this.observe();
      if (event.code === 'KeyR') this.resetCamera();
    });
    this.on(document, 'keyup', e => this.keys.delete((e as KeyboardEvent).code));
    this.on(document, 'mousemove', e => {
      if (document.pointerLockElement !== this.canvas || this.sim?.status !== 'running') return;
      const event = e as MouseEvent, sensitivity = this.zoom ? .00055 : .0018;
      this.camera.rotation.y += event.movementX * sensitivity;
      this.camera.rotation.x = Math.max(-1.4, Math.min(1.4, this.camera.rotation.x + event.movementY * sensitivity));
    });
    this.on(this.canvas, 'contextmenu', e => e.preventDefault());
    this.on(this.canvas, 'mousedown', e => { if ((e as MouseEvent).button === 2 && this.sim?.status === 'running') this.setZoom(!this.zoom); });
    this.on(this.canvas, 'click', () => { if (this.sim?.status === 'paused') void this.enter(); });
  }
  async enter() {
    if (!this.sim || document.hidden) return;
    try {
      await this.canvas.requestPointerLock();
      if (document.pointerLockElement !== this.canvas) { this.callbacks.notice('Click the scene to capture your mouse.'); return; }
      if (this.sim.status === 'ready') this.sim.start(); else this.sim.resume();
      this.previousFrame = 0; this.publish();
    } catch { this.callbacks.notice('Mouse capture was blocked. Click Enter or Resume to try again.'); }
  }
  pause(reason = 'operator') { this.sim?.pause(reason); this.keys.clear(); if (document.pointerLockElement === this.canvas) document.exitPointerLock(); this.publish(); }
  reset() {
    this.pause('reset'); this.sim?.reset();
    for (const visual of this.visuals.values()) visual.dispose(); this.visuals.clear();
    this.zoom = false; this.camera.fov = 1.1; this.resetCamera(); this.previousFrame = 0; this.publish();
  }
  resetCamera() { const spawn = this.options.environment.observerSpawn; this.camera.position.copyFromFloats(spawn.x, spawn.y, spawn.z); this.camera.rotation.set(.015, spawn.heading, 0); this.keys.clear(); }
  setConditions(conditions: Conditions) { this.sim?.setConditions(conditions); this.world?.setConditions(conditions); this.publish(); }
  setQuietPeriod(seconds: number) { if (this.sim?.status === 'ready') this.sim.config.quietPeriod = Math.max(0, Math.min(300, seconds)); }
  setExercise(exercise: ExerciseId) {
    if (!this.sim) return;
    const quietPeriod = this.sim.config.quietPeriod; this.reset();
    this.options.exercise = exercise; this.sim.config = createScenario(this.options.environment,exercise); this.sim.config.quietPeriod = quietPeriod;
    this.callbacks.ready(this.warnings,this.sim.config.entities.every(e => this.templates.has(e.assetId))); this.publish();
  }
  setQuality(quality: Quality) { this.engine.setHardwareScalingLevel(Math.max(1, window.devicePixelRatio) * (quality === 'low' ? 1.5 : 1)); this.world?.setQuality(quality); this.engine.resize(); }
  private setZoom(zoom: boolean) { this.zoom = zoom; this.camera.fov = zoom ? .22 : 1.1; this.sim?.observe(undefined, { action: 'zoom', enabled: zoom, heading: this.heading() }); this.publish(); }
  private observe() {
    if (this.sim?.status !== 'running') return;
    const ray = this.camera.getForwardRay(1300);
    const pick = this.scene.pickWithRay(ray, mesh => mesh.isPickable && mesh.isEnabled() && mesh.isVisible);
    let node: TransformNode | null = pick?.pickedMesh ?? null;
    while (node && !node.metadata?.entityId) node = node.parent as TransformNode | null;
    this.sim.observe(node?.metadata?.entityId, { action: 'mark-bearing', heading: this.heading(), zoom: this.zoom, position: this.camera.position.asArray() });
    this.callbacks.notice('Observation recorded');
  }
  private heading() { return ((this.camera.rotation.y * 180 / Math.PI) % 360 + 360) % 360; }
  private move(dx: number, dz: number) {
    if (!this.world) return;
    const obstacles = [...this.world.obstacles, ...this.world.vegetation.map(t => ({ id: 'trunk', minX: t.x - t.radius, maxX: t.x + t.radius, minZ: t.z - t.radius, maxZ: t.z + t.radius }))];
    this.camera.position.copyFrom(vector(moveObserver(this.camera.position, dx, dz, obstacles, this.options.environment.bounds, this.options.environment.terrain)));
  }
  // Local development controls exist only behind the explicit QA URL flag.
  advanceForQA(seconds: number) {
    if (!new URLSearchParams(location.search).has('qa') || !this.sim) return;
    if (this.sim.status === 'ready') this.sim.start(); else this.sim.resume();
    for (let i = 0; i < Math.round(seconds / FIXED_STEP); i++) this.sim.advance(FIXED_STEP);
    this.syncVisuals(0); this.pause('qa-step'); this.previousFrame = 0;
  }
  focusAerialForQA() {
    if (!new URLSearchParams(location.search).has('qa') || !this.sim) return;
    const entity = [...this.sim.entities.values()][0]; if (!entity) return;
    this.pause('qa-inspection');
    const dimensions = this.templates.get(entity.assetId)?.definition.dimensions;
    const distance = dimensions ? Math.max(.9,Math.max(dimensions.x,dimensions.y,dimensions.z) * 2.1) : 7;
    this.camera.position.copyFrom(vector(entity.position).add(new Vector3(4,2,6).normalize().scale(distance)));
    this.camera.setTarget(vector(entity.position)); this.camera.fov = .7; this.publish();
  }
  walkForQA(dx: number,dz: number) { if (!new URLSearchParams(location.search).has('qa')) return; this.move(dx,dz); this.publish(); }
  private publish() {
    if (!this.sim) return;
    this.callbacks.state({ time: this.sim.time, status: this.sim.status, zoom: this.zoom, heading: this.heading(), conditions: { ...this.sim.conditions }, fps: Math.round(this.engine.getFps()) });
    if (new URLSearchParams(location.search).has('qa')) this.callbacks.diagnostics?.(this.diagnostics());
  }
  private frame = () => {
    if (!this.sim || this.controller.signal.aborted) return;
    const now = performance.now(), dt = this.previousFrame ? Math.min(.1, (now - this.previousFrame) / 1000) : 0; this.previousFrame = now;
    const alpha = this.sim.advance(dt);
    if (this.sim.status === 'running' && document.pointerLockElement === this.canvas) {
      const forward = Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS'));
      const side = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'));
      const length = Math.hypot(forward, side) || 1, speed = (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 6 : 3.2) * dt / length;
      if (forward || side) this.move((forward * Math.sin(this.camera.rotation.y) + side * Math.cos(this.camera.rotation.y)) * speed, (forward * Math.cos(this.camera.rotation.y) - side * Math.sin(this.camera.rotation.y)) * speed);
    }
    this.syncVisuals(alpha);
    this.scene.render();
    if (now >= this.nextUI) { this.publish(); this.nextUI = now + 100; }
  };
  private syncVisuals(alpha: number) {
    if (!this.sim) return;
    for (const [id, state] of this.sim.entities) {
      let visual = this.visuals.get(id);
      if (!visual) {
        const template = this.templates.get(state.assetId); if (!template) continue;
        const instance = template.container.instantiateModelsToScene(name => `${id}-${name}`, false);
        const root = new TransformNode(id, this.scene); root.metadata = { entityId: id };
        const corrected = new TransformNode('model correction', this.scene); corrected.parent = root;
        corrected.scaling.setAll(template.definition.scaleCorrection); corrected.rotation.copyFrom(vector(template.definition.orientationCorrection));
        for (const node of instance.rootNodes) node.parent = corrected;
        visual = { root, dispose: () => { instance.dispose(); root.dispose(); } }; this.visuals.set(id, visual);
      }
      const p = this.sim.status === 'running' ? lerp(state.previous, state.position, alpha) : state.position;
      visual.root.position.copyFrom(vector(p)); visual.root.rotation.y = state.heading;
      const dx = state.position.x - state.previous.x, dz = state.position.z - state.previous.z;
      if (Math.hypot(dx,dz) > .00001) visual.root.rotation.x = -Math.atan2(state.position.y - state.previous.y,Math.hypot(dx,dz));
    }
    for (const [id, visual] of this.visuals) if (!this.sim.entities.has(id)) { visual.dispose(); this.visuals.delete(id); }
  }
  diagnostics() {
    const gl = this.canvas.getContext('webgl2'); const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return { time: this.sim?.time, status: this.sim?.status, entityCount: this.sim?.entities.size, visualCount: this.visuals.size,
      meshes: this.scene.meshes.length, materials: this.scene.materials.length, textures: this.scene.textures.length, fps: this.engine.getFps(),
      camera: { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z }, conditions: this.sim?.conditions,
      events: this.sim?.events.map(e => ({ time: e.time, type: e.type, entityId: e.entityId })), webgl: this.engine.webGLVersion,
      renderer: ext ? gl?.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unavailable', locked: document.pointerLockElement === this.canvas,
      ready: this.initialized, aerialReady: this.sim?.config.entities.every(e => this.templates.has(e.assetId)),
      mapId: this.options.environment.id, exercise: this.options.exercise, sceneryCount: this.world?.sceneryCount,
      terrainHeight: terrainHeight(this.camera.position.x,this.camera.position.z,this.options.environment.terrain),
      availableAssets: [...this.templates.keys()], entities: this.sim ? [...this.sim.entities.values()].map(e => ({ id: e.id, assetId: e.assetId, position: { ...e.position }, heading: e.heading })) : [],
      obstacles: this.world?.obstacles, templates: [...this.templates].map(([id,t]) => ({ id, meshes: t.container.meshes.length, textures: t.container.textures.length, dimensions: t.definition.dimensions })),
      visualBounds: [...this.visuals].map(([id,v]) => { const b = v.root.getHierarchyBoundingVectors(true); return { id, min: b.min.asArray(), max: b.max.asArray() }; }) };
  }
  dispose() {
    this.controller.abort(); this.engine.stopRenderLoop(this.frame);
    for (const fn of this.cleanup) fn(); this.cleanup = [];
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    for (const v of this.visuals.values()) v.dispose(); this.visuals.clear();
    for (const t of this.templates.values()) t.container.dispose(); this.templates.clear();
    this.scene.dispose(); this.engine.dispose();
    if (new URLSearchParams(location.search).has('qa')) Reflect.deleteProperty(window, '__trainerQA');
  }
}
export type TrainerDiagnostics = ReturnType<Trainer['diagnostics']>;
export type ObserverPosition = Vec3;
