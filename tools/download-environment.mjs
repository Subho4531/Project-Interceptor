import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const load = async name => JSON.parse(await readFile(path.join(import.meta.dirname, `${name}-files.json`), 'utf8'));
const [grass, model, sky] = await Promise.all(['grass', 'model', 'sky'].map(load));
const out = path.join(root, 'assets-source/environment');
const gltf = model.gltf['1k'].gltf;
const downloads = [
  { file: 'ground.jpg', ...grass.Diffuse['1k'].jpg },
  { file: 'ground-normal.jpg', ...grass.nor_gl['1k'].jpg },
  { file: 'sky.hdr', ...sky.hdri['1k'].hdr },
  { file: 'rock/rock.gltf', ...gltf },
  ...Object.entries(gltf.include).map(([file, info]) => ({ file: `rock/${file}`, ...info })),
];
for (const [id, folder] of [['tree_small_02', 'tree'], ['shrub_03', 'shrub']]) {
  const data = await load(id);
  const g = data.gltf['1k'].gltf;
  downloads.push({ file: `${folder}/${folder}.gltf`, ...g }, ...Object.entries(g.include).map(([file, info]) => ({ file: `${folder}/${file}`, ...info })));
}
for (const [id, name] of [['gravelly_sand', 'gravel'], ['concrete_wall_006', 'concrete'], ['corrugated_iron', 'roof']]) {
  const data = await load(id);
  downloads.push({ file: `${name}.jpg`, ...data.Diffuse['1k'].jpg }, { file: `${name}-normal.jpg`, ...data.nor_gl['1k'].jpg });
}
const provenance = [];
for (const d of downloads) {
  const dest = path.join(out, d.file);
  await mkdir(path.dirname(dest), { recursive: true });
  let b;
  try { b = await readFile(dest); } catch { /* download below */ }
  if (!b || createHash('md5').update(b).digest('hex') !== d.md5) {
    const response = await fetch(d.url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`${response.status} ${d.url}`);
    b = Buffer.from(await response.arrayBuffer());
    if (createHash('md5').update(b).digest('hex') !== d.md5) throw new Error(`Checksum failed: ${d.file}`);
    await writeFile(dest, b);
  }
  provenance.push({ file: d.file, url: d.url, md5: d.md5, bytes: b.length, license: 'CC0-1.0', licenseUrl: 'https://polyhaven.com/license' });
  console.log(`Verified ${d.file} (${b.length} bytes)`);
}
await writeFile(path.join(out, 'provenance.json'), JSON.stringify(provenance, null, 2));
