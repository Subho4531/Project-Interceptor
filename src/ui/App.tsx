import { useEffect, useRef, useState } from 'react';
import { Trainer, type TrainerDiagnostics } from '../rendering/Trainer';
import { exercises } from '../simulation/config';
import type { Conditions, Quality, TraineeState, ExerciseId } from '../simulation/types';
import { Briefing, ContactPanel, ExerciseResults, elapsed } from './TrainingPanels';
import { appLink, assetUrl } from '../routing';
import { useSession, useSessionSnapshot } from '../session/SessionContext';
import { posts, postById } from '../dashboard/posts';
import type { PostId } from '../dashboard/types';
import RegionalCredits from './RegionalCredits';
type Credit = { name: string; sourceUrl: string; author: { name: string; profile: string }; license: { fullName: string; url: string; requirements: string } };
const initial: TraineeState = { time: 0, status: 'ready', zoom: false, heading: 14, conditions: { timeOfDay: 'day', visibility: 'clear' }, fps: 0 };
const timecode = elapsed;
function Icon({ type }: { type: 'pause' | 'reset' | 'settings' | 'arrow' }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">{type === 'pause' ? <><path d="M8 5v14M16 5v14" /></> : type === 'reset' ? <><path d="M4 10a8 8 0 1 1 1 7M4 4v6h6" /></> : type === 'settings' ? <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="2" fill="currentColor" /><circle cx="15" cy="17" r="2" fill="currentColor" /></> : <path d="M4 12h15m-6-6 6 6-6 6" />}</svg>;
}
export default function App() {
  const controller = useSession(), session = useSessionSnapshot();
  const canvas = useRef<HTMLCanvasElement>(null), trainer = useRef<Trainer | null>(null);
  const [state, setState] = useState(initial), [progress, setProgress] = useState({ label: 'Initializing renderer', value: 0 });
  const [rendererAttempt,setRendererAttempt]=useState(0);
  const [ready, setReady] = useState(false), [error, setError] = useState(''), [warnings, setWarnings] = useState<string[]>([]);
  const [aerialReady, setAerialReady] = useState(false), [settings, setSettings] = useState(false), [quality, setQuality] = useState<Quality>('standard');
  const delay = session.quietPeriod, mapId = controller.environment.id;
  const [notice, setNotice] = useState('');
  const exercise = controller.exercise;
  const [contactPanel,setContactPanel] = useState(false), [selectedContact,setSelectedContact] = useState('');
  const lastContact = useRef('');
  const [credits,setCredits] = useState<Credit[]>([]);
  const [diagnostics,setDiagnostics] = useState<TrainerDiagnostics | null>(null);
  const selectedMap = controller.environment, post=postById(session.postId);
  const qa = new URLSearchParams(location.search).has('qa');
  const newestContact = state.training?.reports.at(-1)?.id ?? '';
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    const newest = newestContact;
    if (newest && newest !== lastContact.current) { setSelectedContact(newest); setContactPanel(true); setSettings(false); }
    if (!newest) { setContactPanel(false); setSelectedContact(''); }
    lastContact.current = newest;
    if (state.status === 'running') setContactPanel(false);
    if (state.status === 'completed') { setContactPanel(false); setSettings(false); }
  },[newestContact,state.status]);
  useEffect(() => {
    const listener = (event:KeyboardEvent) => {
      if (event.code !== 'KeyC' || event.repeat || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || !state.training || !['running','paused'].includes(state.status)) return;
      event.preventDefault(); trainer.current?.pause('review-reports'); setSettings(false); setContactPanel(true);
    };
    document.addEventListener('keydown',listener); return () => document.removeEventListener('keydown',listener);
  },[state.training,state.status]);
  useEffect(() => { const controller = new AbortController(); void fetch(assetUrl('./assets/credits.json'),{signal:controller.signal}).then(r => { if (!r.ok) throw new Error('Credits unavailable'); return r.json(); }).then(setCredits).catch(() => {}); return () => controller.abort(); },[]);
  useEffect(() => {
    if (!canvas.current) return;
    setReady(false); setWarnings([]); setError(''); setProgress({label:'Preparing observation area',value:0});
    let mounted = true;
    try {
      trainer.current = new Trainer(canvas.current, {
        progress: (label, value) => { if (mounted) setProgress({ label, value }); },
        state: s => { if (mounted) setState(s); },
        ready: (w, aerial) => { if (mounted) { setReady(true); setWarnings(w); setAerialReady(aerial); } },
        error: e => { if (mounted) setError(e); }, locked: () => {},
        diagnostics: d => { if (mounted) setDiagnostics(d); },
        contact: id => { if (mounted) { setSelectedContact(id); setContactPanel(true); setSettings(false); } },
        notice: n => { if (!mounted) return; setNotice(n); clearTimeout(noticeTimer.current); noticeTimer.current = setTimeout(() => setNotice(''), 4000); },
      }, { controller, quality });
    } catch (e) { setError(String(e)); }
    return () => { mounted = false; clearTimeout(noticeTimer.current); trainer.current?.dispose(); trainer.current = null; };
    // A map owns its renderer and resource containers. Dispose it fully before opening another.
    // Conditions, exercise, quality and quiet period are carried into the new map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, mapId, rendererAttempt]);
  useEffect(() => { trainer.current?.restoreObserver(); }, [session.sessionId]);
  function conditions(patch: Partial<Conditions>) { trainer.current?.setConditions({ ...state.conditions, ...patch }); }
  function resetExercise() { trainer.current?.reset(); setSettings(false); setContactPanel(false); }
  function exportReview() {
    if (!state.training?.review) return;
    const data = {version:2,sessionId:session.sessionId,postId:session.postId,map:mapId,exercise,seed:session.seed,conditions:state.conditions,training:state.training};
    const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    const link = document.createElement('a'); link.href=url; link.download=`interceptor-${exercise}-review.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  }
  const direction = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(state.heading / 45) % 8];
  const running = state.status === 'running' && !error;
  return <main className={`app ${running ? 'is-running' : ''} ${state.zoom ? 'is-zoomed' : ''} ${state.training ? 'has-training' : ''}`}>
    <canvas key={mapId} ref={canvas} className="world" aria-label="Interactive border observation environment" />
    <div className="screen-shade" />
    <header className="hud-header">
      <div className="identity"><span className="post-symbol">⌖</span><div><span className="eyebrow">{post.region.toUpperCase()}</span><strong>{post.name.toUpperCase()} <span>{post.callsign}</span></strong></div></div>
      <div className="compass" aria-label={`Heading ${Math.round(state.heading)} degrees ${direction}`}><div className="compass-ticks">│ · │ · │ · <b>{direction}</b> · │ · │ · │</div><span>{Math.round(state.heading).toString().padStart(3, '0')}°</span><i /></div>
      <div className="session"><span className={`status-dot ${running ? 'live' : ''}`} /><span>{ready ? (running ? 'IN SESSION' : state.status === 'completed' ? 'COMPLETE' : state.status === 'paused' ? 'PAUSED' : 'STANDBY') : 'PREPARING'}</span><time>{timecode(state.time)}</time></div>
    </header>
    <div className="hud-actions">
      <a className="trainer-dashboard-link" href={appLink('trainer')}>Training console ↗</a>
      <a className="trainer-dashboard-link" href={appLink('dashboard')}>Command dashboard ↗</a>
      {running && <button className="icon-button" onClick={() => trainer.current?.pause()} aria-label="Pause session" title="Pause (P)"><Icon type="pause" /></button>}
      <button className="icon-button" onClick={resetExercise} disabled={!ready} aria-label="Reset session" title="Reset session"><Icon type="reset" /></button>
      <button className="icon-button" onClick={() => { trainer.current?.pause('settings'); setContactPanel(false); setSettings(v => !v); }} disabled={!ready} aria-label="Environment settings" title="Environment settings"><Icon type="settings" /></button>
    </div>
    {running && <><div className="reticle" aria-hidden="true"><i /><i /></div><div className="optics-readout"><span>{state.zoom ? 'OBSERVATION OPTICS' : 'UNAIDED VIEW'}</span><b>{state.zoom ? '5.0×' : '1.0×'}</b></div></>}
    {!running && !settings && !contactPanel && state.status !== 'completed' && <section className="entry-panel" aria-label={error ? 'Renderer error' : state.status === 'paused' ? 'Session paused' : 'Session instructions'}>
      <span className="panel-index">{error ? 'RENDERER / UNAVAILABLE' : state.status === 'paused' ? 'SESSION / ON HOLD' : 'OBSERVATION TRAINING'}</span>
      <h1>{error ? 'Unable to open\nthe environment.' : state.status === 'paused' ? 'Take your time.\nKeep your bearings.' : state.training?.briefing.title ?? 'Eyes on\nthe horizon.'}</h1>
      <p className="intro">{error ? error : state.status === 'paused' ? 'Your position and session are held. Resume to return to the observation post.' : state.training?.briefing.description ?? 'Find an observation position and watch the surrounding airspace. Explore the post and the terrain beyond its gate.'}</p>
      {state.training && state.status === 'ready' && !error && <Briefing training={state.training} />}
      {!error && <div className="controls-guide"><div><kbd>W A S D</kbd><span>Move on foot</span></div><div><kbd>MOUSE</kbd><span>Look around</span></div><div><kbd>Z</kbd><span>Observation zoom</span></div><div><kbd>E</kbd><span>{state.training ? 'Detect & assess contact' : 'Record observation'}</span></div><div><kbd>{state.training ? 'C' : 'R'}</kbd><span>{state.training ? 'Review contact reports' : 'Return to position'}</span></div><div><kbd>ESC</kbd><span>Release mouse & pause</span></div></div>}
      {ready && !error && <button className="text-button" onClick={() => setSettings(true)}>Change map & flight exercise <Icon type="settings" /></button>}
      {error ? <button className="enter-button" onClick={() => setRendererAttempt(value=>value+1)}>Retry environment <Icon type="reset" /></button> : <button className="enter-button" disabled={!ready || Boolean(state.training && !aerialReady)} onClick={() => {setContactPanel(false); void trainer.current?.enter();}}>{ready ? (state.status === 'paused' ? 'Resume observation' : 'Enter observation post') : progress.label}<Icon type="arrow" /></button>}
      {!ready && !error && <div className="loading" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.value * 100)} aria-label={progress.label}><i style={{ width: `${progress.value * 100}%` }} /></div>}
      {ready && !aerialReady && <p className="asset-note"><span />Some aerial assets could not load. Check asset loading issues below.</p>}
      {warnings.length > 0 && <details className="warnings"><summary>Asset loading issues ({warnings.length})</summary>{warnings.map(w => <p key={w}>{w}</p>)}</details>}
    </section>}
    {settings && !error && <section className="settings-panel" aria-label="Environment settings"><span className="panel-index">{post.name.toUpperCase()} / {post.callsign} / EXERCISE</span><h2>Environment</h2><p>{selectedMap.description}</p>
      <label htmlFor="map">Training post</label><select id="map" value={session.postId} disabled={!ready} onChange={e => { if(session.status!=='ready' && !window.confirm('Change post and discard this session?'))return; controller.command({type:'post',postId:e.target.value as PostId,discardConfirmed:true}); }}>
        {posts.map(p => <option value={p.id} key={p.id}>{p.name} · {p.region}</option>)}
      </select>
      <label htmlFor="exercise">Training scenario</label><select id="exercise" value={exercise} disabled={!ready} onChange={e => { if(session.status!=='ready' && !window.confirm('Change exercise and discard this session?'))return; trainer.current?.setExercise(e.target.value as ExerciseId); }}>
        <optgroup label="Trainee scenarios">{exercises.filter(e => e.group === 'training').map(e => <option value={e.id} key={e.id}>{e.label}</option>)}</optgroup>
        <optgroup label="Airframe familiarisation">{exercises.filter(e => e.group === 'familiarisation').map(e => <option value={e.id} key={e.id}>{e.label}</option>)}</optgroup>
      </select><small>Each training scenario has a briefing, contact assessment and review. Changing map or scenario starts a new session.</small>
      <label htmlFor="lighting">Lighting</label><select disabled={!ready} id="lighting" value={state.conditions.timeOfDay} onChange={e => conditions({ timeOfDay: e.target.value as Conditions['timeOfDay'] })}><option value="day">Daylight</option><option value="night">Night</option></select>
      <label htmlFor="visibility">Visibility</label><select disabled={!ready} id="visibility" value={state.conditions.visibility} onChange={e => conditions({ visibility: e.target.value as Conditions['visibility'] })}><option value="clear">Clear</option><option value="reduced">Reduced</option></select>
      <label htmlFor="quality">Rendering quality</label><select disabled={!ready} id="quality" value={quality} onChange={e => { const q = e.target.value as Quality; setQuality(q); trainer.current?.setQuality(q); }}><option value="standard">Standard</option><option value="low">Performance</option></select>
      <label>Quiet period <span>{delay} sec</span><input type="range" min="0" max="120" step="5" value={delay} disabled={state.status !== 'ready'} onChange={e => trainer.current?.setQuietPeriod(Number(e.target.value))} /></label>
      {state.status !== 'ready' && <small>Reset the session to change the quiet period.</small>}
      {!ready && <p role="status">{progress.label}</p>}
      <RegionalCredits postId={session.postId}/><details className="asset-credits"><summary>Asset credits & licenses</summary><p>Sketchfab models are credited below. Geranium-2 is licensed for noncommercial use under ShareAlike terms.</p>{credits.map(c => <p key={c.sourceUrl}><a href={c.sourceUrl} target="_blank" rel="noreferrer">{c.name}</a> by <a href={c.author.profile} target="_blank" rel="noreferrer">{c.author.name}</a><br/><a href={c.license.url} target="_blank" rel="noreferrer">{c.license.fullName}</a></p>)}<p>Ground materials, plants, rocks and sky: <a href="https://polyhaven.com/license" target="_blank" rel="noreferrer">Poly Haven · CC0</a>.</p></details>
      <button className="enter-button" onClick={() => setSettings(false)}>Back to observation <Icon type="arrow" /></button>
    </section>}
    {ready && state.training && !settings && state.status !== 'ready' && state.status !== 'completed' && <aside className="training-actions" aria-label="Training controls"><span>{state.training.briefing.code}</span><button onClick={() => {trainer.current?.pause('review-reports'); setContactPanel(true);}}>Contact reports ({state.training.reports.length}) <kbd>C</kbd></button><button onClick={() => trainer.current?.finishExercise()}>End exercise & review</button></aside>}
    {contactPanel && state.training && !settings && state.status !== 'completed' && <ContactPanel training={state.training} selected={selectedContact} onSelect={setSelectedContact} onClassify={(id,value) => trainer.current?.classify(id,value)} onRespond={(id,value) => trainer.current?.respond(id,value)} onClose={() => setContactPanel(false)} />}
    {state.training?.review && state.status === 'completed' && !settings && <ExerciseResults training={state.training} onReset={resetExercise} onChoose={() => setSettings(true)} onExport={exportReview} />}
    {notice && <div className="notice" role="status">{notice}</div>}
    <footer className="hud-footer"><div><span className="eyebrow">{selectedMap.label.toUpperCase()}</span><span>Ground observation <i>·</i> {state.conditions.timeOfDay === 'day' ? 'Daylight' : 'Night'} <i>·</i> {state.conditions.visibility === 'clear' ? 'Clear visibility' : 'Reduced visibility'}</span></div><div className="footer-help">{running ? <><kbd>SHIFT</kbd> Brisk walk <span> / </span><kbd>Z</kbd> Zoom <span> / </span><kbd>P</kbd> Pause</> : <span>{state.training ? 'OBSERVE · ASSESS · REVIEW' : 'PHASE 01 — WORLD FOUNDATION'}</span>}</div></footer>
    {qa && <output id="qa-snapshot" hidden>{JSON.stringify(diagnostics)}</output>}
    {qa && ready && !running && <aside className="qa-tools" aria-label="Developer verification"><span>QA ONLY</span><button onClick={() => trainer.current?.advanceForQA(10)}>Advance 10 seconds</button><button onClick={() => trainer.current?.focusAerialForQA()}>Inspect aerial model</button><button onClick={() => trainer.current?.detectForQA()}>Record inspected contact</button><button onClick={() => trainer.current?.resetCamera()}>Restore observer</button><button onClick={() => trainer.current?.walkForQA(150,0)}>Probe fence</button><button onClick={() => { trainer.current?.resetCamera(); trainer.current?.walkForQA(5,0); trainer.current?.walkForQA(0,250); }}>Walk through gate</button></aside>}
  </main>;
}

