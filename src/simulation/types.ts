export type Vec3 = { x: number; y: number; z: number };
export type Conditions = { timeOfDay: 'day' | 'night'; visibility: 'clear' | 'reduced' };
export type Quality = 'standard' | 'low';
export type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number };
export type Zone = Bounds & { id: string; minY: number; maxY: number };
export type Obstacle = Bounds & { id: string };
export type Placement = { id: string; module: 'facility' | 'shelter' | 'barrier'; position: Vec3; size: Vec3 };
export type MapId = 'rural-post-07' | 'mountain-pass' | 'rocky-valley';
export type TrainingScenarioId = 'low-ingress' | 'surveillance' | 'penetration' | 'swarm';
export type ExerciseId = 'patrol' | 'route-a' | 'route-b' | 'route-c' | 'route-d' | TrainingScenarioId;
export type Classification = 'benign' | 'unknown' | 'concern' | 'threat';
export type ResponseChoice = 'observe' | 'information' | 'report' | 'simulated-response';
export type SessionStatus = 'ready' | 'running' | 'paused' | 'completed';
export interface ScenarioBriefing { code: string; title: string; description: string; objectives: string[]; }
export interface TrainingDefinition {
  briefing: ScenarioBriefing; duration: number;
  expectedClassification: Classification; expectedResponse: ResponseChoice; rationale: string;
}
export interface ContactReport {
  id: string; label: string; detectedAt: number; bearing: number; elevation: number;
  classification?: Classification; classifiedAt?: number; response?: ResponseChoice; respondedAt?: number;
}
export interface ExerciseReview {
  reason: 'routes-complete' | 'operator'; elapsed: number; detected: number; expected: number; missed: number;
  falseReports: number; classificationMatches: number; responseMatches: number; zoneEntries: number;
  expectedClassification: Classification; expectedResponse: ResponseChoice; rationale: string;
}
export interface TrainingState { briefing: ScenarioBriefing; reports: ContactReport[]; falseReports: number; review?: ExerciseReview; }
export type LandscapePlacement = { id: string; model: 'mountain' | 'dry-terrain' | 'boulders'; position: Vec3; width: number; heightScale: number; heading: number; collidable: boolean };
export interface EnvironmentConfig {
  id: MapId; label: string; description: string;
  terrain: { size: number; subdivisions: number; profile: 'rural' | 'mountain' | 'valley'; tint: string }; bounds: Bounds;
  scenery: LandscapePlacement[]; vegetation: { trees: number; shrubs: number };
  protectedZones: Zone[]; observerSpawn: Vec3 & { heading: number };
  placements: Placement[]; lighting: { sunDirection: Vec3; dayIntensity: number; nightIntensity: number };
  visibility: { clear: number; reduced: number };
  regional?: { id: string; modelUrl: string; heightfieldUrl: string; imageryUrl: string; metadataUrl: string; origin: [number, number]; originHeightEGM2008?: number };
}
export interface DroneAssetDefinition {
  id: string; modelUrl: string; identity: string;
  provenance: { origin: 'sketchfab' | 'simulator'; uid: string; sourceUrl: string; author: { name: string; profile: string }; license: { fullName: string; url: string; requirements: string } };
  dimensions: Vec3; scaleCorrection: number; orientationCorrection: Vec3;
  animations: string[]; status: 'available' | 'blocked'; simulatorOriginal: boolean;
}
export interface ScenarioEntity { id: string; assetId: string; spawnTime: number; speed: number; route: Vec3[]; }
export interface ScenarioConfig {
  id: string; seed: number; quietPeriod: number; conditions: Conditions; entities: ScenarioEntity[];
  training?: TrainingDefinition;
}
export type EventType = 'session-start' | 'session-pause' | 'session-resume' | 'session-reset' | 'entity-spawn' | 'entity-despawn' | 'zone-enter' | 'zone-exit' | 'observation' | 'conditions-change' | 'contact-detection' | 'classification-submitted' | 'response-selected' | 'session-complete';
export interface SimulationEvent { id: string; time: number; type: EventType; entityId?: string; payload: Record<string, unknown>; }
// Ground truth lives in simulation/rendering; trainee UI receives only TraineeState.
export interface EntityState { id: string; assetId: string; previous: Vec3; position: Vec3; heading: number; pitch?: number; roll?: number; zones: string[]; }
export type TraineeState = { time: number; status: SessionStatus; zoom: boolean; heading: number; conditions: Conditions; fps: number; training?: TrainingState; };
