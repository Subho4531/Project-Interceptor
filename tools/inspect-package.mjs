import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../..');
const exe = await readFile(path.join(root, 'Windows/UAV_Intercept_Simulator/Binaries/Win64/UAV_Intercept_Simulator-Win64-Shipping.exe'));
const ascii = exe.toString('latin1');
const wide = exe.toString('utf16le');
const strings = [...ascii.matchAll(/[\x20-\x7e]{8,}/g), ...wide.matchAll(/[\x20-\x7e]{8,}/g)].map(m => m[0]);
const versions = [...new Set(strings.filter(s => /\+\+UE[45]\+Release|[45]\.\d\.\d-\d+/.test(s)))];
const pakDir = path.join(root, 'Windows/UAV_Intercept_Simulator/Content/Paks');
const containers = [];
for (const name of await readdir(pakDir)) {
  if (!name.endsWith('.utoc')) continue;
  const b = await readFile(path.join(pakDir, name));
  containers.push({ name, magic: b.subarray(0, 16).toString(), tocVersion: b[16], headerHex: b.subarray(0, 96).toString('hex') });
}
const manifest = await readFile(path.join(root, 'Windows/Manifest_UFSFiles_Win64.txt'), 'utf8');
const assets = manifest.split(/\r?\n/).map(s => s.split('\t')[0]).filter(s => /fpv|orlan|geran|shahed|lancet/i.test(s) && s.endsWith('.uasset'));
const report = { inspectedAt: new Date().toISOString(), versions, containers, assets };
await mkdir(path.join(root, 'web-trainer/artifacts/extraction'), { recursive: true });
await writeFile(path.join(root, 'web-trainer/artifacts/extraction/package-inspection.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ versions, containers, assetCount: assets.length }, null, 2));
