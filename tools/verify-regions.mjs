import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {NodeIO} from '@gltf-transform/core';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');const io=new NodeIO();const records=[];
const A=6378137,E2=6.6943799901413165e-3,R=Math.PI/180;
function local(p,o){const cart=([lo,la])=>{lo*=R;la*=R;const n=A/Math.sqrt(1-E2*Math.sin(la)**2);return [(n)*Math.cos(la)*Math.cos(lo),n*Math.cos(la)*Math.sin(lo),n*(1-E2)*Math.sin(la)];};const a=cart(p),b=cart(o),d=a.map((v,i)=>v-b[i]),lo=o[0]*R,la=o[1]*R;return [-Math.sin(lo)*d[0]+Math.cos(lo)*d[1],-Math.sin(la)*Math.cos(lo)*d[0]-Math.sin(la)*Math.sin(lo)*d[1]+Math.cos(la)*d[2]];}
function fail(test,condition){if(!condition)throw Error(test);}
for(const id of ['shakti-punjab','maru-rajasthan','himadri-sikkim']){
  const directory=path.join(root,'public/assets/regions',id);
  const field=JSON.parse(await readFile(path.join(directory,'heightfield.json'),'utf8'));
  const meta=JSON.parse(await readFile(path.join(directory,'metadata.json'),'utf8'));
  const doc=await io.read(path.join(directory,'terrain.glb'));
  const primitive=doc.getRoot().listMeshes()[0].listPrimitives()[0],positions=primitive.getAttribute('POSITION'),uv=primitive.getAttribute('TEXCOORD_0');
  fail('Imported terrain geometry count',positions.getCount()===field.width*field.height);
  let maxHeightError=0,maxHorizontalError=0;const vertex=[];let platforms=0;
  for(let i=0;i<positions.getCount();i++){positions.getElement(i,vertex);const x=field.minX+(i%field.width)*field.spacing,z=field.minZ+Math.floor(i/field.width)*field.spacing;maxHorizontalError=Math.max(maxHorizontalError,Math.abs(vertex[0]-x),Math.abs(vertex[2]-z));maxHeightError=Math.max(maxHeightError,Math.abs(vertex[1]-field.heights[i]));if(Math.abs(x)<=60&&Math.abs(z)<=70){fail('Graded compound platform',vertex[1]===0);platforms++;}}
  fail('GLB/heightfield agreement < 0.1mm',maxHeightError<.0001&&maxHorizontalError<.0001);
  const indices=primitive.getIndices().getArray();fail('Triangle diagonal agrees with pure simulation',indices[0]===0&&indices[1]===field.width&&indices[2]===1&&indices[3]===field.width+1&&indices[4]===1&&indices[5]===field.width);
  const temp=[];uv.getElement(0,temp);fail('Southwest UV orientation',temp[0]===0&&temp[1]===1);uv.getElement(field.width*(field.height-1),temp);fail('Northwest UV orientation',temp[0]===0&&temp[1]===0);
  const expected=[[-3000,3000],[3000,3000],[3000,-3000],[-3000,-3000]];
  const errors=meta.mapCorners.map((c,i)=>{const p=local(c,meta.origin);return Math.hypot(p[0]-expected[i][0],p[1]-expected[i][1]);});
  fail('Geographic footprint alignment < 1cm',Math.max(...errors)<.01);
  fail('Cloud-screened source AOI',meta.regionalMaskedFraction<=.20);fail('Source selected 2023–2025',/^202[345]-/.test(meta.imageryDate));
  records.push({id,vertices:positions.getCount(),triangles:indices.length/3,maxHeightErrorMeters:maxHeightError,maxHorizontalErrorMeters:maxHorizontalError,maxCornerAlignmentErrorMeters:Math.max(...errors),platformSamples:platforms,imagerySceneId:meta.imagerySceneId,regionalMaskedFraction:meta.regionalMaskedFraction,allPassed:true});
}
await mkdir(path.join(root,'artifacts/extraction'),{recursive:true});await writeFile(path.join(root,'artifacts/extraction/regional-validation.json'),JSON.stringify(records,null,2));console.log(JSON.stringify(records,null,2));
