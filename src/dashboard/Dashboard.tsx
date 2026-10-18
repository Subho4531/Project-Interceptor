import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import DashboardMap, { type Basemap } from './DashboardMap';
import { scenarioOptions } from './PreviewSession';
import { postById } from './posts';
import AssessRespond from './AssessRespond';
import CommanderAssistant from './CommanderAssistant';
import type { MapLayers, SelectedObject, SimulationCommand } from './types';
import type { ExerciseAction, ExerciseState } from '../training/Exercise';
import { getAttempt, saveAttempt, type ExerciseArchive } from '../training/AttemptStore';
import { archiveAttempt } from '../training/Archive';
import { useSession, useSessionSnapshot } from '../session/SessionContext';
import { appBase, appLink } from '../routing';
import BrandIcon from '../ui/BrandIcon';
import RegionalCredits from '../ui/RegionalCredits';
import { prefetchWorkspaceBundles } from '../ui/workspacePrefetch';
import './dashboard.css';
const EOPanel=lazy(()=>import('./EOPanel'));
const SensorWall=lazy(()=>import('./SensorWall'));
const formatTime=(t:number)=>Math.floor(t/60).toString().padStart(2,'0')+':'+Math.floor(t%60).toString().padStart(2,'0');
export default function Dashboard() {
  const adapter=useSession(),snapshot=useSessionSnapshot(),post=postById(snapshot.postId);
  const [selected,setSelected]=useState<SelectedObject>({type:'post',id:snapshot.postId});
  const [layers,setLayers]=useState<MapLayers>({routes:false,trails:true,coverage:true,zones:true,grid:false,truth:false,radar:true,eo:true});
  const [basemap,setBasemap]=useState<Basemap>('regional'),[focus,setFocus]=useState(0),[overview,setOverview]=useState(false);
  const [workspaceView,setWorkspaceView]=useState<'sensors'|'map'>('sensors');
  const [search,setSearch]=useState(''),[dockOpen,setDockOpen]=useState(true),[objectsOpen,setObjectsOpen]=useState(true),[eoOpen,setEOOpen]=useState(false);
  const [notice,setNotice]=useState('');
  const [roomsWarm,setRoomsWarm]=useState<'warming'|'ready'|'partial'>('warming');
  const track=selected.type==='track'?snapshot.tracks.find(t=>t.id===selected.id):undefined;
  const measured=selected.type==='sensor-track'?snapshot.sensorTracks?.find(t=>t.id===selected.id):undefined;
  const active=snapshot.tracks.filter(t=>t.state==='active').length,scenario=scenarioOptions.find(s=>s.id===snapshot.scenarioId);
  const mode=snapshot.status==='completed'?'REVIEW':snapshot.status==='ready'?'CONFIGURE':'RUN';
  const exerciseState:ExerciseState=adapter.getExerciseState();
  const review=exerciseState.review;
  useEffect(()=>{setSelected({type:'post',id:snapshot.postId});setEOOpen(false);},[snapshot.sessionId,snapshot.postId]);
  // Route bundles plus observer/command-room extras warm from training start; reflect
  // completion on the asset chip so the instructor knows workspace switching is instant.
  useEffect(()=>{
    if(roomsWarm!=='warming')return;
    let cancelled=false;
    void Promise.all([adapter.workspaceWarm(),prefetchWorkspaceBundles()])
      .then(([warm])=>{if(!cancelled)setRoomsWarm(warm==='ready'?'ready':'partial');})
      .catch(()=>{if(!cancelled)setRoomsWarm('partial');});
    return ()=>{cancelled=true;};
  },[]);
  /** Bottom timeline bar: user-resizable by dragging its top edge; persisted in local storage. */
  const [timelineHeight,setTimelineHeight]=useState(()=>{
    const stored=Number(localStorage.getItem('interceptor.timeline-height'));
    return Number.isFinite(stored)&&stored>=92&&stored<=320?stored:118;
  });
  const resizeRef=useRef<Set<number>>(new Set());
  const setTimelineHeightPersisted=(height:number) => setTimelineHeight(current=>{
    const next=Math.round(Math.min(320,Math.max(92,height)));
    if(next!==current)localStorage.setItem('interceptor.timeline-height',String(next));
    return next;
  });
  const startTimelineResize=(event: React.PointerEvent<HTMLElement>) => {
    event.preventDefault();
    try{(event.target as HTMLElement).setPointerCapture(event.pointerId);}catch{/* synthetic pointers can't capture */}
    resizeRef.current.add(event.pointerId);
  };
  useEffect(()=>{
    const move=(event: PointerEvent)=>{
      if(!resizeRef.current.has(event.pointerId))return;
      const height=Math.round(Math.min(320,Math.max(92,innerHeight-event.clientY)));
      setTimelineHeightPersisted(height);
    };
    const finish=(event: PointerEvent)=>{
      if(!resizeRef.current.has(event.pointerId))return;
      resizeRef.current.delete(event.pointerId);
    };
    window.addEventListener('pointermove',move);
    window.addEventListener('pointerup',finish);
    window.addEventListener('pointercancel',finish);
    return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',finish);resizeRef.current.clear();};
  },[]);
  function command(value:SimulationCommand,source:'operator'|'assistant'='operator',confirmed=false) {
    if(value.type==='post'||value.type==='scenario')return {ok:false,message:'Post and exercise are configured on the curriculum page — this console runs them.'};
    if(value.type==='reset'&&snapshot.status!=='ready'&&!confirmed&&!window.confirm('Discard this run and reset to the configured exercise? Export it first if needed.'))return {ok:false,message:'Cancelled. Session retained.'};
    const result=adapter.command({...value,discardConfirmed:true} as SimulationCommand,source);setNotice(result.message);
    if(result.ok&&value.type==='reset')void adapter.loadAssets();
    return result;
  }
  function exerciseAction(action:ExerciseAction) {
    const result=adapter.exerciseAction(action);setNotice(result.message);
    return result;
  }
  function select(object:SelectedObject) {
    setSelected(object);setOverview(false);setFocus(v=>v+1);
  }
  // Training review lifecycle ported from the removed trainer route: save the attempt locally,
  // then open the read-only AAR replay for the shared session id.
  function reviewArchive():Promise<ExerciseArchive> {
    const current=archiveAttempt(snapshot,exerciseState,[],adapter.getCompletedRecipe());
    return getAttempt(snapshot.sessionId).then(saved=>{
      if(snapshot.status==='completed'&&saved?.state.review)return saved;
      if(saved?.checkpoints?.length)return {...current,checkpoints:saved.checkpoints};
      return current;
    }).catch(()=>current);
  }
  function exportReview() {
    void reviewArchive().then(data=>{
      const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
      const link=document.createElement('a');link.href=url;link.download=`interceptor-${snapshot.sessionId}-review.json`;link.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    }).catch(error=>setNotice(`Export failed: ${String(error)}`));
  }
  function openSavedReview() {
    void reviewArchive().then(saveAttempt).then(()=>{
      history.pushState(null,'',appBase(location.pathname)+'aar/'+encodeURIComponent(snapshot.sessionId));
      window.dispatchEvent(new PopStateEvent('popstate'));
    }).catch(error=>setNotice(`Cannot open local replay: ${String(error)}. Export the review instead.`));
  }
  function exportSession() {
    const url=URL.createObjectURL(new Blob([JSON.stringify(adapter.exportSession(),null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='interceptor-'+snapshot.postId+'-'+snapshot.sessionId+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('Session JSON exported with configuration, provenance and recorded events.');
  }
  const matches=(text:string)=>text.toLowerCase().includes(search.toLowerCase());
  const assetsChip=snapshot.error?snapshot.error:snapshot.assetsReady?`REGIONAL ASSETS READY · ROOMS ${roomsWarm==='ready'?'WARM':roomsWarm==='partial'?'PARTIAL':'WARMING'}`:'PREPARING REGIONAL ASSETS…';
  const assetsClass=snapshot.error?'error':snapshot.assetsReady?'ok':'pending';
  return <main className={'dashboard '+(dockOpen?'':'dock-collapsed ')+(objectsOpen?'objects-open ':'')+(eoOpen?'eo-float-open':'')+(resizeRef.current.size?' timeline-resizing':'')}>
    <header className="topbar" role="banner">
      <div className="topbar-row1">
        <a className="brand" href={appLink('progress')} aria-label="Project Interceptor curriculum home"><span className="brand-symbol"><BrandIcon size={16}/></span><b>INTERCEPTOR</b></a>
        <nav aria-label="App views"><a href={appLink('progress')}>Curriculum</a><a href={appLink('dashboard')} aria-current="page">Command map</a><a href={appLink('observer')}>Ground observer</a></nav>
        <span className="level-chip">{snapshot.trainingMode?`L${(snapshot.level??0).toString().padStart(2,'0')} · ${snapshot.trainingMode.toUpperCase()}`:'FREE CONSOLE'}</span>
        <div className="topbar-status" aria-label="Live session status"><i className={`status-dot ${snapshot.status}`}/><span>{snapshot.status.toUpperCase()}</span><time>{formatTime(snapshot.time)}</time><span>{active} AIR / {snapshot.sensorTracks?.filter(t=>t.state!=='lost').length??0} RAD</span></div>
        <div className="topbar-controls">
          <select aria-label="Simulation speed" value={snapshot.speed} onChange={e=>command({type:'speed',speed:Number(e.target.value) as 1|2|4})}>{[1,2,4].map(speed=><option key={speed} value={speed}>{speed}×</option>)}</select>
          <button className="primary-control" disabled={snapshot.status==='completed'||!snapshot.assetsReady} onClick={()=>command({type:snapshot.status==='ready'?'start':snapshot.status==='running'?'pause':'resume'})}>{snapshot.status==='running'?'Ⅱ Pause':snapshot.status==='paused'?'▶ Resume':'▶ Start'}</button>
          <button onClick={()=>command({type:'reset'})} aria-label="Reset exercise">↺ Reset</button>
          <button disabled={!['running','paused'].includes(snapshot.status)} onClick={()=>command({type:'finish'})}>Finish</button>
          <button onClick={exportSession} aria-label="Export session JSON">Export ↗</button>
          <button onClick={()=>setDockOpen(v=>!v)} aria-expanded={dockOpen} aria-controls="support-dock">{dockOpen?'Panel ▸':'Panel ◂'}</button>
        </div>
      </div>
      <div className="topbar-row2" aria-label="Workspace view and exercise identity">
        <div className="view-switch" role="group" aria-label="Workspace view"><button aria-pressed={workspaceView==='sensors'} onClick={()=>setWorkspaceView('sensors')}>Sensor wall</button><button aria-pressed={workspaceView==='map'} onClick={()=>setWorkspaceView('map')}>Tactical map</button></div>
        <button className="objects-toggle" aria-pressed={objectsOpen} onClick={()=>setObjectsOpen(v=>!v)}>Objects</button>
        {workspaceView==='map'&&<div className="map-tools"><div className="basemap-switch" role="group" aria-label="Basemap"><button aria-pressed={basemap==='regional'} onClick={()=>setBasemap('regional')}>Local imagery</button><button aria-pressed={basemap==='satellite'} onClick={()=>setBasemap('satellite')}>Satellite</button><button aria-pressed={basemap==='terrain'} onClick={()=>setBasemap('terrain')}>Topo</button></div><button aria-pressed={overview} onClick={()=>setOverview(v=>!v)}>{overview?'Local sector':'All posts'}</button><button onClick={()=>{setOverview(false);setFocus(v=>v+1);}}>Focus</button><button aria-pressed={eoOpen} onClick={()=>setEOOpen(v=>!v)}>EO / thermal</button></div>}
        <span className="workflow" aria-label="Training workflow stage">{['CONFIGURE','RUN','REVIEW'].map((step,i)=><b key={step} className={mode===step?'current':''}>{'0'+(i+1)} {step}</b>)}</span>
        <span className={`asset-chip ${assetsClass}`} role="status">{assetsChip}{snapshot.error&&<button onClick={()=>void adapter.loadAssets()} aria-label="Retry loading regional assets">Retry</button>}</span>
        <span className="seed-chip">{scenario?.code??snapshot.scenarioId.toUpperCase()} · SEED {snapshot.seed}</span>
      </div>
    </header>
    <div className="dashboard-workspace">
      <aside className={'object-panel'+(objectsOpen?'':' closed')} aria-label="Objects list">
        <div className="objects-head"><span>OBJECTS LIST</span><button aria-label={objectsOpen?'Hide objects list':'Show objects list'} aria-expanded={objectsOpen} onClick={()=>setObjectsOpen(v=>!v)}>–</button></div>
        <label className="objects-search"><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find objects…" aria-label="Search exercise objects"/></label>
        <div className="object-tree">
          <details open><summary>TRAINING POST <span>{post.callsign}</span></summary><div className="post-static"><span className="tree-symbol">⌖</span><span><b>{post.name}</b><small>{post.state} · configured on the curriculum</small></span></div></details>
          <details open><summary>INSTRUCTOR TRUTH <span>{snapshot.tracks.length.toString().padStart(2,'0')}</span></summary>{snapshot.tracks.filter(t=>matches(t.label+' '+t.airframe+' '+t.state)).map(t=><button key={t.id} className={'track-row '+(selected.type==='track'&&selected.id===t.id?'is-selected':'')} onClick={()=>select({type:'track',id:t.id})}><span className="tree-symbol">◇</span><span><b>{t.label}</b><small>{t.airframe}</small></span><em>{t.state.toUpperCase()}</em></button>)}{!snapshot.tracks.length&&<p className="empty-result">No authored contacts in this variation yet.</p>}</details>
          <details open><summary>SIMULATED RADAR <span>{snapshot.sensorTracks?.length??0}</span></summary>{snapshot.sensorTracks?.filter(t=>matches(t.label+' '+t.state)).map(t=><button key={t.id} className={'track-row '+(selected.type==='sensor-track'&&selected.id===t.id?'is-selected':'')} onClick={()=>select({type:'sensor-track',id:t.id})}><span className="tree-symbol radar-symbol">◉</span><span><b>{t.label}</b><small>{Math.round(t.age)} s old · quality {Math.round(t.quality*100)}%</small></span><em>{t.state.toUpperCase()}</em></button>)}{!snapshot.sensorTracks?.length&&<p className="empty-result">No radar reports yet.</p>}</details>
          <details open><summary>SENSOR STATIONS <span>02</span></summary>{(['radar','eo'] as const).map(id=><button className={'sensor-row '+(selected.type==='sensor'&&selected.id===id?'is-selected':'')} key={id} onClick={()=>select({type:'sensor',id})}><span className="tree-symbol">{id==='radar'?'◉':'⊙'}</span><span><b>{id==='radar'?'Radar station':'EO observation'}</b><small>{id==='radar'?'1 Hz · terrain masking':'Live camera · manual acquisition'}</small></span></button>)}</details>
        </div>
        <div className="layer-controls"><span className="dash-kicker">MAP LAYERS</span>{([{id:'truth',label:'Instructor truth'},{id:'radar',label:'Simulated radar tracks'},{id:'eo',label:'EO observations'},{id:'routes',label:'Authored routes'},{id:'trails',label:'Truth trails'},{id:'zones',label:'Protected zone'},{id:'coverage',label:'Sensor range limits'},{id:'grid',label:'1 km grid'}] as const).map(layer=><label key={layer.id}><input type="checkbox" checked={Boolean(layers[layer.id])} onChange={e=>setLayers(current=>({...current,[layer.id]:e.target.checked}))}/>{layer.label}</label>)}</div>
        <div className="object-panel-note"><span className="dash-kicker">FICTIONAL EXERCISE</span><p>Real regional elevation and imagery. Compounds, routes and sensor parameters are training configurations.</p><small>Geranium asset: noncommercial / ShareAlike.</small></div>
      </aside>
      <div className="map-stage">
        {workspaceView==='map'?<DashboardMap snapshot={snapshot} layers={layers} selected={selected} basemap={basemap} focus={focus} overview={overview} onSelect={select}/>:<Suspense fallback={<div className="eo-loading" role="status">Preparing sensor wall…</div>}><SensorWall snapshot={snapshot} exercise={exerciseState}/></Suspense>}
        {workspaceView==='map'&&eoOpen&&snapshot.assetsReady&&<Suspense fallback={<div className="eo-loading">Preparing EO camera…</div>}><EOPanel onClose={()=>setEOOpen(false)}/></Suspense>}
      </div>
      {dockOpen&&<aside className="support-dock" id="support-dock" aria-label="Contact details and assessment controls">
        <section className="object-details" aria-label="Selected object details"><div className="panel-heading"><span className="dash-kicker">SELECTION / DETAILS</span><span>{measured?'RADAR REPORT':track?'INSTRUCTOR TRUTH':'SESSION DATA'}</span></div>
          <h2>{track?.label??measured?.label??(selected.type==='sensor'?(selected.id==='radar'?'Radar station':'EO station'):post.name+' Training Post')}</h2>
          <p>{track?track.airframe+' · '+track.state:measured?measured.state+' · simulated measurement':selected.type==='sensor'?'Fictional training sensor':post.region+', '+post.state}</p>
          <dl>{track?<><div><dt>ALTITUDE</dt><dd>{track.altitudeAGL.toFixed(1)} m AGL</dd></div><div><dt>SPEED</dt><dd>{track.speed} m/s</dd></div><div><dt>HEADING</dt><dd>{Math.round(track.heading).toString().padStart(3,'0')}°</dd></div><div><dt>START</dt><dd>T+{track.spawnTime} s</dd></div><div className="wide"><dt>POSITION / WGS84</dt><dd>{track.position[1].toFixed(5)} N · {track.position[0].toFixed(5)} E</dd></div></>:measured?<><div><dt>REPORT AGE</dt><dd>{measured.age.toFixed(1)} s</dd></div><div><dt>TRACK QUALITY</dt><dd>{Math.round(measured.quality*100)}%</dd></div><div className="wide"><dt>MEASURED POSITION / WGS84</dt><dd>{measured.geographicPosition[1].toFixed(5)} N · {measured.geographicPosition[0].toFixed(5)} E</dd></div></>:selected.type==='sensor'?<><div><dt>RANGE LIMIT</dt><dd>{selected.id==='radar'?'2.2 km':'1.1 km'}</dd></div><div><dt>UPDATE</dt><dd>{selected.id==='radar'?'1 Hz':'Manual EO'}</dd></div></>:<><div><dt>TERRAIN</dt><dd>{post.terrain}</dd></div><div><dt>CALLSIGN</dt><dd>{post.callsign}</dd></div><div className="wide"><dt>REGIONAL ANCHOR / WGS84</dt><dd>{post.origin[1].toFixed(2)} N · {post.origin[0].toFixed(2)} E</dd></div></>}</dl>
          <small>{track?'Authored values; airframe identity is instructor-only.':measured?'Track quality describes acquisition and age, not hostility.':selected.type==='sensor'?'Terrain and solid facilities mask detection. Parameters are fictional training values.':post.provenance}</small>
          {selected.type==='post'&&<a className="region-source" href={post.sourceUrl} target="_blank" rel="noreferrer">Public region reference ↗</a>}
          {selected.type==='post'&&<RegionalCredits postId={snapshot.postId}/>}
          <div className="condition-controls"><label>Lighting<select aria-label="Simulation lighting" value={snapshot.conditions.timeOfDay} onChange={e=>command({type:'conditions',conditions:{...snapshot.conditions,timeOfDay:e.target.value as 'day'|'night'}})}><option value="day">Daylight</option><option value="night">Night</option></select></label><label>Visibility<select aria-label="Simulation visibility" value={snapshot.conditions.visibility} onChange={e=>command({type:'conditions',conditions:{...snapshot.conditions,visibility:e.target.value as 'clear'|'reduced'}})}><option value="clear">Clear</option><option value="reduced">Reduced</option></select></label></div>
        </section>
        <AssessRespond exercise={exerciseState} running={snapshot.status==='running'} onAction={exerciseAction}/>
      </aside>}
    </div>
    {dockOpen&&<section className="timeline-resize-handle" role="separator" aria-label="Resize event timeline bar" aria-orientation="horizontal" aria-valuenow={timelineHeight} aria-valuemin={92} aria-valuemax={320} tabIndex={0} onPointerDown={startTimelineResize} onKeyDown={event => { if(event.key==='ArrowUp'){event.preventDefault();setTimelineHeightPersisted(timelineHeight+20);} else if(event.key==='ArrowDown'){event.preventDefault();setTimelineHeightPersisted(timelineHeight-20);} else if(event.key==='Home'){event.preventDefault();setTimelineHeightPersisted(92);} else if(event.key==='End'){event.preventDefault();setTimelineHeightPersisted(320);} }} />/* -R1 */}
    {snapshot.postId==='shakti-punjab'&&<CommanderAssistant snapshot={snapshot} exercise={exerciseState} selected={selected} onCommand={command}/>}
    <section className="event-timeline" aria-label="Simulation event timeline" style={{'--timeline-h':timelineHeight+'px'} as React.CSSProperties}><div className="timeline-header"><span className="dash-kicker">{mode} / EVENT TIMELINE</span><span>{scenario?.code} · {scenario?.label}</span><div className="timeline-actions">{review&&<><button onClick={openSavedReview}>Open AAR ↗</button><button onClick={exportReview}>Export review</button></>}<button onClick={exportSession}>Export session JSON ↗</button></div></div><div className="timeline-content"><div className="timeline-controls"><span>{formatTime(snapshot.time)} / {formatTime(snapshot.duration)}</span><small>{snapshot.training?.reports.length??0} trainee reports</small>{snapshot.training?.review&&<span>{snapshot.training.review.detected} detected · {snapshot.training.review.missed} missed</span>}{review&&<span className="rubric-summary">RUBRIC {Math.round(review.overall)}/100 · D{Math.round(review.scores.detection)} C{Math.round(review.scores.classification)} T{Math.round(review.scores.threatAssessment)} Q{Math.round(review.scores.decisionQuality)}</span>}</div><ol>{snapshot.events.slice(-6).reverse().map(e=><li key={e.id}><time>{formatTime(e.time)}</time><span>{e.message}</span><small>{e.source.toUpperCase()}</small></li>)}</ol></div></section>
    <footer className="dash-footer" style={{'--timeline-h':timelineHeight+'px'} as React.CSSProperties}><span><i/> {notice||snapshot.error||'One active post · shared clock · route changes pause the session'}</span><span>INDIAN BORDER TRAINING <i> / </i> {post.name.toUpperCase()} · {snapshot.trainingMode?`L${snapshot.level??0} ${snapshot.trainingMode.toUpperCase()}`:'FREE CONSOLE'}</span></footer>
  </main>;
}
