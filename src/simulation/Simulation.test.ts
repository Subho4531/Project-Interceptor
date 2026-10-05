import { describe, it, expect } from 'vitest';
import { Simulation, FIXED_STEP, sampleRoute } from './Simulation';
import { environment, scenario, environments, createScenario } from './config';
import { moveObserver, terrainHeight, principalObstacles, collides } from './world';
const create = (assets = new Set(['sketchfab-fpv'])) => new Simulation(structuredClone(scenario), environment, assets);
const advance = (sim: Simulation, seconds: number) => { for (let i = 0; i < Math.round(seconds / FIXED_STEP); i++) sim.advance(FIXED_STEP); };
describe('Sketchfab patrols and map terrain', () => {
  const assets = new Set(['sketchfab-fpv','sketchfab-orlan','sketchfab-lancet','sketchfab-geran']);
  it.each(environments)('runs each airframe once with no overlapping patrol objects on $id', map => {
    const sim = new Simulation(createScenario(map),map,assets); sim.config.quietPeriod = 0; sim.start();
    for (let i=0; i<240 * 60; i++) { sim.advance(FIXED_STEP); expect(sim.entities.size).toBeLessThanOrEqual(1); }
    expect(sim.events.filter(e => e.type === 'entity-spawn')).toHaveLength(4);
    expect(sim.events.filter(e => e.type === 'entity-despawn')).toHaveLength(4);
    expect(sim.entities.size).toBe(0);
  });
  it.each(environments)('keeps routes above the terrain on $id', map => {
    for (const entity of createScenario(map).entities) for (let distance=0; distance<600; distance+=1) {
      const {position,ended} = sampleRoute(entity.route,distance);
      expect(position.y - terrainHeight(position.x,position.z,map.terrain)).toBeGreaterThan(8);
      if (ended) break;
    }
  });
  it('starts a selected exercise deterministically and retains the requested quiet period', () => {
    const map=environments[1]; const config=createScenario(map,'route-d'); config.quietPeriod=10;
    const sim=new Simulation(config,map,assets); sim.start(); advance(sim,9.9); expect(sim.entities.size).toBe(0);
    advance(sim,.1); expect(sim.entities.get('aerial-01')?.assetId).toBe('sketchfab-geran');
    const expected=structuredClone([...sim.entities.values()]); sim.reset(); sim.start(); advance(sim,10);
    expect([...sim.entities.values()]).toEqual(expected); expect(sim.config.quietPeriod).toBe(10);
  });
  it('uses each selected map surface for bounded movement and keeps the post flat', () => {
    for(const map of environments) {
      expect(terrainHeight(0,0,map.terrain)).toBe(0);
      const p=moveObserver({x:0,y:1.72,z:60},0,230,principalObstacles(map),map.bounds,map.terrain);
      expect(p.y - terrainHeight(p.x,p.z,map.terrain)).toBeCloseTo(1.72);
      expect(p.z).toBeLessThan(map.bounds.maxZ);
    }
    expect(terrainHeight(180,220,environments[1].terrain)).not.toBe(terrainHeight(180,220,environments[2].terrain));
  });
});
describe('scenario lifecycle and deterministic schedules', () => {
  it('is quiet, spawns at the configured delay, crosses the zone, then disposes the entity', () => {
    const sim = create(); sim.start(); advance(sim, 24.9); expect(sim.entities.size).toBe(0);
    advance(sim, .1); expect(sim.entities.size).toBe(1);
    advance(sim, 65); expect(sim.entities.size).toBe(0);
    expect(sim.events.filter(e => e.type === 'entity-spawn')).toHaveLength(1);
    expect(sim.events.some(e => e.type === 'zone-enter')).toBe(true);
    expect(sim.events.some(e => e.type === 'zone-exit')).toBe(true);
    expect(sim.events.some(e => e.type === 'entity-despawn')).toBe(true);
  });
  it('reproduces events and positions for the same configuration after repeated resets', () => {
    const sim = create(); sim.start(); advance(sim, 33);
    const expected = structuredClone([...sim.entities.values()]);
    const events = sim.events.filter(e => e.entityId).map(({ time, type, entityId, payload }) => ({ time, type, entityId, payload }));
    for (let i = 0; i < 20; i++) {
      sim.reset(); sim.start(); advance(sim, 33);
      expect([...sim.entities.values()]).toEqual(expected);
      expect(sim.events.filter(e => e.entityId).map(({ time, type, entityId, payload }) => ({ time, type, entityId, payload }))).toEqual(events);
      expect(new Set(sim.events.map(e => e.id)).size).toBe(sim.events.length);
    }
  });
  it('halts the clock while paused or hidden and requires an explicit resume', () => {
    const sim = create(); sim.start(); advance(sim, 1); const t = sim.time;
    sim.pause(); advance(sim, 2); expect(sim.time).toBe(t);
    sim.resume(); sim.setHidden(true); sim.resume(); advance(sim, 5); expect(sim.time).toBe(t);
    sim.setHidden(false); expect(sim.status).toBe('paused'); sim.resume(); advance(sim, 1); expect(sim.time).toBeCloseTo(t + 1);
  });
  it('does not create an entity when a configured asset is unavailable', () => {
    const sim = create(new Set()); sim.start(); advance(sim, 100); expect(sim.entities.size).toBe(0);
    expect(sim.events.some(e => e.type === 'entity-spawn')).toBe(false);
  });
  it('holds the route during pause, records observations, and keeps conditions on reset', () => {
    const sim = create(); sim.start(); advance(sim, 30); sim.pause(); const position = { ...sim.entities.get('aerial-01')!.position };
    advance(sim, 10); expect(sim.entities.get('aerial-01')!.position).toEqual(position);
    sim.observe('aerial-01', { action: 'zoom' }); expect(sim.events.at(-1)?.type).toBe('observation');
    sim.setConditions({ timeOfDay: 'night', visibility: 'reduced' }); sim.reset();
    expect(sim.conditions).toEqual({ timeOfDay: 'night', visibility: 'reduced' }); expect(sim.time).toBe(0); expect(sim.entities.size).toBe(0);
  });
  it('does not accelerate after a long stall, and accepts alternate quiet periods', () => {
    const sim = create(); sim.config.quietPeriod = 0; sim.start(); sim.advance(1000); expect(sim.time).toBeCloseTo(.25); expect(sim.entities.size).toBe(1);
  });
});
describe('ground navigation', () => {
  const obstacles = principalObstacles(environment);
  it('blocks buildings and fences even at large movement deltas', () => {
    const building = moveObserver({ x: -26, y: 1.72, z: 0 }, 0, -40, obstacles, environment.bounds);
    expect(building.z).toBeGreaterThan(-7.5); expect(collides(building.x, building.z, obstacles)).toBe(false);
    const fence = moveObserver({ x: 0, y: 1.72, z: 0 }, 100, 0, obstacles, environment.bounds);
    expect(fence.x).toBeLessThan(39.5);
  });
  it('allows the open gate, follows terrain, and stays inside exploration bounds', () => {
    const p = moveObserver({ x: 0, y: 1.72, z: 45 }, 0, 200, obstacles, environment.bounds);
    expect(p.z).toBeGreaterThan(52); expect(p.z).toBeLessThan(environment.bounds.maxZ); expect(p.y).toBeCloseTo(terrainHeight(p.x, p.z) + 1.72);
  });
  it('slides along principal obstacles', () => {
    const p = moveObserver({ x: 38, y: 1.72, z: 0 }, 10, 10, obstacles, environment.bounds);
    expect(p.x).toBeLessThan(39.5); expect(p.z).toBeCloseTo(10);
  });
  it('maintains eye height on the rising terrain at the exploration edge', () => {
    const p = moveObserver({ x: 80, y: 1.72, z: 160 }, 15, 0, obstacles, environment.bounds);
    expect(p.x).toBeCloseTo(95); expect(p.y).toBeGreaterThan(1.72);
    expect(p.y - terrainHeight(p.x, p.z)).toBeCloseTo(1.72);
  });
});
