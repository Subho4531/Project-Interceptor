import { lazy, Suspense, Fragment } from 'react';
import type { SessionSnapshot } from './types';
import type { ExerciseState } from '../training/Exercise';
import { useSession } from '../session/SessionContext';
import { OPERATION_RADIUS } from '../simulation/world';
import './sensor-wall.css';

const EOPanel = lazy(() => import('./EOPanel'));
const RFSpectrum = lazy(() => import('./RFSpectrum'));
const clock = (time: number) => `${Math.floor(time / 60).toString().padStart(2, '0')}:${Math.floor(time % 60).toString().padStart(2, '0')}`;

export default function SensorWall({ snapshot, exercise }: { snapshot: SessionSnapshot; exercise: ExerciseState }) {
  const controller = useSession();
  const reports = (snapshot.sensorTracks ?? []).filter(track => track.state !== 'lost');
  const evidence = exercise.selectedEvidence.filter(item => item.source === 'rf').at(-1);
  function cueEO() {
    const track=reports[0];if(!track)return;
    const camera=controller.sensorEngine.eo,horizontal=Math.hypot(track.position.x-camera.position.x,track.position.z-camera.position.z);
    const elevation=Math.atan2(track.position.y-camera.position.y,horizontal)*180/Math.PI;
    controller.command({type:'eo',bearing:track.bearing,elevation,zoom:false});
  }
  return <section className="sensor-wall" aria-label="Live sensor wall">
    <div className="wall-heading"><div><span>LIVE SENSOR WALL</span><h1>{snapshot.postId === 'shakti-punjab' ? 'Shakti' : snapshot.postId === 'maru-rajasthan' ? 'Maru' : 'Himadri'} sector</h1></div><p>Simulated feeds share the session clock. The thermal view is a visual transformation of EO imagery, not independent heat evidence. The RF spectrum visualizes fictional drone emissions; it shows presence, not affiliation.</p></div>
    <div className="wall-grid">
      <section className="wall-card wall-radar" aria-label="Radar scope"><header><span>01 / RADAR SCOPE</span><b>{reports.length} RETURNS</b></header>
        <div className="wall-radar-scope"><i className="wall-ring inner"/><i className="wall-ring outer"/><i className="wall-axis horizontal"/><i className="wall-axis vertical"/><span className="wall-origin">⌖</span><span className="wall-north">N ↑</span>{reports.map(track => <Fragment key={track.id}>{(track.trail ?? []).slice(-18).filter((_,index)=>index%2===0).map((plot,plotIndex) => <i key={`${track.id}-trace-${plotIndex}`} className="wall-trace" style={{ left: `${50 + Math.max(-1, Math.min(1, plot.x / OPERATION_RADIUS)) * 44}%`, top: `${50 - Math.max(-1, Math.min(1, plot.z / OPERATION_RADIUS)) * 44}%`, opacity: ((plotIndex + 1) / 9) * .45 }} />)}<span className="wall-return" style={{ left: `${50 + Math.max(-1, Math.min(1, track.position.x / OPERATION_RADIUS)) * 44}%`, top: `${50 - Math.max(-1, Math.min(1, track.position.z / OPERATION_RADIUS)) * 44}%` }} title={`${Math.round(track.bearing)}° · ${track.state}`}><i/>{track.label}</span></Fragment>)}<small>OPERATION AREA {OPERATION_RADIUS * 2} M · MODEL RANGE 2.2 KM</small></div>
        <div className="wall-card-foot"><b>{reports.length ? reports.map(track => `${track.label} · ${Math.round(track.bearing)}° · ${track.state}`).join(' / ') : 'No unusual radar returns'}</b><span>1 Hz simulated sweep · terrain masking</span>{reports.length>0&&<button onClick={cueEO}>Cue EO to radar return ↗</button>}</div>
      </section>
      <Suspense fallback={<div className="wall-card wall-camera-loading" role="status">Preparing optical and thermal views…</div>}><EOPanel embedded /></Suspense>
      <Suspense fallback={<div className="wall-card wall-camera-loading" role="status">Preparing RF spectrum…</div>}><RFSpectrum snapshot={snapshot} exercise={exercise} /></Suspense>
      <section className="wall-card wall-signals" aria-label="Sensor and signal status"><header><span>05 / SIGNALS & CONDITIONS</span><b>{clock(snapshot.time)}</b></header>
        <dl><div><dt>EO OBSERVATIONS</dt><dd>{snapshot.eoObservations?.length ?? 0}</dd></div><div><dt>RADAR REPORTS</dt><dd>{reports.length}</dd></div><div><dt>LIGHT</dt><dd>{snapshot.conditions.timeOfDay.toUpperCase()}</dd></div><div><dt>VISIBILITY</dt><dd>{snapshot.conditions.visibility.toUpperCase()}</dd></div></dl>
        <div className="wall-rf"><span>RF QUERY</span><p>{evidence?.summary ?? (snapshot.scenarioId === 'low-ingress' ? 'No RF result delivered to the trainee yet. Request it from the training console.' : 'RF evidence is not configured for this exercise.')}</p></div>
        <small>All readings are fictional training outputs. Instructor truth remains a separate map layer.</small>
      </section>
    </div>
  </section>;
}
