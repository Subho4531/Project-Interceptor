import type { EnvironmentConfig, ScenarioConfig, ScenarioEntity, TrainingScenarioId, TrainingDefinition, Vec3 } from './types';
import { terrainHeight } from './world';

// Four authored defensive observation exercises based on the local PRD's flight
// profiles and swarm requirement. These are not an official four-category PS taxonomy.
export const trainingScenarios: { id: TrainingScenarioId; definition: TrainingDefinition }[] = [
  { id: 'low-ingress', definition: {
    briefing: { code: 'EX 01', title: 'Low-altitude incursion', description: 'Patrol the post and scan the lower horizon. Record what you can observe before deciding how to report it.', objectives: ['Acquire a small contact against terrain.', 'Keep visual contact and record its bearing.', 'Assess behaviour near the protected post.'] },
    duration: 90, expectedClassification: 'threat', expectedResponse: 'simulated-response',
    rationale: 'This fictional exercise uses a low contact crossing the protected zone. The exercise rubric expects a threat assessment and an abstract simulated response request.'
  } },
  { id: 'surveillance', definition: {
    briefing: { code: 'EX 02', title: 'Surveillance and loiter', description: 'Monitor the surrounding airspace. Sustained presence calls for a report based on behaviour, even when no boundary is crossed.', objectives: ['Find an elevated contact.', 'Track repeated passes rather than a single glimpse.', 'Distinguish suspicious observation from a direct incursion.'] },
    duration: 120, expectedClassification: 'concern', expectedResponse: 'report',
    rationale: 'The contact circles outside the protected zone. The exercise rubric expects concern and escalation/reporting; its shape alone does not establish hostile intent.'
  } },
  { id: 'penetration', definition: {
    briefing: { code: 'EX 03', title: 'Perimeter penetration', description: 'Maintain an airspace watch across the perimeter. Update your assessment when the observed behaviour changes.', objectives: ['Acquire a moving contact before it crosses the post.', 'Recognise a change in direction and height.', 'Submit a classification and response promptly.'] },
    duration: 80, expectedClassification: 'threat', expectedResponse: 'simulated-response',
    rationale: 'The fictional contact turns toward and crosses the protected zone. The rubric expects a threat assessment and an abstract simulated response request.'
  } },
  { id: 'swarm', definition: {
    briefing: { code: 'EX 04', title: 'Coordinated multi-contact incursion', description: 'Watch a wide sector and continue scanning after your first detection. Report each contact separately.', objectives: ['Detect more than one aerial contact.', 'Maintain separate contact reports.', 'Assess simultaneous approaches without losing coverage.'] },
    duration: 100, expectedClassification: 'threat', expectedResponse: 'simulated-response',
    rationale: 'Four authored contacts approach in two staggered pairs and cross the protected zone. The rubric expects individual reports, threat assessments and abstract simulated response requests.'
  } },
];

// Sensor-led assessment situations. The four older outdoor exercises above remain
// intact for familiarisation and regression checks.
export const sensorScenarios: { id: TrainingScenarioId; definition: TrainingDefinition }[] = [
  { id: 'mixed', definition: {
    briefing: { code: 'TR 05', title: 'Track prioritisation', description: 'Several tracks may appear. Investigate each before deciding how to prioritize.', objectives: ['Maintain separate assessments.', 'Compare authorization and behaviour.', 'Revise decisions as evidence arrives.'] },
    duration: 115, expectedClassification: 'unknown', expectedResponse: 'information',
    rationale: 'Two independent UAVs have different fictional authorization and risk profiles. Assess each contact using its own evidence.'
  } },
  { id: 'ambiguous', definition: {
    briefing: { code: 'TR 02', title: 'Uncertain activity', description: 'Investigate intermittent airspace returns. Compare sensor evidence before assessing what is present.', objectives: ['Acknowledge a neutral return.', 'Check evidence quality and availability.', 'Avoid unsupported escalation.'] },
    duration: 95, expectedClassification: 'benign', expectedResponse: 'information',
    rationale: 'This authored case uses a sensor-only false return. The trainee should preserve uncertainty until the delayed evidence resolves it.'
  } },
  { id: 'friendly', definition: {
    briefing: { code: 'TR 03', title: 'Authorization review', description: 'Investigate a track near the post and verify its authorization before selecting a response.', objectives: ['Compare radar with EO and roster evidence.', 'Separate object type from affiliation.', 'Choose proportionate action.'] },
    duration: 105, expectedClassification: 'benign', expectedResponse: 'observe',
    rationale: 'The UAV has a fictional matching authorization record and poses low concern in this exercise.'
  } },
  { id: 'coordinated', definition: {
    briefing: { code: 'TR 04', title: 'Multiple returns', description: 'Several returns may appear. Investigate their relationship, assess urgency, and use high-level command actions.', objectives: ['Recognize related tracks.', 'Compare movement evidence.', 'Escalate only through the authorized command path.'] },
    duration: 115, expectedClassification: 'threat', expectedResponse: 'simulated-response',
    rationale: 'The authored contacts approach together. The exercise tests group-level coordination and authorized escalation.'
  } },
];

