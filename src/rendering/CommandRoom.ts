import {
  Engine,
  Scene,
  FreeCamera,
  Vector3,
  HemisphericLight,
  PointLight,
  Color3,
  MeshBuilder,
  StandardMaterial,
  DynamicTexture,
  GlowLayer,
  WebXRDefaultExperience,
  WebXRSessionManager,
  WebXRState,
  type AbstractMesh,
} from '@babylonjs/core';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF';
import {
  AdvancedDynamicTexture,
  Grid,
  StackPanel,
  TextBlock,
  Button,
  Control,
  Rectangle,
  Image,
} from '@babylonjs/gui';
import type { SessionController } from '../session/SessionController';
import type { ExerciseAction } from '../training/Exercise';
import { assetUrl } from '../routing';
import { postById } from '../dashboard/posts';

export class CommandRoom {
  private engine: Engine;
  private scene: Scene;
  private camera: FreeCamera;
  private xr?: WebXRDefaultExperience;
  private disposed = false;
  private unsubscribe?: () => void;
  private nextUpdate = 0;
  private selectedIndex = 0;
  private radarAngle = 0;

  // Forward Video Wall UI TextBlocks
  private wallStatus!: TextBlock;
  private wallTracks!: TextBlock;
  private wallROE!: TextBlock;
  private wallHypotheses!: TextBlock;

  // Center Operator Console UI controls
  private centerTrackHeader!: TextBlock;
  private centerAckBtn!: Button;
  private centerNotice!: TextBlock;
  private centerClassificationButtons: Map<string, Button> = new Map();
  private centerAuthBtn!: Button;
  private centerResponseBtn!: Button;

  // Right Monitor UI TextBlock
  private rightEvidenceText!: TextBlock;

  // Left Radar Monitor Dynamic Texture
  private radarTexture?: DynamicTexture;
  private paneVisible = true;

  constructor(
    canvas: HTMLCanvasElement,
    private controller: SessionController,
    private callbacks: {
      ready: () => void;
      error: (message: string) => void;
      xr: (supported: boolean) => void;
      notice: (message: string) => void;
    }
  ) {
    const context = canvas.getContext('webgl2', { antialias: true, alpha: false });
    if (!context) {
      throw new Error('WebGL2 is unavailable. Use the focused desktop console.');
    }
    this.engine = new Engine(context, true);
    this.scene = new Scene(this.engine);
    this.scene.clearColor.set(0.025, 0.045, 0.065, 1);

    // Operator seated position right in front of the central console
    this.camera = new FreeCamera('seated operator', new Vector3(0, 1.35, -0.62), this.scene);
    this.camera.setTarget(new Vector3(0, 1.25, 0.48));
    this.camera.minZ = 0.05;
    this.camera.fov = 1.05;
    this.camera.attachControl(canvas, true);
    this.camera.inputs.removeByType('FreeCameraKeyboardMoveInput');

    // Tactical Multi-source Lighting
    const ambient = new HemisphericLight('room ambient', new Vector3(0, 1, 0), this.scene);
    ambient.intensity = 0.45;
    ambient.diffuse = new Color3(0.22, 0.32, 0.40);
    ambient.groundColor = new Color3(0.08, 0.12, 0.16);

    const ceilingFront = new PointLight('ceiling front', new Vector3(0, 2.85, 0.2), this.scene);
    ceilingFront.intensity = 0.65;
    ceilingFront.diffuse = new Color3(0.80, 0.90, 0.98);
    ceilingFront.range = 8;

    const ceilingRear = new PointLight('ceiling rear', new Vector3(0, 2.85, -1.5), this.scene);
    ceilingRear.intensity = 0.45;
    ceilingRear.diffuse = new Color3(0.80, 0.90, 0.98);
    ceilingRear.range = 7;

    const consoleGlow = new PointLight('operator console glow', new Vector3(0, 1.15, 0.35), this.scene);
    consoleGlow.intensity = 0.40;
    consoleGlow.diffuse = new Color3(0.12, 0.60, 0.72);
    consoleGlow.range = 2.4;

    // Subtle Glow Layer for tactical emissive displays
    const glow = new GlowLayer('tactical glow', this.scene);
    glow.intensity = 0.35;

    window.addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', this.visibilityHandler);
    this.engine.onContextLostObservable.add(() => {
      this.controller.pause('renderer-context-lost');
      callbacks.error('Graphics context lost. Return to the focused console.');
    });

    void this.initialize().catch((error) => {
      if (!this.disposed) callbacks.error(String(error));
    });
  }

