import type { EnvironmentConfig, Placement } from './types';

export type EnvironmentSetting = 'rural' | 'semi-urban';

const variantPlacementPrefix = 'semi-urban-';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Apply an authored setting using only the licensed facility, shelter and
 * barrier modules already loaded by the renderer. The outpost perimeter,
 * terrain and movement bounds are intentionally kept from the selected map.
 */
export function applyEnvironmentSetting(config: EnvironmentConfig, setting: EnvironmentSetting): EnvironmentConfig {
  const authoredPlacements = config.placements.filter(p => !p.id.startsWith(variantPlacementPrefix));
  const placements: Placement[] = setting === 'rural'
    ? authoredPlacements.map(p => ({ ...p, position: { ...p.position }, size: { ...p.size } }))
    : [...authoredPlacements.map(p => ({ ...p, position: { ...p.position }, size: { ...p.size } })), ...semiUrbanPlacements(config)];

  return {
    ...config,
    setting,
    placements,
    bounds: { ...config.bounds },
    // Keep the terrain descriptor identity: imported heightfields are keyed by
    // this object in TerrainSurface and must survive a setting selection.
    terrain: config.terrain,
    protectedZones: config.protectedZones.map(zone => ({ ...zone })),
    vegetation: { ...config.vegetation },
    scenery: config.scenery.map(item => ({ ...item, position: { ...item.position } })),
  };
}

function semiUrbanPlacements(config: EnvironmentConfig): Placement[] {
  const { minX, maxX, minZ, maxZ } = config.bounds;
  const width = maxX - minX;
  const centerX = (minX + maxX) / 2;
  const protectedNorth = config.protectedZones.length
    ? Math.max(...config.protectedZones.map(zone => zone.maxZ))
    : minZ + (maxZ - minZ) * .38;
  const placeX = (fraction: number, objectWidth: number) => clamp(
    centerX + width * fraction,
    minX + objectWidth / 2 + 2,
    maxX - objectWidth / 2 - 2,
  );
  const placeZ = (offset: number, objectDepth: number) => clamp(
    protectedNorth + offset,
    minZ + objectDepth / 2 + 2,
    maxZ - objectDepth / 2 - 2,
  );

  return [
    { id: `${variantPlacementPrefix}market`, module: 'facility', position: { x: placeX(-.29, 12), y: 0, z: placeZ(30, 9) }, size: { x: 12, y: 4, z: 9 } },
    { id: `${variantPlacementPrefix}service-yard`, module: 'facility', position: { x: placeX(.29, 10), y: 0, z: placeZ(58, 8) }, size: { x: 10, y: 3.6, z: 8 } },
    { id: `${variantPlacementPrefix}transit-shelter`, module: 'shelter', position: { x: centerX, y: 0, z: placeZ(13, 5) }, size: { x: 6, y: 3, z: 5 } },
    { id: `${variantPlacementPrefix}road-barrier-west`, module: 'barrier', position: { x: placeX(-.08, 3), y: 0, z: placeZ(5, 1) }, size: { x: 3, y: 1.3, z: 1 } },
    { id: `${variantPlacementPrefix}road-barrier-east`, module: 'barrier', position: { x: placeX(.08, 3), y: 0, z: placeZ(5, 1) }, size: { x: 3, y: 1.3, z: 1 } },
  ];
}
