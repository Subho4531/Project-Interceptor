import { Scene } from '@babylonjs/core/scene';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { HDRCubeTexture } from '@babylonjs/core/Materials/Textures/hdrCubeTexture';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import '@babylonjs/core/Helpers/sceneHelpers';
import '@babylonjs/core/Meshes/instancedMesh';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import type { EnvironmentConfig, Conditions, Quality } from '../simulation/types';
import { terrainHeight, rawTerrainHeight, principalObstacles } from '../simulation/world';
import '@babylonjs/loaders/glTF/glTFFileLoader';
import '@babylonjs/loaders/glTF/2.0/glTFLoader';
import '@babylonjs/loaders/glTF/2.0/Extensions/KHR_texture_transform';
import '@babylonjs/loaders/glTF/2.0/Extensions/KHR_materials_pbrSpecularGlossiness';

export type AssetProgress = (message: string, progress: number) => void;
const color = (hex: string) => Color3.FromHexString(hex);
export async function buildEnvironment(scene: Scene, config: EnvironmentConfig, report: AssetProgress, signal: AbortSignal) {
  const containers: AssetContainer[] = [];
  scene.onDisposeObservable.add(() => { for (const container of containers) container.dispose(); });
  const height = (x: number, z: number) => terrainHeight(x,z,config.terrain);
  const materials: Record<string, PBRMaterial> = {};
  function material(name: string, hex: string, roughness = .9, metallic = 0) {
    const m = new PBRMaterial(name, scene); m.albedoColor = color(hex); m.roughness = roughness; m.metallic = metallic; m.maxSimultaneousLights = 5; materials[name] = m; return m;
  }
  const concrete = material('weathered concrete', '#aaa998');
  const metal = material('painted olive metal', '#4c5948', .7, .2);
  const darkMetal = material('galvanised steel', '#606d69', .5, .7);
  const roof = material('corrugated roof', '#6e786f', .65, .35);
  const glass = material('dark glass', '#263d43', .2, .25);
  const gravel = material('gravel', '#a6a18d');
  const yellow = material('safety ochre', '#ccb371');
  const lampHousing = material('lamp diffuser', '#d8d0b1', .4);
  const wall = material('rendered walls', '#c8c1a8');
  const floor = material('terrain', '#b2b09b');
  const errors: string[] = [];
  async function texture(url: string, tile = 1): Promise<Texture | undefined> {
    return new Promise(resolve => {
      const t = new Texture(url, scene, false, false, Texture.TRILINEAR_SAMPLINGMODE, () => resolve(t), (_message, exception) => { errors.push(`Unable to load ${url}: ${exception?.message ?? 'network or decoding error'}`); t.dispose(); resolve(undefined); });
      t.uScale = tile; t.vScale = tile;
    });
  }
  report('Loading terrain materials', .12);
  const [diffuse, normal, gravelDiffuse, gravelNormal, concreteDiffuse, concreteNormal, roofDiffuse, roofNormal] = await Promise.all([
    texture('./assets/environment/ground.jpg', 225), texture('./assets/environment/ground-normal.jpg', 225),
    texture('./assets/environment/gravel.jpg'), texture('./assets/environment/gravel-normal.jpg'),
    texture('./assets/environment/concrete.jpg'), texture('./assets/environment/concrete-normal.jpg'),
    texture('./assets/environment/roof.jpg'), texture('./assets/environment/roof-normal.jpg'),
  ]);
  if (signal.aborted) return null;
  floor.albedoTexture = diffuse ?? null; floor.bumpTexture = normal ?? null;
  floor.albedoColor = color(config.terrain.tint);
  gravel.albedoTexture = gravelDiffuse ?? null; gravel.bumpTexture = gravelNormal ?? null; gravel.albedoColor = color('#b1ad94');
  concrete.albedoTexture = concreteDiffuse ?? null; concrete.bumpTexture = concreteNormal ?? null; concrete.albedoColor = color('#aaa58c');
  wall.albedoTexture = concreteDiffuse ?? null; wall.bumpTexture = concreteNormal ?? null;
  roof.albedoTexture = roofDiffuse ?? null; roof.bumpTexture = roofNormal ?? null;
  const ground = MeshBuilder.CreateGround('terrain', { width: config.terrain.size, height: config.terrain.size, subdivisions: config.terrain.subdivisions, updatable: true }, scene);
  const positions = ground.getVerticesData(VertexBuffer.PositionKind)!;
  for (let i = 0; i < positions.length; i += 3) positions[i + 1] = rawTerrainHeight(positions[i], positions[i + 2], config.terrain);
  ground.updateVerticesData(VertexBuffer.PositionKind, positions);
  const normals: number[] = []; VertexData.ComputeNormals(positions, ground.getIndices()!, normals); ground.updateVerticesData(VertexBuffer.NormalKind, normals);
  ground.refreshBoundingInfo(); ground.material = floor; ground.receiveShadows = true;
  const dir = config.lighting.sunDirection;
  const sun = new DirectionalLight('sun', new Vector3(dir.x, dir.y, dir.z), scene); sun.position = new Vector3(50, 85, -30);
  const ambient = new HemisphericLight('sky fill', Vector3.Up(), scene); ambient.groundColor = color('#65624f');
  const shadow = new ShadowGenerator(1024, sun); shadow.usePercentageCloserFiltering = true; shadow.filteringQuality = ShadowGenerator.QUALITY_LOW;
  const staticMeshes: Mesh[] = [];
  function box(name: string, x: number, y: number, z: number, w: number, h: number, d: number, mat: PBRMaterial, cast = true) {
    const m = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene); m.position.set(x, y, z); m.material = mat; m.receiveShadows = true;
    const p = m.getVerticesData(VertexBuffer.PositionKind)!, n = m.getVerticesData(VertexBuffer.NormalKind)!, uv: number[] = [];
    for (let i = 0; i < p.length; i += 3) {
      if (Math.abs(n[i + 1]) > .5) uv.push(p[i] / 2, p[i + 2] / 2);
      else if (Math.abs(n[i]) > .5) uv.push(p[i + 2] / 2, p[i + 1] / 2);
      else uv.push(p[i] / 2, p[i + 1] / 2);
    }
    m.setVerticesData(VertexBuffer.UVKind, uv);
    if (cast) shadow.addShadowCaster(m); staticMeshes.push(m); return m;
  }
  function cylinder(name: string, x: number, y: number, z: number, height: number, diameter: number, mat: PBRMaterial) {
    const m = MeshBuilder.CreateCylinder(name, { height, diameter, tessellation: 8 }, scene); m.position.set(x, y, z); m.material = mat; shadow.addShadowCaster(m); staticMeshes.push(m); return m;
  }
  const road = MeshBuilder.CreateGround('access road', { width: 9, height: 490, subdivisions: 100, updatable: true }, scene);
  road.position.z = 215; road.material = gravel; road.receiveShadows = true;
  const roadPositions = road.getVerticesData(VertexBuffer.PositionKind)!, roadUVs = road.getVerticesData(VertexBuffer.UVKind)!;
  for (let i = 0; i < roadPositions.length; i += 3) { roadPositions[i + 1] = height(roadPositions[i], roadPositions[i + 2] + 215) + .035; roadUVs[i / 3 * 2] = roadPositions[i] / 2; roadUVs[i / 3 * 2 + 1] = roadPositions[i + 2] / 2; }
  road.updateVerticesData(VertexBuffer.PositionKind, roadPositions); road.updateVerticesData(VertexBuffer.UVKind, roadUVs);
  const roadNormals: number[] = []; VertexData.ComputeNormals(roadPositions, road.getIndices()!, roadNormals); road.updateVerticesData(VertexBuffer.NormalKind, roadNormals); road.refreshBoundingInfo();
  box('post courtyard', 0, .008, 2, 75, .016, 85, gravel, false);
  // Reusable facility modules with corrugated roofs, plinths, doors and windows.
  for (const p of config.placements) {
    const { x, z } = p.position, { x: w, y: h, z: d } = p.size;
    if (p.module === 'facility') {
      box(`${p.id} plinth`, x, .15, z, w + .5, .3, d + .5, concrete);
      box(p.id, x, h / 2, z, w, h, d, wall);
      box(`${p.id} base trim`, x, .45, z, w + .05, .5, d + .05, metal);
      const r = box(`${p.id} roof`, x, h + .25, z, w + 1.1, .18, d + 1.1, roof); r.rotation.x = -.08;
      for (let i = -w / 2; i < w / 2; i += .55) {
        const ridge = box('roof seam', x + i, h + .37, z, .035, .035, d + 1.1, darkMetal, false); ridge.rotation.x = -.08;
      }
      box('door', x + w * .24, 1.35, z + d / 2 + .03, 1.25, 2.4, .08, metal);
      for (const offset of [-w * .28, 0]) {
        box('window frame', x + offset, 2.1, z + d / 2 + .04, 2, 1.45, .08, darkMetal);
        box('window pane', x + offset, 2.1, z + d / 2 + .09, 1.8, 1.25, .03, glass, false);
        box('window mullion', x + offset, 2.1, z + d / 2 + .12, .04, 1.25, .035, darkMetal, false);
      }
    } else if (p.module === 'shelter') {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) cylinder('shelter pillar', x + sx * w / 2, h / 2, z + sz * d / 2, h, .24, darkMetal);
      box(`${p.id} canopy`, x, h, z, w + 1, .16, d + 1, roof);
      box(`${p.id} rear beam`, x, h - .15, z + d / 2, w, .3, .2, darkMetal);
    }
  }
  for (const x of [-13, -9, -5, 9, 13, 17]) {
    box('checkpoint block', x, .65, 29, 2.9, 1.3, .9, concrete);
    box('checkpoint stripe', x, .8, 29.46, 2.92, .24, .025, yellow, false);
  }
  // Gate opens the perimeter without a hidden collision wall across the road.
  for (const x of [-5.6, 5.6]) cylinder('gate column', x, 1.5, 52, 3, .24, darkMetal);
  const chain = new DynamicTexture('chain link pattern', { width: 128, height: 128 }, scene, true);
  const ctx = chain.getContext(); ctx.clearRect(0, 0, 128, 128); ctx.strokeStyle = '#8e9691'; ctx.lineWidth = 2;
  for (let i = -128; i <= 256; i += 32) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 128, 128); ctx.moveTo(i, 0); ctx.lineTo(i - 128, 128); ctx.stroke(); }
  chain.update(); chain.hasAlpha = true; chain.uScale = 3; chain.vScale = 2;
  const fenceMat = new StandardMaterial('chain link', scene); fenceMat.diffuseTexture = chain; fenceMat.useAlphaFromDiffuseTexture = true; fenceMat.backFaceCulling = false; fenceMat.specularColor = Color3.Black();
  function fence(ax: number, az: number, bx: number, bz: number) {
    const length = Math.hypot(bx - ax, bz - az), count = Math.ceil(length / 4);
    for (let i = 0; i <= count; i++) cylinder('fence post', ax + (bx - ax) * i / count, 1.35, az + (bz - az) * i / count, 2.7, .09, darkMetal);
    for (let i = 0; i < count; i++) {
      const x = ax + (bx - ax) * (i + .5) / count, z = az + (bz - az) * (i + .5) / count;
      const panel = MeshBuilder.CreatePlane('fence panel', { width: length / count, height: 2.4, sideOrientation: Mesh.DOUBLESIDE }, scene);
      panel.position.set(x, 1.2, z); panel.rotation.y = -Math.atan2(bz - az, bx - ax); panel.material = fenceMat; staticMeshes.push(panel);
      const top = box('fence top rail', x, 2.45, z, length / count, .045, .045, darkMetal, false); top.rotation.y = panel.rotation.y;
    }
  }
  fence(-40, -42, -40, 52); fence(40, -42, 40, 52); fence(-40, -42, 40, -42); fence(-40, 52, -5, 52); fence(5, 52, 40, 52);
  // An observation mast and night floodlights are persistent training objects.
  cylinder('communications mast', -32, 8, 18, 16, .19, darkMetal);
  for (const y of [10, 13, 15]) box('mast antenna', -32, y, 18, 2, .07, .07, darkMetal);
  const lamps: PointLight[] = [];
  for (const [x, z] of [[-17, 22], [23, 45], [-33, -27]]) {
    cylinder('lamp pole', x, 3.2, z, 6.4, .16, darkMetal);
    box('lamp head', x, 6.4, z, .6, .2, .4, lampHousing);
    const light = new PointLight('post floodlight', new Vector3(x, 5.8, z), scene); light.diffuse = color('#ffe4ac'); light.range = 40; lamps.push(light);
  }
  report('Placing vegetation and landscape', .48);
  let seed = 713;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const vegetation: { x: number; z: number; radius: number }[] = [];
  const landscapeDetails: { position: Vector3; high: TransformNode; low: TransformNode }[] = [];
  try {
    const [trees, lowTrees, shrubs] = await Promise.all(['tree.glb', 'tree-low.glb', 'shrub.glb'].map(f => LoadAssetContainerAsync(`./assets/environment/${f}`, scene)));
    if (signal.aborted) { trees.dispose(); lowTrees.dispose(); shrubs.dispose(); return null; }
    containers.push(trees, lowTrees, shrubs);
    // Model LOD changes detail only; every tree remains in the world at all quality levels.
    for (let i = 0; i < config.vegetation.trees; i++) {
      const x = (random() - .5) * 1050, z = (random() - .5) * 1050;
      if (Math.abs(x) < 48 && z > -55 && z < 550) continue;
      const size = 1.2 + random() * 1.4, h = height(x, z), rotation = random() * Math.PI * 2;
      const high = new TransformNode(`tree-${i}`, scene), low = new TransformNode(`tree-${i}-low`, scene);
      high.position.set(x, h, z); low.position.copyFrom(high.position); high.scaling.setAll(size); low.scaling.copyFrom(high.scaling); high.rotation.y = rotation; low.rotation.y = rotation;
      const a = trees.instantiateModelsToScene(name => `tree-${i}-${name}`, false), b = lowTrees.instantiateModelsToScene(name => `tree-${i}-low-${name}`, false);
      for (const node of a.rootNodes) node.parent = high; for (const node of b.rootNodes) node.parent = low;
      low.setEnabled(false); landscapeDetails.push({ position: high.position, high, low });
      if (Math.hypot(x, z) < 180) for (const m of high.getChildMeshes()) shadow.addShadowCaster(m);
      vegetation.push({ x, z, radius: .5 * size });
    }
    for (let i = 0; i < config.vegetation.shrubs; i++) {
      const x = (random() - .5) * 370, z = (random() - .5) * 370;
      if (Math.abs(x) < 45 && z > -48 && z < 155) continue;
      const shrub = shrubs.instantiateModelsToScene(name => `shrub-${i}-${name}`, false);
      const shrubRoot = new TransformNode(`shrub-${i}`, scene); shrubRoot.position.set(x, height(x, z), z); shrubRoot.scaling.setAll(.8 + random() * .7); shrubRoot.rotation.y = random() * 6.28;
      for (const node of shrub.rootNodes) node.parent = shrubRoot;
    }
  } catch (e) { errors.push(`Vegetation models: ${String(e)}`); }
  const obstacles = principalObstacles(config);
  report('Loading landscape model', .66);
  try {
    const rock = await LoadAssetContainerAsync('./assets/environment/rock.glb', scene);
    if (signal.aborted) { rock.dispose(); return null; }
    containers.push(rock);
    for (let i = 0; i < 28; i++) {
      const instance = rock.instantiateModelsToScene(name => `landscape-${i}-${name}`, false, { doNotInstantiate: false });
      const root = new TransformNode(`rock placement ${i}`, scene);
      const x = (random() - .5) * 500, z = (random() - .5) * 500;
      root.position.set(x, height(x, z) - .2, z); root.rotation.y = random() * 6.28; root.scaling.setAll(.6 + random() * 2);
      for (const node of instance.rootNodes) node.parent = root;
      if (Math.abs(x) < 105 && z > -105 && z < 170) {
        const meshes = root.getChildMeshes();
        for (const mesh of meshes) { mesh.computeWorldMatrix(true); const b = mesh.getBoundingInfo().boundingBox; const min = b.minimumWorld, max = b.maximumWorld; obstacles.push({ id: mesh.name, minX: min.x, maxX: max.x, minZ: min.z, maxZ: max.z }); }
      }
    }
  } catch (e) { errors.push(`Landscape model: ${String(e)}`); }
  report('Loading Sketchfab terrain and boulders', .74);
  const scenery = new Map<string, AssetContainer>();
  for (const model of new Set(config.scenery.map(p => p.model))) {
    try {
      const container = await LoadAssetContainerAsync(`./assets/sketchfab/${model}.glb`, scene);
      if (signal.aborted) { container.dispose(); return null; }
      containers.push(container); scenery.set(model,container);
    } catch (e) { errors.push(`Sketchfab ${model}: ${String(e)}`); }
  }
  for (const placement of config.scenery) {
    const template = scenery.get(placement.model); if (!template) continue;
    const instance = template.instantiateModelsToScene(name => `${placement.id}-${name}`,false);
    const root = new TransformNode(placement.id,scene);
    root.position.set(placement.position.x, height(placement.position.x,placement.position.z) + placement.position.y, placement.position.z);
    root.scaling.set(placement.width, placement.width * placement.heightScale, placement.width); root.rotation.y = placement.heading;
    for (const node of instance.rootNodes) node.parent = root;
    const meshes = root.getChildMeshes();
    for (const mesh of meshes) { mesh.receiveShadows = true; mesh.computeWorldMatrix(true); if (placement.collidable) shadow.addShadowCaster(mesh); }
    if (placement.collidable) {
      const min = new Vector3(Infinity,Infinity,Infinity), max = new Vector3(-Infinity,-Infinity,-Infinity);
      for (const mesh of meshes) { if (!mesh.getTotalVertices()) continue; const b = mesh.getBoundingInfo().boundingBox; min.minimizeInPlace(b.minimumWorld); max.maximizeInPlace(b.maximumWorld); }
      if (Number.isFinite(min.x)) obstacles.push({ id: placement.id, minX: min.x, maxX: max.x, minZ: min.z, maxZ: max.z });
    }
  }
  report('Loading daylight sky', .82);
  const skyTexture = await new Promise<HDRCubeTexture | undefined>(resolve => {
    const t = new HDRCubeTexture('./assets/environment/sky.hdr', scene, 128, false, true, false, true,
      () => resolve(t), () => { errors.push('Daylight sky could not load.'); t.dispose(); resolve(undefined); });
  });
  if (signal.aborted) return null;
  let sky: Mesh | undefined;
  if (skyTexture) { scene.environmentTexture = skyTexture; sky = scene.createDefaultSkybox(skyTexture, false, 5000, 0, false) ?? undefined; if (sky) sky.applyFog = false; }
  // Batch post modules by shared material to reduce draw calls without removing objects.
  const batches = new Map<unknown, Mesh[]>();
  for (const m of staticMeshes) { const group = batches.get(m.material) ?? []; group.push(m); batches.set(m.material, group); }
  for (const [mat, meshes] of batches) {
    const merged = Mesh.MergeMeshes(meshes, true, true);
    if (!merged) continue;
    merged.name = `post module batch ${merged.material?.name}`; merged.receiveShadows = true; merged.freezeWorldMatrix();
    if (mat !== fenceMat && mat !== gravel && mat !== glass) shadow.addShadowCaster(merged);
  }
  const shadowCasters = shadow.getShadowMap()!.renderList?.filter(m => !m.isDisposed()) ?? [];
  let currentConditions: Conditions = { timeOfDay: 'day', visibility: 'clear' };
  let currentQuality: Quality = 'standard';
  let lodFrame = 0;
  scene.onBeforeRenderObservable.add(() => {
    if (++lodFrame % 20 !== 0 || !scene.activeCamera) return;
    for (const tree of landscapeDetails) {
      const high = Vector3.DistanceSquared(tree.position, scene.activeCamera.position) < (currentQuality === 'low' ? 75 ** 2 : 160 ** 2);
      if (tree.high.isEnabled() !== high) { tree.high.setEnabled(high); tree.low.setEnabled(!high); }
    }
  });
  function setConditions(conditions: Conditions) {
    currentConditions = conditions;
    const night = conditions.timeOfDay === 'night';
    sun.intensity = night ? config.lighting.nightIntensity : config.lighting.dayIntensity;
    sun.diffuse = night ? color('#718ba9') : color('#fff1d5');
    ambient.intensity = night ? .13 : .8; scene.environmentIntensity = night ? .025 : .65;
    scene.fogMode = Scene.FOGMODE_EXP2; scene.fogDensity = config.visibility[conditions.visibility];
    scene.fogColor = night ? color('#14202e') : color('#bfccc7');
    if (sky) { sky.visibility = night ? 0 : 1; }
    scene.clearColor.set(night ? .022 : .62, night ? .035 : .74, night ? .065 : .8, 1);
    for (const lamp of lamps) lamp.intensity = night ? 150 : 0;
    lampHousing.emissiveColor = night ? color('#ffe4ac') : Color3.Black();
  }
  function setQuality(quality: Quality) {
    currentQuality = quality;
    shadow.getShadowMap()!.renderList = quality === 'low' ? [] : shadowCasters;
    shadow.getShadowMap()!.refreshRate = quality === 'low' ? 0 : 1;
    setConditions(currentConditions);
  }
  setConditions(currentConditions);
  report('Observation post ready', .92);
  return { setConditions, setQuality, obstacles, vegetation, errors, sceneryCount: config.scenery.filter(p => scenery.has(p.model)).length };
}
