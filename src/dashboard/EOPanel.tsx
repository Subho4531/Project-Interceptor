import { useEffect, useRef, useState } from 'react';
import { Trainer } from '../rendering/Trainer';
import { useSession, useSessionSnapshot } from '../session/SessionContext';

/** The thermal pane is a false-colour transformation of the optical render, not an independent IR measurement. */
export default function EOPanel({ onClose, embedded = false }: { onClose?: () => void; embedded?: boolean }) {
  const controller=useSession(), snapshot=useSessionSnapshot(), canvas=useRef<HTMLCanvasElement>(null), thermal=useRef<HTMLCanvasElement>(null);
  const [progress,setProgress]=useState('Preparing optical station'),[error,setError]=useState(''),[warnings,setWarnings]=useState<string[]>([]),[ready,setReady]=useState(false),[fps,setFps]=useState(0);
  const eo=controller.sensorEngine.eo, zoom=eo.fieldOfView===8;
  useEffect(()=>{
    if(!canvas.current)return;
    let mounted=true, renderer:Trainer|undefined, frame=0, lastThermal=0;
    setReady(false);setError('');setWarnings([]);
    try {
      renderer=new Trainer(canvas.current,{
        progress:label=>{if(mounted)setProgress(label);},
        state:state=>{if(mounted)setFps(state.fps);},
        ready:issues=>{if(mounted){setReady(true);setWarnings(issues);}},
        error:message=>{if(mounted)setError(message);},locked:()=>{},notice:()=>{},
      },{controller,quality:'standard',mode:'eo'});
    }catch(e){setError(String(e));}
    const paintThermal=(now:number)=>{
      if(!mounted)return;
      if(now-lastThermal>=160 && canvas.current && thermal.current){
        lastThermal=now;
        const output=thermal.current,context=output.getContext('2d',{willReadFrequently:true});
        if(context){
          output.width=320;output.height=180;
          context.drawImage(canvas.current,0,0,320,180);
          const pixels=context.getImageData(0,0,320,180),data=pixels.data;
          const palette=[[7,16,39],[30,72,102],[111,82,116],[220,132,90],[255,231,177]];
          for(let i=0;i<data.length;i+=4){
            const value=Math.min(3.999,Math.max(0,(data[i]*.21+data[i+1]*.72+data[i+2]*.07)/255*4));
            const segment=Math.floor(value),part=value-segment;
            for(let channel=0;channel<3;channel++)data[i+channel]=palette[segment][channel]*(1-part)+palette[segment+1][channel]*part;
          }
          context.putImageData(pixels,0,0);
        }
      }
      frame=requestAnimationFrame(paintThermal);
    };
    frame=requestAnimationFrame(paintThermal);
    return()=>{mounted=false;cancelAnimationFrame(frame);renderer?.dispose();};
  },[controller,snapshot.postId]);
  function adjust(patch:Partial<{bearing:number;elevation:number;zoom:boolean}>) {
    controller.command({type:'eo',bearing:eo.bearing,elevation:eo.elevation,zoom,...patch});
  }
  const controls=<div style={{padding:16,display:'grid',gap:10,fontSize:12}}>
    <label>Bearing {eo.bearing.toFixed(0)}° <input aria-label="EO bearing" type="range" min="0" max="359" step="1" value={eo.bearing} onChange={event=>adjust({bearing:Number(event.target.value)})}/></label>
    <label>Elevation {eo.elevation.toFixed(0)}° <input aria-label="EO elevation" type="range" min="-20" max="80" step="1" value={eo.elevation} onChange={event=>adjust({elevation:Number(event.target.value)})}/></label>
    <button onClick={()=>adjust({zoom:!zoom})}>{zoom?'Return to 40° field of view':'Zoom to 8° field of view'}</button>
    <p style={{margin:0,color:'#94a3b8'}}>Fictional optical training parameters · {snapshot.status.toUpperCase()} · {eo.fieldOfView}° FOV · {fps} FPS. Detection requires range, apparent size and clear line of sight. {snapshot.eoObservations?.length??0} current observations.</p>
    {warnings.length>0 && <details><summary>Asset dependencies ({warnings.length})</summary>{warnings.map(warning=><p key={warning}>{warning}</p>)}</details>}
  </div>;
  return <section className="eo-live-panel" aria-label="Simulated EO and thermal views" data-ready={ready} style={embedded ? undefined : {position:'absolute',zIndex:12,right:24,top:100,width:'min(560px, calc(100vw - 48px))',background:'#080c13',border:'1px solid #334155',boxShadow:'0 18px 60px #0009'}}>
    <header style={{display:'flex',justifyContent:'space-between',padding:'12px 16px',borderBottom:'1px solid #1e293b'}}><strong>EO / THERMAL VIEWS</strong>{onClose&&<button onClick={onClose} aria-label="Close EO live view">Close ×</button>}</header>
    <div className="eo-feed-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:1,background:'#334851'}}>
      <div className="eo-feed"><span>LIVE OPTICAL</span><div style={{position:'relative',aspectRatio:'16 / 9'}}><canvas ref={canvas} aria-label="Live view from simulated optical station" style={{display:'block',width:'100%',height:'100%'}} />{!ready&&<p role="status" style={{position:'absolute',inset:'20% 8%',color:'#cbd5e1'}}>{error||progress}</p>}{ready&&<div aria-hidden="true" style={{position:'absolute',left:'50%',top:'50%',width:19,height:19,border:'1px solid #d0dde780',transform:'translate(-50%,-50%)',pointerEvents:'none'}}/>}</div></div>
      <div className="eo-feed"><span>THERMAL VISUALIZATION</span><canvas ref={thermal} className="eo-thermal-canvas" aria-label="Synthetic thermal visualization derived from optical view" style={{display:'block',width:'100%',aspectRatio:'16 / 9'}} /></div>
    </div>
    <p className="eo-thermal-note">False-colour EO visualization only; no independent infrared detection or temperature measurement.</p>
    {embedded?<details className="eo-controls"><summary>Camera controls / bearing, elevation, zoom</summary>{controls}</details>:controls}
  </section>;
}