  private resize = () => this.engine.resize();
  private visibilityHandler = () => {
    if (document.hidden && document.pointerLockElement) document.exitPointerLock();
    this.applyLoop();
  };

  /** Park or reveal the command room pane. While parked the render loop stops (no GPU
   *  work) and the radar sweep freezes, but the imported room scene stays resident so
   *  returning to the surface is instant. */
  setVisible(visible: boolean) {
    if (this.paneVisible === visible) return;
    this.paneVisible = visible;
    this.applyLoop();
  }
  private applyLoop() {
    if (this.disposed) return;
    if (this.paneVisible && !document.hidden) { this.engine.runRenderLoop(this.frame); this.nextUpdate = 0; this.engine.resize(); }
    else this.engine.stopRenderLoop(this.frame);
  }
  private frame = () => {
    if (this.disposed) return;
    const now = performance.now();
    this.radarAngle = (now / 1800) % (Math.PI * 2);
    this.drawRadar();

    if (now >= this.nextUpdate) {
      this.update();
      this.nextUpdate = now + 200;
    }
    this.scene.render();
  };

  private async initialize() {
    // Shared byte cache: the room module is prefetched at training start, so mounting
    // the command room never re-downloads it.
    const roomBytes = await this.controller.getAssetBytes('./assets/command-room/room.glb');
    const container = await LoadAssetContainerAsync(new Uint8Array(roomBytes), this.scene, { pluginExtension: '.glb' });
    if (this.disposed) {
      container.dispose();
      return;
    }
    container.addAllToScene();

    this.buildScreens();
    this.update();
    this.unsubscribe = this.controller.subscribe(() => {
      this.nextUpdate = 0;
    });

    this.applyLoop();

    this.callbacks.ready();

    const supported = await WebXRSessionManager.IsSessionSupportedAsync('immersive-vr').catch(() => false);
    if (this.disposed) return;
    this.callbacks.xr(supported);

    if (supported) {
      this.xr = await WebXRDefaultExperience.CreateAsync(this.scene, {
        disableDefaultUI: true,
        disableTeleportation: true,
        disableHandTracking: true,
        disableNearInteraction: false,
        floorMeshes: container.meshes.filter((mesh) => mesh.name.toLowerCase().includes('floor')) as AbstractMesh[],
      });
      if (this.disposed) {
        this.xr.dispose();
        return;
      }
      this.xr.baseExperience.onStateChangedObservable.add((state) => {
        if (state === WebXRState.IN_XR) {
          this.controller.recordInputMode('vr');
          this.xr?.baseExperience.camera.position.set(0, 1.35, -0.62);
        }
        if (state === WebXRState.NOT_IN_XR) {
          this.controller.pause('xr-session-ended');
          this.controller.recordInputMode('desktop');
        }
      });
    }

    if (new URLSearchParams(location.search).has('qa')) {
      Object.assign(window, {
        __roomQA: {
          ready: () => true,
          resources: () => ({ meshes: this.scene.meshes.length, textures: this.scene.textures.length }),
          action: (action: ExerciseAction) => this.controller.exerciseAction(action),
        },
      });
    }
  }

  private screenPlane(name: string, position: Vector3, width: number, height: number, rotationY = 0) {
    const mesh = MeshBuilder.CreatePlane(name, { width, height }, this.scene);
    mesh.position = position;
    mesh.rotation.y = rotationY;
    return mesh;
  }

  private buildScreens() {
    this.buildTheaterWall();
    this.buildCenterConsole();
    this.buildLeftRadarMonitor();
    this.buildRightIntelligenceMonitor();
  }

