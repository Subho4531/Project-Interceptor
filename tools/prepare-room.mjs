import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, getBounds, dedup, prune, unpartition } from '@gltf-transform/functions';

const root=path.resolve(import.meta.dirname,'..');
const source=path.join(root,'assets-source/command-room/furniture/Models/GLTF format');
const output=path.join(root,'public/assets/command-room');
await mkdir(output,{recursive:true});
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),document=new Document(),scene=document.createScene('Fictional command-room modules');
document.getRoot().setDefaultScene(scene);
const placements=[];
async function place(model,position,size,heading=0){
  const imported=await io.read(path.join(source,model+'.glb')),sourceScene=imported.getRoot().listScenes()[0],bounds=getBounds(sourceScene),dimensions=bounds.max.map((max,index)=>max-bounds.min[index]);
  const map=mergeDocuments(document,imported),importedScene=map.get(sourceScene),wrapper=document.createNode(model+' placement').setTranslation(position).setScale(size.map((value,index)=>value/Math.max(.001,dimensions[index]))).setRotation([0,Math.sin(heading/2),0,Math.cos(heading/2)]);
  const centre=document.createNode(model+' source correction').setTranslation([-(bounds.min[0]+bounds.max[0])/2,-bounds.min[1],-(bounds.min[2]+bounds.max[2])/2]);
  for(const child of [...importedScene.listChildren()]){importedScene.removeChild(child);centre.addChild(child);}
  wrapper.addChild(centre);scene.addChild(wrapper);importedScene.dispose();placements.push({model,position,size,heading});
}
for(const x of [-3,-1,1,3])for(const z of [-2,0,2])await place('floorFull',[x,0,z],[2,.12,2]);
for(const x of [-3,-1,1,3])await place('wall',[x,.12,3.05],[2,3,.15]);
for(const x of [-4.05,4.05])for(const z of [-2,0,2])await place('wall',[x,.12,z],[2,3,.15],Math.PI/2);
for(const x of [-3,-1,1,3])await place(x===-1?'wallDoorway':'wall',[x,.12,-3.05],[2,3,.15]);
for(const x of [-2.3,2.3]){
  await place('desk',[x,.12,.9],[1.8,.78,.85]);
  await place('chairDesk',[x,.12,-.15],[.65,1.1,.7]);
  await place('computerScreen',[x,.9,1.05],[.7,.5,.15]);
  await place('computerKeyboard',[x,.91,.65],[.5,.04,.2]);
}
await place('televisionModern',[0,1.15,2.84],[3.1,1.65,.15]);
await place('lampSquareCeiling',[0,2.95,0],[1.2,.1,1.2]);
await document.transform(dedup(),prune(),unpartition());
const bytes=await io.writeBinary(document);await writeFile(path.join(output,'room.glb'),bytes);
await copyFile(path.join(root,'assets-source/command-room/furniture/License.txt'),path.join(output,'LICENSE.txt'));
const manifest={source:'https://kenney.nl/assets/furniture-kit',author:'Kenney',license:'CC0-1.0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',description:'Fictional command room assembled from imported Furniture Kit modules. Module transforms are authored in metres.',sha256:createHash('sha256').update(bytes).digest('hex'),placements};
await writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2));
await writeFile(path.join(root,'assets-source/command-room/provenance.json'),JSON.stringify({...manifest,archiveSha256:createHash('sha256').update(await readFile(path.join(root,'assets-source/command-room/kenney_furniture-kit.zip'))).digest('hex')},null,2));
console.log(`Imported command room: ${placements.length} modules, ${bytes.length} bytes`);
