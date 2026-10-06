import {describe,it,expect} from 'vitest';
import {PreviewSession} from './PreviewSession';
import {answerAssistant} from './assistant';
import {posts} from './posts';
import {appBase} from '../routing';

describe('Phase 1 preview adapter',()=>{
  it('stages four distinct contacts and preserves the quiet period',()=>{
    const session=new PreviewSession();expect(session.getSnapshot().mode).toBe('preview');
    expect(session.getSnapshot().tracks.every(t=>t.state==='scheduled')).toBe(true);
    session.command({type:'step',seconds:20});expect(session.getSnapshot().tracks.every(t=>t.state==='scheduled')).toBe(true);
    session.command({type:'step',seconds:6});expect(session.getSnapshot().tracks.filter(t=>t.state==='active')).toHaveLength(2);
    session.command({type:'step',seconds:4});expect(session.getSnapshot().tracks.filter(t=>t.state==='active')).toHaveLength(4);
    expect(new Set(session.getSnapshot().tracks.map(t=>JSON.stringify(t.position))).size).toBe(4);
  });
  it('validates commands, holds paused time and scales only running preview ticks',()=>{
    const session=new PreviewSession();expect(session.command({type:'resume'}).ok).toBe(false);
    session.command({type:'start'});session.tick(.1);expect(session.getSnapshot().time).toBeCloseTo(.1);
    session.command({type:'speed',speed:4});session.tick(.1);expect(session.getSnapshot().time).toBeCloseTo(.5);
    session.command({type:'pause'});session.tick(.25);expect(session.getSnapshot().time).toBeCloseTo(.5);
    expect(session.command({type:'step',seconds:NaN}).ok).toBe(false);
    session.command({type:'finish'});expect(session.command({type:'step',seconds:10}).ok).toBe(false);
    session.tick(.1);expect(session.getSnapshot().time).toBeCloseTo(.5);
  });
  it('repeats coordinates after reset while preserving conditions and clearing old events',()=>{
    const session=new PreviewSession();session.command({type:'step',seconds:30});const positions=session.getSnapshot().tracks.map(t=>t.position);
    session.command({type:'conditions',conditions:{timeOfDay:'night',visibility:'reduced'}});
    session.command({type:'reset'});expect(session.getSnapshot().time).toBe(0);expect(session.getSnapshot().events).toHaveLength(1);
    expect(session.getSnapshot().conditions).toEqual({timeOfDay:'night',visibility:'reduced'});
    session.command({type:'step',seconds:30});expect(session.getSnapshot().tracks.map(t=>t.position)).toEqual(positions);
  });
  it('moves preview fixtures to each separate geographic post and changes scenario contact counts',()=>{
    const session=new PreviewSession();
    for(const post of posts) {session.command({type:'post',postId:post.id});expect(session.getSnapshot().time).toBe(0);const track=session.getSnapshot().tracks[0];expect(Math.abs(track.position[0]-post.origin[0])).toBeLessThan(.1);expect(Math.abs(track.position[1]-post.origin[1])).toBeLessThan(.1);}
    for(const scenarioId of ['low-ingress','surveillance','penetration'] as const) {session.command({type:'scenario',scenarioId});expect(session.getSnapshot().tracks).toHaveLength(1);}
  });
  it('keeps replay read-only and filters future events',()=>{
    const session=new PreviewSession();session.command({type:'step',seconds:30});const live=session.getSnapshot();
    const early=session.atTime(10);expect(early.time).toBe(10);expect(early.tracks.every(t=>t.state==='scheduled')).toBe(true);
    expect(early.events.every(e=>e.time<=10)).toBe(true);expect(session.getSnapshot()).toBe(live);
    expect(session.atTime(999).time).toBe(30);
  });
  it('notifies subscribers once per command and removes subscriptions',()=>{
    const session=new PreviewSession();let notifications=0;const unsubscribe=session.subscribe(()=>notifications++);
    session.command({type:'start'});expect(notifications).toBe(1);unsubscribe();session.command({type:'pause'});expect(notifications).toBe(1);
  });
  it('concludes at the preview duration and keeps ordered unique events',()=>{
    const session=new PreviewSession();for(let i=0;i<10;i++) session.command({type:'step',seconds:30});
    const snapshot=session.getSnapshot();expect(snapshot.status).toBe('completed');expect(snapshot.time).toBe(300);
    expect(new Set(snapshot.events.map(e=>e.id)).size).toBe(snapshot.events.length);
    expect(snapshot.events.every((e,i)=>i===0||e.time>=snapshot.events[i-1].time)).toBe(true);
  });
});
describe('state-backed local assistant',()=>{
  const selected={type:'post',id:'shakti-punjab'} as const;
  it('uses only fixture facts and explicitly identifies the source',()=>{
    const session=new PreviewSession();session.command({type:'step',seconds:30});
    expect(answerAssistant('summarise this post',session.getSnapshot(),selected).text).toContain('4 active contacts');
    const contact=answerAssistant('show UAV 02',session.getSnapshot(),selected);expect(contact.focus).toEqual({type:'track',id:'uav-2'});expect(contact.text).toContain('Geranium-2');expect(contact.text).toContain('Preview');
  });
  it('requires an explicit command intent and confirms destructive preview changes',()=>{
    const snapshot=new PreviewSession().getSnapshot();
    expect(answerAssistant('Do not pause',snapshot,selected).command).toBeUndefined();
    expect(answerAssistant('How do I reset?',snapshot,selected).command).toBeUndefined();
    expect(answerAssistant('pause preview',snapshot,selected).command).toEqual({type:'pause'});
    expect(answerAssistant('reset preview',snapshot,selected).confirmation).toBe(true);
    expect(answerAssistant('switch to Himadri',snapshot,selected)).toMatchObject({command:{type:'post',postId:'himadri-sikkim'},confirmation:true});
  });
});
describe('route bases',()=>{
  it.each([['/','/'],['/dashboard','/'],['/trainer/','/'],['/project/dashboard','/project/'],['/project/trainer/','/project/'],['/project/','/project/']])('resolves %s to %s',(path,base)=>expect(appBase(path)).toBe(base));
});
