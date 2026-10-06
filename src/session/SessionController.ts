import { Simulation, FIXED_STEP, sampleRoute } from '../simulation/Simulation';
import { environments, createScenario } from '../simulation/config';
import { createTrainingScenario } from '../simulation/trainingScenarios';
import { GridTerrainSurface, setTerrainSurface } from '../simulation/TerrainSurface';
import type { Heightfield } from '../simulation/TerrainSurface';
import { SensorEngine } from '../simulation/SensorEngine';
import { ExerciseEngine, type ExerciseAction } from '../training/Exercise';
import { terrainHeight } from '../simulation/world';
import { localToGeographic } from '../simulation/geographic';
import { posts, postById } from '../dashboard/posts';
import type { SessionSnapshot, SessionAdapter, SimulationCommand, CommandResult, PostId, SessionEvent } from '../dashboard/types';
import type { DroneAssetDefinition, EnvironmentConfig, TrainingScenarioId, Vec3, ExerciseId, Classification, ResponseChoice } from '../simulation/types';
import { assetUrl } from '../routing';

export interface ObserverPose { position: Vec3; yaw: number; pitch: number; zoom: boolean; }
export interface SessionOptions { postId?: PostId; scenarioId?: TrainingScenarioId; availableAssets?: Set<string>; terrain?: Heightfield; }
const byteCache=new Map<string,Promise<ArrayBuffer>>();
function fetchBytes(url:string):Promise<ArrayBuffer> {
  let result=byteCache.get(url);
  if(!result){result=fetch(url).then(r=>{if(!r.ok)throw new Error(`${url}: HTTP ${r.status}`);return r.arrayBuffer();}).catch(e=>{byteCache.delete(url);throw e;});byteCache.set(url,result);}
  return result;
}
function validateGLB(data:ArrayBuffer,url:string) {
  if(data.byteLength<20)throw new Error(`Invalid GLB: ${url}`);
  const v=new DataView(data);
  if(data.byteLength<20 || v.getUint32(0,true)!==0x46546c67 || v.getUint32(4,true)!==2 || v.getUint32(8,true)!==data.byteLength || v.getUint32(16,true)!==0x4e4f534a)throw new Error(`Invalid GLB: ${url}`);
  const json=JSON.parse(new TextDecoder().decode(new Uint8Array(data,20,v.getUint32(12,true))));
  if(!json.meshes?.length || !json.nodes?.length)throw new Error(`GLB has no mesh hierarchy: ${url}`);
  const binOffset=20+v.getUint32(12,true),binLength=binOffset+8<=data.byteLength?v.getUint32(binOffset,true):0;
  if(binOffset+8>data.byteLength || v.getUint32(binOffset+4,true)!==0x004e4942 || binOffset+8+binLength>data.byteLength)throw new Error(`Missing GLB binary data: ${url}`);
  for(const view of json.bufferViews??[])if((view.buffer??0)!==0 || !Number.isInteger(view.byteLength) || view.byteLength<0 || (view.byteOffset??0)<0 || (view.byteOffset??0)+view.byteLength>binLength)throw new Error(`Invalid GLB buffer view: ${url}`);
  for(const image of json.images??[])if(!Number.isInteger(image.bufferView) || !json.bufferViews?.[image.bufferView] || !['image/jpeg','image/png','image/webp','image/ktx2'].includes(image.mimeType))throw new Error(`GLB textures must be embedded and supported: ${url}`);
  for(const texture of json.textures??[]){const source=texture.source??texture.extensions?.KHR_texture_basisu?.source??texture.extensions?.EXT_texture_webp?.source;if(!Number.isInteger(source)||!json.images?.[source])throw new Error(`GLB texture references a missing image: ${url}`);}
}
async function validatedGLB(url:string){const absolute=assetUrl(url);if(new URL(absolute).origin!==new URL(document.baseURI).origin)throw new Error('Required 3D assets must be hosted locally.');try{const bytes=await fetchBytes(absolute);validateGLB(bytes,url);return bytes;}catch(error){byteCache.delete(absolute);throw error;}}
export class SessionController implements SessionAdapter {
  sim!: Simulation;
  environment!: EnvironmentConfig;
  sensorEngine!: SensorEngine;
  sensorExercise!: ExerciseEngine;
  observer!: ObserverPose;
  alpha=0;
  private postId:PostId;
  private scenarioId:TrainingScenarioId;
  private exerciseId:ExerciseId;
  private quietPeriod=25;
  private swarmCount=4;
  private pairDelay=4;
  private speed:1|2|4=1;
  private availableAssets:Set<string>;
  private assetsReady=false;
  private error?:string;
  private loadState:NonNullable<SessionSnapshot['loadState']>='idle';
  private generation=0;
  private sessionNumber=0;
  private instanceId=`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
  private events:SessionEvent[]=[];
  private eventSequence=0;
  private simulationEventCount=0;
  private sensorEventCount=0;
  private listeners=new Set<()=>void>();
  private snapshot!:SessionSnapshot;
  private frame?:number;
  private cleanups:(()=>void)[]=[];
  private loadPromise?:Promise<void>;
  private trails=new Map<string,Vec3[]>();
  private lastTrailTime=-1;
  private regionalMetadata?:Record<string,unknown>;
  constructor(options:SessionOptions={}) {
    this.postId=options.postId??'shakti-punjab';this.scenarioId=options.scenarioId??'low-ingress';this.exerciseId=this.scenarioId;this.availableAssets=options.availableAssets??new Set();
    this.makeEnvironment();
    if(options.terrain)setTerrainSurface(this.environment.terrain,new GridTerrainSurface(options.terrain));
    this.assetsReady=Boolean(options.availableAssets && options.terrain);this.loadState=this.assetsReady?'ready':'idle';
    this.rebuild();this.refresh();
  }
  getSnapshot=()=>this.snapshot;
  get exercise(){return this.exerciseId;}
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};};
  getAssetBytes(url:string){return fetchBytes(assetUrl(url));}
  private makeEnvironment(){
    this.regionalMetadata=undefined;
    const post=postById(this.postId),legacy=environments.find(e=>e.id===post.environmentId)!;
    this.environment=structuredClone(legacy);
    this.environment.label=`${post.name} · ${post.region}`;
    this.environment.description=`Fictional ${post.name} compound in georeferenced ${post.terrain.toLowerCase()}.`;
    this.environment.terrain.size=6000;this.environment.terrain.subdivisions=200;
    // Imported booth source dimensions; every compound module uses uniform scale.
    const booth={x:8,y:3.5157833549386677,z:3.0653649896194444};
    this.environment.placements=this.environment.placements.map(p=>{const scale=Math.min(p.size.x/booth.x,p.size.y/booth.y,p.size.z/booth.z);return {...p,module:'facility',size:{x:booth.x*scale,y:booth.y*scale,z:booth.z*scale}};});
    this.environment.regional={id:post.id,origin:post.origin,modelUrl:`./assets/regions/${post.id}/terrain.glb`,heightfieldUrl:`./assets/regions/${post.id}/heightfield.json`,imageryUrl:`./assets/regions/${post.id}/imagery.jpg`,metadataUrl:`./assets/regions/${post.id}/metadata.json`};
  }
  private rebuild(){
    const conditions=this.sim?.conditions??{timeOfDay:'day' as const,visibility:'clear' as const};
    const config=['low-ingress','surveillance','penetration','swarm'].includes(this.exerciseId)?createTrainingScenario(this.environment,this.scenarioId,{swarmCount:this.swarmCount,pairDelay:this.pairDelay}):createScenario(this.environment,this.exerciseId);config.quietPeriod=this.quietPeriod;config.conditions={...conditions};
    if(config.training)config.training.briefing.description=`${postById(this.postId).name}: ${config.training.briefing.description}`;
    this.sim=new Simulation(config,this.environment,this.availableAssets);this.sensorEngine=new SensorEngine(this.environment,config.seed);
    this.sensorExercise=new ExerciseEngine({seed:config.seed,quietPeriod:config.quietPeriod});
    if(typeof document!=='undefined')this.sim.setHidden(Boolean(document.hidden));
    const spawn=this.environment.observerSpawn;
    this.observer={position:{x:spawn.x,y:terrainHeight(spawn.x,spawn.z,this.environment.terrain)+1.72,z:spawn.z},yaw:spawn.heading,pitch:0,zoom:false};
    this.alpha=0;this.sessionNumber++;this.events=[];this.eventSequence=0;this.simulationEventCount=0;this.sensorEventCount=0;
    this.trails.clear();this.lastTrailTime=-1;
  }
  updateObserver(pose:Partial<ObserverPose>){this.observer={...this.observer,...pose};}
  private log(type:string,message:string,source:SessionEvent['source']='simulation',time=this.sim.time){
    if(source!=='simulation')this.collectEvents();
    this.events.push({id:`${this.sessionNumber}:${++this.eventSequence}`,time,type,message,source});if(this.events.length>10000)this.events.splice(0,1000);
  }
  private collectEvents(){
    const pending:{type:string;time:number;message:string}[]=this.sim.events.slice(this.simulationEventCount).map(e=>({type:e.type,time:e.time,message:`${e.type.replaceAll('-',' ')}${e.entityId?` · ${e.entityId}`:''}${e.type==='session-pause'?` (${String(e.payload.reason)})`:''}`}));
    this.simulationEventCount=this.sim.events.length;
    pending.push(...this.sensorEngine.events.slice(this.sensorEventCount).map(e=>({type:e.type,time:e.time,message:e.message})));
    this.sensorEventCount=this.sensorEngine.events.length;
    pending.sort((a,b)=>a.time-b.time);for(const e of pending)this.log(e.type,e.message,'simulation',e.time);
  }
  private refresh(){
    this.collectEvents();const post=postById(this.postId),geo=(p:Vec3)=>localToGeographic(p,post.origin,post.heading);
    if(this.sim.time-this.lastTrailTime>=.099 || this.lastTrailTime<0){for(const e of this.sim.entities.values()){const trail=this.trails.get(e.id)??[];trail.push({...e.position});if(trail.length>1800)trail.shift();this.trails.set(e.id,trail);}this.lastTrailTime=this.sim.time;}
    const tracks=this.sim.config.entities.map((e,index)=>{
      const spawnTime=this.sim.config.quietPeriod+e.spawnTime,active=this.sim.entities.get(e.id),sample=sampleRoute(e.route,Math.max(0,this.sim.time-spawnTime)*e.speed),position=active?.position??sample.position;
      return {id:e.id,label:`UAV ${String(index+1).padStart(2,'0')}`,airframe:e.assetId.replace('sketchfab-','').toUpperCase(),state:(this.sim.time<spawnTime?'scheduled':active?'active':'departed') as 'scheduled'|'active'|'departed',position:geo(position),altitudeAGL:position.y-terrainHeight(position.x,position.z,this.environment.terrain),speed:e.speed,heading:((active?.heading??sample.heading)*180/Math.PI+360)%360,route:e.route.map(geo),trail:(this.trails.get(e.id)??[]).map(geo),spawnTime};
    });
    const zone=this.environment.protectedZones[0];
    this.snapshot={mode:'live',sessionId:`session-${this.instanceId}-${this.sessionNumber}`,postId:this.postId,scenarioId:this.scenarioId,status:this.sim.status,time:this.sim.time,duration:this.quietPeriod+(this.sim.config.training?.duration??0),quietPeriod:this.quietPeriod,seed:this.sim.config.seed,speed:this.speed,conditions:{...this.sim.conditions},tracks,events:[...this.events],swarmCount:this.swarmCount,pairDelay:this.pairDelay,training:this.sim.trainingState(),assetsReady:this.assetsReady,error:this.error,loadState:this.loadState,
      protectedZone:zone?[geo({x:zone.minX,y:0,z:zone.minZ}),geo({x:zone.maxX,y:0,z:zone.minZ}),geo({x:zone.maxX,y:0,z:zone.maxZ}),geo({x:zone.minX,y:0,z:zone.maxZ}),geo({x:zone.minX,y:0,z:zone.minZ})]:[],
      sensorTracks:[...this.sensorEngine.tracks.values()].map(t=>({...structuredClone(t),age:Math.max(0,this.sim.time-t.time),geographicPosition:geo(t.position)})),eoObservations:this.sensorEngine.observations.map(o=>({...structuredClone(o),geographicPosition:geo(o.position)})),eo:{yaw:this.sensorEngine.eo.bearing*Math.PI/180,pitch:this.sensorEngine.eo.elevation*Math.PI/180,zoom:this.sensorEngine.eo.fieldOfView===8}};
    for(const listener of this.listeners)listener();
  }
  async loadAssets():Promise<void>{
    if(this.loadPromise)return this.loadPromise;if(this.assetsReady)return;
    const generation=this.generation;this.loadState='loading';this.error=undefined;this.refresh();
    this.loadPromise=(async()=>{
      try{
        const region=this.environment.regional!,response=await fetch(assetUrl('./assets/drones/catalog.json'));if(!response.ok)throw new Error(`Catalog HTTP ${response.status}`);
        const catalog=await response.json() as {assets:DroneAssetDefinition[]};if(!Array.isArray(catalog.assets))throw new Error('Invalid drone catalog');
        const definitions=catalog.assets.filter(a=>a.status==='available');const available=new Set<string>();
        for(const a of definitions)if(!a.id || !a.identity || !a.provenance?.sourceUrl || !a.provenance?.author?.name || !a.provenance?.license?.url || !Object.values(a.dimensions??{}).every(v=>Number.isFinite(v)&&v>0) || Object.values(a.dimensions??{}).length!==3 || !Number.isFinite(a.scaleCorrection) || a.scaleCorrection<=0 || Object.values(a.orientationCorrection??{}).length!==3 || !Object.values(a.orientationCorrection).every(Number.isFinite))throw new Error(`Invalid aircraft dimensions, transforms or provenance: ${a.id}`);
        await Promise.all(definitions.map(async a=>{await validatedGLB(a.modelUrl);available.add(a.id);}));
        await Promise.all(['booth','fence','barrier'].map(id=>validatedGLB(`./assets/environment/${id}.glb`)));
        for(const id of ['sketchfab-fpv','sketchfab-orlan','sketchfab-lancet','sketchfab-geran'])if(!available.has(id))throw new Error(`Required aircraft unavailable: ${id}`);
        const [heightData,metadataData]=await Promise.all([this.getAssetBytes(region.heightfieldUrl),this.getAssetBytes(region.metadataUrl),validatedGLB(region.modelUrl)]);
        const heightfield=JSON.parse(new TextDecoder().decode(heightData)) as Heightfield,metadata=JSON.parse(new TextDecoder().decode(metadataData)) as {originHeightEGM2008?:number;origin?:number[];verticalDatum?:string;licenses?:unknown[]};
        const surface=new GridTerrainSurface(heightfield);
        if(heightfield.minX!==-3000 || heightfield.minZ!==-3000 || Math.abs((heightfield.columns-1)*heightfield.spacing-6000)>.001 || Math.abs((heightfield.rows-1)*heightfield.spacing-6000)>.001 || !metadata.origin?.every(Number.isFinite) || metadata.origin.length!==2 || Math.abs(metadata.origin[0]-region.origin[0])>1e-7 || Math.abs(metadata.origin[1]-region.origin[1])>1e-7 || metadata.verticalDatum!=='EGM2008' || !Number.isFinite(metadata.originHeightEGM2008) || !metadata.licenses?.length || Math.abs((heightfield.originHeightEGM2008??NaN)-metadata.originHeightEGM2008!)>.001)throw new Error('Regional footprint, origin, datum or provenance does not match the selected post.');
        const image=await this.getAssetBytes(region.imageryUrl),imageBytes=new Uint8Array(image);if(image.byteLength<4 || imageBytes[0]!==255 || imageBytes[1]!==216 || imageBytes[image.byteLength-2]!==255 || imageBytes[image.byteLength-1]!==217)throw new Error('Invalid local regional JPEG imagery.');
        if(generation!==this.generation)return;
        setTerrainSurface(this.environment.terrain,surface);region.originHeightEGM2008=metadata.originHeightEGM2008;this.regionalMetadata=structuredClone(metadata);
        this.availableAssets=available;this.assetsReady=true;this.loadState='ready';this.rebuild();this.log('assets-ready','Local aircraft and regional terrain validated.');
      }catch(error){if(generation===this.generation){const region=this.environment.regional!;for(const url of [region.heightfieldUrl,region.metadataUrl,region.imageryUrl])byteCache.delete(assetUrl(url));this.assetsReady=false;this.loadState='error';this.error=String(error);this.log('assets-error',this.error);}}
      finally{if(generation===this.generation){this.loadPromise=undefined;this.refresh();}}
    })();return this.loadPromise;
  }
  command=(command:SimulationCommand,source:'operator'|'assistant'='operator'):CommandResult=>{
    const reject=(message:string)=>{this.log('command-rejected',`${command.type}: ${message}`,source);this.refresh();return {ok:false,message};};
    const active=this.sim.status!=='ready';
    if(['post','scenario','reset'].includes(command.type)&&active&&!(command as {discardConfirmed?:boolean}).discardConfirmed)return reject('Confirm discarding the current session.');
    let message='';
    switch(command.type){
      case 'start':if(this.sim.status!=='ready')return reject('Start requires a ready session.');if(!this.assetsReady)return reject(this.error??'Required local assets are loading.');this.sim.start();if((this.sim.status as string)!=='running')return reject('Session cannot start while hidden.');this.updateExercise();message='Session started.';break;
      case 'pause':if(this.sim.status!=='running')return reject('Session is not running.');this.sim.pause(command.reason??source);message='Session paused; clock held.';break;
      case 'resume':if(this.sim.status!=='paused')return reject('Session is not paused.');this.sim.resume();if((this.sim.status as string)!=='running')return reject('Resume requires a visible tab.');message='Session resumed.';break;
      case 'finish':if(!['running','paused'].includes(this.sim.status))return reject('Start before finishing.');this.sim.finish();this.updateExercise();message='Exercise finished; review ready.';break;
      case 'reset':this.rebuild();message='Session reset; ready at 00:00.';break;
      case 'post':if(!posts.some(p=>p.id===command.postId))return reject('Unknown post.');this.postId=command.postId;this.generation++;this.loadPromise=undefined;this.assetsReady=false;this.loadState='idle';this.error=undefined;this.makeEnvironment();this.rebuild();message=`${postById(this.postId).name} selected; loading regional assets.`;void this.loadAssets();break;
      case 'scenario':if(!['low-ingress','surveillance','penetration','swarm'].includes(command.scenarioId))return reject('Unknown exercise.');this.scenarioId=command.scenarioId;this.exerciseId=this.scenarioId;this.rebuild();message='Exercise selected; ready at 00:00.';break;
      case 'configure':if(active)return reject('Configuration can be edited only while ready.');if(!Number.isFinite(command.quietPeriod)||command.quietPeriod<0||command.quietPeriod>120||!Number.isInteger(command.swarmCount)||command.swarmCount<1||command.swarmCount>12||!Number.isFinite(command.pairDelay)||command.pairDelay<0||command.pairDelay>30)return reject('Quiet period 0–120 s, swarm 1–12, pair delay 0–30 s.');this.quietPeriod=command.quietPeriod;this.swarmCount=command.swarmCount;this.pairDelay=command.pairDelay;this.rebuild();message='Exercise configuration updated.';break;
      case 'speed':if(![1,2,4].includes(command.speed))return reject('Supported speeds: 1×, 2×, 4×.');this.speed=command.speed;message=`Speed ${this.speed}×.`;break;
      case 'conditions':if(!['day','night'].includes(command.conditions.timeOfDay)||!['clear','reduced'].includes(command.conditions.visibility))return reject('Invalid conditions.');this.sim.setConditions(command.conditions);message=`${command.conditions.timeOfDay}, ${command.conditions.visibility} visibility.`;break;
      case 'eo':if(!Number.isFinite(command.bearing)||!Number.isFinite(command.elevation)||command.elevation< -20||command.elevation>80)return reject('EO elevation must be −20° to 80°.');this.sensorEngine.setEO(command.bearing,command.elevation,command.zoom);message='EO bearing, elevation and zoom updated.';break;
      case 'step':{
        if(typeof location==='undefined'||!new URLSearchParams(location.search).has('qa'))return reject('Manual stepping is disabled in live training.');
        if(!Number.isFinite(command.seconds)||command.seconds<=0||command.seconds>300||!this.assetsReady||this.sim.status==='completed')return reject('QA stepping requires ready assets and 0–300 seconds.');
        if(this.sim.status==='ready')this.sim.start();else if(this.sim.status==='paused')this.sim.resume();
        let remaining=command.seconds;while(remaining>1e-10&&this.sim.status==='running'){const step=Math.min(FIXED_STEP,remaining);this.alpha=this.sim.advance(step);this.updateExercise();remaining-=step;}
        this.sim.pause('qa-step');message=`QA advanced ${command.seconds} simulation seconds.`;break;
      }
    }
    this.log('command-accepted',`${command.type}: ${message}`,source);this.refresh();return {ok:true,message};
  };
  private updateExercise(){
    this.sensorEngine.update(this.sim.time,this.sim.entities.values(),this.sim.conditions);
    this.sensorExercise.tick(this.sim.time,[...this.sensorEngine.tracks.values()],this.sensorEngine.observations);
    if(this.sim.status==='completed'&&this.sensorExercise.state().status!=='completed')this.sensorExercise.act({type:'finish'});
  }
  getExerciseState(){return this.sensorExercise.state();}
  exerciseAction(action:ExerciseAction):CommandResult{
    if(this.sim.status!=='running')return {ok:false,message:'Start or resume the exercise before acting.'};
    if(action.type==='request-eo'){
      const track=this.sensorExercise.state().tracks.find(t=>t.id===action.contactId);
      if(track)this.sensorEngine.setEO(track.bearing,0,false);
    }
    const accepted=this.sensorExercise.act(action);
    if(!accepted)return {ok:false,message:'This action is not available for the selected contact.'};
    if(action.type==='finish')this.sim.finish('operator');
    this.log('trainee-action',action.type,'operator');
    this.refresh();
    return {ok:true,message:'Action recorded.'};
  }
  advance(seconds:number){
    if(!Number.isFinite(seconds)||seconds<=0||this.sim.status!=='running')return;
    let remaining=Math.min(seconds,.25)*this.speed;
    while(remaining>1e-10&&this.sim.status==='running'){const step=Math.min(FIXED_STEP,remaining);this.alpha=this.sim.advance(step);this.updateExercise();remaining-=step;}
    this.refresh();
  }
  startScheduler(){
    if(this.frame!==undefined)return;let previous=performance.now(),lastPublish=previous;
    const tick=(now:number)=>{const dt=Math.min(.25,Math.max(0,(now-previous)/1000));previous=now;
      if(this.sim.status==='running'){let remaining=dt*this.speed;while(remaining>1e-10&&this.sim.status==='running'){const step=Math.min(FIXED_STEP,remaining);this.alpha=this.sim.advance(step);this.updateExercise();remaining-=step;}}
      if(now-lastPublish>=100){this.refresh();lastPublish=now;}this.frame=requestAnimationFrame(tick);};this.frame=requestAnimationFrame(tick);
    const visibility=()=>{this.sim.setHidden(document.hidden);previous=performance.now();this.refresh();};
    const blur=()=>{this.sim.pause('window-blur');previous=performance.now();this.refresh();};
    document.addEventListener('visibilitychange',visibility);window.addEventListener('blur',blur);this.cleanups.push(()=>document.removeEventListener('visibilitychange',visibility),()=>window.removeEventListener('blur',blur));
  }
  stopScheduler(){if(this.frame!==undefined)cancelAnimationFrame(this.frame);this.frame=undefined;for(const cleanup of this.cleanups)cleanup();this.cleanups=[];}
  pause(reason:string){if(this.sim.status==='running')this.command({type:'pause',reason});}
  notify(){this.refresh();}
  setExercise(exercise:ExerciseId){
    if(!['patrol','route-a','route-b','route-c','route-d','low-ingress','surveillance','penetration','swarm'].includes(exercise)||this.sim.status!=='ready')return {ok:false,message:'Select a valid exercise while ready.'};
    this.exerciseId=exercise;if(['low-ingress','surveillance','penetration','swarm'].includes(exercise))this.scenarioId=exercise as TrainingScenarioId;
    this.rebuild();this.log('exercise-selected',`Exercise ${exercise} selected.`,'operator');this.refresh();return {ok:true,message:'Exercise selected.'};
  }
  observe(entityId:string|undefined,payload:Record<string,unknown>){if(this.sim.status==='completed')return;this.sim.observe(entityId,payload);this.refresh();}
  reportContact(entityId:string|undefined,bearing:number,elevation:number){const report=this.sim.reportContact(entityId,bearing,elevation);this.refresh();return report;}
  classify(id:string,value:Classification){const ok=this.sim.classify(id,value);this.log(ok?'command-accepted':'command-rejected',`Classification ${id}: ${value}`,'operator');this.refresh();return ok;}
  respond(id:string,value:ResponseChoice){const ok=this.sim.respond(id,value);this.log(ok?'command-accepted':'command-rejected',`Response ${id}: ${value}`,'operator');this.refresh();return ok;}
  getTraineeSnapshot(){return {time:this.sim.time,status:this.sim.status,conditions:{...this.sim.conditions},training:this.sim.trainingState(),postName:postById(this.postId).name};}
  exportSession(projection:'instructor'|'trainee'='instructor'){
    const training=this.sim.trainingState(),common={version:3,sessionId:this.snapshot.sessionId,projection,post:structuredClone(postById(this.postId)),seed:this.sim.config.seed,conditions:{...this.sim.conditions},elapsed:this.sim.time,status:this.sim.status,training};
    if(projection==='trainee')return {...common,events:this.sim.events.filter(e=>['session-start','session-pause','session-resume','session-reset','observation','contact-detection','classification-submitted','response-selected','session-complete','conditions-change'].includes(e.type)).map(e=>({id:e.id,time:e.time,type:e.type,payload:Object.fromEntries(Object.entries(e.payload).filter(([key])=>['action','enabled','heading','zoom','position','bearing','elevation','acquired','contactId','classification','response','reason','seed','scenarioId','timeOfDay','visibility'].includes(key)).map(([key,value])=>[key,structuredClone(value)]))}))};
    return {...common,environment:{id:this.environment.id,regional:structuredClone(this.environment.regional),metadata:structuredClone(this.regionalMetadata),protectedZones:structuredClone(this.environment.protectedZones)},config:structuredClone(this.sim.config),events:structuredClone(this.sim.events),commandReceipts:structuredClone(this.events.filter(e=>e.type.startsWith('command-'))),sensorEvents:structuredClone(this.sensorEngine.events),sensorTracks:structuredClone([...this.sensorEngine.tracks.values()]),observer:structuredClone(this.observer)};
  }
}
