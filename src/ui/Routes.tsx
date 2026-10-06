import { lazy, Suspense, useEffect, useState } from 'react';
import { useSession } from '../session/SessionContext';
import { appBase } from '../routing';
const Trainer=lazy(()=>import('./SensorTrainingRoute'));
const Observer=lazy(()=>import('./App'));
const AAR=lazy(()=>import('./AARPage'));
const Dashboard=lazy(()=>import('../dashboard/Dashboard'));
const Progress=lazy(()=>import('./ProgressPage'));
const Room=lazy(()=>import('./CommandRoomRoute'));
export default function Routes() {
  const controller = useSession();
  const [pathname, setPathname] = useState(location.pathname);
  useEffect(() => {
    const navigate = () => { controller.command({type:'pause',reason:'view-change'}); if(/\/dashboard\/?$/.test(location.pathname))controller.markInstructorAccess();setPathname(location.pathname); };
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element)?.closest?.('a');
      if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
      const target = new URL(anchor.href);
      if (target.origin !== location.origin || !(/\/(dashboard|trainer|observer|progress|room)\/?$/.test(target.pathname) || /\/aar\/[^/]+\/?$/.test(target.pathname))) return;
      event.preventDefault();
      if (target.pathname === location.pathname && target.search === location.search) return;
      controller.command({type:'pause',reason:'view-change'});
      if(/\/dashboard\/?$/.test(target.pathname))controller.markInstructorAccess();
      history.pushState(null,'',target.pathname+target.search+target.hash);
      setPathname(target.pathname);
    };
    document.addEventListener('click',click);
    window.addEventListener('popstate',navigate);
    return () => { document.removeEventListener('click',click); window.removeEventListener('popstate',navigate); };
  },[controller]);
  const dashboard=/\/dashboard\/?$/.test(pathname);
  const observer=/\/observer\/?$/.test(pathname);
  const aar=/\/aar\/[^/]+\/?$/.test(pathname);
  const progress=/\/progress\/?$/.test(pathname)||pathname===appBase(pathname);
  const room=/\/room\/?$/.test(pathname);
  return <Suspense fallback={<div className="route-loading" role="status">Preparing {dashboard?'command dashboard':observer?'ground observer':aar?'after action review':progress?'curriculum':room?'command room':'training console'}…</div>}>{dashboard?<Dashboard/>:observer?<Observer/>:aar?<AAR/>:progress?<Progress/>:room?<Room/>:<Trainer/>}</Suspense>;
}
