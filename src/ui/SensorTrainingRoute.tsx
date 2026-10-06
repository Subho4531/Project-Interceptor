import { lazy, Suspense, useEffect, useState } from 'react';
import { useSession, useSessionSnapshot } from '../session/SessionContext';
import { appBase, appLink } from '../routing';
import { getAttempt, saveAttempt, type ExerciseArchive } from '../training/AttemptStore';
import { archiveAttempt } from '../training/Archive';
import SensorConsole from './SensorConsole';
const EOPanel = lazy(() => import('../dashboard/EOPanel'));

function navigate(route: 'dashboard' | 'observer' | 'progress' | 'room') {
  history.pushState(null, '', appLink(route));
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export default function SensorTrainingRoute() {
  const controller = useSession();
  const session = useSessionSnapshot();
  const exercise = controller.getExerciseState();
  const supported = ['low-ingress', 'ambiguous', 'friendly', 'coordinated', 'mixed'].includes(session.scenarioId);
  const [notice, setNotice] = useState('');
  const [eoOpen, setEOOpen] = useState(false);
  useEffect(() => {
    if (session.loadState === 'idle') void controller.loadAssets();
  }, [controller, session.loadState]);
  async function reviewArchive(): Promise<ExerciseArchive> {
    const current=archiveAttempt(session,controller.getExerciseState(),[],controller.getCompletedRecipe());
    try{
      const saved=await getAttempt(session.sessionId);
      if(session.status==='completed'&&saved?.state.review)return saved;
      if(saved?.checkpoints?.length)return {...current,checkpoints:saved.checkpoints};
    }catch{/* Export the live review if local storage is unavailable. */}
    return current;
  }
  async function exportReview() {
    const data=await reviewArchive();
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = `interceptor-${session.sessionId}-review.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function openSavedReview() {
    void reviewArchive().then(saveAttempt).then(() => {
      history.pushState(null, '', appBase(location.pathname) + 'aar/' + encodeURIComponent(session.sessionId));
      window.dispatchEvent(new PopStateEvent('popstate'));
    }).catch(error => setNotice(`Cannot open local replay: ${String(error)}. Export the review instead.`));
  }
  return <>
    <SensorConsole
      snapshot={exercise}
      postId={session.postId}
      scenarioId={session.scenarioId}
      trainingMode={session.trainingMode??'practice'}
      level={session.level??1}
      environmentSetting={session.environmentSetting??'rural'}
      weather={session.conditions.weather??'clear'}
      sensorHealth={session.sensorHealth}
      eligibilityFlags={session.eligibilityFlags??[]}
      sessionStatus={session.status}
      assetsReady={Boolean(session.assetsReady && supported)}
      error={!supported ? 'This is an outdoor familiarisation exercise. Select Basic Detection, Uncertain Activity, Authorized Flight or Multiple Returns in the instructor dashboard.' : session.error}
      onAction={action => { const result = controller.exerciseAction(action); if (!result.ok) setNotice(result.message); else { setNotice(''); if (action.type === 'request-eo') setEOOpen(true); } }}
      onStart={() => { const result = controller.command({ type: 'start' }); if (!result.ok) setNotice(result.message); }}
      onPause={() => controller.command({ type: 'pause', reason: 'practice' })}
      onResume={() => controller.command({ type: 'resume' })}
      onReset={() => { controller.command({ type: 'reset', discardConfirmed: true }); setEOOpen(false); setNotice(''); }}
      onExport={exportReview}
      onOpenSavedReview={openSavedReview}
      onRetryAssets={() => { void controller.loadAssets(); }}
      onScenarioChange={scenarioId => { const result=controller.command({type:'scenario',scenarioId}); if(!result.ok)setNotice(result.message);else setNotice(''); }}
      onOpenObserver={() => navigate('observer')}
      onOpenDashboard={() => navigate('dashboard')}
      onOpenProgress={() => navigate('progress')}
      onOpenRoom={() => navigate('room')}
    />
    {eoOpen && <Suspense fallback={<div role="status" className="sensor-route-notice">Preparing EO view…</div>}><EOPanel onClose={() => setEOOpen(false)} /></Suspense>}
    {(notice||session.storageError) && <div role="status" className="sensor-route-notice">{notice||session.storageError}</div>}
  </>;
}
