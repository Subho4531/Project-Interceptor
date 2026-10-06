import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { Ray } from '@babylonjs/core/Culling/ray';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { AssetContainer } from '@babylonjs/core/assetContainer';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/core/Culling/ray';
import { buildEnvironment } from './environment';
import { lerp } from '../simulation/Simulation';
import type { SessionController } from '../session/SessionController';
import { moveObserver, terrainHeight } from '../simulation/world';
import { getOpticalRange } from '../simulation/SensorEngine';
import { assetUrl } from '../routing';
import type { TraineeState, DroneAssetDefinition, Conditions, Quality, Vec3, ExerciseId, Classification, ResponseChoice } from '../simulation/types';
type Callbacks = { progress: (label: string, progress: number) => void; state: (state: TraineeState) => void; ready: (warnings: string[], aerialReady: boolean) => void; error: (error: string) => void; locked: (locked: boolean) => void; notice: (text: string) => void; contact?: (id:string) => void; diagnostics?: (state: TrainerDiagnostics) => void };
interface Catalog { assets: DroneAssetDefinition[]; status: string; reason?: string; }
type Environment = NonNullable<Awaited<ReturnType<typeof buildEnvironment>>>;
const vector = (p: Vec3) => new Vector3(p.x, p.y, p.z);
export type TrainerOptions = { controller: SessionController; quality: Quality; mode?: 'observer' | 'eo' };
export class Trainer {
  private engine: Engine;
  private scene: Scene;
  private camera: FreeCamera;
  private world?: Environment;
  private get sim() { return this.options.controller.sim; }
  private get environment() { return this.options.controller.environment; }
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
  private conditionSignature = '';
  private probeCache?: {x:number;z:number;sampled:number;rendered?:number;error?:number}[];
  private options: TrainerOptions;
  constructor(private canvas: HTMLCanvasElement, private callbacks: Callbacks, options: TrainerOptions) {
    this.options = options;
    const context = canvas.getContext('webgl2', { antialias: true, alpha: false, stencil: true, preserveDrawingBuffer: true });
    if (!context) throw new Error('WebGL2 is unavailable. Use desktop Chrome or Edge with hardware acceleration enabled.');
    this.engine = new Engine(context, true, { preserveDrawingBuffer: true, stencil: true });
    this.engine.setHardwareScalingLevel(Math.max(1, window.devicePixelRatio));
    this.scene = new Scene(this.engine);
    this.scene.imageProcessingConfiguration.toneMappingEnabled = true;
    this.scene.imageProcessingConfiguration.toneMappingType = 1;
    this.scene.imageProcessingConfiguration.exposure = 1.05;
    this.scene.imageProcessingConfiguration.contrast = 1.08;
    this.camera = new FreeCamera(options.mode === 'eo' ? 'eo station' : 'observer', vector(this.options.controller.observer.position), this.scene);
    this.camera.minZ = .08; this.camera.maxZ = 10000; this.camera.fov = 1.1;
    if (options.mode==='eo') this.camera.fovMode=Camera.FOVMODE_HORIZONTAL_FIXED;
    this.restoreCamera();
    if (options.mode !== 'eo') this.installControls();
    else this.on(window, 'resize', () => this.engine.resize());
    this.engine.onContextLostObservable.add(() => { this.pause('renderer-context-lost'); callbacks.error('The graphics context was lost. Reload the environment to recover.'); });
    void this.initialize().catch(e => { if (!this.controller.signal.aborted) callbacks.error(String(e)); });
  }
  private async initialize() {
    const signal = this.controller.signal;
    await this.options.controller.loadAssets();
    if (signal.aborted) return;
    if (!this.options.controller.getSnapshot().assetsReady) throw new Error(this.options.controller.getSnapshot().error ?? 'Regional assets could not load. Retry the session asset loader.');
    const world = await buildEnvironment(this.scene, this.environment, this.callbacks.progress, signal, path=>this.options.controller.getAssetBytes(path));
    if (!world || signal.aborted) return;
    this.world = world;
    const warnings = [...world.errors];
    const available = new Set<string>();
    try {
      const response = await fetch(assetUrl('./assets/drones/catalog.json'), { signal });
      if (!response.ok) throw new Error(`Asset catalog returned ${response.status}`);
      const catalog: Catalog = await response.json();
      if (!Array.isArray(catalog.assets)) throw new Error('Invalid aerial asset catalog');
      for (const [index,definition] of catalog.assets.entries()) {
        if (definition.status !== 'available') continue;
        this.callbacks.progress(`Loading aerial models (${index + 1}/${catalog.assets.length})`, .92 + .07 * index / catalog.assets.length);
        try {
          if (!definition.identity || !definition.provenance?.sourceUrl || !definition.provenance.license?.url || Object.values(definition.dimensions).some(v => !Number.isFinite(v) || v <= 0) || !Number.isFinite(definition.scaleCorrection) || definition.scaleCorrection <= 0 || !Object.values(definition.orientationCorrection).every(Number.isFinite)) throw new Error('Model has incomplete dimensions or provenance');
          if (new URL(assetUrl(definition.modelUrl)).origin !== location.origin) throw new Error('Aerial assets must be hosted locally');
          const container = await LoadAssetContainerAsync(new Uint8Array(await this.options.controller.getAssetBytes(definition.modelUrl)), this.scene, {pluginExtension:'.glb'});
          if (signal.aborted) { container.dispose(); return; }
          if (!container.meshes.some(m => m.getTotalVertices() > 0)) { container.dispose(); throw new Error('Model contains no geometry'); }
          this.templates.set(definition.id, { container, definition }); available.add(definition.id);
        } catch (e) { if (signal.aborted) return; warnings.push(`Aerial model ${definition.id}: ${String(e)}`); }
      }
    } catch (e) { if (signal.aborted) return; warnings.push(`Aerial asset catalog unavailable: ${String(e)}`); }
    this.world.setConditions(this.sim.conditions); this.setQuality(this.options.quality); this.warnings = warnings;
    this.initialized = true;
    this.callbacks.progress('Ready', 1); this.callbacks.ready(warnings, this.sim.config.entities.every(e => available.has(e.assetId)));
    this.publish(); this.engine.runRenderLoop(this.frame);
    // Explicit diagnostic mode is opt-in. Trainee HUD never receives scenario truth.
    if (this.options.mode !== 'eo' && new URLSearchParams(location.search).has('qa')) {
      Object.assign(window, { __trainerQA: {
        snapshot: () => this.diagnostics(), start: () => { this.options.controller.command({type:'start'}); this.publish(); },
        pause: () => this.pause(), resume: () => { this.options.controller.command({type:'resume'}); this.previousFrame = 0; this.publish(); },
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
      if (document.hidden) this.options.controller.command({type:'pause',reason:'hidden-tab'});
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
      if (event.code === 'KeyE' || event.code === 'Space') { event.preventDefault(); this.observe(); }
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
    if (!this.sim || document.hidden || this.sim.status === 'completed') return;
    if (this.sim.config.training && this.sim.config.entities.some(e => !this.templates.has(e.assetId))) { this.callbacks.notice('All required aerial assets must load before this exercise can start.'); return; }
    try {
      await this.canvas.requestPointerLock();
      if (document.pointerLockElement !== this.canvas) { this.callbacks.notice('Click the scene to capture your mouse.'); return; }
      const result = this.options.controller.command({type:this.sim.status === 'ready'?'start':'resume'});
      if (!result.ok) { document.exitPointerLock(); this.callbacks.notice(result.message); }
      this.previousFrame = 0; this.publish();
    } catch { this.callbacks.notice('Mouse capture was blocked. Click Enter or Resume to try again.'); }
  }
  pause(reason = 'operator') { if(this.sim.status==='running')this.options.controller.command({type:'pause',reason}); this.keys.clear(); if (document.pointerLockElement === this.canvas) document.exitPointerLock(); this.publish(); }
  reset() {
    this.pause('reset'); this.options.controller.command({type:'reset',discardConfirmed:true});
    for (const visual of this.visuals.values()) visual.dispose(); this.visuals.clear();
    this.zoom = false; this.camera.fov = 1.1; this.resetCamera(); this.previousFrame = 0; this.publish();
  }
  private restoreCamera() { const observer=this.options.controller.observer; this.camera.position.copyFrom(vector(observer.position)); this.camera.rotation.set(observer.pitch,observer.yaw,0); this.zoom=observer.zoom; this.camera.fov=this.zoom?.22:1.1; }
  restoreObserver() { this.restoreCamera(); this.keys.clear(); this.publish(); }
  private saveCamera() { if(this.options.mode!=='eo') this.options.controller.updateObserver({position:{x:this.camera.position.x,y:this.camera.position.y,z:this.camera.position.z},yaw:this.camera.rotation.y,pitch:this.camera.rotation.x,zoom:this.zoom}); }
  resetCamera() { const spawn = this.environment.observerSpawn; this.camera.position.copyFromFloats(spawn.x, terrainHeight(spawn.x,spawn.z,this.environment.terrain)+1.72, spawn.z); this.camera.rotation.set(0, spawn.heading, 0); this.keys.clear(); this.saveCamera(); }
  setConditions(conditions: Conditions) { this.options.controller.command({type:'conditions',conditions}); this.world?.setConditions(conditions); this.publish(); }
  setQuietPeriod(seconds: number) { const state=this.options.controller.getSnapshot(); this.options.controller.command({type:'configure',quietPeriod:seconds,swarmCount:state.swarmCount??4,pairDelay:state.pairDelay??4}); }
  setExercise(exercise: ExerciseId) {
    if (!this.sim) return;
    if(this.sim.status!=='ready') this.options.controller.command({type:'reset',discardConfirmed:true});
    this.options.controller.setExercise(exercise);
    this.callbacks.ready(this.warnings,this.sim.config.entities.every(e => this.templates.has(e.assetId))); this.publish();
  }
  classify(contactId: string, classification: Classification) { this.options.controller.classify(contactId,classification); this.publish(); }
  respond(contactId: string, response: ResponseChoice) { this.options.controller.respond(contactId,response); this.publish(); }
  finishExercise() { this.options.controller.command({type:'finish'}); this.syncVisuals(0); this.pause('exercise-complete'); }
  setQuality(quality: Quality) { this.engine.setHardwareScalingLevel(Math.max(1, window.devicePixelRatio) * (quality === 'low' ? 1.5 : 1)); this.world?.setQuality(quality); this.engine.resize(); }
  private setZoom(zoom: boolean) { this.zoom = zoom; this.camera.fov = zoom ? .22 : 1.1; this.options.controller.observe(undefined, { action: 'zoom', enabled: zoom, heading: this.heading() }); this.saveCamera(); this.publish(); }
  private observe() {
    if (this.sim?.status !== 'running') return;
    const ray = this.camera.getForwardRay(getOpticalRange(this.environment,this.sim.conditions,1300));
    const pick = this.scene.pickWithRay(ray, mesh => mesh.isPickable && mesh.isEnabled() && mesh.isVisible);
    let node: TransformNode | null = pick?.pickedMesh ?? null;
    while (node && !node.metadata?.entityId) node = node.parent as TransformNode | null;
    const entityId: string | undefined = node?.metadata?.entityId;
    this.options.controller.observe(entityId, { action: 'mark-bearing', heading: this.heading(), zoom: this.zoom, position: this.camera.position.asArray() });
    if (this.sim.config.training) {
      const report = this.options.controller.reportContact(entityId,this.heading(),-this.camera.rotation.x * 180 / Math.PI);
      if (report) { this.pause('contact-report'); this.callbacks.contact?.(report.id); this.callbacks.notice(`${report.label} recorded. Submit your assessment.`); }
      else { this.callbacks.notice('Bearing logged; no aerial contact acquired at the reticle.'); this.publish(); }
    } else this.callbacks.notice('Observation recorded');
  }
  private heading() { return ((this.camera.rotation.y * 180 / Math.PI) % 360 + 360) % 360; }
  private move(dx: number, dz: number) {
    if (!this.world) return;
    const obstacles = [...this.world.obstacles, ...this.world.vegetation.map(t => ({ id: 'trunk', minX: t.x - t.radius, maxX: t.x + t.radius, minZ: t.z - t.radius, maxZ: t.z + t.radius }))];
    this.camera.position.copyFrom(vector(moveObserver(this.camera.position, dx, dz, obstacles, this.environment.bounds, this.environment.terrain))); this.saveCamera();
  }
  // Local development controls exist only behind the explicit QA URL flag.
  advanceForQA(seconds: number) {
    if (!new URLSearchParams(location.search).has('qa') || !this.sim) return;
    this.options.controller.command({type:'step',seconds});
    this.syncVisuals(0); this.pause('qa-step'); this.previousFrame = 0;
  }
  detectForQA() {
    if (!new URLSearchParams(location.search).has('qa') || !this.sim) return;
    this.options.controller.command({type:'resume'}); this.observe(); this.pause('qa-detection');
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
    this.callbacks.state({ time: this.sim.time, status: this.sim.status, zoom: this.zoom, heading: this.heading(), conditions: { ...this.sim.conditions }, fps: Math.round(this.engine.getFps()), training:this.sim.trainingState() });
    if (new URLSearchParams(location.search).has('qa')) this.callbacks.diagnostics?.(this.diagnostics());
  }
  private frame = () => {
    if (!this.sim || this.controller.signal.aborted) return;
    const now = performance.now(), dt = this.previousFrame ? Math.min(.1, (now - this.previousFrame) / 1000) : 0; this.previousFrame = now;
    const alpha = this.options.controller.alpha;
    const conditionSignature=`${this.sim.conditions.timeOfDay}/${this.sim.conditions.visibility}/${this.sim.conditions.weather??'clear'}`;
    if(conditionSignature!==this.conditionSignature){this.world?.setConditions(this.sim.conditions);this.conditionSignature=conditionSignature;}
    if (this.options.mode === 'eo') {
      const eo=this.options.controller.sensorEngine.eo;
      this.camera.position.copyFrom(vector(eo.position)); this.camera.rotation.set(-eo.elevation*Math.PI/180,eo.bearing*Math.PI/180,0); this.camera.fov=eo.fieldOfView*Math.PI/180;
    }
    if (this.sim.status === 'completed' && document.pointerLockElement === this.canvas) { this.keys.clear(); document.exitPointerLock(); }
    if (this.sim.status === 'running' && document.pointerLockElement === this.canvas) {
      const forward = Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS'));
      const side = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'));
      const length = Math.hypot(forward, side) || 1, speed = (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 6 : 3.2) * dt / length;
      if (forward || side) this.move((forward * Math.sin(this.camera.rotation.y) + side * Math.cos(this.camera.rotation.y)) * speed, (forward * Math.cos(this.camera.rotation.y) - side * Math.sin(this.camera.rotation.y)) * speed);
    }
    if (this.options.mode!=='eo') this.saveCamera();
    this.syncVisuals(alpha,dt);
    this.scene.render();
    if (now >= this.nextUI) { this.publish(); this.nextUI = now + 100; }
  };
  private syncVisuals(alpha: number, dt = 1/60) {
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
      visual.root.position.copyFrom(vector(p));
      const smoothing = this.sim.status==='running'?1-Math.exp(-Math.max(dt,.001)*12):1;
      visual.root.rotation.y += Math.atan2(Math.sin(state.heading-visual.root.rotation.y),Math.cos(state.heading-visual.root.rotation.y))*smoothing;
      const dx = state.position.x - state.previous.x, dz = state.position.z - state.previous.z;
      const pitch=state.pitch ?? (Math.hypot(dx,dz)>.00001?-Math.atan2(state.position.y-state.previous.y,Math.hypot(dx,dz)):visual.root.rotation.x);
      visual.root.rotation.x+=(pitch-visual.root.rotation.x)*smoothing;
      visual.root.rotation.z+=((state.roll??0)-visual.root.rotation.z)*smoothing;
    }
    for (const [id, visual] of this.visuals) if (!this.sim.entities.has(id)) { visual.dispose(); this.visuals.delete(id); }
  }
  private terrainProbes() {
    if(this.probeCache)return this.probeCache;
    const probes=[[0,0],[-225,140],[225,140],[-160,-130],[160,-130]].map(([x,z])=>{
      const sampled=terrainHeight(x,z,this.environment.terrain),hit=this.scene.pickWithRay(new Ray(new Vector3(x,sampled+5000,z),new Vector3(0,-1,0),10000),mesh=>Boolean(mesh.metadata?.regionalTerrain));
      return {x,z,sampled,rendered:hit?.pickedPoint?.y,error:hit?.pickedPoint?hit.pickedPoint.y-sampled:undefined};
    });
    if(probes.every(probe=>probe.rendered!==undefined))this.probeCache=probes;
    return probes;
  }
  diagnostics() {
    const gl = this.canvas.getContext('webgl2'); const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return { time: this.sim?.time, status: this.sim?.status, entityCount: this.sim?.entities.size, visualCount: this.visuals.size,
      meshes: this.scene.meshes.length, materials: this.scene.materials.length, textures: this.scene.textures.length, fps: this.engine.getFps(),
      camera: { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z }, conditions: this.sim?.conditions,
      events: this.sim?.events.map(e => ({ time: e.time, type: e.type, entityId: e.entityId })), webgl: this.engine.webGLVersion,
      renderer: ext ? gl?.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unavailable', locked: document.pointerLockElement === this.canvas,
      ready: this.initialized, aerialReady: this.sim?.config.entities.every(e => this.templates.has(e.assetId)),
      sessionId:this.options.controller.getSnapshot().sessionId, postId:this.options.controller.getSnapshot().postId,
      mapId: this.environment.id, exercise: this.options.controller.exercise, sceneryCount: this.world?.sceneryCount,
      regional:this.environment.regional, observer:this.options.controller.observer, sensorTracks:this.options.controller.getSnapshot().sensorTracks,
      terrainRoot: this.scene.getMeshByName('__root__')?.getWorldMatrix().asArray(),
      terrainProbes:this.terrainProbes(),
      terrainMeshes:this.scene.meshes.filter(mesh=>mesh.metadata?.regionalTerrain).map(mesh=>({name:mesh.name,vertices:mesh.getTotalVertices(),enabled:mesh.isEnabled(),bounds:{min:mesh.getBoundingInfo().boundingBox.minimumWorld.asArray(),max:mesh.getBoundingInfo().boundingBox.maximumWorld.asArray()}})),
      training: this.sim?.trainingState(),
      terrainHeight: terrainHeight(this.camera.position.x,this.camera.position.z,this.environment.terrain),
      availableAssets: [...this.templates.keys()], entities: this.sim ? [...this.sim.entities.values()].map(e => ({ id: e.id, assetId: e.assetId, position: { ...e.position }, heading: e.heading })) : [],
      obstacles: this.world?.obstacles, templates: [...this.templates].map(([id,t]) => ({ id, meshes: t.container.meshes.length, textures: t.container.textures.length, dimensions: t.definition.dimensions })),
      visualBounds: [...this.visuals].map(([id,v]) => { const b = v.root.getHierarchyBoundingVectors(true); return { id, min: b.min.asArray(), max: b.max.asArray() }; }) };
  }
  dispose() {
    this.saveCamera();
    this.controller.abort(); this.engine.stopRenderLoop(this.frame);
    for (const fn of this.cleanup) fn(); this.cleanup = [];
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    for (const v of this.visuals.values()) v.dispose(); this.visuals.clear();
    for (const t of this.templates.values()) t.container.dispose(); this.templates.clear();
    this.scene.dispose(); this.engine.dispose();
    if (this.options.mode !== 'eo' && new URLSearchParams(location.search).has('qa')) Reflect.deleteProperty(window, '__trainerQA');
  }
}
export type TrainerDiagnostics = ReturnType<Trainer['diagnostics']>;
export type ObserverPosition = Vec3;
