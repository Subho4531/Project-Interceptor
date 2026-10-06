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

export function createTrainingScenario(map: EnvironmentConfig, id: TrainingScenarioId, options: {swarmCount?:number;pairDelay?:number} = {}): ScenarioConfig {
  const selected = trainingScenarios.find(s => s.id === id)!;
  const points = (values: number[][]): Vec3[] => values.map(([x,y,z]) => ({x,y,z}));
  const entity = (number: number, assetId: string, speed: number, spawnTime: number, route: Vec3[]): ScenarioEntity => ({ id: `aerial-${String(number).padStart(2,'0')}`, assetId, speed, spawnTime, route: routeAboveTerrain(map,route) });
  let entities: ScenarioEntity[];
  if (id === 'low-ingress') {
    entities = [entity(1,'sketchfab-fpv',7,0,points([[-150,12,150],[-95,11,110],[-45,10,80],[0,12,35],[55,16,50],[145,21,140]]))];
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
  const routeEnd = Math.max(...entities.map(e => e.spawnTime + e.route.slice(1).reduce((distance,p,i) => distance + Math.hypot(p.x-e.route[i].x,p.y-e.route[i].y,p.z-e.route[i].z),0) / e.speed));
  return { id: `${map.id}-${id}`, seed:26052, quietPeriod:25, conditions:{timeOfDay:'day',visibility:'clear'}, entities,
    training: {...selected.definition,briefing:structuredClone(selected.definition.briefing),duration:Math.max(selected.definition.duration,Math.ceil(routeEnd)+8)} };
}
