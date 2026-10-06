import { useEffect, useRef, useState } from 'react';
import { Trainer } from '../rendering/Trainer';
import { useSession, useSessionSnapshot } from '../session/SessionContext';

/** Optional live optical view. It renders the shared session and never advances simulation time. */
export default function EOPanel({ onClose }: { onClose: () => void }) {
  const controller=useSession(), snapshot=useSessionSnapshot(), canvas=useRef<HTMLCanvasElement>(null);
  const [progress,setProgress]=useState('Preparing optical station'),[error,setError]=useState(''),[warnings,setWarnings]=useState<string[]>([]),[ready,setReady]=useState(false),[fps,setFps]=useState(0);
  const eo=controller.sensorEngine.eo, zoom=eo.fieldOfView===8;
  useEffect(()=>{
    if(!canvas.current)return;
    let mounted=true, renderer:Trainer|undefined;
    setReady(false);setError('');setWarnings([]);
    try {
      renderer=new Trainer(canvas.current,{
        progress:label=>{if(mounted)setProgress(label);},
        state:state=>{if(mounted)setFps(state.fps);},
        ready:issues=>{if(mounted){setReady(true);setWarnings(issues);}},
        error:message=>{if(mounted)setError(message);},locked:()=>{},notice:()=>{},
      },{controller,quality:'standard',mode:'eo'});
    }catch(e){setError(String(e));}
    return()=>{mounted=false;renderer?.dispose();};
  },[controller,snapshot.postId]);
  function adjust(patch:Partial<{bearing:number;elevation:number;zoom:boolean}>) {
    controller.command({type:'eo',bearing:eo.bearing,elevation:eo.elevation,zoom,...patch});
  }
  return <section className="eo-live-panel" aria-label="Simulated EO station" style={{position:'absolute',zIndex:12,right:24,top:100,width:'min(560px, calc(100vw - 48px))',background:'#080c13',border:'1px solid #334155',boxShadow:'0 18px 60px #0009'}}>
    <header style={{display:'flex',justifyContent:'space-between',padding:'12px 16px',borderBottom:'1px solid #1e293b'}}><strong>EO / LIVE OPTICAL VIEW</strong><button onClick={onClose} aria-label="Close EO live view">Close ×</button></header>
    <div style={{position:'relative',aspectRatio:'16 / 9'}}>
      <canvas ref={canvas} aria-label="Live view from simulated optical station" style={{display:'block',width:'100%',height:'100%'}} />
      {!ready && <p role="status" style={{position:'absolute',inset:'35% 8%',color:'#cbd5e1'}}>{error||progress}</p>}
      {ready && <><div aria-hidden="true" style={{position:'absolute',left:'50%',top:'50%',width:24,height:24,border:'1px solid #d0dde780',transform:'translate(-50%,-50%)',pointerEvents:'none'}}/><span style={{position:'absolute',left:12,bottom:8,fontFamily:'monospace',fontSize:11,color:'#cbd5e1'}}>{snapshot.status.toUpperCase()} · {eo.fieldOfView}° FOV · {fps} FPS</span></>}
    </div>
    <div style={{padding:16,display:'grid',gap:10,fontSize:12}}>
      <label>Bearing {eo.bearing.toFixed(0)}° <input aria-label="EO bearing" type="range" min="0" max="359" step="1" value={eo.bearing} onChange={event=>adjust({bearing:Number(event.target.value)})}/></label>
      <label>Elevation {eo.elevation.toFixed(0)}° <input aria-label="EO elevation" type="range" min="-20" max="80" step="1" value={eo.elevation} onChange={event=>adjust({elevation:Number(event.target.value)})}/></label>
      <button onClick={()=>adjust({zoom:!zoom})}>{zoom?'Return to 40° field of view':'Zoom to 8° field of view'}</button>
      <p style={{margin:0,color:'#94a3b8'}}>Fictional optical training parameters. Detection requires range, apparent size and clear line of sight. {snapshot.eoObservations?.length??0} current observations.</p>
      {warnings.length>0 && <details><summary>Asset dependencies ({warnings.length})</summary>{warnings.map(warning=><p key={warning}>{warning}</p>)}</details>}
    </div>
  </section>;
}
