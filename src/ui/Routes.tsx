import { lazy, Suspense, useEffect, useState } from 'react';
import { useSession, useSessionSnapshot } from '../session/SessionContext';
const observerLoader=()=>import('./App');
const roomLoader=()=>import('./CommandRoomRoute');
const Observer=lazy(observerLoader);
const AAR=lazy(()=>import('./AARPage'));
const Dashboard=lazy(()=>import('../dashboard/Dashboard'));
const Progress=lazy(()=>import('./ProgressPage'));
const Room=lazy(roomLoader);
type WorkspaceOrg = 'dashboard'|'observer'|'room';
export default function Routes() {
  const controller = useSession();
  const session = useSessionSnapshot();
  const [pathname, setPathname] = useState(location.pathname);
  const [activated, setActivated] = useState<Partial<Record<WorkspaceOrg, boolean>>>({});
  useEffect(() => {
    const navigate = () => { controller.command({type:'pause',reason:'view-change'}); if(/\/dashboard\/?$/.test(location.pathname))controller.markInstructorAccess();setPathname(location.pathname); };
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element)?.closest?.('a');
      if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
      const target = new URL(anchor.href);
      if (target.origin !== location.origin || !(/\/(dashboard|observer|progress|room)\/?$/.test(target.pathname) || /\/aar\/[^/]+\/?$/.test(target.pathname))) return;
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
  const room=/\/room\/?$/.test(pathname);
  const pane: WorkspaceOrg|'aar'|'progress' = dashboard?'dashboard':observer?'observer':aar?'aar':room?'room':'progress';
  useEffect(()=>{ if(pane!=='aar'&&pane!=='progress'&&!activated[pane]) setActivated(prev=>({...prev,[pane]:true})); },[pane,activated]);
  // Preload the 3D workspaces at the start of the training: the moment regional assets
  // are validated both rooms build their scenes in the background (small command room
  // first, heavy ground observer after a short stagger) and stay resident afterwards.
  // Opening a surface later is then a visibility flip, not a rebuild — the render
  // loops of parked panes are stopped, so the GPU cost while hidden is zero.
  useEffect(()=>{
    if(!session.assetsReady)return;
    if(activated.observer&&activated.room)return;
    const timers:number[]=[];
    if(!activated.room)timers.push(window.setTimeout(()=>setActivated(prev=>({...prev,room:true})),300));
    if(!activated.observer)timers.push(window.setTimeout(()=>setActivated(prev=>({...prev,observer:true})),2400));
    return ()=>{for(const timer of timers)clearTimeout(timer);};
  },[session.assetsReady,session.status,activated.observer,activated.room]);
  const prepareLabel=(workspace:WorkspaceOrg|'progress')=>workspace==='dashboard'?'command dashboard':workspace==='observer'?'ground observer':workspace==='room'?'command room':'curriculum';
  const paneNode=(workspace:WorkspaceOrg, active:boolean, node: React.ReactNode)=>(activated[workspace]||active)?
    <Suspense fallback={active?<div className="route-loading" role="status">Preparing {prepareLabel(workspace)}…</div>:null}>
      <div className={'workspace-pane'+(active?'':' pane-hidden')} inert={!active||undefined}>{node}</div>
    </Suspense>:null;
  return <>{paneNode('dashboard',dashboard,<Dashboard/>)}
    {paneNode('observer',observer,<Observer paneVisible={observer}/>)}
    {paneNode('room',room,<Room paneVisible={room}/>)}
    {aar&&<Suspense fallback={<div className="route-loading" role="status">Preparing after action review…</div>}><AAR/></Suspense>}
    {pane==='progress'&&<Suspense fallback={<div className="route-loading" role="status">Preparing curriculum…</div>}><Progress/></Suspense>}
  </>;
}
