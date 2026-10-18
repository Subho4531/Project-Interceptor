import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { GeoJSONSource, Map as LibreMap, Marker } from 'maplibre-gl';
import type { FeatureCollection, Feature, Geometry } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
maplibregl.setWorkerUrl(mapWorkerUrl);
import { assetUrl } from '../routing';
import { offsetPosition, postById, posts } from './posts';
import type { GeographicPosition, MapLayers, SelectedObject, SessionSnapshot } from './types';

export type Basemap = 'regional' | 'satellite' | 'terrain';
type Props={snapshot:SessionSnapshot;layers:MapLayers;selected:SelectedObject;basemap:Basemap;focus:number;overview:boolean;onSelect:(object:SelectedObject)=>void};
const collection=(features:Feature<Geometry>[]):FeatureCollection=>({type:'FeatureCollection',features});
function polygon(origin:GeographicPosition,radius:number,segments=64) {
  return Array.from({length:segments+1},(_,i)=>offsetPosition(origin,Math.sin(i/segments*Math.PI*2)*radius,Math.cos(i/segments*Math.PI*2)*radius));
}
function overlays(snapshot:SessionSnapshot) {
  const origin=postById(snapshot.postId).origin;
  const line=(coordinates:GeographicPosition[]):Feature<Geometry>=>({type:'Feature',properties:{},geometry:{type:'LineString',coordinates}});
  const shape=(coordinates:GeographicPosition[]):Feature<Geometry>=>({type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[coordinates]}});
  const zone=snapshot.protectedZone??[[-450,-350],[450,-350],[450,450],[-450,450],[-450,-350]].map(([east,north])=>offsetPosition(origin,east,north));
  const grid:Feature<Geometry>[]=[];
  for(let offset=-6000;offset<=6000;offset+=1000) {grid.push(line([offsetPosition(origin,offset,-6000),offsetPosition(origin,offset,6000)]));grid.push(line([offsetPosition(origin,-6000,offset),offsetPosition(origin,6000,offset)]));}
  return {
    routes:collection(snapshot.tracks.map(track=>line(track.route))),trails:collection(snapshot.tracks.filter(t=>t.state!=='scheduled').map(track=>line(track.trail))),
    zones:collection(zone.length?[shape(zone)]:[]),coverage:collection([shape(polygon(origin,2200)),line(polygon(origin,1100))]),grid:collection(grid),
    radar:collection((snapshot.sensorTracks??[]).map(t=>({type:'Feature',properties:{id:t.id,label:t.label,state:t.state,age:t.age},geometry:{type:'Point',coordinates:t.geographicPosition}}))),
    radarTrace:collection((snapshot.sensorTracks??[]).filter(t=>(t.trail??[]).length>1).map(t=>line(t.trail!.map(p=>offsetPosition(origin,p.x,p.z))))),
    eo:collection((snapshot.eoObservations??[]).slice(-40).map(t=>({type:'Feature',properties:{id:t.id},geometry:{type:'Point',coordinates:t.geographicPosition}}))),
  };
}

