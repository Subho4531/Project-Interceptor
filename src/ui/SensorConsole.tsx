import { useMemo, useState } from 'react';
import type { ExerciseAction, ExerciseState } from '../training/Exercise';
import type { PostId } from '../dashboard/types';
import type { Conditions, TrainingScenarioId } from '../simulation/types';
import type { EnvironmentSetting } from '../simulation/EnvironmentVariants';
import type { SensorHealthSummary } from '../simulation/SensorEngine';
import { postById } from '../dashboard/posts';
import { assetUrl } from '../routing';
import './sensor-console.css';

type Props = {
  snapshot: ExerciseState;
  postId: PostId;
  scenarioId: TrainingScenarioId;
  trainingMode: 'guided' | 'practice' | 'assessment' | 'demo';
  level: number;
  environmentSetting: EnvironmentSetting;
  weather: NonNullable<Conditions['weather']>;
  sensorHealth?: SensorHealthSummary;
  eligibilityFlags: string[];
  sessionStatus: 'ready' | 'running' | 'paused' | 'completed';
  assetsReady: boolean;
  error?: string;
  onAction: (action: ExerciseAction) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onExport: () => void;
  onOpenSavedReview: () => void;
  onRetryAssets: () => void;
  onScenarioChange: (scenario: TrainingScenarioId) => void;
  onOpenObserver: () => void;
  onOpenDashboard: () => void;
  onOpenProgress: () => void;
  onOpenRoom: () => void;
};
const clock = (time: number) => `${Math.floor(time / 60).toString().padStart(2, '0')}:${Math.floor(time % 60).toString().padStart(2, '0')}`;
const optionSets = {
  objectType: [['unknown', 'Unknown'], ['uav', 'UAV'], ['non-uav', 'Non-UAV']],
  coordination: [['unknown', 'Unknown'], ['single', 'Single'], ['multiple-independent', 'Multiple independent'], ['coordinated', 'Coordinated group']],
  affiliation: [['unconfirmed', 'Unconfirmed'], ['friendly', 'Authorized / friendly'], ['unauthorized', 'Confirmed unauthorized']],
  threat: [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['critical', 'Critical']],
} as const;
const assessmentActions = {
  objectType: 'set-object-type',
  coordination: 'set-coordination',
  affiliation: 'set-affiliation',
  threat: 'set-threat',
} as const;

