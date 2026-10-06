import { useEffect, useState } from 'react';
import { getAttempt, type ExerciseArchive } from '../training/AttemptStore';
import { appLink } from '../routing';
import { postById } from '../dashboard/posts';
import './sensor-console.css';

const clock = (time: number) => `${Math.floor(time / 60).toString().padStart(2, '0')}:${Math.floor(time % 60).toString().padStart(2, '0')}`;
export default function AARPage() {
  const id = decodeURIComponent(location.pathname.match(/\/aar\/([^/]+)\/?$/)?.[1] ?? '');
  const [archive, setArchive] = useState<ExerciseArchive>();
  const [error, setError] = useState('');
  const [time, setTime] = useState(0);
  useEffect(() => {
    if (!id) { setError('No session was selected.'); return; }
    void getAttempt(id).then(result => {
      if (!result?.state.review) { setError('This completed session is not available in local history.'); return; }
      setArchive(result); setTime(result.state.time);
    }).catch(reason => setError(String(reason)));
  }, [id]);
  const review = archive?.state.review;
  const chronology = review?.chronology.filter(event => event.time <= time) ?? [];
  const evidence = archive?.state.selectedEvidence.filter(item => item.deliveryTime <= time) ?? [];
  const actions = archive?.state.actions.filter(item => item.time <= time) ?? [];
  return <main className="sensor-console aar-page">
    <header className="sensor-topbar"><div className="sensor-brand"><span className="sensor-brand-mark">⌖</span><span><strong>PROJECT INTERCEPTOR</strong><small>LOCAL AFTER ACTION REVIEW</small></span></div><nav><a href={appLink('trainer')}>Training console ↗</a><a href={appLink('dashboard')}>Instructor dashboard ↗</a></nav></header>
    {error ? <section className="aar-content"><h1>Review unavailable</h1><p role="alert">{error}</p><a href={appLink('trainer')}>Return to training</a></section>
      : !archive || !review ? <section className="aar-content" role="status">Loading local review…</section>
        : <section className="aar-content"><span className="sensor-kicker">{postById(archive.postId).name.toUpperCase()} / PRACTICE / {archive.completedAt.slice(0, 10)}</span><h1>After action review</h1>
          <div className="aar-summary"><strong>{Math.round(review.overall)}<small>/ 100</small></strong><p>Detection {Math.round(review.scores.detection)} · Classification {Math.round(review.scores.classification)} · Threat assessment {Math.round(review.scores.threatAssessment)} · Decision quality {Math.round(review.scores.decisionQuality)}</p></div>
          <p>First cue to acknowledgement: {review.detectionLatencySeconds === undefined ? 'No acknowledgement' : review.detectionLatencySeconds.toFixed(1) + ' seconds'}. {review.criticalDecisionError ? 'A critical decision error was recorded.' : 'No critical decision error was recorded.'}</p>
          <div className="aar-replay-control"><label htmlFor="replay-time">Replay trainee evidence at {clock(time)}</label><input id="replay-time" type="range" min="0" max={Math.max(1, Math.ceil(archive.state.time))} step="1" value={Math.min(time,Math.ceil(archive.state.time))} onChange={event => setTime(Number(event.target.value))}/><small>Replay shows only evidence and decisions recorded by this local exercise. It cannot change the completed result.</small></div>
          <div className="aar-columns"><section><h2>Events through {clock(time)}</h2><ol>{chronology.map(event => <li key={event.id}><time>{clock(event.time)}</time><span>{event.detail}</span></li>)}</ol></section><section><h2>Evidence available</h2><ol>{evidence.map(item => <li key={item.id}><time>{clock(item.deliveryTime)}</time><span><b>{item.source.toUpperCase()}</b> · {item.summary}</span></li>)}</ol><h2>Recorded actions</h2><ol>{actions.map(action => <li key={action.id}><time>{clock(action.time)}</time><span>{action.summary}</span></li>)}</ol></section></div>
          <div className="aar-truth"><h2>Scenario truth</h2><p>{review.groundTruth.objectType.toUpperCase()} · {review.groundTruth.coordination.replaceAll('-', ' ')} · {review.groundTruth.affiliation} · {review.groundTruth.threat} threat</p><small>Truth is available in completed reviews only. The replayed evidence lists what the trainee had received at the selected time.</small></div>
        </section>}
  </main>;
}
