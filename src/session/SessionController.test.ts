import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { SessionController } from './SessionController';
const assets=new Set(['sketchfab-fpv','sketchfab-orlan','sketchfab-lancet','sketchfab-geran']);
const terrain={minX:-3000,minZ:-3000,columns:2,rows:2,spacing:6000,heights:[0,0,0,0]};
const make=()=>new SessionController({availableAssets:assets,terrain});
const advance=(controller:SessionController,seconds:number)=>{for(let i=0;i<Math.round(seconds*4);i++)controller.advance(.25);};
describe('shared live session',()=>{
  afterEach(()=>vi.unstubAllGlobals());
  it('loads real local assets headlessly and blocks corrupt GLBs with retry',async()=>{
    vi.stubGlobal('document',{baseURI:'http://127.0.0.1/'});
    let corrupt=true;
    vi.stubGlobal('fetch',async(url:string)=>{
      const path=new URL(url).pathname;
      if(path.endsWith('/fpv.glb')&&corrupt)return new Response(new Uint8Array([1,2,3]));
      const bytes=readFileSync(`public${path}`);return new Response(bytes);
    });
    const controller=new SessionController();await controller.loadAssets();expect(controller.getSnapshot().loadState).toBe('error');expect(controller.command({type:'start'}).ok).toBe(false);
    corrupt=false;
    // Failed network entries are retried; invalid successful bytes must also be evicted.
    await controller.loadAssets();expect(controller.getSnapshot().error).toBeUndefined();expect(controller.getSnapshot().assetsReady).toBe(true);expect(controller.command({type:'start'}).ok).toBe(true);expect(controller.environment.regional?.originHeightEGM2008).toBeGreaterThan(200);expect(controller.exportSession('instructor')).toHaveProperty('environment.metadata.imagerySceneId');expect(controller.exportSession('instructor')).toHaveProperty('environment.metadata.outputs');
  });
  it('blocks Start until required assets are validated and logs rejected receipts',()=>{
    const controller=new SessionController();expect(controller.command({type:'start'}).ok).toBe(false);expect(controller.getSnapshot().events.at(-1)?.type).toBe('command-rejected');expect(controller.sim.time).toBe(0);
  });
  it('rejects regional origin/datum mismatch and retries corrected metadata',async()=>{
    vi.stubGlobal('document',{baseURI:'http://regional-metadata.local/'});let wrong=true;
    vi.stubGlobal('fetch',async(url:string)=>{const path=new URL(url).pathname,bytes=readFileSync(`public${path}`);if(path.endsWith('/metadata.json')&&wrong){const metadata=JSON.parse(bytes.toString());metadata.origin=[0,0];return new Response(JSON.stringify(metadata));}return new Response(bytes);});
    const controller=new SessionController();await controller.loadAssets();expect(controller.getSnapshot().assetsReady).toBe(false);expect(controller.getSnapshot().error).toContain('origin');
    wrong=false;await controller.loadAssets();expect(controller.getSnapshot().assetsReady).toBe(true);
  });
  it('one clock maintains 4× fixed steps, pause/hidden holds and explicit resume',()=>{
    const controller=make();controller.command({type:'start'});controller.command({type:'speed',speed:4});advance(controller,2);expect(controller.sim.time).toBeCloseTo(8);
    controller.pause('view-change');const held=controller.sim.time;advance(controller,3);expect(controller.sim.time).toBe(held);expect(controller.getSnapshot().events.some(e=>e.message.includes('view-change'))).toBe(true);
    controller.command({type:'resume'});controller.sim.setHidden(true);expect(controller.command({type:'resume'}).ok).toBe(false);controller.sim.setHidden(false);expect(controller.sim.status).toBe('paused');controller.command({type:'resume'});advance(controller,1);expect(controller.sim.time).toBeCloseTo(12);
  });
  it('retains fixed-step interpolation and orders interleaved sensor/simulation events at 4×',()=>{
    const controller=make();controller.command({type:'configure',quietPeriod:0,swarmCount:4,pairDelay:4});controller.command({type:'speed',speed:4});controller.command({type:'start'});
    controller.advance(.071);expect(controller.sim.time).toBeCloseTo(17/60);expect(controller.alpha).toBeCloseTo(.04);
    advance(controller,8);controller.command({type:'pause'});
    const times=controller.getSnapshot().events.map(e=>e.time);expect(times).toEqual([...times].sort((a,b)=>a-b));expect(controller.sim.time).toBeCloseTo(32+17/60);
  });
  it('validates configuration and does not discard an active run without confirmation',()=>{
    const controller=make();expect(controller.command({type:'configure',quietPeriod:0,swarmCount:13,pairDelay:4}).ok).toBe(false);
    controller.command({type:'scenario',scenarioId:'swarm'});expect(controller.command({type:'configure',quietPeriod:0,swarmCount:12,pairDelay:30}).ok).toBe(true);expect(controller.sim.config.entities).toHaveLength(12);expect(controller.sim.config.entities[11].spawnTime).toBe(150);expect(controller.getSnapshot().duration).toBeGreaterThan(180);
    controller.command({type:'start'});expect(controller.command({type:'reset'}).ok).toBe(false);expect(controller.command({type:'configure',quietPeriod:1,swarmCount:1,pairDelay:1}).ok).toBe(false);expect(controller.command({type:'reset',discardConfirmed:true}).ok).toBe(true);
  });
  it('25 resets reproduce routes/events and clear all reports, sensors and IDs',()=>{
    const controller=make();controller.command({type:'configure',quietPeriod:0,swarmCount:4,pairDelay:4});controller.command({type:'start'});advance(controller,2);
    const expected=structuredClone([...controller.sim.entities.values()]);const ids=new Set<string>();
    for(let i=0;i<25;i++){ids.add(controller.getSnapshot().sessionId);controller.reportContact('aerial-01',315,4);controller.command({type:'reset',discardConfirmed:true});expect(controller.getSnapshot().training?.reports).toHaveLength(0);expect(controller.sensorEngine.tracks.size).toBe(0);expect(controller.getSnapshot().tracks[0].trail).toHaveLength(0);controller.command({type:'start'});advance(controller,2);expect([...controller.sim.entities.values()]).toEqual(expected);}
    expect(ids.size).toBe(25);
  });
  it('trainee projection and export keep authored identity and expected answers private until completion',()=>{
    const controller=make();controller.command({type:'configure',quietPeriod:0,swarmCount:4,pairDelay:4});controller.command({type:'start'});advance(controller,2);controller.reportContact('aerial-01',315,4);
    controller.observe('aerial-01',{action:'mark-bearing',entityId:'aerial-01',assetId:'sketchfab-fpv',scenarioTruth:{expected:'threat'}});
    for(const projection of [controller.getTraineeSnapshot(),controller.exportSession('trainee')]){const serialized=JSON.stringify(projection);expect(serialized).not.toContain('sketchfab-fpv');expect(serialized).not.toContain('expectedClassification');expect(serialized).not.toContain('aerial-01');expect(serialized).not.toContain('sensorTracks');}
    controller.classify('contact-1','unknown');controller.respond('contact-1','observe');controller.command({type:'finish'});expect(controller.sim.entities.size).toBe(0);expect(controller.getTraineeSnapshot().training?.review?.expected).toBe(1);expect(controller.exportSession('instructor')).toHaveProperty('config');
  });
  it('keeps familiarisation profiles and completes them explicitly',()=>{const controller=make();expect(controller.setExercise('route-d').ok).toBe(true);expect(controller.exercise).toBe('route-d');expect(controller.sim.config.entities[0].assetId).toBe('sketchfab-geran');controller.command({type:'start'});expect(controller.command({type:'finish'}).ok).toBe(true);expect(controller.sim.status).toBe('completed');});
});
