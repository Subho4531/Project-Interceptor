import type { Conditions, EntityState, EnvironmentConfig, Vec3 } from './types';
import { terrainHeight } from './world';

export interface SensorConfig { id: 'radar' | 'eo'; position: Vec3; range: number; updateInterval: number; bearing: number; elevation: number; fieldOfView: number; errorMeters: number; }
export interface SensorObservation { id: string; sensorId: 'radar' | 'eo'; entityId: string; position: Vec3; time: number; bearing: number; elevation: number; }
export interface SensorTrack extends SensorObservation { label: string; state: 'acquiring' | 'firm' | 'coasting' | 'lost'; quality: number; age: number; detections: number; missed: number; /** Observed radar plots for this track, oldest first (bounded). Trainee-visible trace. */ trail?: Array<{ x: number; y: number; z: number; t: number }>; }
export interface SensorEvent { time: number; type: string; trackId: string; message: string; }
export type SensorDifficulty = 'foundation' | 'intermediate' | 'advanced';
export interface SensorEngineOptions { difficulty?: SensorDifficulty; }
export interface SensorHealthSummary {
  difficulty: SensorDifficulty;
  radarLatencySeconds: number;
  radarNoiseMeters: number;
  radarIntermittenceProbability: number;
  eoRangeScale: number;
  eoOutageProbability: number;
}
const SENSOR_HEALTH: Record<SensorDifficulty, SensorHealthSummary> = {
  foundation: { difficulty: 'foundation', radarLatencySeconds: 0, radarNoiseMeters: 25, radarIntermittenceProbability: 0, eoRangeScale: 1, eoOutageProbability: 0 },
  intermediate: { difficulty: 'intermediate', radarLatencySeconds: 1, radarNoiseMeters: 55, radarIntermittenceProbability: 0.09, eoRangeScale: 0.78, eoOutageProbability: 0.08 },
  advanced: { difficulty: 'advanced', radarLatencySeconds: 2, radarNoiseMeters: 85, radarIntermittenceProbability: 0.2, eoRangeScale: 0.55, eoOutageProbability: 0.2 },
};
const DEG=Math.PI/180;
export const angularDifference=(a:number,b:number)=>Math.abs(((a-b+540)%360)-180);
/** Shared optical limit matching Babylon EXP2 fog at 5% transmittance. */
export function getOpticalRange(environment:EnvironmentConfig,conditions:Conditions,maximumRange=1100):number {
  const weatherDensity=conditions.weather==='fog' ? .026 : conditions.weather==='rain' ? .0035 : 0;
  const density=Math.max(environment.visibility[conditions.visibility],weatherDensity);
  const fogLimit=density>0?Math.sqrt(-Math.log(.05))/density:Infinity;
  return Math.min(maximumRange*(conditions.visibility==='reduced'?.45:1),fogLimit)*(conditions.timeOfDay==='night'?.35:1);
}
export function inOpticalFrustum(offset:Vec3,bearing:number,elevation:number,horizontalFov:number):boolean {
  const yaw=bearing*DEG,pitch=elevation*DEG;
  const forward=offset.x*Math.sin(yaw)*Math.cos(pitch)+offset.y*Math.sin(pitch)+offset.z*Math.cos(yaw)*Math.cos(pitch);
  if(forward<=0)return false;
  const right=offset.x*Math.cos(yaw)-offset.z*Math.sin(yaw);
  const up=-offset.x*Math.sin(yaw)*Math.sin(pitch)+offset.y*Math.cos(pitch)-offset.z*Math.cos(yaw)*Math.sin(pitch);
  const tangent=Math.tan(horizontalFov*DEG/2);
  return Math.abs(right)<=forward*tangent && Math.abs(up)<=forward*tangent*9/16;
}
export function lineOfSight(a: Vec3,b: Vec3,environment: EnvironmentConfig): boolean {
  const steps=Math.max(2,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z)/4));
  for(let i=1;i<steps;i++) {
    const t=i/steps,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t,z=a.z+(b.z-a.z)*t;
    if(terrainHeight(x,z,environment.terrain)+.15>=y) return false;
    for(const p of environment.placements) if(x>=p.position.x-p.size.x/2 && x<=p.position.x+p.size.x/2 && z>=p.position.z-p.size.z/2 && z<=p.position.z+p.size.z/2) {
      const base=terrainHeight(p.position.x,p.position.z,environment.terrain)+p.position.y;
      if(y>=base && y<=base+p.size.y)return false;
    }
  }
  return true;
}
function randomUnit(seed:number,second:number,id:string,axis:number) {
  let value=(seed ^ Math.imul(second,1597334677) ^ axis)|0;
  for(const char of id)value=Math.imul(value^char.charCodeAt(0),16777619);
  value^=value<<13;value^=value>>>17;value^=value<<5;
  return (value>>>0)/4294967295;
}
function noise(seed:number,second:number,id:string,axis:number,maximum=25) {
  return (randomUnit(seed,second,id,axis)*2-1)*maximum;
}
interface PendingRadarReport { dueAt: number; track: SensorTrack; }
export class SensorEngine {
  readonly radar: SensorConfig;
  readonly eo: SensorConfig;
  readonly tracks=new Map<string,SensorTrack>();
  observations: SensorObservation[]=[];
  events: SensorEvent[]=[];
  readonly difficulty: SensorDifficulty;
  private readonly health: SensorHealthSummary;
  private nextUpdate=1;
  private previousEO=new Set<string>();
  private readonly pendingRadarReports: PendingRadarReport[]=[];
  private readonly radarDetectionRun=new Map<string,{second:number;count:number}>();
  private readonly trails=new Map<string,Array<{x:number;y:number;z:number;t:number}>>();
  private eoOutage=false;
  constructor(public readonly environment: EnvironmentConfig,private seed:number,options:SensorEngineOptions={}) {
    this.difficulty=options.difficulty??'foundation';
    this.health={...SENSOR_HEALTH[this.difficulty]};
    const ground=terrainHeight(0,0,environment.terrain);
    this.radar={id:'radar',position:{x:0,y:ground+12,z:0},range:2200,updateInterval:1,bearing:0,elevation:0,fieldOfView:360,errorMeters:this.health.radarNoiseMeters};
    this.eo={id:'eo',position:{x:0,y:ground+5,z:0},range:1100,updateInterval:1,bearing:0,elevation:10,fieldOfView:40,errorMeters:0};
  }
  /** Public, truth-free summary for training setup and sensor-status displays. */
  getHealthSummary():SensorHealthSummary { return {...this.health}; }
  setEO(bearing:number,elevation:number,zoom:boolean) { this.eo.bearing=((bearing%360)+360)%360;this.eo.elevation=elevation;this.eo.fieldOfView=zoom?8:40; }
  reset() {this.tracks.clear();this.observations=[];this.events=[];this.nextUpdate=1;this.previousEO.clear();this.pendingRadarReports.length=0;this.radarDetectionRun.clear();this.trails.clear();this.eoOutage=false;}
  /** Bounded traced path of observed plots for one track id. */
  private trace(id: string, plot: { x: number; y: number; z: number }, time: number): SensorTrack['trail'] {
    const trail = this.trails.get(id) ?? [];
    trail.push({ x: plot.x, y: plot.y, z: plot.z, t: time });
    if (trail.length > 96) trail.splice(0, trail.length - 96);
    this.trails.set(id, trail);
    return trail.map(item => ({ ...item }));
  }
  update(time:number,entities:Iterable<EntityState>,conditions:Conditions) {
    // The original constructor path remains the baseline: existing sessions and
    // replays receive the exact prior measurement timing and noise profile.
    if(this.difficulty==='foundation')return this.updateFoundation(time,entities,conditions);
    return this.updateDegraded(time,entities,conditions);
  }
  private updateFoundation(time:number,entities:Iterable<EntityState>,conditions:Conditions) {
    if(time+1e-9<this.nextUpdate) return;
    const second=Math.floor(time+1e-9);this.nextUpdate=second+1;
    const active=[...entities],seen=new Set<string>();this.observations=[];
    for(const entity of active) {
      const p=entity.position,radarDistance=Math.hypot(p.x-this.radar.position.x,p.y-this.radar.position.y,p.z-this.radar.position.z);
      if(radarDistance<=this.radar.range && lineOfSight(this.radar.position,p,this.environment)) {
        seen.add(entity.id);const id=`radar-${entity.id}`,old=this.tracks.get(id),detections=(old?.missed===0?old.detections:0)+1;
        const position={...p,x:p.x+noise(this.seed,second,entity.id,1),z:p.z+noise(this.seed,second,entity.id,2)};
        const bearing=((Math.atan2(position.x-this.radar.position.x,position.z-this.radar.position.z)/DEG)%360+360)%360;
        const state=detections>=2?'firm':'acquiring';
        const track:SensorTrack={id,sensorId:'radar',entityId:entity.id,label:`Track ${entity.id.split('-').at(-1)}`,position,time,bearing,elevation:Math.atan2(position.y-this.radar.position.y,Math.hypot(position.x,position.z))/DEG,state,quality:Math.min(1,detections/5),age:0,detections,missed:0,trail:this.trace(id,p,time)};
        this.tracks.set(id,track);
        if(old?.state!==state)this.record(time,`radar-${state}`,id,`${track.label}: ${state}.`);
      }
      const dx=p.x-this.eo.position.x,dz=p.z-this.eo.position.z,dy=p.y-this.eo.position.y,distance=Math.hypot(dx,dy,dz),bearing=((Math.atan2(dx,dz)/DEG)%360+360)%360,elevation=Math.atan2(dy,Math.hypot(dx,dz))/DEG;
      const range=getOpticalRange(this.environment,conditions,this.eo.range);
      // 0.3 m is the conservative smallest training silhouette, not a capability claim.
      if(distance<=range && inOpticalFrustum({x:dx,y:dy,z:dz},this.eo.bearing,this.eo.elevation,this.eo.fieldOfView) && 2*Math.atan(.15/Math.max(distance,.1))/DEG >= (this.eo.fieldOfView===8?.015:.04) && lineOfSight(this.eo.position,p,this.environment)) {
        this.observations.push({id:`eo-${entity.id}`,sensorId:'eo',entityId:entity.id,position:{...p},time,bearing,elevation});
      }
    }
    for(const track of this.tracks.values()) if(!seen.has(track.entityId)) {
      const before=track.state;track.missed++;track.age=Math.max(0,time-track.time);track.quality=Math.max(0,track.quality-.1);
      if(track.age>=10)track.state='lost';else if(track.missed>=3)track.state='coasting';
      if(before!==track.state)this.record(time,`radar-${track.state}`,track.id,`${track.label}: ${track.state}; last report ${Math.round(track.age)} s ago.`);
    }
    const currentEO=new Set(this.observations.map(o=>o.id));
    for(const observation of this.observations)if(!this.previousEO.has(observation.id))this.record(time,'eo-acquired',observation.id,'EO acquired an unclassified visual contact.');
    for(const id of this.previousEO)if(!currentEO.has(id))this.record(time,'eo-lost',id,'EO visual contact lost: pointing, visibility or masking changed.');
    this.previousEO=currentEO;
    if(this.events.length>2000)this.events.splice(0,500);
  }
  private updateDegraded(time:number,entities:Iterable<EntityState>,conditions:Conditions) {
    if(time+1e-9<this.nextUpdate)return;
    const second=Math.floor(time+1e-9);this.nextUpdate=second+1;
    const active=[...entities],radarSeen=new Set<string>();this.observations=[];
    const eoAvailable=randomUnit(this.seed,second,'eo-health',81)>=this.health.eoOutageProbability;
    if(eoAvailable===this.eoOutage){
      this.eoOutage=!eoAvailable;
      this.record(time,eoAvailable?'eo-restored':'eo-outage','eo',eoAvailable?'EO feed restored.':'EO feed temporarily unavailable.');
    }
    for(const entity of active){
      const p=entity.position;
      const radarDistance=Math.hypot(p.x-this.radar.position.x,p.y-this.radar.position.y,p.z-this.radar.position.z);
      const radarInView=radarDistance<=this.radar.range&&lineOfSight(this.radar.position,p,this.environment);
      const radarAvailable=radarInView&&randomUnit(this.seed,second,entity.id,83)>=this.health.radarIntermittenceProbability;
      if(radarAvailable){
        radarSeen.add(entity.id);
        const prior=this.radarDetectionRun.get(entity.id),detections=prior?.second===second-1?prior.count+1:1;
        this.radarDetectionRun.set(entity.id,{second,count:detections});
        const position={...p,x:p.x+noise(this.seed,second,entity.id,1,this.health.radarNoiseMeters),z:p.z+noise(this.seed,second,entity.id,2,this.health.radarNoiseMeters)};
        const bearing=((Math.atan2(position.x-this.radar.position.x,position.z-this.radar.position.z)/DEG)%360+360)%360;
        const track:SensorTrack={id:`radar-${entity.id}`,sensorId:'radar',entityId:entity.id,label:`Track ${entity.id.split('-').at(-1)}`,position,time,bearing,elevation:Math.atan2(position.y-this.radar.position.y,Math.hypot(position.x,position.z))/DEG,state:detections>=2?'firm':'acquiring',quality:Math.min(1,detections/5),age:0,detections,missed:0,trail:this.trace(`radar-${entity.id}`,p,time)};
        this.pendingRadarReports.push({dueAt:time+this.health.radarLatencySeconds,track});
      }else this.radarDetectionRun.delete(entity.id);

      if(!eoAvailable)continue;
      const dx=p.x-this.eo.position.x,dz=p.z-this.eo.position.z,dy=p.y-this.eo.position.y,distance=Math.hypot(dx,dy,dz),bearing=((Math.atan2(dx,dz)/DEG)%360+360)%360,elevation=Math.atan2(dy,Math.hypot(dx,dz))/DEG;
      const range=getOpticalRange(this.environment,conditions,this.eo.range*this.health.eoRangeScale);
      // 0.3 m remains the conservative smallest training silhouette.
      if(distance<=range&&inOpticalFrustum({x:dx,y:dy,z:dz},this.eo.bearing,this.eo.elevation,this.eo.fieldOfView)&&2*Math.atan(.15/Math.max(distance,.1))/DEG>=(this.eo.fieldOfView===8?.015:.04)&&lineOfSight(this.eo.position,p,this.environment)){
        this.observations.push({id:`eo-${entity.id}`,sensorId:'eo',entityId:entity.id,position:{...p},time,bearing,elevation});
      }
    }
    for(const entityId of this.radarDetectionRun.keys())if(!radarSeen.has(entityId))this.radarDetectionRun.delete(entityId);

    // Age stale plots every scan. A current raw detection prevents a miss while
    // its delayed report is in transit, but consumers still see the old capture time.
    for(const track of this.tracks.values()){
      track.age=Math.max(0,time-track.time);
      if(radarSeen.has(track.entityId)){track.missed=0;continue;}
      const before=track.state;track.missed++;track.quality=Math.max(0,track.quality-.1);
      if(track.age>=10)track.state='lost';else if(track.missed>=3)track.state='coasting';
      if(before!==track.state)this.record(time,`radar-${track.state}`,track.id,`${track.label}: ${track.state}; last report ${Math.round(track.age)} s ago.`);
    }

    const ready=this.pendingRadarReports.filter(report=>report.dueAt<=time+1e-9).sort((a,b)=>a.dueAt-b.dueAt||a.track.time-b.track.time);
    const readySet=new Set(ready);
    for(let index=this.pendingRadarReports.length-1;index>=0;index--)if(readySet.has(this.pendingRadarReports[index]))this.pendingRadarReports.splice(index,1);
    for(const report of ready){
      const sample=report.track,old=this.tracks.get(sample.id);
      if(old&&old.time>sample.time)continue;
      const track={...sample,age:Math.max(0,time-sample.time),missed:0};
      this.tracks.set(track.id,track);
      if(old?.state!==track.state)this.record(time,`radar-${track.state}`,track.id,`${track.label}: ${track.state}.`);
    }

    const currentEO=new Set(this.observations.map(observation=>observation.id));
    for(const observation of this.observations)if(!this.previousEO.has(observation.id))this.record(time,'eo-acquired',observation.id,'EO acquired an unclassified visual contact.');
    for(const id of this.previousEO)if(!currentEO.has(id))this.record(time,'eo-lost',id,'EO visual contact lost: pointing, visibility or masking changed.');
    this.previousEO=currentEO;
    if(this.events.length>2000)this.events.splice(0,500);
  }
  private record(time:number,type:string,trackId:string,message:string) {this.events.push({time,type,trackId,message});}
}
