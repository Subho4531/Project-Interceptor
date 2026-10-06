import { offsetPosition, postById } from './posts';
import type { CommandResult, GeographicPosition, PreviewTrack, SessionAdapter, SessionSnapshot, SimulationCommand } from './types';

export const scenarioOptions = [
  {id:'mixed',code:'TR 05',label:'Track prioritisation · assessed'},
  {id:'ambiguous',code:'TR 02',label:'Uncertain activity · assessed'},
  {id:'friendly',code:'TR 03',label:'Authorization review · assessed'},
  {id:'coordinated',code:'TR 04',label:'Multiple returns · assessed'},
  {id:'low-ingress',code:'EX 01',label:'Low-altitude incursion'},
  {id:'surveillance',code:'EX 02',label:'Surveillance & loiter'},
  {id:'penetration',code:'EX 03',label:'Perimeter penetration'},
  {id:'swarm',code:'EX 04',label:'Coordinated swarm'},
] as const;
type TrackDefinition = {airframe:string;spawn:number;altitude:number;speed:number;points:number[][]};
function fixtures(snapshot: SessionSnapshot): PreviewTrack[] {
  const origin=postById(snapshot.postId).origin;
  const definitions:TrackDefinition[] = snapshot.scenarioId === 'ambiguous' ? [] : snapshot.scenarioId === 'swarm' || snapshot.scenarioId === 'coordinated'
    ? [0,1,2,3].map(i=>{const side=i%2 ? 1:-1;return {airframe:'Geranium-2',spawn:25+(i<2?0:4),altitude:55+i*6,speed:22,points:[[side*2600,2400+i*150],[side*1200,1400],[side*280,250],[side*500,-650],[side*2500,-2300]]};})
    : snapshot.scenarioId === 'mixed'
      ? [{airframe:'Orlan-10',spawn:25,altitude:55,speed:20,points:[[-1600,800],[-800,550],[0,550],[1200,800]]},{airframe:'FPV',spawn:28,altitude:25,speed:18,points:[[800,1000],[500,650],[0,0],[-500,-600]]}]
    : snapshot.scenarioId === 'friendly'
      ? [{airframe:'Orlan-10',spawn:25,altitude:55,speed:20,points:[[-2600,2300],[-1200,1700],[0,1700],[1500,2000]]}]
    : snapshot.scenarioId === 'surveillance'
      ? [{airframe:'Orlan-10',spawn:25,altitude:110,speed:28,points:Array.from({length:25},(_,i)=>[2200*Math.cos(Math.PI+i*Math.PI/6),3000+1000*Math.sin(Math.PI+i*Math.PI/6)])}]
      : snapshot.scenarioId === 'penetration'
        ? [{airframe:'Lancet',spawn:25,altitude:70,speed:32,points:[[2600,2600],[1600,1800],[600,800],[0,0],[-700,-600],[-2800,-2000]]}]
        : [{airframe:'FPV',spawn:25,altitude:15,speed:18,points:[[-2600,2300],[-1700,1500],[-850,550],[0,0],[1000,-750],[2500,-1800]]}];
  return definitions.map((definition,i)=>{
    const age=snapshot.time-definition.spawn, travel=Math.max(0,age)*definition.speed;
    let remaining=travel, east=definition.points[0][0], north=definition.points[0][1], heading=0, ended=false;
    const route=definition.points.map(p=>offsetPosition(origin,p[0],p[1]));
    const trail:GeographicPosition[]=[route[0]];
    for(let j=1;j<definition.points.length;j++) {
      const a=definition.points[j-1],b=definition.points[j],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      heading=(Math.atan2(b[0]-a[0],b[1]-a[1])*180/Math.PI+360)%360;
      if(remaining<=length) { const ratio=remaining/length; east=a[0]+(b[0]-a[0])*ratio;north=a[1]+(b[1]-a[1])*ratio;break; }
      remaining-=length;east=b[0];north=b[1];trail.push(route[j]);if(j===definition.points.length-1) ended=true;
    }
    const position=offsetPosition(origin,east,north);trail.push(position);
    return {id:`uav-${i+1}`,label:`UAV ${String(i+1).padStart(2,'0')}`,airframe:definition.airframe,state:age<0?'scheduled':ended?'departed':'active',position,altitudeAGL:definition.altitude,speed:definition.speed,heading,route,trail,spawnTime:definition.spawn};
  });
}

