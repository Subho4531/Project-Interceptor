import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useSession, useSessionSnapshot } from '../session/SessionContext';
import { appBase, appLink } from '../routing';
import { saveAttempt, type ExerciseArchive } from '../training/AttemptStore';
import SensorConsole from './SensorConsole';
const EOPanel = lazy(() => import('../dashboard/EOPanel'));

function navigate(route: 'dashboard' | 'observer') {
  history.pushState(null, '', appLink(route));
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export default function SensorTrainingRoute() {
  const controller = useSession();
  const session = useSessionSnapshot();
  const exercise = controller.getExerciseState();
  const [notice, setNotice] = useState('');
  const [eoOpen, setEOOpen] = useState(false);
  const saved = useRef(new Set<string>());
  useEffect(() => {
    if (session.loadState === 'idle') void controller.loadAssets();
  }, [controller, session.loadState]);
  useEffect(() => {
    if (session.status !== 'completed' || saved.current.has(session.sessionId)) return;
    const state = controller.getExerciseState();
    if (!state.review) return;
    saved.current.add(session.sessionId);
    const archive: ExerciseArchive = { version: 1, id: session.sessionId, postId: session.postId, scenarioId: session.scenarioId, seed: session.seed, completedAt: new Date().toISOString(), mode: 'practice', state };
    void saveAttempt(archive).catch(error => setNotice(`History save failed: ${String(error)}. Use Export review JSON.`));
  }, [controller, session.status, session.sessionId, session.postId, session.scenarioId, session.seed]);
  function exportReview() {
    const data: ExerciseArchive = { version: 1, id: session.sessionId, postId: session.postId, scenarioId: session.scenarioId, seed: session.seed, completedAt: new Date().toISOString(), mode: 'practice', state: controller.getExerciseState() };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = `interceptor-${session.sessionId}-review.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function openSavedReview() {
    const data: ExerciseArchive = { version: 1, id: session.sessionId, postId: session.postId, scenarioId: session.scenarioId, seed: session.seed, completedAt: new Date().toISOString(), mode: 'practice', state: controller.getExerciseState() };
    void saveAttempt(data).then(() => {
      history.pushState(null, '', appBase(location.pathname) + 'aar/' + encodeURIComponent(session.sessionId));
      window.dispatchEvent(new PopStateEvent('popstate'));
    }).catch(error => setNotice(`Cannot open local replay: ${String(error)}. Export the review instead.`));
  }
  return <>
    <SensorConsole
      snapshot={exercise}
      postId={session.postId}
      sessionStatus={session.status}
      assetsReady={Boolean(session.assetsReady && session.scenarioId === 'low-ingress')}
      error={session.scenarioId !== 'low-ingress' ? 'Basic Detection is the first sensor-led exercise. Select Low-altitude incursion in the instructor dashboard.' : session.error}
      onAction={action => { const result = controller.exerciseAction(action); if (!result.ok) setNotice(result.message); else { setNotice(''); if (action.type === 'request-eo') setEOOpen(true); } }}
      onStart={() => { const result = controller.command({ type: 'start' }); if (!result.ok) setNotice(result.message); }}
      onPause={() => controller.command({ type: 'pause', reason: 'practice' })}
      onResume={() => controller.command({ type: 'resume' })}
      onReset={() => { controller.command({ type: 'reset', discardConfirmed: true }); setEOOpen(false); setNotice(''); }}
      onExport={exportReview}
      onOpenSavedReview={openSavedReview}
      onRetryAssets={() => { void controller.loadAssets(); }}
      onOpenObserver={() => navigate('observer')}
      onOpenDashboard={() => navigate('dashboard')}
    />
    {eoOpen && <Suspense fallback={<div role="status" className="sensor-route-notice">Preparing EO view…</div>}><EOPanel onClose={() => setEOOpen(false)} /></Suspense>}
    {notice && <div role="status" className="sensor-route-notice">{notice}</div>}
  </>;
}
