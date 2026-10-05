import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { dedup, weld, prune, simplify } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'public/assets/environment');
await mkdir(out, { recursive: true });
for (const file of ['ground.jpg', 'ground-normal.jpg', 'sky.hdr', 'gravel.jpg', 'gravel-normal.jpg', 'concrete.jpg', 'concrete-normal.jpg', 'roof.jpg', 'roof-normal.jpg']) await copyFile(path.join(root, 'assets-source/environment', file), path.join(out, file));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(path.join(root, 'assets-source/environment/rock/rock.gltf'));
await doc.transform(dedup(), weld(), prune());
await io.write(path.join(out, 'rock.glb'), doc);
await MeshoptSimplifier.ready;
for (const folder of ['tree', 'shrub']) {
  const model = await io.read(path.join(root, `assets-source/environment/${folder}/${folder}.gltf`));
  await model.transform(dedup(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio: folder === 'tree' ? .035 : .5, error: .005 }), prune());
  await io.write(path.join(out, `${folder}.glb`), model);
  if (folder === 'tree') {
    await model.transform(simplify({ simplifier: MeshoptSimplifier, ratio: .18, error: .02 }), prune());
    await io.write(path.join(out, 'tree-low.glb'), model);
  }
}
await writeFile(path.join(root, 'artifacts/extraction/environment-optimization.json'), JSON.stringify({ tool: 'glTF Transform', rock: { transforms: ['dedup', 'weld', 'prune'], geometrySimplified: false }, tree: { ratio: .035, error: .005, distantRatio: .18, distantError: .02 }, shrub: { ratio: .5, error: .005 }, textureSize: '1k source', outputs: ['rock.glb','tree.glb','tree-low.glb','shrub.glb'] }, null, 2));
console.log('Local environment assets prepared.');