// Standalone fixture adapter. It neither instantiates nor controls the Babylon trainer.
export class PreviewSession implements SessionAdapter {
  private snapshot: SessionSnapshot;
  private listeners=new Set<()=>void>();
  private sequence=0;
  private session=1;
  constructor() {
    this.snapshot={mode:'preview',sessionId:'preview-1',postId:'shakti-punjab',scenarioId:'swarm',status:'ready',time:0,duration:300,quietPeriod:25,seed:26052,speed:1,conditions:{timeOfDay:'day',visibility:'clear'},tracks:[],events:[]};
    this.event('preview-loaded','Fixture session ready. Scheduled tracks are preview data.','preview');this.refresh();
  }
  getSnapshot=()=>this.snapshot;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};};
  private event(type:string,message:string,source:'operator'|'assistant'|'preview') {this.snapshot.events=[...this.snapshot.events,{id:`${this.session}:${++this.sequence}`,time:this.snapshot.time,type,message,source}].slice(-200);}
  private refresh() {this.snapshot={...this.snapshot,tracks:fixtures(this.snapshot)};for(const listener of this.listeners) listener();}
  private reset(source:'operator'|'assistant',message='Preview reset; fixture clock and events cleared.') {
    this.session++;this.sequence=0;this.snapshot={...this.snapshot,sessionId:`preview-${this.session}`,status:'ready',time:0,events:[]};this.event('reset',message,source);
  }
  command=(command:SimulationCommand,source:'operator'|'assistant'='operator'):CommandResult=>{
    let message='';
    switch(command.type) {
      case 'start': if(this.snapshot.status!=='ready') return {ok:false,message:'Start requires a ready preview. Reset a completed run or resume a paused run.'};this.snapshot={...this.snapshot,status:'running'};message='Preview started. Scheduled contacts enter after 25 seconds.';break;
      case 'pause': if(this.snapshot.status!=='running') return {ok:false,message:'The preview is not running.'};this.snapshot={...this.snapshot,status:'paused'};message='Preview paused; simulation time held.';break;
      case 'resume': if(this.snapshot.status!=='paused') return {ok:false,message:'The preview is not paused.'};this.snapshot={...this.snapshot,status:'running'};message='Preview resumed.';break;
      case 'finish': if(!['running','paused'].includes(this.snapshot.status)) return {ok:false,message:'Start the preview before finishing it.'};this.snapshot={...this.snapshot,status:'completed'};message='Preview finished. This is fixture review, not a trainee score.';break;
      case 'reset': this.reset(source);this.refresh();return {ok:true,message:'Preview reset. Ready at 00:00.'};
      case 'post': if(!['shakti-punjab','maru-rajasthan','himadri-sikkim'].includes(command.postId)) return {ok:false,message:'Unknown training post.'};this.snapshot={...this.snapshot,postId:command.postId};this.reset(source,`${postById(command.postId).name} selected. New preview session.`);this.refresh();return {ok:true,message:`${postById(command.postId).name} selected; preview reset.`};
      case 'scenario': if(!scenarioOptions.some(s=>s.id===command.scenarioId)) return {ok:false,message:'Unknown preview exercise.'};this.snapshot={...this.snapshot,scenarioId:command.scenarioId};this.reset(source,'Exercise changed. New preview session.');this.refresh();return {ok:true,message:'Exercise selected; preview reset.'};
      case 'speed': if(![1,2,4].includes(command.speed)) return {ok:false,message:'Supported speeds are 1×, 2× and 4×.'};this.snapshot={...this.snapshot,speed:command.speed};message=`Preview speed set to ${command.speed}×.`;break;
      case 'conditions': if(!['day','night'].includes(command.conditions.timeOfDay)||!['clear','reduced'].includes(command.conditions.visibility)) return {ok:false,message:'Invalid preview conditions.'};this.snapshot={...this.snapshot,conditions:{...command.conditions}};message=`Preview conditions: ${command.conditions.timeOfDay}, ${command.conditions.visibility} visibility.`;break;
      case 'step': if(this.snapshot.status==='completed'||!Number.isFinite(command.seconds)||command.seconds<=0||command.seconds>30) return {ok:false,message:'Step requires an unfinished preview and 1–30 seconds.'};if(this.snapshot.status==='ready') this.snapshot={...this.snapshot,status:'paused'};this.advance(command.seconds);message=`Preview stepped ${command.seconds} seconds.`;break;
    }
    this.event(command.type,message,source);this.refresh();return {ok:true,message};
  };
  advance(seconds:number) {
    if(!Number.isFinite(seconds)||seconds<=0||this.snapshot.status==='completed') return;
    const before=this.snapshot.tracks;
    const time=Math.min(this.snapshot.duration,this.snapshot.time+seconds);
    this.snapshot={...this.snapshot,time,tracks:fixtures({...this.snapshot,time})};
    for(const track of this.snapshot.tracks) {
      const previous=before.find(t=>t.id===track.id);
      if(previous?.state==='scheduled'&&track.state!=='scheduled') this.event('contact-active',`${track.label} entered the preview. ${track.airframe}; ${track.altitudeAGL} m AGL.`,'preview');
      if(previous?.state!=='departed'&&track.state==='departed') this.event('contact-departed',`${track.label} completed its authored preview route.`,'preview');
    }
    if(time===this.snapshot.duration) {this.snapshot={...this.snapshot,status:'completed'};this.event('preview-complete','Preview window complete. Fixture timeline available.','preview');}
    this.refresh();
  }
  tick(seconds:number) {if(this.snapshot.status==='running') this.advance(Math.min(.25,Math.max(0,seconds))*this.snapshot.speed);}
  atTime(time:number):SessionSnapshot {const snapshot={...this.snapshot,time:Math.max(0,Math.min(this.snapshot.time,time)),status:'paused' as const};return {...snapshot,tracks:fixtures(snapshot),events:snapshot.events.filter(event=>event.time<=snapshot.time)};}
}
