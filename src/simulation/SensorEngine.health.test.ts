import { describe, expect, it } from 'vitest';
import { environment } from './config';
import { getOpticalRange, SensorEngine, type SensorDifficulty, type SensorTrack } from './SensorEngine';
import { setTerrainSurface } from './TerrainSurface';
import type { EntityState } from './types';

const clear={timeOfDay:'day' as const,visibility:'clear' as const};
const make=(seed:number,difficulty?:SensorDifficulty)=>{
  const map=structuredClone(environment);
  setTerrainSurface(map.terrain,{heightAt:()=>0});map.placements=[];
  return new SensorEngine(map,seed,difficulty?{difficulty}:undefined);
};
const entity=(position={x:0,y:25,z:500}):EntityState=>({
  id:'aerial-private-01',assetId:'airframe-secret',position,previous:position,heading:0,zones:[],
});
const pointEO=(sensors:SensorEngine,target:EntityState)=>{
  const dx=target.position.x-sensors.eo.position.x,dz=target.position.z-sensors.eo.position.z,dy=target.position.y-sensors.eo.position.y;
  sensors.setEO(Math.atan2(dx,dz)*180/Math.PI,Math.atan2(dy,Math.hypot(dx,dz))*180/Math.PI,true);
};

describe('deterministic sensor health profiles',()=>{
  it('preserves default constructor behavior and exposes a safe foundation health summary',()=>{
    const implicit=make(19),explicit=make(19,'foundation'),target=entity();
    for(let time=1;time<=6;time++){
      implicit.update(time,[target],clear);explicit.update(time,[target],clear);
    }
    expect([...explicit.tracks.values()]).toEqual([...implicit.tracks.values()]);
    expect(explicit.events).toEqual(implicit.events);
    expect(explicit.getHealthSummary()).toEqual({
      difficulty:'foundation',radarLatencySeconds:0,radarNoiseMeters:25,
      radarIntermittenceProbability:0,eoRangeScale:1,eoOutageProbability:0,
    });
    expect(JSON.stringify(explicit.getHealthSummary())).not.toContain('aerial-private-01');
    expect(explicit.getHealthSummary().radarNoiseMeters).toBe(explicit.radar.errorMeters);
  });

  it.each([
    ['intermediate',1,2],['advanced',2,3],
  ] as const)('%s delays radar reports by its configured sensor latency', (difficulty,latency,firstDelivery)=>{
    const sensors=make(731,difficulty),target=entity();
    for(let time=1;time<firstDelivery;time++){
      sensors.update(time,[target],clear);
      expect(sensors.tracks.size).toBe(0);
    }
    let time=firstDelivery;
    for(let count=0;count<20&&sensors.tracks.size===0;count++,time++)sensors.update(time,[target],clear);
    const firstTrack=[...sensors.tracks.values()][0];
    expect(firstTrack).toMatchObject({state:'acquiring'});
    expect(time-1-firstTrack.time).toBe(latency);
    expect(sensors.getHealthSummary().radarLatencySeconds).toBe(latency);
  });

  it('raises track confidence after consecutive delivered reports and preserves the foundation noise bound',()=>{
    const baseline=make(22),intermediate=make(22,'intermediate'),target=entity();
    for(let time=1;time<=8;time++){
      baseline.update(time,[target],clear);intermediate.update(time,[target],clear);
    }
    const baselineTrack=[...baseline.tracks.values()][0],track=[...intermediate.tracks.values()][0];
    expect(track.state).toBe('firm');
    expect(Math.abs(baselineTrack.position.x-target.position.x)).toBeLessThanOrEqual(25);
    expect(Math.abs(baselineTrack.position.z-target.position.z)).toBeLessThanOrEqual(25);
    expect(Math.abs(track.position.x-target.position.x)).toBeLessThanOrEqual(55);
    expect(Math.abs(track.position.z-target.position.z)).toBeLessThanOrEqual(55);
    expect(track).not.toHaveProperty('assetId');
    expect(track).not.toHaveProperty('affiliation');
  });

  it('produces seeded radar dropouts and identical track histories for matching seeds',()=>{
    const left=make(8801,'advanced'),right=make(8801,'advanced'),target=entity();
    const leftHistory:unknown[]=[],rightHistory:unknown[]=[];
    for(let time=1;time<=100;time++){
      left.update(time,[target],clear);right.update(time,[target],clear);
      leftHistory.push({tracks:structuredClone([...left.tracks.values()]),events:structuredClone(left.events)});
      rightHistory.push({tracks:structuredClone([...right.tracks.values()]),events:structuredClone(right.events)});
    }
    expect(leftHistory).toEqual(rightHistory);
    expect(leftHistory.some(sample=>{
      const tracks=(sample as {tracks:SensorTrack[]}).tracks;
      return tracks.some(track=>track.missed>0||track.state==='coasting');
    })).toBe(true);
  });

  it('coasts, loses, then reacquires a contact after advanced-profile latency',()=>{
    const sensors=make(504,'advanced'),target=entity();let time=1;
    for(;time<=40&&[...sensors.tracks.values()][0]?.state!=='firm';time++)sensors.update(time,[target],clear);
    expect([...sensors.tracks.values()][0]?.state).toBe('firm');
    const trackId=[...sensors.tracks.keys()][0];
    for(let count=0;count<24&&sensors.tracks.get(trackId)?.state!=='lost';count++,time++)sensors.update(time,[],clear);
    expect(sensors.tracks.get(trackId)?.state).toBe('lost');
    for(let count=0;count<40&&sensors.tracks.get(trackId)?.state!=='firm';count++,time++)sensors.update(time,[target],clear);
    expect(sensors.tracks.get(trackId)?.state).toBe('firm');
    const transitions=sensors.events.filter(event=>event.trackId===trackId).map(event=>event.type);
    expect(transitions).toContain('radar-coasting');
    expect(transitions).toContain('radar-lost');
    expect(transitions).toContain('radar-acquiring');
    expect(transitions.at(-1)).toBe('radar-firm');
  });

  it('degrades EO range and produces reproducible outage/recovery events',()=>{
    const far=entity({x:0,y:25,z:900});
    const baseline=make(91),advanced=make(91,'advanced');pointEO(baseline,far);pointEO(advanced,far);
    baseline.update(1,[far],clear);advanced.update(1,[far],clear);
    expect(baseline.observations).toHaveLength(1);
    expect(advanced.observations).toHaveLength(0);
    expect(advanced.getHealthSummary().eoRangeScale).toBeLessThan(baseline.getHealthSummary().eoRangeScale);

    const left=make(191,'advanced'),right=make(191,'advanced'),near=entity({x:0,y:25,z:400});pointEO(left,near);pointEO(right,near);
    const leftSamples:boolean[]=[],rightSamples:boolean[]=[];
    for(let time=1;time<=100;time++){
      left.update(time,[near],clear);right.update(time,[near],clear);
      leftSamples.push(left.observations.length>0);rightSamples.push(right.observations.length>0);
    }
    expect(leftSamples).toEqual(rightSamples);
    expect(leftSamples).toContain(true);expect(leftSamples).toContain(false);
    expect(left.events.some(event=>event.type==='eo-outage')).toBe(true);
    expect(left.events.some(event=>event.type==='eo-restored')).toBe(true);
    expect(left.events.every(event=>!event.message.includes('airframe-secret'))).toBe(true);
  });

  it('reduces optical range for rain and fog while preserving clear-weather defaults',()=>{
    const map=make(5).environment;
    const baseline=getOpticalRange(map,clear);
    const rain=getOpticalRange(map,{...clear,weather:'rain'});
    const fog=getOpticalRange(map,{...clear,weather:'fog'});
    expect(baseline).toBe(1100);
    expect(rain).toBeLessThan(baseline);
    expect(fog).toBeLessThan(rain);
    expect(getOpticalRange(map,{...clear,weather:'fog',timeOfDay:'night'})).toBeLessThan(fog);
  });

  it('clears queued reports, dropout continuity and outage state on reset',()=>{
    const sensors=make(4,'advanced'),target=entity();
    sensors.update(1,[target],clear);
    expect(sensors.tracks.size).toBe(0);
    sensors.reset();
    expect(sensors.tracks.size).toBe(0);expect(sensors.events).toHaveLength(0);
    sensors.update(1,[target],clear);sensors.update(2,[target],clear);sensors.update(3,[target],clear);
    expect([...sensors.tracks.values()][0]?.state).toBe('acquiring');
  });
});