  /**
   * Forward Theater Video Wall (North wall television, z = 2.84)
   * Displays high-level theater airspace overview, ROE posture, and SAARTHI hypotheses
   */
  private buildTheaterWall() {
    const wallMesh = this.screenPlane('theater video wall', new Vector3(0, 1.85, 2.75), 3.3, 1.8);
    const ui = AdvancedDynamicTexture.CreateForMesh(wallMesh, 1920, 1080, true);
    ui.background = '#0B0B0B';

    const root = new StackPanel();
    root.width = '96%';
    root.height = '96%';
    root.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    ui.addControl(root);

    // Header banner
    const headerRect = new Rectangle();
    headerRect.height = '110px';
    headerRect.background = '#181818';
    headerRect.thickness = 1;
    headerRect.color = '#282828';
    headerRect.cornerRadius = 6;
    root.addControl(headerRect);

    this.wallStatus = new TextBlock('wall header text');
    this.wallStatus.color = '#00E5FF';
    this.wallStatus.fontSize = 32;
    this.wallStatus.fontFamily = 'monospace';
    this.wallStatus.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.wallStatus.paddingLeft = '24px';
    headerRect.addControl(this.wallStatus);

    // 3-Column Theater Grid
    const grid = new Grid();
    grid.height = '900px';
    grid.paddingTop = '16px';
    grid.addColumnDefinition(0.33);
    grid.addColumnDefinition(0.34);
    grid.addColumnDefinition(0.33);
    root.addControl(grid);

    // Col 0: Sector Airspace Status
    const col0 = new Rectangle();
    col0.background = '#121212';
    col0.thickness = 1;
    col0.color = '#282828';
    col0.cornerRadius = 6;
    col0.paddingRight = '10px';
    grid.addControl(col0, 0, 0);

    this.wallTracks = new TextBlock('wall tracks text');
    this.wallTracks.color = '#FFFFFF';
    this.wallTracks.fontSize = 24;
    this.wallTracks.fontFamily = 'monospace';
    this.wallTracks.textWrapping = true;
    this.wallTracks.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.wallTracks.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.wallTracks.paddingLeft = '20px';
    this.wallTracks.paddingTop = '20px';
    col0.addControl(this.wallTracks);

    // Col 1: Rules of Engagement & Command Status
    const col1 = new Rectangle();
    col1.background = '#121212';
    col1.thickness = 1;
    col1.color = '#282828';
    col1.cornerRadius = 6;
    col1.paddingLeft = '5px';
    col1.paddingRight = '5px';
    grid.addControl(col1, 0, 1);

    this.wallROE = new TextBlock('wall roe text');
    this.wallROE.color = '#FFFFFF';
    this.wallROE.fontSize = 24;
    this.wallROE.fontFamily = 'monospace';
    this.wallROE.textWrapping = true;
    this.wallROE.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.wallROE.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.wallROE.paddingLeft = '20px';
    this.wallROE.paddingTop = '20px';
    col1.addControl(this.wallROE);

    // Col 2: SAARTHI AI Explainable Hypotheses
    const col2 = new Rectangle();
    col2.background = '#121212';
    col2.thickness = 1;
    col2.color = '#282828';
    col2.cornerRadius = 6;
    col2.paddingLeft = '10px';
    grid.addControl(col2, 0, 2);

    this.wallHypotheses = new TextBlock('wall hypotheses text');
    this.wallHypotheses.color = '#FFFFFF';
    this.wallHypotheses.fontSize = 24;
    this.wallHypotheses.fontFamily = 'monospace';
    this.wallHypotheses.textWrapping = true;
    this.wallHypotheses.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.wallHypotheses.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.wallHypotheses.paddingLeft = '20px';
    this.wallHypotheses.paddingTop = '20px';
    col2.addControl(this.wallHypotheses);
  }