export default function SensorConsole({ snapshot, postId, scenarioId, trainingMode, level, environmentSetting, weather, sensorHealth, eligibilityFlags, sessionStatus, assetsReady, error, onAction, onStart, onPause, onResume, onReset, onExport, onOpenSavedReview, onRetryAssets, onScenarioChange, onOpenObserver, onOpenDashboard, onOpenProgress, onOpenRoom }: Props) {
  const [selectedId, setSelectedId] = useState<string>();
  const post = postById(postId);
  const briefingCode = scenarioId === 'ambiguous' ? 'TR 02 / UNCERTAIN ACTIVITY' : scenarioId === 'friendly' ? 'TR 03 / AUTHORIZATION REVIEW' : scenarioId === 'coordinated' ? 'TR 04 / COORDINATED CONTACTS' : scenarioId === 'mixed' ? 'TR 05 / PRIORITISE NEUTRAL TRACKS' : 'TR 01 / BASIC DETECTION';
  const selected = snapshot.tracks.find(track => track.id === selectedId) ?? snapshot.tracks.find(track => track.id === snapshot.selectedContactId) ?? snapshot.tracks[0];
  const assessment = selected ? snapshot.assessments[selected.id] ?? {} : {};
  const evidence = selected ? snapshot.evidenceByContact[selected.id] ?? [] : [];
  const radarPoints = useMemo(() => snapshot.tracks.map(track => {
    const distance = Math.min(1, track.rangeMeters / 2200) * 43;
    const angle = track.bearing * Math.PI / 180;
    return { track, left: 50 + Math.sin(angle) * distance, top: 50 - Math.cos(angle) * distance };
  }), [snapshot.tracks]);
  const action = (type: ExerciseAction['type'], contactId?: string) => onAction({ type, ...(contactId ? { contactId } : {}) } as ExerciseAction);
  const assess = (key: keyof typeof optionSets, value: string) => {
    if (!selected) return;
    onAction({ type: assessmentActions[key], contactId: selected.id, value } as ExerciseAction);
  };
  return <main className="sensor-console">
    <header className="sensor-topbar">
      <div className="sensor-brand"><span className="sensor-brand-mark">⌖</span><span><strong>PROJECT INTERCEPTOR</strong><small>TRAINEE / SENSOR CONSOLE</small></span></div>
      <div className="sensor-session"><span>{post.name.toUpperCase()} · {post.region.toUpperCase()}</span><b>{sessionStatus.toUpperCase()}</b><time>{clock(snapshot.time)}</time></div>
      <nav aria-label="Session views"><button onClick={onOpenProgress}>Curriculum ↗</button><button onClick={onOpenRoom}>Room / VR ↗</button><button onClick={onOpenObserver}>Ground observer ↗</button><button onClick={onOpenDashboard}>Open dashboard ↗</button></nav>
    </header>
    <div className="sensor-health-strip" role="status" aria-label="Training environment and sensor status">
      <span>SETTING <b>{environmentSetting === 'semi-urban' ? 'SEMI-URBAN' : 'RURAL'}</b></span>
      <span>WEATHER <b>{weather.toUpperCase()}</b></span>
      {sensorHealth&&<>
        <span>{sensorHealth.difficulty.toUpperCase()} SENSOR MODEL</span>
        <span>RADAR <b>{sensorHealth.radarLatencySeconds}s delay · ±{sensorHealth.radarNoiseMeters}m noise · {Math.round(sensorHealth.radarIntermittenceProbability*100)}% gaps</b></span>
        <span>EO <b>{Math.round(sensorHealth.eoRangeScale*100)}% range · {Math.round(sensorHealth.eoOutageProbability*100)}% outage</b></span>
      </>}
    </div>
    {sessionStatus === 'ready' && <section className="sensor-briefing" aria-label="Exercise briefing">
      <span className="sensor-kicker">{briefingCode}</span><h1>Monitor the post. Assess what the sensors reveal.</h1>
      <p>{scenarioId==='mixed'?'Multiple neutral tracks may appear. Compare their evidence, prioritise investigations and keep each assessment tied to its own contact.':'Unusual activity may appear after a quiet period. Acknowledge a sensor track, compare available evidence, then submit your assessment and high-level decision.'}</p>
      <label className="sensor-brief-choice">EXERCISE<select aria-label="Training exercise" disabled={trainingMode==='assessment'} value={scenarioId} onChange={event=>onScenarioChange(event.target.value as TrainingScenarioId)}><option value="low-ingress">TR 01 · Basic detection</option><option value="ambiguous">TR 02 · Uncertain activity</option><option value="friendly">TR 03 · Authorization review</option><option value="coordinated">TR 04 · Coordinated contacts</option><option value="mixed">TR 05 · Track prioritisation</option></select></label>
      <div className="sensor-brief-grid"><span>POST <b>{post.name} / {post.state}</b></span><span>MODE <b>Level {level} · {trainingMode}</b></span><span>SENSORS <b>Radar · EO · RF · roster</b></span></div>
      {trainingMode==='assessment'&&<p className="sensor-muted">Assessment runs at 1×. Pausing, leaving the trainee view or opening instructor truth makes this attempt ineligible for progression.</p>}
      <p className="sensor-muted">Object identity and the expected answer remain hidden until review. The assessment clock continues while panels are open.</p>
      {error && <p role="alert" className="sensor-error">{error} <button onClick={onRetryAssets}>Retry assets</button></p>}
      <button className="sensor-primary" disabled={!assetsReady} onClick={onStart}>{assetsReady ? 'Start exercise →' : 'Validating local training assets…'}</button>
    </section>}
    {sessionStatus === 'paused' && <div className="sensor-paused" role="status"><b>Exercise paused</b><span>The simulation clock and pending evidence are held.</span><button onClick={onResume}>Resume exercise</button></div>}
    {eligibilityFlags.length>0&&sessionStatus!=='ready'&&<div className="sensor-consequence" role="status"><strong>PROGRESSION INELIGIBLE</strong><span>{eligibilityFlags.join(' · ')}. The attempt remains available for review.</span></div>}
    {snapshot.consequences.length > 0 && sessionStatus !== 'completed' && <div className="sensor-consequence" role="status"><strong>SIMULATED OUTCOME</strong><span>{snapshot.consequences.at(-1)!.summary}</span></div>}
    {sessionStatus !== 'ready' && <div className="sensor-workspace">
      <section className="sensor-panel sensor-map" aria-label="Airspace overview"><div className="sensor-panel-heading"><span>01 / AIRSPACE OVERVIEW</span><span>LOCAL SECTOR · SIMULATED</span></div>
        <div className="sensor-map-image" style={{ backgroundImage: `linear-gradient(#07141aba,#07141aba),url("${assetUrl(`./assets/regions/${postId}/imagery.jpg`)}")` }}>
          <div className="sensor-radar-ring ring-one" /><div className="sensor-radar-ring ring-two" /><div className="sensor-radar-cross x" /><div className="sensor-radar-cross y" /><span className="sensor-radar-post">⌖</span>
          {radarPoints.map(({ track, left, top }) => <button key={track.id} style={{ left: `${left}%`, top: `${top}%` }} className={`sensor-blip ${selected?.id === track.id ? 'selected' : ''}`} aria-label={`Select ${track.label}`} onClick={() => setSelectedId(track.id)}><i/><span>{track.label}</span></button>)}
          <span className="sensor-north">N ↑</span><span className="sensor-radius">RADAR 2.2 KM / TRAINING PARAMETER</span>
        </div>
        <p className="sensor-map-note">The map places measured returns relative to the fictional post. Bearing and range include modeled uncertainty.</p>
      </section>
      <section className="sensor-panel sensor-tracks" aria-label="Radar returns"><div className="sensor-panel-heading"><span>02 / RADAR</span><span>{snapshot.tracks.length} RETURNS</span></div>
        {snapshot.tracks.length === 0 ? <div className="sensor-empty">No unusual returns. Maintain watch; sensor silence is not confirmation of clear airspace.</div> :
          <div className="sensor-track-list">{snapshot.tracks.map(track => <button key={track.id} className={selected?.id === track.id ? 'selected' : ''} onClick={() => setSelectedId(track.id)}><strong>{track.label}</strong><span>{Math.round(track.bearing).toString().padStart(3, '0')}° · {(track.rangeMeters / 1000).toFixed(2)} km</span><small>{track.state.toUpperCase()} · {track.acknowledged ? 'ACKNOWLEDGED' : 'NEW'}</small></button>)}</div>}
        {selected && <div className="sensor-contact"><span className="sensor-kicker">SELECTED / {selected.label}</span><div className="sensor-values"><span>Bearing <b>{Math.round(selected.bearing)}°</b></span><span>Range <b>{Math.round(selected.rangeMeters)} m</b></span><span>Quality <b>{Math.round(selected.quality * 100)}%</b></span></div><button className="sensor-primary" disabled={selected.acknowledged || sessionStatus !== 'running'} onClick={() => action('acknowledge-track', selected.id)}>{selected.acknowledged ? 'Acknowledged' : 'Acknowledge track'}</button></div>}
      </section>
      <section className="sensor-panel sensor-evidence" aria-label="Investigation"><div className="sensor-panel-heading"><span>03 / INVESTIGATION</span><span>OBSERVED EVIDENCE</span></div>
        {!selected?.acknowledged ? <div className="sensor-empty">Acknowledge a return to open its investigation record.</div> : <>
          <div className="sensor-investigate">{([['request-eo', 'Cue EO / thermal'], ['request-rf', 'Check RF'], ['request-roster', 'Check flight roster'], ['request-history', 'Movement history']] as const).map(([type,label])=><button key={type} disabled={sessionStatus !== 'running'} onClick={() => action(type,selected.id)}>{label} ↗</button>)}</div>
          <ol className="sensor-evidence-list">{evidence.length ? evidence.map(item => <li key={item.id}><time>{clock(item.deliveryTime)}</time><strong>{item.source.toUpperCase()}</strong><span>{item.summary}<small>Captured {clock(item.captureTime)} · delivered {clock(item.deliveryTime)}</small></span></li>) : <li><span>Radar acknowledgement logged. Request more evidence before deciding.</span></li>}</ol>
        </>}
      </section>
      <section className="sensor-panel sensor-assess" aria-label="Assessment and decisions"><div className="sensor-panel-heading"><span>04 / ASSESS & RESPOND</span><span>{selected?.label ?? 'NO CONTACT'}</span></div>
        {!selected?.acknowledged ? <div className="sensor-empty">Assessment controls open after a track is acknowledged.</div> : <>
          <div className="sensor-assessment-grid">{(Object.keys(optionSets) as (keyof typeof optionSets)[]).map(key => <label key={key}>{key === 'objectType' ? 'Object type' : key === 'coordination' ? 'Coordination' : key === 'affiliation' ? 'Affiliation' : 'Threat level'}<select value={assessment[key] ?? ''} disabled={sessionStatus !== 'running'} onChange={event => assess(key,event.target.value)}><option value="">Select assessment</option>{optionSets[key].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>)}</div>
          <div className="sensor-decisions"><span className="sensor-kicker">HIGH-LEVEL ACTIONS</span>{([['verification','Request verification'],['monitor','Continue monitoring'],['alert','Raise local alert'],['report','Report to command'],['authorization','Request authorization'],['authorized-response','Request authorized simulated response']] as const).map(([type,label]) => <button key={type} disabled={sessionStatus !== 'running'} onClick={() => action(type,selected.id)}>{label}</button>)}</div>
          <small>Decisions and revisions are recorded. An action does not automatically establish target identity.</small>
        </>}
      </section>
      <section className="sensor-panel sensor-assistant" aria-label="Analysis assistant"><div className="sensor-panel-heading"><span>SAARTHI / ANALYSIS SUPPORT</span><span>LOCAL RULES</span></div>
        {trainingMode==='guided'&&<div className="sensor-hypothesis"><b>Practice coach</b><p>{!selected?'Maintain watch for new returns.':!selected.acknowledged?'Acknowledge the neutral track to start an investigation record.':evidence.length<2?'Request another source and compare its capture time, delivery time and uncertainty.':'Compare supporting and conflicting evidence. Keep object type, affiliation and risk separate, then choose a proportionate action.'}</p></div>}
        {snapshot.hypotheses.length ? snapshot.hypotheses.filter(h => !selected || h.contactId === selected.id).map((h,index) => <div className="sensor-hypothesis" key={index}><b>{h.label}</b><span>{h.confidence.toUpperCase()} SUPPORT</span><p>{h.basis}</p></div>) : <p className="sensor-muted">No hypothesis is available. The assistant uses delivered sensor evidence and does not decide for you.</p>}
        <small>Support descriptions are training aids, not calibrated probabilities.</small>
      </section>
      <section className="sensor-panel sensor-log" aria-label="Exercise timeline"><div className="sensor-panel-heading"><span>SESSION / EVENT LOG</span><span>{snapshot.actions.length} ACTIONS</span></div><ol>{snapshot.actions.slice(-8).reverse().map(item=><li key={item.id}><time>{clock(item.time)}</time><span>{item.summary}</span></li>)}</ol></section>
    </div>}
    {sessionStatus !== 'ready' && <footer className="sensor-footer"><span>{post.name} · {sessionStatus === 'completed' ? 'Review ready' : 'Fictional unit-level exercise'}</span><div>{sessionStatus === 'running' && <button onClick={onPause}>Pause</button>}{sessionStatus === 'paused' && <button onClick={onResume}>Resume</button>}{sessionStatus !== 'completed' && <button onClick={() => action('finish')}>End & review</button>}<button onClick={onReset}>Reset</button></div></footer>}
    {snapshot.review && sessionStatus === 'completed' && <section className="sensor-review" aria-label="After action review">
      <span className="sensor-kicker">AFTER ACTION REVIEW</span><h2>Exercise complete</h2>
      <p>{snapshot.review.summary}</p>
      {level===0?<div className="sensor-diagnostic-note"><strong>Familiarisation · diagnostic</strong><span>This review supports practice only. It has no progression score.</span></div>:<div className="sensor-score"><strong>{Math.round(snapshot.review.overall)}</strong><span>/ 100 · OVERALL</span></div>}
      <p className="sensor-review-latency">First cue to acknowledgement: {snapshot.review.detectionLatencySeconds === undefined ? 'No acknowledgement' : snapshot.review.detectionLatencySeconds.toFixed(1) + ' s'}{snapshot.review.criticalDecisionError ? ' · Critical decision error recorded' : ''}</p>
      <div className="sensor-score-grid">{([['detection','Detection'],['classification','Classification'],['threatAssessment','Threat assessment'],['decisionQuality','Decision quality']] as const).map(([key,label])=><div key={key}><b>{Math.round(snapshot.review!.scores[key])}</b><span>{level===0?`Diagnostic · ${label}`:label}</span><p>{snapshot.review!.reasons[key]}</p></div>)}</div>
      <p className="sensor-review-truth">Scenario truth revealed after completion: {snapshot.review.groundTruth.objectType.toUpperCase()} · {snapshot.review.groundTruth.coordination.replaceAll('-', ' ')} · {snapshot.review.groundTruth.affiliation} · {snapshot.review.groundTruth.threat} threat.</p>
      <h3>Chronology</h3><ol>{snapshot.review.chronology.map(item=><li key={item.id}><time>{clock(item.time)}</time><span><b>{item.type.replaceAll('-', ' ')}</b><small>{item.detail}</small></span></li>)}</ol>
      <div className="sensor-review-actions"><button className="sensor-primary" onClick={onOpenSavedReview}>Open replay →</button><button onClick={onReset}>Repeat exercise</button><button onClick={onExport}>Export review JSON</button><button onClick={onOpenDashboard}>Instructor dashboard</button></div>
    </section>}
  </main>;
}
