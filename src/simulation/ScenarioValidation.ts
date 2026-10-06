import type { EnvironmentConfig, ScenarioConfig, TrainingScenarioId, EntityState } from './types';
import { createTrainingScenario } from './trainingScenarios';
import { sampleRoute } from './Simulation';
import { SensorEngine, type SensorDifficulty } from './SensorEngine';
import { terrainHeight } from './world';

export function validateResolvedScenario(config:ScenarioConfig,environment:EnvironmentConfig,difficulty:SensorDifficulty='foundation'):string[]{
  const errors:string[]=[];
  if(!config.training||config.training.duration<40)errors.push('Insufficient investigation time.');
  for(const entity of config.entities){
    if(entity.route.some(point=>!Object.values(point).every(Number.isFinite)||Math.hypot(point.x,point.z)>2000||point.y-terrainHeight(point.x,point.z,environment.terrain)<6))errors.push(`Invalid route clearance or coverage: ${entity.id}.`);
  }
  if(errors.length||!config.entities.length)return errors;
  const sensor=new SensorEngine(environment,config.seed,{difficulty}),seen=new Set<string>();
  const end=config.quietPeriod+(config.training?.duration??90)-20;
  for(let time=Math.ceil(config.quietPeriod);time<=end;time++){
    const entities:EntityState[]=config.entities.flatMap(definition=>{
      const age=time-config.quietPeriod-definition.spawnTime;if(age<0)return [];
      const sample=sampleRoute(definition.route,age*definition.speed);if(sample.ended)return [];
      return [{id:definition.id,assetId:definition.assetId,position:sample.position,previous:sample.position,heading:sample.heading,zones:[]}];
    });
    sensor.update(time,entities,config.conditions);for(const track of sensor.tracks.values())if(track.state!=='lost')seen.add(track.entityId);
  }
  for(const entity of config.entities)if(!seen.has(entity.id))errors.push(`No qualifying radar opportunity before the response budget: ${entity.id}.`);
  return errors;
}

export function resolveValidatedScenario(environment:EnvironmentConfig,id:TrainingScenarioId,options:{seed:number;swarmCount?:number;pairDelay?:number;conditions?:ScenarioConfig['conditions'];quietPeriod?:number;difficulty?:SensorDifficulty}){
  const create=(seed:number)=>{const config=createTrainingScenario(environment,id,{...options,seed});if(options.conditions)config.conditions={...options.conditions};if(options.quietPeriod!==undefined)config.quietPeriod=options.quietPeriod;return config;};
  let seed=options.seed;
  for(let retries=0;retries<3;retries++){
    const config=create(seed);
    if(!validateResolvedScenario(config,environment,options.difficulty).length)return {config,generation:{version:'constrained-1',requestedSeed:options.seed,resolvedSeed:seed,retries,fallbackUsed:false}};
    seed=(Math.imul(seed,1664525)+1013904223)>>>1;
  }
  const config=create(26052),errors=validateResolvedScenario(config,environment,options.difficulty);
  if(errors.length)throw new Error(`No valid scenario for this environment: ${errors.join(' ')}`);
  return {config,generation:{version:'constrained-1',requestedSeed:options.seed,resolvedSeed:26052,retries:3,fallbackUsed:true}};
}
