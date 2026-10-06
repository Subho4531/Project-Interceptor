import type { EnvironmentConfig } from './types';

export interface TerrainSurface { heightAt(x: number, z: number): number; }
export interface Heightfield {
  minX: number; minZ: number; spacing: number; columns: number; rows: number;
  heights: number[]; originHeightEGM2008?: number;
}
const surfaces = new WeakMap<EnvironmentConfig['terrain'], TerrainSurface>();
export const setTerrainSurface = (terrain: EnvironmentConfig['terrain'], surface: TerrainSurface) => surfaces.set(terrain, surface);
export const getTerrainSurface = (terrain: EnvironmentConfig['terrain']) => surfaces.get(terrain);
export class GridTerrainSurface implements TerrainSurface {
  constructor(public readonly data: Heightfield) {
    if (!Number.isFinite(data.spacing) || !(data.spacing > 0) || !Number.isInteger(data.columns) || !Number.isInteger(data.rows) || data.columns < 2 || data.rows < 2 || !Number.isFinite(data.minX) || !Number.isFinite(data.minZ) || !Array.isArray(data.heights) || data.heights.length !== data.columns * data.rows || !data.heights.every(Number.isFinite)) throw new Error('Invalid regional heightfield');
  }
  heightAt(x: number, z: number): number {
    const d = this.data, gx = Math.max(0, Math.min(d.columns - 1, (x-d.minX)/d.spacing)), gz = Math.max(0, Math.min(d.rows-1,(z-d.minZ)/d.spacing));
    const ix = Math.min(d.columns-2,Math.floor(gx)), iz = Math.min(d.rows-2,Math.floor(gz)), u = gx-ix, v = gz-iz;
    const a=d.heights[iz*d.columns+ix], b=d.heights[iz*d.columns+ix+1], c=d.heights[(iz+1)*d.columns+ix], e=d.heights[(iz+1)*d.columns+ix+1];
    return u+v <= 1 ? a+(b-a)*u+(c-a)*v : e+(c-e)*(1-u)+(b-e)*(1-v);
  }
}