function routeAboveTerrain(map: EnvironmentConfig, points: Vec3[]): Vec3[] {
  // Densify authored segments for terrain clearance on every existing map.
  // Heights are metres above ground; this is a training animation, not flight physics.
  const result: Vec3[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const divisions = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 4));
    for (let j = i === 1 ? 0 : 1; j <= divisions; j++) {
      const t = j / divisions, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      const ground=terrainHeight(x,z,map.terrain);
      const roofs=map.placements.filter(p=>Math.abs(x-p.position.x)<=p.size.x/2+3 && Math.abs(z-p.position.z)<=p.size.z/2+3).map(p=>terrainHeight(p.position.x,p.position.z,map.terrain)+p.position.y+p.size.y+8);
      result.push({ x, z, y: Math.max(ground + Math.max(8,a.y + (b.y - a.y) * t),...roofs) });
    }
  }
  return result;
}

/** Seed jitter so each contact ingresses from a slightly different bearing and lane. */
function transitJitter(seed: number, key: string, spread: number): number {
  let hash = seed ^ 0x9e3779b9;
  for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  hash ^= hash << 13; hash ^= hash >>> 17; hash ^= hash << 5;
  return (((hash >>> 0) / 4294967295) * 2 - 1) * spread;
}

/**
 * Directed UAV transit through the post's operation area (see OPERATION_RADIUS).
 * The contact spawns on the ingress edge of the 700 m ring at a specific point,
 * flies a straight or parabolic profile across the observation sector, and
 * despawns on the far side of the ring - the radar view window is therefore
 * bounded and the trainee must observe and report inside it.
 */
export function transitRoute(options: {
  seed: number; key: string; directionDeg: number; laneOffset: number;
  entryRadius?: number; baseY: number; profile: 'straight' | 'parabolic'; lift?: number;
}): Vec3[] {
  const entryRadius = options.entryRadius ?? 690;
  const direction = (options.directionDeg + transitJitter(options.seed, `${options.key}:heading`, 9)) * Math.PI / 180;
  const lane = options.laneOffset + transitJitter(options.seed, `${options.key}:lane`, 22);
  // Direction unit vector (heading uses atan2-based dx/dz in this sim) and its left-hand normal.
  const ux = Math.sin(direction), uz = Math.cos(direction);
  const nx = -uz, nz = ux;
  const centre = { x: nx * lane, z: nz * lane };
  const entry = { x: centre.x - ux * entryRadius, z: centre.z - uz * entryRadius };
  const exit = { x: centre.x + ux * entryRadius, z: centre.z + uz * entryRadius };
  const yAt = (t: number) => options.profile === 'straight'
    ? options.baseY + (options.lift ?? 0) * t
    : options.baseY + (options.lift ?? 14) * Math.sin(Math.PI * t);
  return [0, 0.25, 0.5, 0.75, 1].map(t => ({
    x: entry.x + (exit.x - entry.x) * t,
    y: yAt(t),
    z: entry.z + (exit.z - entry.z) * t,
  }));
}

