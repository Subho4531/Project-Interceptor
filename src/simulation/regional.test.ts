import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { GridTerrainSurface, setTerrainSurface, type Heightfield } from './TerrainSurface';
import { localToGeographic, geographicToLocal } from './geographic';
import { environment, environments } from './config';
import { SensorEngine, lineOfSight, inOpticalFrustum, getOpticalRange } from './SensorEngine';
import { createTrainingScenario } from './trainingScenarios';
import { sampleRoute } from './Simulation';
import { terrainHeight, moveObserver, principalObstacles, collides } from './world';
import type { EntityState } from './types';
import { posts } from '../dashboard/posts';
const entity=(position={x:100,y:25,z:200}):EntityState=>({id:'aerial-01',assetId:'hidden',position,previous:position,heading:0,zones:[]});
const clear={timeOfDay:'day' as const,visibility:'clear' as const};
describe('regional terrain and geographic frame',()=>{
  it.each(posts)('round-trips $name including cardinal headings within 1 cm',post=>{
    for(const heading of [0,Math.PI/2,Math.PI,Math.PI*1.5])for(const point of [{x:0,z:0},{x:3000,z:3000},{x:-3000,z:3000},{x:50,z:-100}]){
      const result=geographicToLocal(localToGeographic(point,post.origin,heading),post.origin,heading);
      expect(Math.hypot(result.x-point.x,result.z-point.z)).toBeLessThan(.01);
    }
    expect(localToGeographic({x:100,z:0},post.origin)[0]).toBeGreaterThan(post.origin[0]);
    expect(localToGeographic({x:0,z:100},post.origin)[1]).toBeGreaterThan(post.origin[1]);
  });
  it('uses the imported triangle diagonal, clamps boundary samples and rejects corrupt data',()=>{
    const surface=new GridTerrainSurface({minX:0,minZ:0,columns:2,rows:2,spacing:1,heights:[0,0,0,10]});
    expect(surface.heightAt(.2,.2)).toBe(0);expect(surface.heightAt(.8,.8)).toBeCloseTo(6);expect(surface.heightAt(20,20)).toBe(10);
    expect(()=>new GridTerrainSurface({minX:0,minZ:0,columns:2,rows:2,spacing:1,heights:[0,1,NaN,1]})).toThrow();
  });
  it.each(posts)('keeps all four $name authored exercises above real terrain and principal roofs',post=>{
    const map=structuredClone(environments.find(e=>e.id===post.environmentId)!);
    const data=JSON.parse(readFileSync(`public/assets/regions/${post.id}/heightfield.json`,'utf8')) as Heightfield;
    setTerrainSurface(map.terrain,new GridTerrainSurface(data));
    for(const scenarioId of ['low-ingress','surveillance','penetration','swarm'] as const){
      const config=createTrainingScenario(map,scenarioId,{swarmCount:12,pairDelay:30});
      expect(new Set(config.entities.map(e=>e.id)).size).toBe(config.entities.length);
      for(const e of config.entities) {
        const length=e.route.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-e.route[i].x,p.y-e.route[i].y,p.z-e.route[i].z),0);
        for(let distance=0;distance<=length;distance+=1){const {position:p}=sampleRoute(e.route,distance);expect(p.y-terrainHeight(p.x,p.z,map.terrain)).toBeGreaterThanOrEqual(6.5);
          for(const obstacle of map.placements)if(Math.abs(p.x-obstacle.position.x)<=obstacle.size.x/2&&Math.abs(p.z-obstacle.position.z)<=obstacle.size.z/2)expect(p.y-terrainHeight(obstacle.position.x,obstacle.position.z,map.terrain)-obstacle.size.y).toBeGreaterThanOrEqual(6.5);
        }
      }
    }
    const moved=moveObserver({x:0,y:1.72,z:0},80,0,principalObstacles(map),map.bounds,map.terrain);
    expect(collides(moved.x,moved.z,principalObstacles(map))).toBe(false);expect(moved.y-terrainHeight(moved.x,moved.z,map.terrain)).toBeCloseTo(1.72);
  });
});
describe('fictional radar and EO rules',()=>{
  it('uses the same 16:9 horizontal frustum as the EO camera at high elevation',()=>{
    const pitch=80*Math.PI/180;
    expect(inOpticalFrustum({x:0,y:100*Math.sin(pitch),z:100*Math.cos(pitch)},0,80,8)).toBe(true);
    expect(inOpticalFrustum({x:8,y:100*Math.sin(pitch),z:100*Math.cos(pitch)},0,80,8)).toBe(false);
    expect(inOpticalFrustum({x:0,y:-100*Math.sin(pitch),z:-100*Math.cos(pitch)},0,80,40)).toBe(false);
    expect(inOpticalFrustum({x:0,y:21,z:100},0,0,40)).toBe(false);
    expect(inOpticalFrustum({x:0,y:20,z:100},0,0,40)).toBe(true);
  });
  const make=()=>{const map=structuredClone(environment);setTerrainSurface(map.terrain,{heightAt:()=>0});map.placements=[];return new SensorEngine(map,26052);};
  it('acquires after two updates and coasts/loss occurs on missed simulation updates',()=>{
    const sensors=make();sensors.update(.5,[entity()],clear);expect(sensors.tracks.size).toBe(0);
    sensors.update(1,[entity()],clear);expect([...sensors.tracks.values()][0].state).toBe('acquiring');
    sensors.update(2,[entity()],clear);expect([...sensors.tracks.values()][0].state).toBe('firm');
    sensors.update(3,[],clear);sensors.update(4,[],clear);expect([...sensors.tracks.values()][0].state).toBe('firm');
    sensors.update(5,[],clear);expect([...sensors.tracks.values()][0].state).toBe('coasting');
    for(let t=6;t<=12;t++)sensors.update(t,[],clear);expect([...sensors.tracks.values()][0].state).toBe('lost');
    sensors.update(13,[entity()],clear);expect([...sensors.tracks.values()][0].state).toBe('acquiring');sensors.update(14,[entity()],clear);expect([...sensors.tracks.values()][0].state).toBe('firm');
  });
  it('seeded measurements reproduce bounded horizontal error without revealing airframe',()=>{
    const a=make(),b=make();for(let t=1;t<=5;t++){a.update(t,[entity()],clear);b.update(t,[entity()],clear);}
    expect([...a.tracks.values()]).toEqual([...b.tracks.values()]);const track=[...a.tracks.values()][0];expect(Math.abs(track.position.x-100)).toBeLessThanOrEqual(25);expect(Math.abs(track.position.z-200)).toBeLessThanOrEqual(25);expect(track).not.toHaveProperty('assetId');
  });
  it('masks terrain and solid structures',()=>{
    const sensors=make(),a={x:0,y:12,z:0},b={x:0,y:25,z:200};
    setTerrainSurface(sensors.environment.terrain,{heightAt:(_x,z)=>z>40&&z<80?80:0});expect(lineOfSight(a,b,sensors.environment)).toBe(false);
    setTerrainSurface(sensors.environment.terrain,{heightAt:()=>0});sensors.environment.placements=[{id:'wall',module:'facility',position:{x:0,y:0,z:60},size:{x:10,y:30,z:5}}];expect(lineOfSight(a,b,sensors.environment)).toBe(false);
  });
  it('EO requires pointing, angular size and conditions; zoom narrows FOV',()=>{
    const sensors=make(),target=entity({x:0,y:25,z:500});sensors.setEO(0,Math.atan2(20,500)*180/Math.PI,false);sensors.update(1,[target],clear);expect(sensors.observations).toHaveLength(0);
    sensors.setEO(0,Math.atan2(20,500)*180/Math.PI,true);sensors.update(2,[target],clear);expect(sensors.observations).toHaveLength(1);
    sensors.update(3,[target],{timeOfDay:'night',visibility:'clear'});expect(sensors.observations).toHaveLength(0);
    sensors.setEO(20,0,true);sensors.update(4,[target],clear);expect(sensors.observations).toHaveLength(0);
  });
  it('EO and trainee optical range share EXP2 fog transmittance limits',()=>{
    const sensors=make(),target=entity({x:0,y:25,z:400});sensors.setEO(0,Math.atan2(20,400)*180/Math.PI,true);
    sensors.update(1,[target],clear);expect(sensors.observations).toHaveLength(1);
    const reduced={timeOfDay:'day' as const,visibility:'reduced' as const};sensors.update(2,[target],reduced);expect(sensors.observations).toHaveLength(0);
    expect(getOpticalRange(sensors.environment,reduced)).toBeCloseTo(Math.sqrt(-Math.log(.05))/.013);
    expect(getOpticalRange(sensors.environment,{...reduced,timeOfDay:'night'})).toBeCloseTo(getOpticalRange(sensors.environment,reduced)*.35);
  });
});
