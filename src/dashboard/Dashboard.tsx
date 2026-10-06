import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import DashboardMap, { type Basemap } from './DashboardMap';
import { scenarioOptions } from './PreviewSession';
import { posts, postById } from './posts';
import { answerAssistant } from './assistant';
import type { AssistantReply, MapLayers, SelectedObject, SimulationCommand } from './types';
import { useSession, useSessionSnapshot } from '../session/SessionContext';
import { appLink } from '../routing';
import RegionalCredits from '../ui/RegionalCredits';
import './dashboard.css';
const EOPanel=lazy(()=>import('./EOPanel'));
const formatTime=(t:number)=>Math.floor(t/60).toString().padStart(2,'0')+':'+Math.floor(t%60).toString().padStart(2,'0');
type Message={id:number;role:'assistant'|'user';text:string};
export default function Dashboard() {
  const adapter=useSession(),snapshot=useSessionSnapshot(),post=postById(snapshot.postId);
  const [selected,setSelected]=useState<SelectedObject>({type:'post',id:snapshot.postId});
  const [layers,setLayers]=useState<MapLayers>({routes:false,trails:true,coverage:true,zones:true,grid:false,truth:true,radar:true,eo:true});
  const [basemap,setBasemap]=useState<Basemap>('regional'),[focus,setFocus]=useState(0),[overview,setOverview]=useState(false);
  const [search,setSearch]=useState(''),[dockOpen,setDockOpen]=useState(true),[objectsOpen,setObjectsOpen]=useState(false),[eoOpen,setEOOpen]=useState(false),[setupOpen,setSetupOpen]=useState(false);
  const [notice,setNotice]=useState(''),[input,setInput]=useState(''),[pending,setPending]=useState<AssistantReply|null>(null);
  const [messages,setMessages]=useState<Message[]>([{id:0,role:'assistant',text:'I’m SAARTHI. This console controls the shared training session. Instructor truth, simulated radar tracks and EO observations are separate layers. Select a post and exercise, then start when assets are ready.'}]);
  const messageId=useRef(0),chatEnd=useRef<HTMLDivElement>(null);
  const track=selected.type==='track'?snapshot.tracks.find(t=>t.id===selected.id):undefined;
  const measured=selected.type==='sensor-track'?snapshot.sensorTracks?.find(t=>t.id===selected.id):undefined;
  const active=snapshot.tracks.filter(t=>t.state==='active').length,scenario=scenarioOptions.find(s=>s.id===snapshot.scenarioId);
  const mode=snapshot.status==='completed'?'REVIEW':snapshot.status==='ready'?'CONFIGURE':'RUN';
  useEffect(()=>{setSelected({type:'post',id:snapshot.postId});setPending(null);setEOOpen(false);},[snapshot.sessionId,snapshot.postId]);
  useEffect(()=>{const log=chatEnd.current?.parentElement;log?.scrollTo({top:log.scrollHeight,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});},[messages,pending]);
  function command(value:SimulationCommand,source:'operator'|'assistant'='operator',confirmed=false) {
    if(['reset','post','scenario'].includes(value.type)&&snapshot.status!=='ready'&&!confirmed&&!window.confirm('Discard this run and configure a new session? Export it first if needed.')) return {ok:false,message:'Cancelled. Session retained.'};
    const result=adapter.command({...value,discardConfirmed:true} as SimulationCommand,source);setNotice(result.message);
    if(result.ok&&['post','scenario','reset'].includes(value.type)) void adapter.loadAssets();
    return result;
  }
  function select(object:SelectedObject) {
    if(object.type==='post'&&object.id!==snapshot.postId&&!command({type:'post',postId:object.id}).ok) return;
    if(object.type==='sensor'&&object.id==='eo') setEOOpen(true);
    setSelected(object);setOverview(false);setFocus(v=>v+1);setObjectsOpen(false);
  }
  function addMessage(role:Message['role'],text:string) {setMessages(current=>[...current,{id:++messageId.current,role,text}].slice(-60));}
  function ask(text:string) {
    if(!text.trim()) return;addMessage('user',text.trim());setInput('');setPending(null);
    const reply=answerAssistant(text,snapshot,selected);
    if(reply.confirmation){setPending(reply);addMessage('assistant',reply.text);return;}
    if(reply.command){const result=command(reply.command,'assistant');addMessage('assistant','[Session · '+formatTime(adapter.getSnapshot().time)+'] '+(result.ok?'Applied: ':'Not applied: ')+result.message);}
    else {addMessage('assistant',reply.text);if(reply.focus) select(reply.focus);}
  }
  function exportSession() {
    const url=URL.createObjectURL(new Blob([JSON.stringify(adapter.exportSession(),null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='interceptor-'+snapshot.postId+'-'+snapshot.sessionId+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('Session JSON exported with configuration, provenance and recorded events.');
  }
  const matches=(text:string)=>text.toLowerCase().includes(search.toLowerCase()),locked=snapshot.status!=='ready';
  return <main className={'dashboard '+(dockOpen?'':'dock-collapsed ')+(objectsOpen?'objects-open':'')}>
    <header className="dash-header">
      <a className="dash-brand" href={appLink('dashboard')} aria-label="Project Interceptor dashboard"><span className="brand-symbol">⌖</span><span><b>INTERCEPTOR</b><small>INSTRUCTOR CONSOLE</small></span></a>
      <nav aria-label="App views"><a href={appLink('dashboard')} aria-current="page">Command map</a><a href={appLink('trainer')}>Training console ↗</a><a href={appLink('observer')}>Ground observer ↗</a></nav>
      <div className="preview-badge"><i/>SHARED SESSION<span> / PHASE 03</span></div>
      <button className="dock-toggle" onClick={()=>setDockOpen(v=>!v)} aria-expanded={dockOpen} aria-controls="support-dock">{dockOpen?'Hide':'Show'} assistant</button>
    </header>
    <section className="command-bar" aria-label="Live training session controls">
      <label className="post-picker"><span>TRAINING POST</span><select value={snapshot.postId} onChange={e=>command({type:'post',postId:e.target.value as typeof snapshot.postId})} aria-label="Dashboard training post">{posts.map(p=><option value={p.id} key={p.id}>{p.callsign} · {p.name} / {p.state}</option>)}</select></label>
      <label className="exercise-picker"><span>EXERCISE</span><select value={snapshot.scenarioId} onChange={e=>command({type:'scenario',scenarioId:e.target.value as typeof snapshot.scenarioId})} aria-label="Dashboard exercise">{scenarioOptions.map(s=><option key={s.id} value={s.id}>{s.code} · {s.label}</option>)}</select></label>
      <div className="clock"><span>{snapshot.status.toUpperCase()}</span><time>{formatTime(snapshot.time)}</time><small>{active} AIRBORNE / {snapshot.sensorTracks?.filter(t=>t.state!=='lost').length??0} RADAR</small></div>
      <div className="playback-buttons"><button className="primary-control" disabled={snapshot.status==='completed'||!snapshot.assetsReady} onClick={()=>command({type:snapshot.status==='ready'?'start':snapshot.status==='running'?'pause':'resume'})}>{snapshot.status==='running'?'Ⅱ Pause':snapshot.status==='paused'?'▶ Resume':'▶ Start exercise'}</button><button onClick={()=>command({type:'reset'})}>↺ Reset</button><button disabled={!['running','paused'].includes(snapshot.status)} onClick={()=>command({type:'finish'})}>Finish</button><select aria-label="Simulation speed" value={snapshot.speed} onChange={e=>command({type:'speed',speed:Number(e.target.value) as 1|2|4})}>{[1,2,4].map(speed=><option key={speed} value={speed}>{speed}×</option>)}</select></div>
    </section>
    <div className="session-rail"><span className="workflow">{['CONFIGURE','RUN','REVIEW'].map((step,i)=><b key={step} className={mode===step?'current':''}>{'0'+(i+1)} {step}</b>)}</span><span className="session-id">{snapshot.sessionId}</span><span className={snapshot.assetsReady?'asset-status':'asset-status pending'}>{snapshot.error||(snapshot.assetsReady?'REGIONAL ASSETS READY':'PREPARING REGIONAL ASSETS…')}</span>{snapshot.error&&<button onClick={()=>void adapter.loadAssets()}>Retry assets</button>}<button onClick={()=>setSetupOpen(v=>!v)} aria-expanded={setupOpen}>Exercise setup</button></div>
    {setupOpen&&<section className="exercise-setup" aria-label="Exercise configuration"><label>Quiet period (seconds)<input aria-label="Quiet period seconds" type="number" min="0" max="120" value={snapshot.quietPeriod} disabled={locked} onChange={e=>command({type:'configure',quietPeriod:Number(e.target.value),swarmCount:snapshot.swarmCount??4,pairDelay:snapshot.pairDelay??4})}/></label><label>Swarm contacts<input aria-label="Swarm contact count" type="number" min="1" max="12" value={snapshot.swarmCount??4} disabled={locked||snapshot.scenarioId!=='swarm'} onChange={e=>command({type:'configure',quietPeriod:snapshot.quietPeriod,swarmCount:Number(e.target.value),pairDelay:snapshot.pairDelay??4})}/></label><label>Pair delay (seconds)<input aria-label="Swarm pair delay" type="number" min="0" max="30" value={snapshot.pairDelay??4} disabled={locked||snapshot.scenarioId!=='swarm'} onChange={e=>command({type:'configure',quietPeriod:snapshot.quietPeriod,swarmCount:snapshot.swarmCount??4,pairDelay:Number(e.target.value)})}/></label><span>SEED {snapshot.seed} · Reset to configure another run.</span></section>}
    <div className="dashboard-workspace">
      <aside className="object-panel" aria-label="Exercise object hierarchy">
        <div className="panel-heading"><span className="dash-kicker">EXERCISE OBJECTS</span><span>03 POSTS</span></div>
        <label className="object-search"><span>⌕</span><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find post or contact…" aria-label="Search exercise objects"/></label>
        <div className="object-tree">
          <details open><summary>TRAINING POSTS <span>3</span></summary>{posts.filter(p=>matches(p.name+' '+p.region+' '+p.state)).map(p=><button key={p.id} className={'post-row '+(p.id===snapshot.postId?'is-selected':'')} onClick={()=>select({type:'post',id:p.id})}><span className="tree-symbol">⌖</span><span><b>{p.name}</b><small>{p.state} · {p.callsign}</small></span><em>{p.id===snapshot.postId?'SELECTED':'STANDBY'}</em></button>)}</details>
          <details open><summary>INSTRUCTOR TRUTH <span>{snapshot.tracks.length.toString().padStart(2,'0')}</span></summary>{snapshot.tracks.filter(t=>matches(t.label+' '+t.airframe+' '+t.state)).map(t=><button key={t.id} className={'track-row '+(selected.type==='track'&&selected.id===t.id?'is-selected':'')} onClick={()=>select({type:'track',id:t.id})}><span className="tree-symbol">◇</span><span><b>{t.label}</b><small>{t.airframe}</small></span><em>{t.state.toUpperCase()}</em></button>)}</details>
          <details open><summary>SIMULATED RADAR <span>{snapshot.sensorTracks?.length??0}</span></summary>{snapshot.sensorTracks?.filter(t=>matches(t.label+' '+t.state)).map(t=><button key={t.id} className={'track-row '+(selected.type==='sensor-track'&&selected.id===t.id?'is-selected':'')} onClick={()=>select({type:'sensor-track',id:t.id})}><span className="tree-symbol radar-symbol">◉</span><span><b>{t.label}</b><small>{Math.round(t.age)} s old · quality {Math.round(t.quality*100)}%</small></span><em>{t.state.toUpperCase()}</em></button>)}{!snapshot.sensorTracks?.length&&<p className="empty-result">No radar reports yet.</p>}</details>
          <details open><summary>SENSOR STATIONS <span>02</span></summary>{(['radar','eo'] as const).map(id=><button className={'sensor-row '+(selected.type==='sensor'&&selected.id===id?'is-selected':'')} key={id} onClick={()=>select({type:'sensor',id})}><span className="tree-symbol">{id==='radar'?'◉':'⊙'}</span><span><b>{id==='radar'?'Radar station':'EO observation'}</b><small>{id==='radar'?'1 Hz · terrain masking':'Live camera · manual acquisition'}</small></span></button>)}</details>
        </div>
        <div className="layer-controls"><span className="dash-kicker">MAP LAYERS</span>{([{id:'truth',label:'Instructor truth'},{id:'radar',label:'Simulated radar tracks'},{id:'eo',label:'EO observations'},{id:'routes',label:'Authored routes'},{id:'trails',label:'Truth trails'},{id:'zones',label:'Protected zone'},{id:'coverage',label:'Sensor range limits'},{id:'grid',label:'1 km grid'}] as const).map(layer=><label key={layer.id}><input type="checkbox" checked={Boolean(layers[layer.id])} onChange={e=>setLayers(current=>({...current,[layer.id]:e.target.checked}))}/>{layer.label}</label>)}</div>
        <div className="object-panel-note"><span className="dash-kicker">FICTIONAL EXERCISE</span><p>Real regional elevation and imagery. Compounds, routes and sensor parameters are training configurations.</p><small>Geranium asset: noncommercial / ShareAlike.</small></div>
      </aside>
      <div className="map-stage">
        <div className="map-toolbar"><button className="objects-toggle" onClick={()=>setObjectsOpen(v=>!v)} aria-expanded={objectsOpen}>Objects</button><div className="basemap-switch" role="group" aria-label="Basemap"><button aria-pressed={basemap==='regional'} onClick={()=>setBasemap('regional')}>Local imagery</button><button aria-pressed={basemap==='satellite'} onClick={()=>setBasemap('satellite')}>Satellite</button><button aria-pressed={basemap==='terrain'} onClick={()=>setBasemap('terrain')}>Topo</button></div><button aria-pressed={overview} onClick={()=>setOverview(v=>!v)}>{overview?'Local sector':'All posts'}</button><button onClick={()=>{setOverview(false);setFocus(v=>v+1);}}>Focus</button><button aria-pressed={eoOpen} onClick={()=>setEOOpen(v=>!v)}>EO camera</button><span>INSTRUCTOR VIEW</span></div>
        <DashboardMap snapshot={snapshot} layers={layers} selected={selected} basemap={basemap} focus={focus} overview={overview} onSelect={select}/>
        {eoOpen&&snapshot.assetsReady&&<Suspense fallback={<div className="eo-loading">Preparing EO camera…</div>}><EOPanel onClose={()=>setEOOpen(false)}/></Suspense>}
      </div>
      {dockOpen&&<aside className="support-dock" id="support-dock" aria-label="Contact details and support assistant">
        <section className="object-details" aria-label="Selected object details"><div className="panel-heading"><span className="dash-kicker">SELECTION / DETAILS</span><span>{measured?'RADAR REPORT':track?'INSTRUCTOR TRUTH':'SESSION DATA'}</span></div>
          <h2>{track?.label??measured?.label??(selected.type==='sensor'?(selected.id==='radar'?'Radar station':'EO station'):post.name+' Training Post')}</h2>
          <p>{track?track.airframe+' · '+track.state:measured?measured.state+' · simulated measurement':selected.type==='sensor'?'Fictional training sensor':post.region+', '+post.state}</p>
          <dl>{track?<><div><dt>ALTITUDE</dt><dd>{track.altitudeAGL.toFixed(1)} m AGL</dd></div><div><dt>SPEED</dt><dd>{track.speed} m/s</dd></div><div><dt>HEADING</dt><dd>{Math.round(track.heading).toString().padStart(3,'0')}°</dd></div><div><dt>START</dt><dd>T+{track.spawnTime} s</dd></div><div className="wide"><dt>POSITION / WGS84</dt><dd>{track.position[1].toFixed(5)} N · {track.position[0].toFixed(5)} E</dd></div></>:measured?<><div><dt>REPORT AGE</dt><dd>{measured.age.toFixed(1)} s</dd></div><div><dt>TRACK QUALITY</dt><dd>{Math.round(measured.quality*100)}%</dd></div><div className="wide"><dt>MEASURED POSITION / WGS84</dt><dd>{measured.geographicPosition[1].toFixed(5)} N · {measured.geographicPosition[0].toFixed(5)} E</dd></div></>:selected.type==='sensor'?<><div><dt>RANGE LIMIT</dt><dd>{selected.id==='radar'?'2.2 km':'1.1 km'}</dd></div><div><dt>UPDATE</dt><dd>{selected.id==='radar'?'1 Hz':'Manual EO'}</dd></div></>:<><div><dt>TERRAIN</dt><dd>{post.terrain}</dd></div><div><dt>CALLSIGN</dt><dd>{post.callsign}</dd></div><div className="wide"><dt>REGIONAL ANCHOR / WGS84</dt><dd>{post.origin[1].toFixed(2)} N · {post.origin[0].toFixed(2)} E</dd></div></>}</dl>
          <small>{track?'Authored values; airframe identity is instructor-only.':measured?'Track quality describes acquisition and age, not hostility.':selected.type==='sensor'?'Terrain and solid facilities mask detection. Parameters are fictional training values.':post.provenance}</small>
          {selected.type==='post'&&<a className="region-source" href={post.sourceUrl} target="_blank" rel="noreferrer">Public region reference ↗</a>}
          {selected.type==='post'&&<RegionalCredits postId={snapshot.postId}/>}
          <div className="condition-controls"><label>Lighting<select aria-label="Simulation lighting" value={snapshot.conditions.timeOfDay} onChange={e=>command({type:'conditions',conditions:{...snapshot.conditions,timeOfDay:e.target.value as 'day'|'night'}})}><option value="day">Daylight</option><option value="night">Night</option></select></label><label>Visibility<select aria-label="Simulation visibility" value={snapshot.conditions.visibility} onChange={e=>command({type:'conditions',conditions:{...snapshot.conditions,visibility:e.target.value as 'clear'|'reduced'}})}><option value="clear">Clear</option><option value="reduced">Reduced</option></select></label></div>
        </section>
        <section className="assistant-panel" aria-label="SAARTHI support assistant"><div className="assistant-heading"><span className="assistant-mark">S</span><div><h2>SAARTHI</h2><span>SIMULATION SUPPORT</span></div><span className="local-tag">LOCAL</span></div>
          <div className="assistant-messages" role="log" aria-label="Assistant conversation" aria-live="polite">{messages.map(m=><article className={'chat-message '+m.role} key={m.id}><span>{m.role==='assistant'?'SAARTHI':'YOU'}</span><p>{m.text}</p></article>)}<div ref={chatEnd}/></div>
          {pending&&<div className="assistant-confirm"><span>Confirm session change</span><button onClick={()=>{if(pending.command){const r=command(pending.command,'assistant',true);addMessage('assistant',(r.ok?'Applied: ':'Not applied: ')+r.message);}setPending(null);}}>Confirm</button><button onClick={()=>{setPending(null);addMessage('assistant','Cancelled. Session retained.');}}>Cancel</button></div>}
          <div className="assistant-prompts"><button onClick={()=>ask('Summarise this post')}>Brief post</button><button onClick={()=>ask('Radar status')}>Radar status</button><button onClick={()=>ask('Explain the last event')}>Last event</button></div>
          <form onSubmit={e=>{e.preventDefault();ask(input);}}><label className="sr-only" htmlFor="assistant-input">Ask SAARTHI</label><input id="assistant-input" value={input} maxLength={500} onChange={e=>setInput(e.target.value)} placeholder="Ask about this session…"/><button disabled={!input.trim()} type="submit" aria-label="Send assistant message">↑</button></form><small className="assistant-footnote">Source: instructor session · deterministic local answers</small>
        </section>
      </aside>}
    </div>
    <section className="event-timeline" aria-label="Simulation event timeline"><div className="timeline-header"><span className="dash-kicker">{mode} / EVENT TIMELINE</span><span>{scenario?.code} · {scenario?.label}</span><button onClick={exportSession}>Export session JSON ↗</button></div><div className="timeline-content"><div className="timeline-controls"><span>{formatTime(snapshot.time)} / {formatTime(snapshot.duration)}</span><small>{snapshot.training?.reports.length??0} trainee reports</small>{snapshot.training?.review&&<span>{snapshot.training.review.detected} detected · {snapshot.training.review.missed} missed</span>}</div><ol>{snapshot.events.slice(-6).reverse().map(e=><li key={e.id}><time>{formatTime(e.time)}</time><span>{e.message}</span><small>{e.source.toUpperCase()}</small></li>)}</ol></div></section>
    <footer className="dash-footer"><span><i/> {notice||snapshot.error||'One active post · shared clock · route changes pause the session'}</span><span>INDIAN BORDER TRAINING <i> / </i> {post.name.toUpperCase()} · SEED {snapshot.seed}</span></footer>
  </main>;
}


