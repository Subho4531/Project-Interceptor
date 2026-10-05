import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, weld, prune, simplify, getBounds } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

const root = path.resolve(import.meta.dirname, '..');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
await MeshoptSimplifier.ready;
const droneSources = JSON.parse(await readFile(path.join(root, 'assets-source/sketchfab/downloads.json'), 'utf8')).models;
const environmentSources = JSON.parse(await readFile(path.join(root, 'artifacts/extraction/sketchfab-environment-candidates.json'), 'utf8'));
const catalog = [];
const conversions = [];
const credits = [];
const drones = [
  { name: 'fpv', width: .48, yaw: 0, source: droneSources[0] },
  { name: 'orlan', width: 3.1, yaw: 0, source: droneSources[1] },
  { name: 'lancet', width: 1.03, yaw: Math.PI, source: droneSources[2] },
  { name: 'geran', width: 2.5, yaw: Math.PI, source: droneSources[3] },
];
const landscapes = [
  { name: 'mountain', file: 'snowy_mountain_-_terrain.glb', ratio: .24, source: environmentSources[0] },
  { name: 'dry-terrain', file: 'free_-_dry_rock_sand_terrain.glb', ratio: .12, source: environmentSources[1] },
  { name: 'boulders', file: 'cliff_rock_boulder_field.glb', ratio: .22, source: environmentSources[2] },
];
for (const item of [...drones, ...landscapes]) {
  const drone = 'width' in item;
  let sourceFile;
  if (drone) sourceFile = path.join(root, item.source.localFile);
  else {
    const directory = path.join(root, 'assets-source/sketchfab', item.source.uid);
    await mkdir(directory, { recursive: true });
    sourceFile = path.join(directory, item.file);
    if (!existsSync(sourceFile)) await copyFile(path.join('C:/Users/subho/Downloads', item.file), sourceFile);
    const bytes = await readFile(sourceFile);
    if (!existsSync(path.join(directory, 'PROVENANCE.json'))) await writeFile(path.join(directory, 'PROVENANCE.json'), JSON.stringify({ ...item.source, downloadedAt: new Date().toISOString(), downloadMethod: 'Authenticated Chrome UI', requestedTextureResolution: '1k', sha256: createHash('sha256').update(bytes).digest('hex') }, null, 2));
    await writeFile(path.join(directory, 'ATTRIBUTION.txt'), `${item.source.name} by ${item.source.author.name}\n${item.source.url}\n${item.source.license.fullName}: ${item.source.license.url}\n${item.source.license.requirements}\n`);
  }
  const document = await io.read(sourceFile);
  // Scans can contain isolated point primitives; retain triangle geometry for the runtime scenery.
  if (!drone) for (const mesh of document.getRoot().listMeshes()) for (const primitive of [...mesh.listPrimitives()]) if (primitive.getMode() !== 4) primitive.dispose();
  const scene = document.getRoot().listScenes()[0];
  const bounds = getBounds(scene);
  const size = bounds.max.map((v, i) => v - bounds.min[i]);
  const factor = (drone ? item.width : 1) / size[0];
  const normalization = document.createNode('metre-space normalization');
  normalization.setScale([factor, factor, factor]);
  normalization.setTranslation([-(bounds.min[0] + bounds.max[0]) / 2 * factor, -(drone ? (bounds.min[1] + bounds.max[1]) / 2 : bounds.min[1]) * factor, -(bounds.min[2] + bounds.max[2]) / 2 * factor]);
  for (const child of [...scene.listChildren()]) { scene.removeChild(child); normalization.addChild(child); }
  scene.addChild(normalization);
  await document.transform(dedup(), weld(), ...(drone ? [] : [simplify({ simplifier: MeshoptSimplifier, ratio: item.ratio, error: .003 })]), prune());
  const directory = path.join(root, 'public/assets', drone ? 'drones' : 'sketchfab');
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, `${item.name}.glb`);
  await io.write(file, document);
  // Drone source manifests retain the license/source URL; author names come from public metadata.
  const metadata = drone ? JSON.parse(await readFile(path.join(root, 'artifacts/extraction/sketchfab-candidates.json'), 'utf8')).candidates.find(c => c.uid === item.source.uid) : item.source;
  const provenance = { uid: item.source.uid, sourceUrl: item.source.sourceUrl ?? item.source.url, author: metadata.author, license: item.source.license, sourceBounds: bounds, normalizationScale: factor, dimensions: { x: size[0] * factor, y: size[1] * factor, z: size[2] * factor }, transformations: drone ? ['dedup', 'weld', 'prune', 'centre and authored metre-space scale'] : ['dedup', 'weld', `simplify ratio ${item.ratio}, error .003`, 'prune', 'centre and normalize to one metre width'], outputBytes: (await readFile(file)).length };
  credits.push({ name: metadata.name ?? item.source.name, sourceUrl: provenance.sourceUrl, author: metadata.author, license: item.source.license });
  const triangles = document.getRoot().listMeshes().flatMap(m => m.listPrimitives()).reduce((n,p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0);
  conversions.push({ name: item.name, triangles, ...provenance });
  await writeFile(path.join(directory, `${item.name}.provenance.json`), JSON.stringify(provenance, null, 2));
  await writeFile(path.join(directory, `${item.name}.LICENSE.txt`), `${metadata.name ?? item.source.name} by ${metadata.author.name}\n${provenance.sourceUrl}\n${item.source.license.fullName}: ${item.source.license.url}\n${item.source.license.requirements}\nModified: ${provenance.transformations.join('; ')}.\n`);
  if (drone) catalog.push({ id: `sketchfab-${item.name}`, modelUrl: `./assets/drones/${item.name}.glb`, identity: metadata.name, provenance: { origin: 'sketchfab', uid: item.source.uid, sourceUrl: provenance.sourceUrl, author: metadata.author, license: item.source.license }, dimensions: provenance.dimensions, scaleCorrection: 1, orientationCorrection: { x: 0, y: item.yaw, z: 0 }, animations: [], status: 'available', scaleBasis: 'Authored training wingspan; proportions preserved. Not a certified manufacturer measurement.', simulatorOriginal: false });
  console.log(`${item.name}: ${triangles.toLocaleString()} triangles, ${(provenance.outputBytes / 1048576).toFixed(2)} MiB`);
}
await writeFile(path.join(root, 'public/assets/drones/catalog.json'), JSON.stringify({ status: 'available', source: 'User-authorized Sketchfab models; original Unreal assets remain separate.', assets: catalog }, null, 2));
await writeFile(path.join(root, 'artifacts/extraction/sketchfab-optimization.json'), JSON.stringify(conversions, null, 2));

await writeFile(path.join(root, 'public/assets/credits.json'), JSON.stringify(credits, null, 2));
