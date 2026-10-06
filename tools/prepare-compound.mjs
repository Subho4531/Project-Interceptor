import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, weld, prune, getBounds, simplify, flatten, join } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

const root=path.resolve(import.meta.dirname,'..');
const source=path.join(root,'assets-source/compound');
const output=path.join(root,'public/assets/environment');
await mkdir(source,{recursive:true});await mkdir(output,{recursive:true});
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
await MeshoptSimplifier.ready;
const sha=b=>createHash('sha256').update(b).digest('hex');
const results=[];
for (const item of [
  {id:'booth',width:8,download:'C:/Users/subho/Downloads/security_booth__cabina_de_seguridad.glb',author:'claudio (@Claudio12345)',url:'https://sketchfab.com/3d-models/security-booth-cabina-de-seguridad-b15e6647ee434bcea57b2d965d3a1b30',license:'CC-BY-4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/'},
  {id:'fence',width:4,poly:'modular_chainlink_fence'},
  {id:'barrier',width:3,poly:'concrete_road_barrier'},
]) {
  if(process.argv[2] && process.argv[2]!==item.id)continue;
  const dir=path.join(source,item.id);await mkdir(dir,{recursive:true});
  let input;
  if (item.poly) {
    const manifestPath=path.join(dir,'source-files.json');
    let data;try{data=JSON.parse(await readFile(manifestPath,'utf8'));}catch{const r=await fetch(`https://api.polyhaven.com/files/${item.poly}`);if(!r.ok)throw new Error(`Poly Haven ${r.status}`);data=await r.json();await writeFile(manifestPath,JSON.stringify(data,null,2));}
    const gltf=data.gltf['1k'].gltf;
    const resources=[{name:'source.gltf',...gltf},...Object.entries(gltf.include).map(([name,info])=>({name,...info}))];
    await Promise.all(resources.map(async resource=>{
      const target=path.join(dir,resource.name);await mkdir(path.dirname(target),{recursive:true});
      let bytes;try{bytes=await readFile(target);}catch{}
      if(!bytes||createHash('md5').update(bytes).digest('hex')!==resource.md5){const r=await fetch(resource.url);if(!r.ok)throw new Error(`Download ${r.status}: ${resource.url}`);bytes=Buffer.from(await r.arrayBuffer());if(createHash('md5').update(bytes).digest('hex')!==resource.md5)throw new Error('Checksum failed');await writeFile(target,bytes);}
    }));
    input=path.join(dir,'source.gltf');Object.assign(item,{author:'Poly Haven contributors',url:`https://polyhaven.com/a/${item.poly}`,license:'CC0-1.0',licenseUrl:'https://polyhaven.com/license'});
  } else {input=path.join(dir,'source.glb');try{await readFile(input);}catch{await copyFile(item.download,input);}}
  const doc=await io.read(input);const scene=doc.getRoot().listScenes()[0];
  if(item.id==='fence') {
    execFileSync(process.env.REGION_PYTHON??path.join(root,'.cache/regions-venv/Scripts/python.exe'),[path.join(root,'tools/prepare-alpha.py'),'fence'],{stdio:'inherit'});
    const material=doc.getRoot().listMaterials().find(m=>m.getName()==='modular_chainlink_fence_wire');
    if(!material?.getBaseColorTexture())throw new Error('Imported wire material missing');
    material.getBaseColorTexture().setImage(await readFile(path.join(dir,'source-diffuse-rgba.png'))).setMimeType('image/png');
    material.setAlphaMode('MASK').setAlphaCutoff(.4);
    // Assemble actual source modules into a repeatable four-metre panel.
    const panel=scene.listChildren().find(n=>n.getName()==='modular_chainlink_fence_double');
    const post=scene.listChildren().find(n=>n.getName()==='modular_chainlink_fence_post');
    if(!panel||!post)throw new Error('Source fence modules missing');
    const place=(original,x,name)=>{const b=getBounds(original),t=original.getTranslation();return doc.createNode(name).setMesh(original.getMesh()).setRotation(original.getRotation()).setScale(original.getScale()).setTranslation([t[0]-(b.min[0]+b.max[0])/2+x,t[1]-b.min[1],t[2]-(b.min[2]+b.max[2])/2]);};
    const assembled=[place(panel,-1,'imported left wire panel'),place(panel,1,'imported right wire panel'),place(post,-2,'imported left post'),place(post,0,'imported middle post'),place(post,2,'imported right post')];
    for(const n of [...scene.listChildren()])scene.removeChild(n);
    for(const n of assembled)scene.addChild(n);
  }
  console.log(item.id,'nodes',scene.listChildren().map(n=>n.getName()));
  const bounds=getBounds(scene),size=bounds.max.map((v,i)=>v-bounds.min[i]);
  const factor=item.width/size[0];const normalization=doc.createNode('metre-space imported compound normalization').setScale([factor,factor,factor]).setTranslation([-(bounds.min[0]+bounds.max[0])/2*factor,-bounds.min[1]*factor,-(bounds.min[2]+bounds.max[2])/2*factor]);
  for(const node of [...scene.listChildren()]){scene.removeChild(node);normalization.addChild(node);}scene.addChild(normalization);
  const ratio=item.id==='barrier'?.075:.5;
  await doc.transform(dedup(),weld(),...(item.poly?[simplify({simplifier:MeshoptSimplifier,ratio,error:.001})]:[]),...(item.id==='fence'?[flatten(),join({keepNamed:false})]:[]),prune());
  const dest=path.join(output,`${item.id}.glb`);await io.write(dest,doc);
  const dimensions=size.map(v=>v*factor);
  const provenance={name:item.id,sourceUrl:item.url,author:item.author,license:item.license,licenseUrl:item.licenseUrl,...(!item.poly?{uid:'b15e6647ee434bcea57b2d965d3a1b30',downloadMethod:'Authenticated Chrome UI',requestedTextureResolution:'1k'}:{}),sourceSha256:sha(await readFile(input)),outputSha256:sha(await readFile(dest)),sourceBounds:bounds,normalizationScale:factor,dimensions:{x:dimensions[0],y:dimensions[1],z:dimensions[2]},modifications:['Source geometry/materials imported; centred horizontally; bottom aligned to0; uniformly scaled to authored training dimensions','glTF Transform dedup/weld/prune',...(item.poly?[`Meshoptimizer ${ratio*100}% target, error .001`]:[]),...(item.id==='fence'?['Packed genuine source wire opacity PNG into diffuse RGBA PNG, MASK cutoff0.4','Flattened and joined by material to reduce repeated fence draw calls']:[])],bytes:(await readFile(dest)).length};
  await writeFile(path.join(output,`${item.id}.provenance.json`),JSON.stringify(provenance,null,2));await writeFile(path.join(dir,'provenance.json'),JSON.stringify(provenance,null,2));await writeFile(path.join(output,`${item.id}.LICENSE.txt`),`${item.id} by ${item.author}\n${item.url}\n${item.license}: ${item.licenseUrl}\nModified: ${provenance.modifications.join('; ')}\n`);
  results.push(provenance);console.log(item.id,dimensions,provenance.bytes);
}
let previous=[];try{previous=JSON.parse(await readFile(path.join(source,'manifest.json'),'utf8'));}catch{}
await writeFile(path.join(source,'manifest.json'),JSON.stringify([...previous.filter(p=>!results.some(r=>r.name===p.name)),...results],null,2));
