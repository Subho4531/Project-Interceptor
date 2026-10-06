import type { Conditions, MapId, TrainingScenarioId, TrainingState } from '../simulation/types';
import type { SensorObservation, SensorTrack } from '../simulation/SensorEngine';

export type PostId = 'shakti-punjab' | 'maru-rajasthan' | 'himadri-sikkim';
export type GeographicPosition = [longitude:number, latitude:number];
export interface PostDefinition {
  id: PostId; name: string; callsign: string; region: string; state: string; terrain: string;
  origin: GeographicPosition; heading: number; altitudeDatum: 'ground-relative' | 'EGM2008';
  environmentId: MapId; extentMeters: number; sourceUrl: string;
  provenance: string;
}
export interface PreviewTrack {
  id: string; label: string; airframe: string; state: 'scheduled' | 'active' | 'departed';
  position: GeographicPosition; altitudeAGL: number; speed: number; heading: number;
  route: GeographicPosition[]; trail: GeographicPosition[]; spawnTime: number;
}
export interface SessionEvent { id: string; time: number; type: string; message: string; source: 'operator' | 'assistant' | 'preview' | 'simulation'; }
export interface SessionSnapshot {
  mode: 'preview' | 'live'; sessionId: string; postId: PostId; scenarioId: TrainingScenarioId;
  status: 'ready' | 'running' | 'paused' | 'completed'; time: number; duration: number;
  quietPeriod: number; seed: number; speed: 1 | 2 | 4; conditions: Conditions;
  tracks: PreviewTrack[]; events: SessionEvent[];
  protectedZone?: GeographicPosition[]; swarmCount?: number; pairDelay?: number;
  sensorTracks?: (SensorTrack & { geographicPosition: GeographicPosition })[];
  eoObservations?: (SensorObservation & { geographicPosition: GeographicPosition })[];
  training?: TrainingState; assetsReady?: boolean; error?: string;
  loadState?: 'idle' | 'loading' | 'ready' | 'error';
  eo?: { yaw: number; pitch: number; zoom: boolean };
}
export type SimulationCommand =
  | { type: 'start' | 'pause' | 'resume' | 'reset' | 'finish'; reason?: string; discardConfirmed?: boolean }
  | { type: 'post'; postId: PostId; discardConfirmed?: boolean }
  | { type: 'scenario'; scenarioId: TrainingScenarioId; discardConfirmed?: boolean }
  | { type: 'configure'; quietPeriod: number; swarmCount: number; pairDelay: number }
  | { type: 'eo'; bearing: number; elevation: number; zoom: boolean }
  | { type: 'speed'; speed: 1 | 2 | 4 }
  | { type: 'conditions'; conditions: Conditions }
  | { type: 'step'; seconds: number };
export interface CommandResult { ok: boolean; message: string; }
export interface SessionAdapter {
  getSnapshot(): SessionSnapshot;
  subscribe(listener: () => void): () => void;
  command(command: SimulationCommand, source?: 'operator' | 'assistant'): CommandResult;
}
export interface MapLayers { routes: boolean; trails: boolean; coverage: boolean; zones: boolean; grid: boolean; truth?: boolean; radar?: boolean; eo?: boolean; }
export type SelectedObject = { type: 'post'; id: PostId } | { type: 'track'; id: string } | { type: 'sensor'; id: 'radar' | 'eo' } | {type:'sensor-track';id:string};
export interface AssistantReply { text: string; command?: SimulationCommand; confirmation?: boolean; focus?: SelectedObject; }