  /**
   * Center Operator Monitor (right in front of the seated operator at z = 0.52)
   * Primary Tactical Decision Console: select contact, acknowledge, 1-click classification, ROE commands
   */
  private buildCenterConsole() {
    const centerMesh = this.screenPlane('operator center monitor', new Vector3(0, 1.05, 0.45), 0.60, 0.36);
    const ui = AdvancedDynamicTexture.CreateForMesh(centerMesh, 1280, 768, true);
    ui.background = '#0B0B0B';

    const root = new StackPanel();
    root.width = '96%';
    root.height = '96%';
    root.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    ui.addControl(root);

    // Header Status (Selected Track Telemetry)
    const headerRect = new Rectangle();
    headerRect.height = '85px';
    headerRect.background = '#121212';
    headerRect.thickness = 1;
    headerRect.color = '#282828';
    headerRect.cornerRadius = 4;
    root.addControl(headerRect);

    this.centerTrackHeader = new TextBlock('center track header');
    this.centerTrackHeader.color = '#FFFFFF';
    this.centerTrackHeader.fontSize = 26;
    this.centerTrackHeader.fontFamily = 'monospace';
    this.centerTrackHeader.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.centerTrackHeader.paddingLeft = '16px';
    headerRect.addControl(this.centerTrackHeader);

    // Primary Action Row: Next Contact & Acknowledge
    const actionRow = new StackPanel();
    actionRow.isVertical = false;
    actionRow.height = '72px';
    actionRow.paddingTop = '10px';
    root.addControl(actionRow);

    const nextBtn = Button.CreateSimpleButton('btn next contact', 'SELECT CONTACT [⇥]');
    nextBtn.width = '340px';
    nextBtn.height = '60px';
    nextBtn.color = '#ffffff';
    nextBtn.background = '#282828';
    nextBtn.thickness = 1;
    nextBtn.fontSize = 22;
    nextBtn.fontFamily = 'monospace';
    nextBtn.cornerRadius = 4;
    nextBtn.onPointerClickObservable.add(() => {
      this.selectedIndex++;
      this.update();
    });
    actionRow.addControl(nextBtn);

    this.centerAckBtn = Button.CreateSimpleButton('btn ack contact', '✓ ACKNOWLEDGE RETURN');
    this.centerAckBtn.width = '420px';
    this.centerAckBtn.height = '60px';
    this.centerAckBtn.paddingLeft = '15px';
    this.centerAckBtn.color = '#ffffff';
    this.centerAckBtn.background = '#1DB954';
    this.centerAckBtn.thickness = 1;
    this.centerAckBtn.fontSize = 22;
    this.centerAckBtn.fontFamily = 'monospace';
    this.centerAckBtn.cornerRadius = 4;
    this.centerAckBtn.onPointerClickObservable.add(() => {
      this.act({ type: 'acknowledge-track', contactId: this.contactId() });
    });
    actionRow.addControl(this.centerAckBtn);

    const startResumeBtn = Button.CreateSimpleButton('btn start resume', 'START / RESUME');
    startResumeBtn.width = '320px';
    startResumeBtn.height = '60px';
    startResumeBtn.paddingLeft = '15px';
    startResumeBtn.color = '#ffffff';
    startResumeBtn.background = '#282828';
    startResumeBtn.thickness = 1;
    startResumeBtn.fontSize = 22;
    startResumeBtn.fontFamily = 'monospace';
    startResumeBtn.cornerRadius = 4;
    startResumeBtn.onPointerClickObservable.add(() => {
      const state = this.controller.getSnapshot();
      const result = this.controller.command({ type: state.status === 'ready' ? 'start' : 'resume' });
      this.callbacks.notice(result.message);
      this.update();
    });
    actionRow.addControl(startResumeBtn);

    // Multi-sensor Investigation Row
    const investRow = new StackPanel();
    investRow.isVertical = false;
    investRow.height = '68px';
    investRow.paddingTop = '10px';
    root.addControl(investRow);

    const investTools = [
      { type: 'request-eo' as const, label: '📷 EO GIMBAL' },
      { type: 'request-rf' as const, label: '📡 RF SNIFFER' },
      { type: 'request-roster' as const, label: '📋 FLIGHT ROSTER' },
      { type: 'request-history' as const, label: '⏱ HISTORY' },
    ];
    for (const tool of investTools) {
      const btn = Button.CreateSimpleButton(`btn ${tool.type}`, tool.label);
      btn.width = '275px';
      btn.height = '56px';
      btn.paddingRight = '10px';
      btn.color = '#FFFFFF';
      btn.background = '#181818';
      btn.thickness = 1;
      btn.fontSize = 20;
      btn.fontFamily = 'monospace';
      btn.cornerRadius = 4;
      btn.onPointerClickObservable.add(() => {
        this.act({ type: tool.type, contactId: this.contactId() });
      });
      investRow.addControl(btn);
    }

    // 1-Click Classification Matrix (Grid)
    const classGrid = new Grid();
    classGrid.height = '260px';
    classGrid.paddingTop = '10px';
    classGrid.addColumnDefinition(0.25);
    classGrid.addColumnDefinition(0.25);
    classGrid.addColumnDefinition(0.25);
    classGrid.addColumnDefinition(0.25);
    root.addControl(classGrid);

    const categories = [
      {
        field: 'objectType',
        title: 'OBJECT TYPE',
        actionType: 'set-object-type',
        options: ['uav', 'non-uav', 'unknown'],
      },
      {
        field: 'coordination',
        title: 'COORDINATION',
        actionType: 'set-coordination',
        options: ['single', 'coordinated', 'multiple-independent', 'unknown'],
      },
      {
        field: 'affiliation',
        title: 'AFFILIATION',
        actionType: 'set-affiliation',
        options: ['unauthorized', 'friendly', 'unconfirmed'],
      },
      {
        field: 'threat',
        title: 'THREAT LEVEL',
        actionType: 'set-threat',
        options: ['critical', 'high', 'medium', 'low'],
      },
    ];

    categories.forEach((cat, colIdx) => {
      const catStack = new StackPanel();
      catStack.width = '96%';
      catStack.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
      classGrid.addControl(catStack, 0, colIdx);

      const title = new TextBlock(`title ${cat.field}`, cat.title);
      title.height = '34px';
      title.color = '#F59E0B';
      title.fontSize = 18;
      title.fontFamily = 'monospace';
      title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      catStack.addControl(title);

      for (const val of cat.options) {
        const btn = Button.CreateSimpleButton(`btn ${cat.field} ${val}`, val.toUpperCase());
        btn.height = '48px';
        btn.paddingBottom = '6px';
        btn.color = '#B3B3B3';
        btn.background = '#181818';
        btn.thickness = 1;
        btn.fontSize = 18;
        btn.fontFamily = 'monospace';
        btn.cornerRadius = 4;
        btn.onPointerClickObservable.add(() => {
          this.act({
            type: cat.actionType as ExerciseAction['type'],
            contactId: this.contactId(),
            value: val,
          } as ExerciseAction);
        });
        catStack.addControl(btn);
        this.centerClassificationButtons.set(`${cat.field}-${val}`, btn);
      }
    });

    // ROE & Command Response Row
    const roeRow = new StackPanel();
    roeRow.isVertical = false;
    roeRow.height = '68px';
    roeRow.paddingTop = '10px';
    root.addControl(roeRow);

    this.centerAuthBtn = Button.CreateSimpleButton('btn auth', 'REQUEST ROE AUTHORITY');
    this.centerAuthBtn.width = '370px';
    this.centerAuthBtn.height = '56px';
    this.centerAuthBtn.paddingRight = '12px';
    this.centerAuthBtn.color = '#0B0B0B';
    this.centerAuthBtn.background = '#F59E0B';
    this.centerAuthBtn.thickness = 1;
    this.centerAuthBtn.fontSize = 20;
    this.centerAuthBtn.fontFamily = 'monospace';
    this.centerAuthBtn.cornerRadius = 4;
    this.centerAuthBtn.onPointerClickObservable.add(() => {
      this.act({ type: 'authorization', contactId: this.contactId() });
    });
    roeRow.addControl(this.centerAuthBtn);

    this.centerResponseBtn = Button.CreateSimpleButton('btn response', 'TASK SIMULATED RESPONSE');
    this.centerResponseBtn.width = '380px';
    this.centerResponseBtn.height = '56px';
    this.centerResponseBtn.paddingRight = '12px';
    this.centerResponseBtn.color = '#ffffff';
    this.centerResponseBtn.background = '#1DB954';
    this.centerResponseBtn.thickness = 1;
    this.centerResponseBtn.fontSize = 20;
    this.centerResponseBtn.fontFamily = 'monospace';
    this.centerResponseBtn.cornerRadius = 4;
    this.centerResponseBtn.onPointerClickObservable.add(() => {
      this.act({ type: 'authorized-response', contactId: this.contactId() });
    });
    roeRow.addControl(this.centerResponseBtn);

    const finishBtn = Button.CreateSimpleButton('btn finish', 'FINISH / AAR');
    finishBtn.width = '320px';
    finishBtn.height = '56px';
    finishBtn.color = '#ffffff';
    finishBtn.background = '#282828';
    finishBtn.thickness = 1;
    finishBtn.fontSize = 20;
    finishBtn.fontFamily = 'monospace';
    finishBtn.cornerRadius = 4;
    finishBtn.onPointerClickObservable.add(() => {
      this.act({ type: 'finish' });
    });
    roeRow.addControl(finishBtn);

    // Bottom Operator Feedback Toast
    this.centerNotice = new TextBlock('center notice text', 'Ready. Select contact and verify sensor evidence.');
    this.centerNotice.height = '42px';
    this.centerNotice.color = '#00E5FF';
    this.centerNotice.fontSize = 18;
    this.centerNotice.fontFamily = 'monospace';
    this.centerNotice.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.centerNotice.paddingLeft = '8px';
    this.centerNotice.paddingTop = '6px';
    root.addControl(this.centerNotice);
  }

