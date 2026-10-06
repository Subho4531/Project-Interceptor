import {describe,it,expect} from 'vitest';
import {Simulation,FIXED_STEP,sampleRoute} from './Simulation';
import {environments,createScenario} from './config';
import {trainingScenarios} from './trainingScenarios';
import {terrainHeight} from './world';
import type {ContactReport,TrainingScenarioId} from './types';

const assets = new Set(['sketchfab-fpv','sketchfab-orlan','sketchfab-lancet','sketchfab-geran']);
const advance = (sim:Simulation,seconds:number) => {for(let i=0;i<Math.round(seconds/FIXED_STEP);i++) sim.advance(FIXED_STEP);};
const create = (id:TrainingScenarioId='low-ingress') => new Simulation(createScenario(environments[0],id),environments[0],assets);

describe('four trainee scenarios',() => {
  it('defines four distinct profiles and uses all four sourced aircraft',() => {
    const configs=trainingScenarios.map(s=>createScenario(environments[0],s.id));
    expect(new Set(configs.map(c=>c.training!.briefing.code)).size).toBe(4);
    expect(new Set(configs.map(c=>JSON.stringify(c.entities[0].route))).size).toBe(4);
    expect(new Set(configs.flatMap(c=>c.entities.map(e=>e.assetId)))).toEqual(assets);
    expect(configs.map(c=>c.entities.length)).toEqual([1,1,1,4]);
  });
  for (const map of environments) {
    it.each(trainingScenarios)('finishes $id on '+map.id+' with routes clear of terrain',({id}) => {
      const config=createScenario(map,id); config.quietPeriod=5;
      const sim=new Simulation(config,map,assets); sim.start(); advance(sim,4.9); expect(sim.entities.size).toBe(0);
      let peak=0;
      for(let i=0;i<Math.ceil(config.training!.duration+6)*60;i++) {
        sim.advance(FIXED_STEP); peak=Math.max(peak,sim.entities.size);
      }
      expect(peak).toBe(id==='swarm'?4:1); expect(sim.status).toBe('completed');
      expect(sim.entities.size).toBe(0); expect(sim.events.filter(e=>e.type==='entity-spawn')).toHaveLength(config.entities.length);
      expect(sim.events.filter(e=>e.type==='session-complete')).toHaveLength(1);
      expect(sim.events.filter(e=>e.type==='zone-enter').length).toBe(id==='surveillance'?0:config.entities.length);
      for(const entity of config.entities) {
        for(let d=0;d<2000;d+=2) {const sample=sampleRoute(entity.route,d);expect(sample.position.y-terrainHeight(sample.position.x,sample.position.z,map.terrain)).toBeGreaterThan(8);if(sample.ended) break;}
      }
      const t=sim.time; sim.resume(); advance(sim,30); expect(sim.time).toBe(t);
    });
  }
  it('reproduces the simultaneous swarm and events after reset',()=>{
    const sim=create('swarm'); sim.start(); advance(sim,30);
    const expected=structuredClone([...sim.entities.values()]);
    expect(expected).toHaveLength(4);
    const contact=sim.reportContact(expected[0].id,15,12)!; sim.pause(); sim.classify(contact.id,'threat'); sim.respond(contact.id,'simulated-response');
    sim.setConditions({timeOfDay:'night',visibility:'reduced'}); sim.finish(); sim.reset();
    expect(sim.trainingState()!.reports).toEqual([]); expect(sim.trainingState()!.review).toBeUndefined();
    expect(sim.conditions).toEqual({timeOfDay:'night',visibility:'reduced'});
    sim.start(); advance(sim,30); expect([...sim.entities.values()]).toEqual(expected);
  });
});