export function createTrainingScenario(map: EnvironmentConfig, id: TrainingScenarioId, options: {swarmCount?:number;pairDelay?:number;seed?:number} = {}): ScenarioConfig {
  const selected = [...trainingScenarios,...sensorScenarios].find(s => s.id === id)!;
  const points = (values: number[][]): Vec3[] => values.map(([x,y,z]) => ({x,y,z}));
  const seed=options.seed??26052;
  const entity = (number: number, assetId: string, speed: number, spawnTime: number, route: Vec3[]): ScenarioEntity => {
    const hash=(Math.imul(seed ^ Math.imul(number,7919),1664525)+1013904223)>>>0;
    const dx=seed===26052?0:((hash&65535)/65535-.5)*30,dz=seed===26052?0:((hash>>>16)/65535-.5)*30;
    return { id: `aerial-${String(number).padStart(2,'0')}`, assetId, speed, spawnTime, route: routeAboveTerrain(map,route.map(point=>({...point,x:point.x+dx,z:point.z+dz}))) };
  };
  let entities: ScenarioEntity[];
  if (id === 'low-ingress') {
    entities = [entity(1,'sketchfab-fpv',7,0,points([[-150,12,150],[-95,11,110],[-45,10,80],[0,12,35],[55,16,50],[145,21,140]]))];
  } else if (id === 'ambiguous') {
    entities = [];
  } else if (id === 'mixed') {
    // TR 05: two independent transit profiles from different ingress directions.
    // Contact 1 crosses high and straight; contact 2 ingresses on a parabolic climb.
    const transit = (number: number, assetId: string, options: { spawnTime: number; speed: number; directionDeg: number; laneOffset: number; baseY: number; profile: 'straight' | 'parabolic'; lift?: number }) =>
      ({ id: `aerial-${String(number).padStart(2,'0')}`, assetId, spawnTime: options.spawnTime, speed: options.speed,
        route: routeAboveTerrain(map, transitRoute({ seed, key: `${id}-${number}`, ...options })) });
    entities = [
      transit(1, 'sketchfab-orlan', { spawnTime: 0, speed: 17.5, directionDeg: 130, laneOffset: 175, baseY: 55, profile: 'straight' }),
      transit(2, 'sketchfab-fpv', { spawnTime: 3, speed: 18.5, directionDeg: 310, laneOffset: -150, baseY: 38, profile: 'parabolic', lift: 18 }),
    ];
  } else if (id === 'friendly') {
    // TR 03: one straight, level transit approaching from the northwest.
    entities = [{ id: 'aerial-01', assetId: 'sketchfab-orlan', spawnTime: 0, speed: 20,
      route: routeAboveTerrain(map, transitRoute({ seed, key: `${id}-1`, directionDeg: 80, laneOffset: 165, baseY: 52, profile: 'straight' })) }];
  } else if (id === 'coordinated') {
    // TR 04: two staggered pairs share a matched ingress direction and timing.
    const pairs = [-1, 1].map(laneSign => laneSign * 30);
    const speeds = [17.5, 18.5];
    entities = pairs.flatMap((laneOffset, pairIndex) => [0, 1].map(step => {
      const number = pairIndex * 2 + step + 1;
      return { id: `aerial-${String(number).padStart(2,'0')}`, assetId: 'sketchfab-geran',
        spawnTime: pairIndex * 4, speed: speeds[pairIndex],
        route: routeAboveTerrain(map, transitRoute({ seed, key: `${id}-${number}`, directionDeg: 245, laneOffset, baseY: 30, profile: 'straight' })) };
    }));
  } else if (id === 'surveillance') {
    const orbit = Array.from({length:25},(_,i) => { const angle = Math.PI + i * Math.PI / 6; return {x: 100*Math.cos(angle), y: 65, z: 165 + 65*Math.sin(angle)}; });
    entities = [entity(1,'sketchfab-orlan',13,0,[{x:-195,y:65,z:165},...orbit,{x:-200,y:70,z:165}])];
  } else if (id === 'penetration') {
    entities = [entity(1,'sketchfab-lancet',12,0,points([[165,50,185],[100,45,135],[45,38,85],[5,25,25],[-30,22,-25],[-140,35,-100]]))];
  } else {
    entities = Array.from({length:options.swarmCount??4},(_,i) => {
      const side = i % 2 === 0 ? -1 : 1, offset = Math.floor(i / 2) * 28;
      return entity(i+1,'sketchfab-geran',10,Math.floor(i/2)*(options.pairDelay??4),points([[side*175,55+offset*.2,185+offset],[side*105,46,125+offset],[side*32,32,42],[side*12,28,-15],[side*130,40,-135-offset]]));
    });
  }
  const routeEnd = entities.length ? Math.max(...entities.map(e => e.spawnTime + e.route.slice(1).reduce((distance,p,i) => distance + Math.hypot(p.x-e.route[i].x,p.y-e.route[i].y,p.z-e.route[i].z),0) / e.speed)) : 0;
  return { id: `${map.id}-${id}`, seed, quietPeriod:25, conditions:{timeOfDay:id==='ambiguous'||id==='coordinated'?'night':'day',visibility:id==='ambiguous'||id==='coordinated'?'reduced':'clear'}, entities,
    training: {...selected.definition,briefing:structuredClone(selected.definition.briefing),duration:Math.max(selected.definition.duration,Math.ceil(routeEnd)+8)} };
}
