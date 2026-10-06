import type { Vec3, Bounds, Obstacle, EnvironmentConfig } from './types';
import { getTerrainSurface } from './TerrainSurface';
type Terrain = EnvironmentConfig['terrain'];
const defaultTerrain: Terrain = { size: 2400, subdivisions: 240, profile: 'rural', tint: '#b8b59a' };
export function rawTerrainHeight(x: number, z: number, terrain: Terrain = defaultTerrain): number {
  const distance = Math.hypot(x, z);
  const flat = terrain.profile === 'rural' ? 180 : 105;
  const blend = Math.min(1, Math.max(0, (distance - flat) / 200));
  const hills = 10 + 14 * Math.sin(x * 0.008) * Math.cos(z * 0.007) + 5 * Math.sin((x + z) * 0.018);
  const strength = terrain.profile === 'mountain' ? 1.05 : terrain.profile === 'valley' ? .48 : 1;
  return Math.max(0, hills * 3 + 18 + 10 * Math.sin(x * .004 + z * .009)) * blend * strength;
}
// Same triangles as Babylon's ground mesh, so eye height follows the rendered surface.
export function terrainHeight(x: number, z: number, terrain: Terrain = defaultTerrain): number {
  const imported = getTerrainSurface(terrain);
  if (imported) return imported.heightAt(x,z);
  const step = terrain.size / terrain.subdivisions, half = terrain.size / 2;
  const gx = (x + half) / step, gz = (z + half) / step;
  const ix = Math.floor(gx), iz = Math.floor(gz), u = gx - ix, v = gz - iz;
  const x0 = ix * step - half, z0 = iz * step - half;
  const a = rawTerrainHeight(x0,z0,terrain), b = rawTerrainHeight(x0 + step,z0,terrain), c = rawTerrainHeight(x0,z0 + step,terrain), d = rawTerrainHeight(x0 + step,z0 + step,terrain);
  return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
}
export function inside(p: Vec3, bounds: Bounds): boolean {
  return p.x >= bounds.minX && p.x <= bounds.maxX && p.z >= bounds.minZ && p.z <= bounds.maxZ;
}
export function collides(x: number, z: number, obstacles: Obstacle[], radius = 0.35): boolean {
  return obstacles.some(o => {
    const dx = x - Math.max(o.minX, Math.min(x, o.maxX));
    const dz = z - Math.max(o.minZ, Math.min(z, o.maxZ));
    return dx * dx + dz * dz < radius * radius;
  });
}
// Swept substeps prevent tunnelling. Axis separation gives natural wall sliding.
export function moveObserver(p: Vec3, dx: number, dz: number, obstacles: Obstacle[], bounds: Bounds, terrain: Terrain = defaultTerrain): Vec3 {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.15));
  let { x, z } = p;
  for (let i = 0; i < steps; i++) {
    const nx = Math.max(bounds.minX + 0.4, Math.min(bounds.maxX - 0.4, x + dx / steps));
    const climbable=(tx:number,tz:number)=>Math.abs(terrainHeight(tx,tz,terrain)-terrainHeight(x,z,terrain))<=Math.hypot(tx-x,tz-z)*1.1+.03;
    if (!collides(nx, z, obstacles) && climbable(nx,z)) x = nx;
    const nz = Math.max(bounds.minZ + 0.4, Math.min(bounds.maxZ - 0.4, z + dz / steps));
    if (!collides(x, nz, obstacles) && climbable(x,nz)) z = nz;
  }
  return { x, y: terrainHeight(x, z, terrain) + 1.72, z };
}
export function principalObstacles(config: EnvironmentConfig): Obstacle[] {
  const obstacles: Obstacle[] = [];
  for (const p of config.placements) {
    if (p.module === 'facility') obstacles.push({ id: p.id, minX: p.position.x - p.size.x / 2, maxX: p.position.x + p.size.x / 2, minZ: p.position.z - p.size.z / 2, maxZ: p.position.z + p.size.z / 2 });
    if (p.module === 'shelter') for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = p.position.x + sx * p.size.x / 2, z = p.position.z + sz * p.size.z / 2;
      obstacles.push({ id: `${p.id}-pillar-${sx}-${sz}`, minX: x - .14, maxX: x + .14, minZ: z - .14, maxZ: z + .14 });
    }
  }
  obstacles.push(
    { id: 'west-fence', minX: -40.2, maxX: -39.8, minZ: -42, maxZ: 52 },
    { id: 'east-fence', minX: 39.8, maxX: 40.2, minZ: -42, maxZ: 52 },
    { id: 'south-fence', minX: -40, maxX: 40, minZ: -42.2, maxZ: -41.8 },
    { id: 'north-fence-west', minX: -40, maxX: -5, minZ: 51.8, maxZ: 52.2 },
    { id: 'north-fence-east', minX: 5, maxX: 40, minZ: 51.8, maxZ: 52.2 },
  );
  for (const x of [-13, -9, -5, 9, 13, 17]) obstacles.push({ id: `barrier-${x}`, minX: x - 1.45, maxX: x + 1.45, minZ: 28.55, maxZ: 29.45 });
  return obstacles;
}
