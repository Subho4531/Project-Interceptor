import { useEffect, useRef, useState } from 'react';
import { CommandRoom } from '../rendering/CommandRoom';
import { useSession, useSessionSnapshot } from '../session/SessionContext';
import { appLink } from '../routing';
import { postById } from '../dashboard/posts';
import './room.css';

export default function CommandRoomRoute(){
  const controller=useSession(),session=useSessionSnapshot(),canvas=useRef<HTMLCanvasElement>(null),room=useRef<CommandRoom|undefined>(undefined);
  const [ready,setReady]=useState(false),[supported,setSupported]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  useEffect(()=>{if(!canvas.current)return;setReady(false);setError('');try{room.current=new CommandRoom(canvas.current,controller,{ready:()=>setReady(true),error:setError,xr:setSupported,notice:setNotice});}catch(reason){setError(String(reason));}return()=>{room.current?.dispose();room.current=undefined;};},[controller,session.postId]);
  return <main className="room-route"><canvas ref={canvas} aria-label="Interactive imported command room"/><header><div><strong>{postById(session.postId).name.toUpperCase()} / COMMAND ROOM</strong><small>{session.trainingMode?.toUpperCase()} · LEVEL {session.level} · {session.status.toUpperCase()} · {Math.floor(session.time)} s</small></div><nav><a href={appLink('progress')}>Curriculum</a><a href={appLink('trainer')}>Focused console</a><a href={appLink('dashboard')}>Instructor</a></nav></header>
    {!ready&&<section className="room-loading" role="status"><h1>{error?'Room unavailable':'Loading command room…'}</h1><p>{error||'Preparing imported modules and shared monitor controls.'}</p><a href={appLink('trainer')}>Open focused desktop controls</a></section>}
    <footer><div><b>SEATED TRAINING / PC VR</b><span>Drag to look. Click monitor buttons, or use controller rays in VR. The focused console provides larger text.</span><small>Furniture Kit by Kenney · CC0. Fictional room; imported modules. Real headset acceptance is pending.</small></div><div><button disabled={!ready||!supported} onClick={()=>void room.current?.enterVR().catch(reason=>setNotice(String(reason)))}>Enter PC VR</button><button onClick={()=>void room.current?.exitVR()}>Exit VR</button><button onClick={()=>room.current?.recenter()}>Recenter</button><button onClick={()=>controller.command({type:'pause',reason:'room-operator'})}>Pause</button><a href={appLink('trainer')}>Open assessment / AAR</a></div>{!supported&&ready&&<p>Immersive VR is unavailable here. Connect the headset to an OpenXR runtime and use a trusted browser context. Desktop controls remain available.</p>}{(notice||session.storageError)&&<p role="status">{notice||session.storageError}</p>}</footer>
  </main>;
}
