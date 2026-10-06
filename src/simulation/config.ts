import type { EnvironmentConfig, ScenarioConfig, ExerciseId, LandscapePlacement } from './types';
import { terrainHeight } from './world';
import { createTrainingScenario, trainingScenarios, sensorScenarios } from './trainingScenarios';
export const environment: EnvironmentConfig = {
  id: 'rural-post-07', label: 'Rural border post', description: 'Open fields, wooded hills and a roadside checkpoint.',
  terrain: { size: 2400, subdivisions: 240, profile: 'rural', tint: '#b8b59a' },
  vegetation: { trees: 85, shrubs: 75 },
  scenery: [
    { id: 'rural-boulders-west', model: 'boulders', position: { x: -66, y: 0, z: 100 }, width: 14, heightScale: 1, heading: .3, collidable: true },
    { id: 'rural-boulders-east', model: 'boulders', position: { x: 72, y: 0, z: 125 }, width: 18, heightScale: 1, heading: 1.5, collidable: true },
  ],
  bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 165 },
  protectedZones: [{ id: 'post-perimeter', minX: -40, maxX: 40, minZ: -42, maxZ: 52, minY: 0, maxY: 100 }],
  observerSpawn: { x: -5, y: 1.72, z: 5, heading: 0.18 },
  placements: [
    { id: 'operations', module: 'facility', position: { x: -26, y: 0, z: -13 }, size: { x: 15, y: 4, z: 11 } },
    { id: 'stores', module: 'facility', position: { x: 26, y: 0, z: 23 }, size: { x: 12, y: 3.5, z: 9 } },
    { id: 'checkpoint', module: 'shelter', position: { x: 14, y: 0, z: 39 }, size: { x: 5, y: 3, z: 5 } },
    { id: 'observation', module: 'shelter', position: { x: -17, y: 0, z: 13 }, size: { x: 8, y: 3.4, z: 7 } },
  ],
  lighting: { sunDirection: { x: -0.65, y: -1, z: 0.3 }, dayIntensity: 2.2, nightIntensity: 0.12 },
  visibility: { clear: 0.00065, reduced: 0.013 },
};
const mountainScenery: LandscapePlacement[] = [
  { id: 'west-ridge', model: 'mountain', position: { x: -1050, y: -12, z: 480 }, width: 1050, heightScale: 1.8, heading: .5, collidable: false },
  { id: 'east-ridge', model: 'mountain', position: { x: 1050, y: -12, z: 500 }, width: 1050, heightScale: 1.6, heading: -1, collidable: false },
  { id: 'northern-massif', model: 'mountain', position: { x: 0, y: -12, z: 1300 }, width: 1100, heightScale: 2.4, heading: .1, collidable: false },
];
const valleyScenery: LandscapePlacement[] = [
  { id: 'west-escarpment', model: 'dry-terrain', position: { x: -900, y: -85, z: 370 }, width: 850, heightScale: .45, heading: 0, collidable: false },
  { id: 'east-escarpment', model: 'dry-terrain', position: { x: 900, y: -85, z: 390 }, width: 850, heightScale: .35, heading: Math.PI, collidable: false },
  { id: 'valley-head', model: 'dry-terrain', position: { x: 0, y: -85, z: 1250 }, width: 1000, heightScale: .4, heading: Math.PI, collidable: false },
];
function rockPlacements(): LandscapePlacement[] {
  return [[-75, 95, 15], [85, 105, 19], [-120, 145, 22], [145, 195, 17], [-70, -100, 16], [80, -85, 13]].map(([x,z,width], i) => ({ id: `scanned-boulders-${i}`, model: 'boulders', position: { x, y: 0, z }, width, heightScale: 1, heading: i * .71, collidable: true }));
}
export const environments: EnvironmentConfig[] = [environment,
  { ...environment, id: 'mountain-pass', label: 'Mountain pass', description: 'A foothill outpost beneath snowy ridges. Explore the rising ground beyond the gate.', terrain: { ...environment.terrain, profile: 'mountain', tint: '#a6afa1' }, bounds: { minX: -210, maxX: 210, minZ: -170, maxZ: 300 }, vegetation: { trees: 52, shrubs: 32 }, scenery: [...mountainScenery, ...rockPlacements()] },
  { ...environment, id: 'rocky-valley', label: 'Rocky valley', description: 'A dry border crossing between rocky escarpments and scanned boulder fields.', terrain: { ...environment.terrain, profile: 'valley', tint: '#c7ae83' }, bounds: { minX: -210, maxX: 210, minZ: -170, maxZ: 300 }, vegetation: { trees: 9, shrubs: 22 }, scenery: [...valleyScenery, ...rockPlacements()] },
];
export const exercises: { id: ExerciseId; label: string; group: 'training' | 'familiarisation' }[] = [
  ...sensorScenarios.map(s => ({id:s.id,label:`${s.definition.briefing.code} · ${s.definition.briefing.title}`,group:'training' as const})),
  ...trainingScenarios.map(s => ({id:s.id,label:`${s.definition.briefing.code} · ${s.definition.briefing.title}`,group:'training' as const})),
  ...[{ id: 'patrol' as const, label: 'Rotating patrol · four passes' }, { id: 'route-a' as const, label: 'Route A' }, { id: 'route-b' as const, label: 'Route B' }, { id: 'route-c' as const, label: 'Route C' }, { id: 'route-d' as const, label: 'Route D' }].map(e => ({...e,group:'familiarisation' as const}))
];
export function createScenario(config: EnvironmentConfig, exercise: ExerciseId = 'patrol'): ScenarioConfig {
  if ([...trainingScenarios,...sensorScenarios].some(s => s.id === exercise)) return createTrainingScenario(config,exercise as Parameters<typeof createTrainingScenario>[1]);
  const route = [{ x: -160, y: 24, z: 135 }, { x: -45, y: 22, z: 80 }, { x: 0, y: 19, z: 35 }, { x: 80, y: 26, z: 65 }, { x: 190, y: 32, z: 150 }];
  const variants = [
    { id: 'route-a', assetId: 'sketchfab-fpv', speed: 8, altitude: 0 },
    { id: 'route-b', assetId: 'sketchfab-orlan', speed: 12, altitude: 14 },
    { id: 'route-c', assetId: 'sketchfab-lancet', speed: 11, altitude: 5 },
    { id: 'route-d', assetId: 'sketchfab-geran', speed: 14, altitude: 18 },
  ];
  const chosen = exercise === 'patrol' ? [variants[1], variants[2], variants[0], variants[3]] : variants.filter(v => v.id === exercise);
  return { id: `${config.id}-${exercise}`, seed: 26052, quietPeriod: 25, conditions: { timeOfDay: 'day', visibility: 'clear' }, entities: chosen.map((v,i) => ({ id: `aerial-${String(i + 1).padStart(2,'0')}`, assetId: v.assetId, spawnTime: i * 60, speed: v.speed, route: route.map(p => ({ ...p, y: Math.max(p.y + v.altitude, terrainHeight(p.x,p.z,config.terrain) + 18 + v.altitude * .3) })) })) };
}
// Single-route fixture retained for deterministic simulation checks.
export const scenario = createScenario(environment, 'route-a');