  /**
   * Left Operator Monitor: S-Band Surveillance Radar Scope
   * Animated sweep scanline with range rings and contact blips
   */
  private buildLeftRadarMonitor() {
    const radarMesh = this.screenPlane(
      'operator left radar monitor',
      new Vector3(-0.70, 1.05, 0.42),
      0.60,
      0.36,
      0.30
    );

    const material = new StandardMaterial('radar screen material', this.scene);
    this.radarTexture = new DynamicTexture('radar scope texture', { width: 512, height: 320 }, this.scene, false);
    material.emissiveTexture = this.radarTexture;
    material.diffuseColor = Color3.Black();
    material.disableLighting = true;
    radarMesh.material = material;
  }

  /**
   * Draw the dynamic tactical radar scope with rotating sweep and contact blips
   */
  private drawRadar() {
    if (!this.radarTexture) return;
    const ctx = this.radarTexture.getContext();
    const w = 512;
    const h = 320;
    const cx = w / 2;
    const cy = h / 2;
    const maxR = 142;

    // Dark slate background
    ctx.fillStyle = '#0B0B0B';
    ctx.fillRect(0, 0, w, h);

    // Range rings
    ctx.strokeStyle = 'rgba(29, 185, 84, 0.3)';
    ctx.lineWidth = 1;
    for (const frac of [0.25, 0.5, 0.75, 1.0]) {
      ctx.beginPath();
      ctx.arc(cx, cy, maxR * frac, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(cx - maxR, cy);
    ctx.lineTo(cx + maxR, cy);
    ctx.moveTo(cx, cy - maxR);
    ctx.lineTo(cx, cy + maxR);
    ctx.stroke();

    // Rotating Sweep line with phosphor trail
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, maxR, this.radarAngle - 0.45, this.radarAngle);
    ctx.closePath();
    ctx.fillStyle = 'rgba(29, 185, 84, 0.22)';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(this.radarAngle) * maxR, cy + Math.sin(this.radarAngle) * maxR);
    ctx.strokeStyle = '#1ED760';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Title & Range labels
    ctx.fillStyle = '#F59E0B';
    ctx.font = '14px monospace';
    ctx.fillText('S-BAND RADAR · 2.2KM MAX', 14, 22);

    ctx.fillStyle = '#B3B3B3';
    ctx.font = '11px monospace';
    ctx.fillText('500m', cx + 4, cy - maxR * 0.25 - 2);
    ctx.fillText('1000m', cx + 4, cy - maxR * 0.50 - 2);
    ctx.fillText('2000m', cx + 4, cy - maxR * 1.00 - 2);

    // Contacts
    const state = this.controller.getExerciseState();
    for (const track of state.tracks) {
      const range = Math.min(1, track.rangeMeters / 2200) * maxR;
      const angle = (track.bearing - 90) * (Math.PI / 180);
      const x = cx + Math.cos(angle) * range;
      const y = cy + Math.sin(angle) * range;

      const isSelected = track.id === this.contactId();

      ctx.fillStyle = isSelected ? '#F59E0B' : track.acknowledged ? '#00E5FF' : '#FF2A54';
      ctx.beginPath();
      ctx.arc(x, y, isSelected ? 5 : 4, 0, Math.PI * 2);
      ctx.fill();

      // Velocity indicator
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 10, y - 5);
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '11px monospace';
      ctx.fillText(`${track.id} [${Math.round(track.rangeMeters)}m]`, x + 8, y + 4);
    }