export default function DashboardMap({snapshot,layers,selected,basemap,focus,overview,onSelect}:Props) {
  const container=useRef<HTMLDivElement>(null),map=useRef<LibreMap|null>(null);
  const postMarkers=useRef<Marker[]>([]),trackMarkers=useRef<Map<string,Marker>>(new Map());
  const props=useRef({snapshot,layers,selected,basemap,overview,onSelect}); props.current={snapshot,layers,selected,basemap,overview,onSelect};
  const [mapStatus,setMapStatus]=useState<'loading'|'ready'|'error'>('loading'),[unsupported,setUnsupported]=useState(false);
  const [coordinates,setCoordinates]=useState<GeographicPosition>(postById(snapshot.postId).origin);
  const [loaded,setLoaded]=useState(false);
  const [retry,setRetry]=useState(0);
  const [zoom,setZoom]=useState(12.4);
  useEffect(()=>{
    if(!container.current) return;
    let instance:LibreMap;
    try {
      instance=new maplibregl.Map({container:container.current,center:postById(props.current.snapshot.postId).origin,zoom:12.4,minZoom:3,maxZoom:17,attributionControl:false,
        style:{version:8,sources:{
          satellite:{type:'raster',tiles:['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg'],tileSize:256,maxzoom:14},
          terrain:{type:'raster',tiles:['https://a.tile.opentopomap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:17},
          ...Object.fromEntries(posts.map(post=>['region-'+post.id,{type:'image' as const,url:assetUrl('./assets/regions/'+post.id+'/imagery.jpg'),coordinates:[[-3000,3000],[3000,3000],[3000,-3000],[-3000,-3000]].map(([x,z])=>offsetPosition(post.origin,x,z))}])),
        },layers:[{id:'background',type:'background',paint:{'background-color':'#0B0B0B'}},{id:'satellite',type:'raster',source:'satellite',layout:{visibility:props.current.basemap==='satellite'?'visible':'none'},paint:{'raster-brightness-max':.72,'raster-saturation':-.32}},{id:'terrain',type:'raster',source:'terrain',layout:{visibility:props.current.basemap==='terrain'?'visible':'none'},paint:{'raster-brightness-max':.7,'raster-saturation':-.5}}]},
      });
    } catch {setUnsupported(true);setMapStatus('error');return;}
    map.current=instance;setLoaded(false);setMapStatus('loading');setUnsupported(false);
    instance.addControl(new maplibregl.ScaleControl({maxWidth:120,unit:'metric'}),'bottom-right');
    let deadline:ReturnType<typeof setTimeout>;
    const armDeadline=()=>{clearTimeout(deadline);deadline=setTimeout(()=>{if(!instance.areTilesLoaded()) setMapStatus('error');},12000);};
    armDeadline();
    instance.on('load',()=>{
      const data=overlays(props.current.snapshot);
      for(const post of posts) instance.addLayer({id:'region-'+post.id,type:'raster',source:'region-'+post.id,layout:{visibility:props.current.basemap==='regional'?'visible':'none'},paint:{'raster-fade-duration':0,'raster-brightness-max':.85,'raster-saturation':-.12}});
      for(const [id,value] of Object.entries(data)) instance.addSource(id,{type:'geojson',data:value});
      instance.addLayer({id:'grid-lines',type:'line',source:'grid',paint:{'line-color':'#6A6A6A','line-opacity':.17,'line-width':1}});
      instance.addLayer({id:'coverage-fill',type:'fill',source:'coverage',paint:{'fill-color':'#00E5FF','fill-opacity':.06}});
      instance.addLayer({id:'coverage-lines',type:'line',source:'coverage',paint:{'line-color':'#00E5FF','line-width':1,'line-opacity':.48}});
      instance.addLayer({id:'zone-fill',type:'fill',source:'zones',paint:{'fill-color':'#F59E0B','fill-opacity':.08}});
      instance.addLayer({id:'zone-lines',type:'line',source:'zones',paint:{'line-color':'#F59E0B','line-width':1.5,'line-dasharray':[4,3]}});
      instance.addLayer({id:'route-lines',type:'line',source:'routes',paint:{'line-color':'#F59E0B','line-opacity':.62,'line-width':1.5,'line-dasharray':[4,5]}});
      instance.addLayer({id:'trail-lines',type:'line',source:'trails',paint:{'line-color':'#00E5FF','line-width':2.2}});
      instance.addLayer({id:'radar-trace',type:'line',source:'radarTrace',paint:{'line-color':'rgba(245,158,11,.55)','line-width':1.6,'line-dasharray':[2,2]}});
      instance.addLayer({id:'radar-reports',type:'circle',source:'radar',paint:{'circle-radius':7,'circle-color':['match',['get','state'],'lost','#3F3F3F','coasting','#B45309','#F59E0B'],'circle-opacity':['match',['get','state'],'lost',.3,.8],'circle-stroke-color':'#FFFFFF','circle-stroke-width':1.5}});
      instance.addLayer({id:'eo-reports',type:'circle',source:'eo',paint:{'circle-radius':3,'circle-color':'#FF6B00','circle-stroke-color':'#FFA85C','circle-stroke-width':1}});
      instance.on('click','radar-reports',event=>{const id=event.features?.[0]?.properties?.id;if(typeof id==='string')props.current.onSelect({type:'sensor-track',id});});
      for(const post of posts) {
        const button=document.createElement('button');button.className='post-map-marker';button.setAttribute('aria-label',`Select ${post.name} training post`);
        const symbol=document.createElement('span');symbol.textContent='⌖';const text=document.createElement('b');text.textContent=`${post.callsign} / ${post.name.toUpperCase()}`;
        button.append(symbol,text);button.onclick=()=>props.current.onSelect({type:'post',id:post.id});
        postMarkers.current.push(new maplibregl.Marker({element:button}).setLngLat(post.origin).addTo(instance));
      }
      setLoaded(true);
    });
    instance.on('idle',()=>{if(instance.areTilesLoaded()){clearTimeout(deadline);setMapStatus('ready');}});
    instance.on('error',event=>{if(/fetch|tile|network|HTTP|AJAX/i.test(event.error.message)) setMapStatus('error');});
    instance.on('movestart',armDeadline);
    instance.on('mousemove',event=>setCoordinates([event.lngLat.lng,event.lngLat.lat]));
    instance.on('zoomend',()=>setZoom(instance.getZoom()));
    instance.on('webglcontextlost',()=>{setUnsupported(true);setMapStatus('error');});
    const observer=new ResizeObserver(()=>instance.resize());observer.observe(container.current);
    return ()=>{clearTimeout(deadline);observer.disconnect();for(const marker of postMarkers.current) marker.remove();postMarkers.current=[];for(const marker of trackMarkers.current.values()) marker.remove();trackMarkers.current.clear();instance.remove();map.current=null;};
  },[retry]);
  useEffect(()=>{
    const instance=map.current;if(!instance||!loaded||!instance.getLayer('trail-lines')) return;
    const data=overlays(snapshot);
    for(const [id,value] of Object.entries(data)) (instance.getSource(id) as GeoJSONSource|undefined)?.setData(value);
    for(const [key,ids] of Object.entries({grid:['grid-lines'],coverage:['coverage-fill','coverage-lines'],zones:['zone-fill','zone-lines'],routes:['route-lines'],trails:['trail-lines'],radar:['radar-reports','radar-trace'],eo:['eo-reports']})) for(const id of ids) instance.setLayoutProperty(id,'visibility',layers[key as keyof MapLayers]&&(!['routes','trails'].includes(key)||layers.truth!==false)?'visible':'none');
    for(const marker of postMarkers.current) marker.getElement().classList.toggle('selected',marker.getLngLat().lng===postById(snapshot.postId).origin[0]);
    const visibleTracks=layers.truth===false?[]:snapshot.tracks;
    for(const track of visibleTracks) {
      let marker=trackMarkers.current.get(track.id);
      if(!marker) {
        const button=document.createElement('button');button.setAttribute('aria-label',`Select ${track.label}`);button.innerHTML='<span class="track-symbol">⌃</span><b></b><small></small>';
        button.dataset.slot=track.id.replace('uav-','');
        button.onclick=()=>props.current.onSelect({type:'track',id:track.id});
        marker=new maplibregl.Marker({element:button,rotationAlignment:'map'}).setLngLat(track.position).addTo(instance);trackMarkers.current.set(track.id,marker);
      }
      marker.setLngLat(track.position);const el=marker.getElement();
      // Preserve MapLibre's positioning classes when the fixture state changes.
      el.classList.remove('scheduled','active','departed','selected');
      el.classList.add('track-map-marker',track.state);
      el.classList.toggle('selected',selected.type==='track'&&selected.id===track.id);
      el.querySelector('b')!.textContent=track.label;el.querySelector('small')!.textContent=track.state==='scheduled'?'SCHEDULED':`${track.altitudeAGL.toFixed(0)} m AGL`;
      (el.querySelector('.track-symbol') as HTMLElement).style.transform=`rotate(${track.heading}deg)`;
    }
    for(const [id,marker] of trackMarkers.current) if(!visibleTracks.some(t=>t.id===id)){marker.remove();trackMarkers.current.delete(id);}
  },[snapshot,layers,selected,loaded]);
  useEffect(()=>{const instance=map.current;if(!instance||!loaded||!instance.getLayer('trail-lines')) return;instance.setLayoutProperty('satellite','visibility',basemap==='satellite'?'visible':'none');instance.setLayoutProperty('terrain','visibility',basemap==='terrain'?'visible':'none');for(const post of posts)instance.setLayoutProperty('region-'+post.id,'visibility',basemap==='regional'?'visible':'none');setMapStatus(instance.areTilesLoaded()?'ready':'loading');},[basemap,loaded]);
  useEffect(()=>{
    const instance=map.current;if(!instance||!loaded||!instance.getLayer('trail-lines')) return;
    if(overview){const bounds=new maplibregl.LngLatBounds();posts.forEach(post=>bounds.extend(post.origin));instance.fitBounds(bounds,{padding:80,maxZoom:5,duration:500});}
    else {
      const post=postById(snapshot.postId),target=selected.type==='track'?snapshot.tracks.find(t=>t.id===selected.id)?.position:selected.type==='sensor-track'?snapshot.sensorTracks?.find(t=>t.id===selected.id)?.geographicPosition:undefined;
      setCoordinates(target??post.origin);
      if(target) instance.flyTo({center:target,zoom:15,duration:500});
      else {
        const bounds=new maplibregl.LngLatBounds();bounds.extend(post.origin);
        [[-800,-800],[800,800]].forEach(([x,z])=>bounds.extend(offsetPosition(post.origin,x,z)));
        instance.fitBounds(bounds,{padding:{top:100,bottom:105,left:45,right:45},maxZoom:15,duration:500});
      }
    }
    // Clock updates must not continuously recenter a manually panned map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[snapshot.postId,focus,overview,loaded]);
  return <section className="dashboard-map" aria-label="Geographic exercise map">
    <div ref={container} className="map-canvas" />
    <div className="map-caption"><span className="dash-kicker">{overview?'INDIA / REGIONAL OVERVIEW':`${postById(snapshot.postId).state.toUpperCase()} / EXERCISE SECTOR`}</span><h1>{overview?'Three posts. One training picture.':`${postById(snapshot.postId).name} sector`}</h1><span>WGS84 · {basemap==='regional'?'Packaged Sentinel-2 regional imagery':basemap==='satellite'?'Sentinel-2 · 2024 mosaic':'Topographic context'} <i> / </i> SHARED SIMULATION</span></div>
    <div className="map-nav" aria-label="Map navigation"><button aria-label="Zoom map in" onClick={()=>map.current?.zoomIn()}>+</button><button aria-label="Zoom map out" onClick={()=>map.current?.zoomOut()}>−</button><button aria-label="Reset map north" onClick={()=>map.current?.resetNorth()}>N ↑</button></div>
    {mapStatus!=='ready'&&<div className={`map-load-note ${mapStatus==='error'?'has-error':''}`} role="status">{mapStatus==='loading'?'Loading geographic imagery…':unsupported?'Map renderer unavailable. Post coordinates and tracks remain available in the panels.':'Some map tiles are unavailable. Overlays and coordinate details remain available.'}{mapStatus==='error'&&<button onClick={()=>setRetry(value=>value+1)}>Retry map</button>}</div>}
    <div className="map-legend"><span><i className="legend-post"/>Training post</span><span><i className="legend-track"/>Instructor truth UAV</span><span><i className="legend-zone"/>Protected zone</span><small>Dashed amber line: traced radar path · simulated radar and EO reports.</small></div>
    <div className="map-coordinates"><span>{coordinates[1].toFixed(5)}° N &nbsp; {coordinates[0].toFixed(5)}° E</span><span>ZOOM {zoom.toFixed(1)} · {overview?'REGION':'1 km grid'}</span></div>
    <div className="map-attribution">{basemap==='regional'?<>Modified Copernicus Sentinel data · regional scene dates in asset provenance · <a href='https://registry.opendata.aws/sentinel-2-l2a-cogs/' target='_blank' rel='noreferrer'>Sentinel-2 / Earth Search</a></>:basemap==='satellite'?<><a href="https://cloudless.eox.at" target="_blank" rel="noreferrer">EOxCloudless</a> by <a href="https://maps.eox.at" target="_blank" rel="noreferrer">EOX</a> · Modified Copernicus Sentinel data 2024 · <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noreferrer">CC BY-NC-SA 4.0</a></>:<><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>, SRTM · <a href="https://opentopomap.org" target="_blank" rel="noreferrer">© OpenTopoMap</a> · CC BY-SA</>}</div>
  </section>;
}


