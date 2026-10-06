import { useEffect, useState } from 'react';
import { assetUrl } from '../routing';
type Metadata={credits:string[];imageryDate?:string;imagerySceneId?:string;sourceResolutionMeters?:number;imageResolutionMeters?:number;licenses:{name:string;url:string;localUrl?:string}[]};
export default function RegionalCredits({postId}:{postId:string}) {
  const [metadata,setMetadata]=useState<Metadata|null>(null);
  useEffect(()=>{const abort=new AbortController();setMetadata(null);void fetch(assetUrl('./assets/regions/'+postId+'/metadata.json'),{signal:abort.signal}).then(r=>{if(!r.ok)throw new Error('Metadata unavailable');return r.json();}).then(setMetadata).catch(()=>{});return()=>abort.abort();},[postId]);
  return <details className="regional-credits"><summary>Regional data credits & licences</summary>{metadata?<><p>Imagery captured {metadata.imageryDate?.slice(0,10)} · elevation source {metadata.sourceResolutionMeters} m · imagery source {metadata.imageResolutionMeters} m. Compounds and graded platforms are fictional modifications.</p>{metadata.credits.map(credit=><p key={credit}>{credit}</p>)}{metadata.licenses.map(license=><p key={license.url}><a href={license.localUrl?assetUrl(license.localUrl):license.url} target="_blank" rel="noreferrer">{license.name} ↗</a></p>)}</>:<p>Preparing regional provenance.</p>}</details>;
}