    this.radarTexture.update();
  }

  /**
   * Right Operator Monitor: Regional Satellite Aperture & Delivered Intelligence Feed
   */
  private buildRightIntelligenceMonitor() {
    const rightMesh = this.screenPlane(
      'operator right intelligence monitor',
      new Vector3(0.70, 1.05, 0.42),
      0.60,
      0.36,
      -0.30
    );

    const ui = AdvancedDynamicTexture.CreateForMesh(rightMesh, 1024, 640, true);
    ui.background = '#0B0B0B';

    const root = new StackPanel();
    root.width = '96%';
    root.height = '96%';
    root.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    ui.addControl(root);

    // Upper Half: Regional Imagery Window
    const mapRect = new Rectangle();
    mapRect.height = '280px';
    mapRect.background = '#121212';
    mapRect.thickness = 1;
    mapRect.color = '#282828';
    mapRect.cornerRadius = 4;
    root.addControl(mapRect);

    const post = postById(this.controller.getSnapshot().postId);
    const mapImg = new Image('regional map imagery', assetUrl(`./assets/regions/${post.id}/imagery.jpg`));
    mapImg.stretch = Image.STRETCH_FILL;
    mapRect.addControl(mapImg);

    // Reticle overlay
    const reticleText = new TextBlock(
      'reticle text',
      `REGIONAL IMAGERY · ${post.name.toUpperCase()}\nCOORD: ${post.origin[1].toFixed(4)}°N, ${post.origin[0].toFixed(4)}°E`
    );
    reticleText.color = '#00E5FF';
    reticleText.fontSize = 18;
    reticleText.fontFamily = 'monospace';
    reticleText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    reticleText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    reticleText.paddingLeft = '14px';
    reticleText.paddingTop = '12px';
    mapRect.addControl(reticleText);

    // Lower Half: Delivered Intelligence Feed
    const feedRect = new Rectangle();
    feedRect.height = '315px';
    feedRect.paddingTop = '10px';
    feedRect.background = '#121212';
    feedRect.thickness = 1;
    feedRect.color = '#282828';
    feedRect.cornerRadius = 4;
    root.addControl(feedRect);

    this.rightEvidenceText = new TextBlock('right evidence text');
    this.rightEvidenceText.color = '#B3B3B3';
    this.rightEvidenceText.fontSize = 18;
    this.rightEvidenceText.fontFamily = 'monospace';
    this.rightEvidenceText.textWrapping = true;
    this.rightEvidenceText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.rightEvidenceText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.rightEvidenceText.paddingLeft = '16px';
    this.rightEvidenceText.paddingTop = '14px';
    this.rightEvidenceText.paddingRight = '16px';
    feedRect.addControl(this.rightEvidenceText);
  }

  private contactId(): string {
    const tracks = this.controller.getExerciseState().tracks;
    return tracks.length ? tracks[this.selectedIndex % tracks.length].id : '';
  }

  private act(action: ExerciseAction) {
    const result = this.controller.exerciseAction(action);
    this.centerNotice.text = result.message;
    this.callbacks.notice(result.message);
    this.update();
  }

  /**
   * Update all dynamic texts, button states, and tactical postures
   */
  private update() {
    if (!this.wallStatus) return;

    const session = this.controller.getSnapshot();
    const state = this.controller.getExerciseState();
    const track = state.tracks.find((item) => item.id === this.contactId());
    const post = postById(session.postId);

    // 1. Forward Theater Video Wall
    this.wallStatus.text = `PROJECT INTERCEPTOR · THEATER C2 · ${post.name.toUpperCase()} (${post.region.toUpperCase()}) · LEVEL ${session.level} · [${session.status.toUpperCase()} ${Math.floor(session.time)}s]`;

    this.wallTracks.text = `AIRSPACE TRACK REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Returns: ${state.tracks.length}
Acknowledged: ${state.tracks.filter((t) => t.acknowledged).length}
Unacknowledged: ${state.tracks.filter((t) => !t.acknowledged).length}

ACTIVE SELECTED CONTACT:
${track ? `ID: ${track.id} (${track.label})
Bearing: ${Math.round(track.bearing)}°
Range: ${Math.round(track.rangeMeters)}m
Quality: ${(track.quality * 100).toFixed(0)}%
Status: ${track.acknowledged ? 'ACKNOWLEDGED' : 'NEW RETURN (!)'}` : 'No active target selected.'}`;

    const assessment = state.assessments[track?.id ?? ''] ?? {};
    const authStatus = state.authorization[track?.id ?? ''] ?? 'unrequested';

    this.wallROE.text = `RULES OF ENGAGEMENT & ROE
━━━━━━━━━━━━━━━━━━━━━━━━━━
Classification:
Type: ${(assessment.objectType ?? 'UNKNOWN').toUpperCase()}
Coord: ${(assessment.coordination ?? 'UNKNOWN').toUpperCase()}
Affil: ${(assessment.affiliation ?? 'UNCONFIRMED').toUpperCase()}
Threat: ${(assessment.threat ?? 'PENDING').toUpperCase()}

AUTHORIZATION: ${authStatus.toUpperCase()}
DECISION STATUS:
${state.review ? `★ AAR SCORE: ${Math.round(state.review.overall)}/100
Detection: ${Math.round(state.review.scores.detection)} / Class: ${Math.round(state.review.scores.classification)}` : 'Operational assessment pending.'}`;

    const hypotheses = state.hypotheses.filter((h) => !track || h.contactId === track.id);
    this.wallHypotheses.text = `SAARTHI AI C2 ADVISOR
━━━━━━━━━━━━━━━━━━━━━━━━━━
${hypotheses.length ? hypotheses.map((h) => `▶ ${h.label} [${h.confidence.toUpperCase()}]\n${h.basis}`).join('\n\n') : 'Awaiting multi-sensor evidence correlation.'}`;

    // 2. Operator Center Console
    if (track) {
      this.centerTrackHeader.text = `TARGET: ${track.label} [${track.id}] · ${Math.round(track.bearing)}° / ${Math.round(track.rangeMeters)}m · ${track.acknowledged ? 'STATUS: ACKNOWLEDGED ✓' : 'STATUS: UNACKNOWLEDGED (!)'}`;
      this.centerAckBtn.background = track.acknowledged ? '#282828' : '#1DB954';
    } else {
      this.centerTrackHeader.text = 'AIRSPACE SCAN: SECTOR CLEAR · MONITORING';
      this.centerAckBtn.background = '#282828';
    }

    // Update Classification Matrix Buttons highlight
    for (const [key, btn] of this.centerClassificationButtons) {
      const [field, val] = key.split('-');
      const current = assessment[field as keyof typeof assessment];
      if (current === val) {
        btn.background = field === 'threat' && (val === 'high' || val === 'critical') ? '#FF2A54' : '#1DB954';
        btn.color = '#ffffff';
      } else {
        btn.background = '#181818';
        btn.color = '#B3B3B3';
      }
    }

    // Update ROE buttons
    this.centerAuthBtn.background = authStatus === 'granted' ? '#1DB954' : '#F59E0B';
    this.centerAuthBtn.children[0] && ((this.centerAuthBtn.children[0] as TextBlock).text = authStatus === 'granted' ? 'AUTH GRANTED ✓' : authStatus === 'pending' ? 'AUTH PENDING…' : 'REQUEST ROE AUTHORITY');

    // 3. Right Intelligence Monitor Feed
    const evidence = state.evidenceByContact[track?.id ?? ''] ?? [];
    if (evidence.length) {
      this.rightEvidenceText.text = `DELIVERED INTELLIGENCE STREAM (${evidence.length} REPORTS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${evidence.slice(-3).map((item) => `[${item.source.toUpperCase()}] T+${Math.floor(item.deliveryTime)}s: ${item.summary}`).join('\n\n')}`;
    } else {
      this.rightEvidenceText.text = `DELIVERED INTELLIGENCE STREAM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
No multi-sensor telemetry delivered yet.
Request EO Gimbal, RF Sniffer, or Flight Roster on the center console to investigate target return.`;
    }
  }

  async enterVR() {
    if (!this.xr) {
      throw new Error('No immersive VR session is available. Connect the PC headset and OpenXR runtime, then reload.');
    }
    await this.xr.baseExperience.enterXRAsync('immersive-vr', 'local-floor', this.xr.renderTarget);
  }

  async exitVR() {
    await this.xr?.baseExperience.exitXRAsync();
  }

  recenter() {
    this.camera.position.set(0, 1.35, -0.62);
    this.camera.setTarget(new Vector3(0, 1.25, 0.48));
    if (this.xr) {
      this.xr.baseExperience.camera.position.set(0, 1.35, -0.62);
    }
  }

  dispose() {
    this.disposed = true;
    this.unsubscribe?.();
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    Reflect.deleteProperty(window, '__roomQA');
    this.xr?.dispose();
    this.scene.dispose();
    this.engine.dispose();
  }
}
