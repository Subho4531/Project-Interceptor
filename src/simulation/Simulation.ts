import type { ScenarioConfig, EnvironmentConfig, EntityState, Vec3, SimulationEvent, EventType, Conditions } from './types';
import { inside } from './world';
export const FIXED_STEP = 1 / 60;
export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
export function sampleRoute(route: Vec3[], distance: number): { position: Vec3; heading: number; ended: boolean } {
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i];
    const length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (distance <= length) return { position: lerp(a, b, length ? distance / length : 1), heading: Math.atan2(b.x - a.x, b.z - a.z), ended: false };
    distance -= length;
  }
  return { position: { ...route[route.length - 1] }, heading: 0, ended: true };
}
export class Simulation {
  time = 0;
  status: 'ready' | 'running' | 'paused' = 'ready';
  conditions: Conditions;
  entities = new Map<string, EntityState>();
  events: SimulationEvent[] = [];
  accumulator = 0;
  private completed = new Set<string>();
  private hidden = false;
  private eventSequence = 0;
  private session = 1;
  constructor(public config: ScenarioConfig, private environment: EnvironmentConfig, private availableAssets: Set<string>) {
    this.conditions = { ...config.conditions };
    if (!Number.isInteger(config.seed) || config.quietPeriod < 0 || config.entities.some(e => e.speed <= 0 || e.route.length < 2 || e.spawnTime < 0 || e.route.some(p => !Object.values(p).every(Number.isFinite))) || new Set(config.entities.map(e => e.id)).size !== config.entities.length) throw new Error('Invalid scenario configuration');
  }
  private emit(type: EventType, payload: Record<string, unknown> = {}, entityId?: string) {
    // Bounded log for long sessions; future AAR adapters can stream events to storage.
    if (this.events.length >= 10000) this.events.splice(0, 1000);
    this.events.push({ id: `${this.session}:${++this.eventSequence}`, time: this.time, type, entityId, payload });
  }
  start() { if (this.status !== 'ready') return; this.status = 'running'; this.emit('session-start', { seed: this.config.seed }); }
  pause(reason = 'operator') { if (this.status !== 'running') return; this.status = 'paused'; this.accumulator = 0; this.emit('session-pause', { reason }); }
  resume() { if (this.status !== 'paused' || this.hidden) return; this.status = 'running'; this.accumulator = 0; this.emit('session-resume'); }
  setHidden(hidden: boolean) { this.hidden = hidden; if (hidden) this.pause('hidden-tab'); this.accumulator = 0; }
  reset() {
    this.session++; this.time = 0; this.accumulator = 0; this.entities.clear(); this.completed.clear(); this.events = []; this.eventSequence = 0;
    this.status = 'ready'; this.emit('session-reset', { seed: this.config.seed });
  }
  observe(entityId: string | undefined, payload: Record<string, unknown>) { this.emit('observation', payload, entityId && this.entities.has(entityId) ? entityId : undefined); }
  setConditions(conditions: Conditions) { this.conditions = { ...conditions }; this.emit('conditions-change', conditions); }
  advance(seconds: number) {
    if (this.status !== 'running' || this.hidden) return 0;
    this.accumulator += Math.max(0, Math.min(seconds, 0.25));
    while (this.accumulator + 1e-10 >= FIXED_STEP) { this.step(); this.accumulator = Math.max(0, this.accumulator - FIXED_STEP); }
    return this.accumulator / FIXED_STEP;
  }
  private step() {
    this.time += FIXED_STEP;
    for (const definition of this.config.entities) {
      const spawnTime = this.config.quietPeriod + definition.spawnTime;
      if (this.time + 1e-9 < spawnTime || this.completed.has(definition.id) || !this.availableAssets.has(definition.assetId)) continue;
      let state = this.entities.get(definition.id);
      if (!state) {
        const p = { ...definition.route[0] };
        state = { id: definition.id, assetId: definition.assetId, position: p, previous: p, heading: 0, zones: [] };
        this.entities.set(definition.id, state); this.emit('entity-spawn', {}, definition.id);
      }
      state.previous = { ...state.position };
      const sample = sampleRoute(definition.route, Math.max(0, this.time - spawnTime) * definition.speed);
      state.position = sample.position; state.heading = sample.heading;
      const zones = this.environment.protectedZones.filter(z => inside(sample.position, z) && sample.position.y >= z.minY && sample.position.y <= z.maxY).map(z => z.id);
      for (const zone of zones) if (!state.zones.includes(zone)) this.emit('zone-enter', { zone }, state.id);
      for (const zone of state.zones) if (!zones.includes(zone)) this.emit('zone-exit', { zone }, state.id);
      state.zones = zones;
      if (sample.ended) { for (const zone of zones) this.emit('zone-exit', { zone }, state.id); this.emit('entity-despawn', {}, state.id); this.entities.delete(state.id); this.completed.add(state.id); }
    }
  }
}
