import { Scene } from '@babylonjs/core/scene';
import { Vector3, Quaternion } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { HDRCubeTexture } from '@babylonjs/core/Materials/Textures/hdrCubeTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import '@babylonjs/core/Helpers/sceneHelpers';
import '@babylonjs/core/Meshes/instancedMesh';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import '@babylonjs/loaders/glTF/glTFFileLoader';
import '@babylonjs/loaders/glTF/2.0/glTFLoader';
import '@babylonjs/loaders/glTF/2.0/Extensions/KHR_texture_transform';
import '@babylonjs/loaders/glTF/2.0/Extensions/KHR_materials_pbrSpecularGlossiness';
import type { EnvironmentConfig, Conditions, Quality, Obstacle, Vec3 } from '../simulation/types';
import { terrainHeight } from '../simulation/world';
import { assetUrl } from '../routing';

export type AssetProgress = (message: string, progress: number) => void;
const color = (hex: string) => Color3.FromHexString(hex);
const regionIds: Record<string, string> = { 'rural-post-07':'shakti-punjab', 'rocky-valley':'maru-rajasthan', 'mountain-pass':'himadri-sikkim' };

/** All visible geometry comes from documented GLBs; terrain is baked from source DEM offline. */
export async function buildEnvironment(scene: Scene, config: EnvironmentConfig, report: AssetProgress, signal: AbortSignal, assetBytes?: (path: string) => Promise<ArrayBuffer>) {
  const errors: string[] = [], containers: AssetContainer[] = [], obstacles: Obstacle[] = [];
  const vegetation: { x: number; z: number; radius: number }[] = [];
  const height = (x: number, z: number) => terrainHeight(x, z, config.terrain);
  scene.onDisposeObservable.add(() => { for (const container of containers) container.dispose(); });
  async function load(path: string, required = false) {
    try {
      const container = assetBytes
        ? await LoadAssetContainerAsync(new Uint8Array(await assetBytes(path)), scene, {pluginExtension:'.glb'})
        : await LoadAssetContainerAsync(assetUrl(path), scene);
      if (signal.aborted) { container.dispose(); return; }
      if (!container.meshes.some(mesh => mesh.getTotalVertices() > 0)) { container.dispose(); throw new Error('GLB contains no geometry'); }
      containers.push(container); return container;
    } catch (error) {
      if (signal.aborted) return;
      const message = `Asset dependency ${path}: ${String(error)}`;
      if (required) throw new Error(message);
      errors.push(message);
    }
  }
  report('Loading georeferenced regional terrain', .08);
  const terrain = await load(config.regional?.modelUrl ?? `./assets/regions/${regionIds[config.id]}/terrain.glb`, true);
  if (!terrain || signal.aborted) return null;
  terrain.addAllToScene();
  // DEM exports use the simulation's x-east/z-north coordinates directly. Undo
  // glTF's automatic handedness wrapper for this asset only; other GLBs retain it.
  for (const root of terrain.rootNodes) if (root instanceof TransformNode) { root.rotationQuaternion=Quaternion.Identity(); root.scaling.setAll(1); root.computeWorldMatrix(true); }
  for (const mesh of terrain.meshes) { mesh.receiveShadows = true; mesh.isPickable = true; mesh.metadata={...mesh.metadata,regionalTerrain:true}; mesh.computeWorldMatrix(true); mesh.refreshBoundingInfo({}); mesh.freezeWorldMatrix(); }
  const groundNormal=await new Promise<Texture|undefined>(resolve=>{
    const texture=new Texture(assetUrl('./assets/environment/ground-normal.jpg'),scene,false,false,Texture.TRILINEAR_SAMPLINGMODE,()=>resolve(texture),()=>{texture.dispose();errors.push('Licensed ground normal texture unavailable');resolve(undefined);});
  });
  if(signal.aborted)return null;
  if(groundNormal){
    groundNormal.uScale=config.terrain.size/4;groundNormal.vScale=config.terrain.size/4;groundNormal.level=.45;groundNormal.anisotropicFilteringLevel=4;
    for(const mesh of terrain.meshes)if(mesh.material instanceof PBRMaterial){mesh.material.bumpTexture=groundNormal;mesh.material.roughness=1;mesh.material.metallic=0;}
  }
  const sun = new DirectionalLight('sun', new Vector3(config.lighting.sunDirection.x, config.lighting.sunDirection.y, config.lighting.sunDirection.z), scene);
  sun.position.set(50, 85, -30);
  const ambient = new HemisphericLight('sky fill', Vector3.Up(), scene); ambient.groundColor = color('#65624f');
  const shadow = new ShadowGenerator(1024, sun); shadow.usePercentageCloserFiltering = true; shadow.filteringQuality = ShadowGenerator.QUALITY_LOW;
  function place(template: AssetContainer, id: string, position: Vec3, size?: Vec3, yaw = 0, solid = false, preserveProportions = false) {
    const instance = template.instantiateModelsToScene(name => `${id}-${name}`, false);
    const root = new TransformNode(id, scene);
    for (const node of instance.rootNodes) node.parent = root;
    const bounds = root.getHierarchyBoundingVectors(true), extent = bounds.max.subtract(bounds.min);
    // Import normalization uses the real model bounds, preserving source materials.
    const correction = new TransformNode(`${id}-origin`, scene);
    for (const node of instance.rootNodes) node.parent = correction;
    correction.position.set(-(bounds.min.x + bounds.max.x) / 2, -bounds.min.y, -(bounds.min.z + bounds.max.z) / 2); correction.parent = root;
    if (size) {
      const scale=new Vector3(size.x/Math.max(.001,extent.x),size.y/Math.max(.001,extent.y),size.z/Math.max(.001,extent.z));
      if(preserveProportions)root.scaling.setAll(Math.min(scale.x,scale.y,scale.z));else root.scaling.copyFrom(scale);
    }
    root.position.set(position.x, height(position.x, position.z) + position.y, position.z); root.rotation.y = yaw;
    for (const mesh of root.getChildMeshes()) { mesh.receiveShadows = true; mesh.isPickable = true; if (Math.hypot(position.x, position.z) < 150) shadow.addShadowCaster(mesh); }
    if (solid) {
      const b = root.getHierarchyBoundingVectors(true);
      obstacles.push({ id, minX:b.min.x, maxX:b.max.x, minZ:b.min.z, maxZ:b.max.z });
    }
    return root;
  }
  report('Loading imported compound modules', .25);
  const [booth, fence, barrier] = await Promise.all(['booth','fence','barrier'].map(name => load(`./assets/environment/${name}.glb`)));
  if (signal.aborted) return null;
  if (booth) for (const placement of config.placements) {
    if (placement.module !== 'barrier') place(booth, placement.id, placement.position, placement.size, 0, true, true);
  }
  if (barrier) for (const placement of config.placements) {
    if (placement.module === 'barrier') place(barrier, placement.id, placement.position, placement.size, 0, true, true);
  }
  function fenceRun(ax: number, az: number, bx: number, bz: number, id: string) {
    if (!fence) return;
    const length = Math.hypot(bx-ax,bz-az), count = Math.ceil(length/4), segment = length/count;
    for (let i=0;i<count;i++) place(fence, `${id}-${i}`, {x:ax+(bx-ax)*(i+.5)/count,y:0,z:az+(bz-az)*(i+.5)/count}, {x:segment,y:2.7,z:.12}, -Math.atan2(bz-az,bx-ax), true);
  }
  fenceRun(-40,-42,-40,52,'west-fence'); fenceRun(40,-42,40,52,'east-fence'); fenceRun(-40,-42,40,-42,'south-fence');
  fenceRun(-40,52,-5,52,'north-fence-west'); fenceRun(5,52,40,52,'north-fence-east');
  if (barrier) for (const x of [-13,-9,-5,9,13,17]) place(barrier,`checkpoint-barrier-${x}`,{x,y:0,z:29},{x:2.9,y:1.3,z:.9},0,true);
  // Virtual lights are not physical geometry; source-model lamp assets are not fabricated.
  const lamps = [[-17,22],[23,45],[-33,-27]].map(([x,z]) => {
    const light = new PointLight('compound floodlight',new Vector3(x,height(x,z)+5.8,z),scene); light.diffuse=color('#ffe4ac'); light.range=40; return light;
  });
  report('Loading regional vegetation', .45);
  const [tree, treeLow, shrub, rock] = await Promise.all(['tree','tree-low','shrub','rock'].map(name => load(`./assets/environment/${name}.glb`)));
  if (signal.aborted) return null;
  const details: { position: Vector3; high: TransformNode; low: TransformNode }[] = [];
  // Fixed placements depend only on the post config, never renderer quality or frame count.
  for (let i=0;tree && treeLow && i<config.vegetation.trees;i++) {
    const x=-500+(i*137)%1000, z=-480+(i*233)%1000;
    if (Math.abs(x)<65 && z>-80 && z<190) continue;
    const high=place(tree,`tree-${i}`,{x,y:0,z},undefined,i*.73), low=place(treeLow,`tree-${i}-low`,{x,y:0,z},undefined,i*.73);
    const scale=1.2+(i%5)*.25; high.scaling.setAll(scale); low.scaling.setAll(scale); low.setEnabled(false);
    details.push({position:high.position,high,low}); vegetation.push({x,z,radius:.5*scale});
  }
  for (let i=0;shrub && i<config.vegetation.shrubs;i++) {
    const x=-200+(i*79)%400,z=-190+(i*107)%400;
    if (Math.abs(x)<65 && z>-80 && z<170) continue;
    place(shrub,`shrub-${i}`,{x,y:0,z},undefined,i*.71);
  }
  for (let i=0;rock && i<18;i++) {
    const x=-350+(i*151)%700,z=-310+(i*197)%650;
    if (Math.abs(x)<65 && z>-80 && z<180) continue;
    place(rock,`rock-${i}`,{x,y:0,z},undefined,i*.93,Math.hypot(x,z)<250);
  }
  report('Loading licensed daylight sky', .78);
  const skyTexture = await new Promise<HDRCubeTexture | undefined>(resolve => {
    const texture = new HDRCubeTexture(assetUrl('./assets/environment/sky.hdr'),scene,128,false,true,false,true,()=>resolve(texture),()=>{errors.push('Daylight sky could not load');texture.dispose();resolve(undefined);});
  });
  if (signal.aborted) return null;
  const sky = skyTexture ? scene.createDefaultSkybox(skyTexture,false,12000,0,false) : null;
  if (skyTexture) scene.environmentTexture=skyTexture;
  if (sky) sky.applyFog=false;
  // Rain uses a tiny authored streak texture and a local particle volume around
  // the observer. It is a weather effect, not substitute landscape geometry.
  const rainEmitter = Vector3.Zero();
  const rainTexture = new DynamicTexture('rain-streak-texture', { width: 8, height: 32 }, scene, false);
  rainTexture.hasAlpha = true;
  const rainContext = rainTexture.getContext();
  const rainGradient = rainContext.createLinearGradient(0, 0, 0, 32);
  rainGradient.addColorStop(0, 'rgba(255,255,255,0)');
  rainGradient.addColorStop(.18, 'rgba(255,255,255,.72)');
  rainGradient.addColorStop(.82, 'rgba(255,255,255,.72)');
  rainGradient.addColorStop(1, 'rgba(255,255,255,0)');
  rainContext.fillStyle = rainGradient;
  rainContext.fillRect(3, 0, 2, 32);
  rainTexture.update(false);
  const rain = new ParticleSystem('rain-particles', 800, scene);
  rain.particleTexture = rainTexture;
  rain.emitter = rainEmitter;
  rain.minEmitBox = new Vector3(-32, 5, -32); rain.maxEmitBox = new Vector3(32, 34, 32);
  rain.direction1 = new Vector3(-2, -24, 1); rain.direction2 = new Vector3(-1, -28, 2);
  rain.minEmitPower = 1; rain.maxEmitPower = 1; rain.minLifeTime = .45; rain.maxLifeTime = .8;
  rain.minSize = .08; rain.maxSize = .14; rain.emitRate = 1000;
  rain.color1 = new Color4(.72, .79, .88, .58); rain.color2 = new Color4(.62, .71, .82, .38); rain.colorDead = new Color4(.62, .71, .82, 0);
  rain.gravity = new Vector3(0, -2, 0); rain.updateSpeed = .01;
  scene.onDisposeObservable.add(() => { rain.dispose(); rainTexture.dispose(); });
  const casters=[...(shadow.getShadowMap()?.renderList ?? [])];
  let quality: Quality='standard', conditions: Conditions={timeOfDay:'day',visibility:'clear'}, lodFrame=0, rainEnabled=false;
  scene.onBeforeRenderObservable.add(()=>{
    if (scene.activeCamera) { rainEmitter.copyFrom(scene.activeCamera.position); rainEmitter.y += 15; }
    if (++lodFrame%20 || !scene.activeCamera) return;
    for (const detail of details) {
      const high=Vector3.DistanceSquared(detail.position,scene.activeCamera.position)<(quality==='low'?75**2:160**2);
      detail.high.setEnabled(high); detail.low.setEnabled(!high);
    }
  });
  function setConditions(next: Conditions) {
    conditions={...next}; const night=next.timeOfDay==='night';
    const weather=next.weather ?? 'clear';
    sun.intensity=night?config.lighting.nightIntensity:config.lighting.dayIntensity; sun.diffuse=night?color('#718ba9'):color('#fff1d5');
    ambient.intensity=night?.13:.8; scene.environmentIntensity=night?.025:.65;
    scene.fogMode=Scene.FOGMODE_EXP2;
    const weatherFog=weather==='fog' ? .026 : weather==='rain' ? .0035 : 0;
    scene.fogDensity=Math.max(config.visibility[next.visibility],weatherFog);
    scene.fogColor=weather==='fog'?color(night?'#27313a':'#aeb9b7'):night?color('#14202e'):color('#bfccc7');
    if (weather==='rain'&&!rainEnabled) { rain.start(); rainEnabled=true; }
    else if (weather!=='rain'&&rainEnabled) { rain.stop(); rainEnabled=false; }
    if (sky) sky.visibility=night?0:1;
    scene.clearColor.set(night?.022:.62,night?.035:.74,night?.065:.8,1);
    for (const lamp of lamps) lamp.intensity=night?150:0;
  }
  function setQuality(next: Quality) {
    quality=next; const map=shadow.getShadowMap(); if(map) {map.renderList=next==='low'?[]:casters;map.refreshRate=next==='low'?0:1;} setConditions(conditions);
  }
  setConditions(conditions); report('Regional observation post ready',.9);
  return {setConditions,setQuality,obstacles,vegetation,errors,sceneryCount:containers.length};
}
