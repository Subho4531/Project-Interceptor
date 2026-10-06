import { lazy, Suspense, useEffect, useState } from 'react';
import { useSession } from '../session/SessionContext';
const Trainer=lazy(()=>import('./App'));
const Dashboard=lazy(()=>import('../dashboard/Dashboard'));
export default function Routes() {
  const controller = useSession();
  const [pathname, setPathname] = useState(location.pathname);
  useEffect(() => {
    const navigate = () => { controller.command({type:'pause',reason:'view-change'}); setPathname(location.pathname); };
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element)?.closest?.('a');
      if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
      const target = new URL(anchor.href);
      if (target.origin !== location.origin || !/\/(dashboard|trainer)\/?$/.test(target.pathname)) return;
      event.preventDefault();
      if (target.pathname === location.pathname && target.search === location.search) return;
      controller.command({type:'pause',reason:'view-change'});
      history.pushState(null,'',target.pathname+target.search+target.hash);
      setPathname(target.pathname);
    };
    document.addEventListener('click',click);
    window.addEventListener('popstate',navigate);
    return () => { document.removeEventListener('click',click); window.removeEventListener('popstate',navigate); };
  },[controller]);
  const dashboard=/\/dashboard\/?$/.test(pathname);
  return <Suspense fallback={<div className="route-loading" role="status">Preparing {dashboard?'command dashboard':'observation trainer'}…</div>}>{dashboard?<Dashboard/>:<Trainer/>}</Suspense>;
}