describe('contact assessment and review',()=>{
  it('requires an actual active contact; bearing-only reports cannot inflate detection coverage',()=>{
    const sim=create(); sim.start();
    expect(sim.reportContact('aerial-01',10,5)).toBeUndefined();
    advance(sim,30); sim.reportContact(undefined,20,10); sim.reportContact('unseen',20,10);
    const contact=sim.reportContact('aerial-01',370,15)!;
    expect(contact.bearing).toBe(10); expect(sim.reportContact('aerial-01',90,15)).toEqual(contact);
    expect(sim.trainingState()!.reports).toHaveLength(1); expect(sim.trainingState()!.falseReports).toBe(3);
    sim.pause(); expect(sim.reportContact('aerial-01',0,0)).toBeUndefined();
    expect(sim.respond(contact.id,'report')).toBe(false); expect(sim.classify('not-a-contact','threat')).toBe(false);
    expect(sim.classify(contact.id,'threat')).toBe(true); expect(sim.respond(contact.id,'simulated-response')).toBe(true);
    sim.finish(); const review=sim.trainingState()!.review!;
    expect(review.detected).toBe(1); expect(review.classificationMatches).toBe(1); expect(review.responseMatches).toBe(1);
    expect(review.missed).toBe(0); expect(sim.status).toBe('completed');
  });
  it('holds the clock during assessment and invalidates a decision when classification changes',()=>{
    const sim=create(); sim.start(); advance(sim,30); const contact=sim.reportContact('aerial-01',0,0)!;
    sim.pause('contact-report'); const time=sim.time; advance(sim,20); expect(sim.time).toBe(time);
    sim.classify(contact.id,'concern'); sim.respond(contact.id,'report'); sim.classify(contact.id,'unknown');
    expect(sim.trainingState()!.reports[0].response).toBeUndefined();
    sim.finish(); expect(sim.respond(contact.id,'simulated-response')).toBe(false); expect(sim.classify(contact.id,'threat')).toBe(false);
    const count=sim.events.length; sim.finish(); expect(sim.events.length).toBe(count);
  });
  it('does not expose unseen identities, counts or expected answers until completion',()=>{
    const sim=create('swarm'); sim.start(); advance(sim,30);
    const trainee=JSON.stringify(sim.trainingState());
    for(const truth of ['sketchfab','assetId','expectedClassification','expectedResponse','entities','spawnTime','route','rationale']) expect(trainee).not.toContain(truth);
    expect(sim.trainingState()!.review).toBeUndefined(); sim.finish(); expect(sim.trainingState()!.review!.expected).toBe(4);
    expect(sim.trainingState()!.review!.missed).toBe(4);
  });
  it('returns independent trainee report snapshots and preserves event ordering',()=>{
    const sim=create(); sim.start(); advance(sim,30); const report=sim.reportContact('aerial-01',20,8)!;
    const snapshot=sim.trainingState()!; snapshot.reports[0].classification='benign';
    expect(sim.trainingState()!.reports[0].classification).toBeUndefined();
    sim.classify(report.id,'threat'); sim.respond(report.id,'simulated-response'); sim.finish();
    const sequence=sim.events.filter(e=>['session-start','entity-spawn','contact-detection','classification-submitted','response-selected','session-complete'].includes(e.type)).map(e=>e.type);
    expect(sequence).toEqual(['session-start','entity-spawn','contact-detection','classification-submitted','response-selected','session-complete']);
    expect(sim.events.every((e,i)=>i===0 || e.time>=sim.events[i-1].time)).toBe(true);
    expect(new Set(sim.events.map(e=>e.id)).size).toBe(sim.events.length);
  });
  it('reports per-contact swarm coverage and unanswered decisions accurately',()=>{
    const sim=create('swarm'); sim.start(); advance(sim,30);
    const contacts:ContactReport[]=[...sim.entities.values()].slice(0,2).map(e=>sim.reportContact(e.id,0,0)!);
    sim.classify(contacts[0].id,'threat'); sim.respond(contacts[0].id,'simulated-response'); sim.classify(contacts[1].id,'unknown');
    sim.finish(); expect(sim.trainingState()!.review).toMatchObject({expected:4,detected:2,missed:2,classificationMatches:1,responseMatches:1});
  });
  it('does not start a graded exercise with missing required assets or while hidden',()=>{
    const sim=new Simulation(createScenario(environments[0],'swarm'),environments[0],new Set()); sim.start(); expect(sim.status).toBe('ready');
    const hidden=create(); hidden.setHidden(true); hidden.start(); expect(hidden.status).toBe('ready');
  });
});
