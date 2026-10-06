import type { GeographicPosition, PostDefinition } from './types';
import { localToGeographic } from '../simulation/geographic';

export const posts: PostDefinition[] = [
  {id:'shakti-punjab',name:'Shakti',callsign:'POST 01',region:'Attari · Amritsar',state:'Punjab',terrain:'Agricultural plains',origin:[74.60,31.60],heading:0,altitudeDatum:'EGM2008',environmentId:'rural-post-07',extentMeters:6000,sourceUrl:'https://amritsar.nic.in/tourist-place/wagah-border/',provenance:'Copernicus regional elevation and Sentinel-2 imagery. Rounded anchor and fictional graded compound; not a surveyed operational post.'},
  {id:'maru-rajasthan',name:'Maru',callsign:'POST 02',region:'Tanot · Jaisalmer',state:'Rajasthan',terrain:'Arid desert',origin:[70.40,27.80],heading:0,altitudeDatum:'EGM2008',environmentId:'rocky-valley',extentMeters:6000,sourceUrl:'https://www.incredibleindia.gov.in/en/rajasthan/jaisalmer/tanot-mata-temple',provenance:'Copernicus regional elevation and Sentinel-2 imagery. Rounded anchor and fictional graded compound; not a surveyed operational post.'},
  {id:'himadri-sikkim',name:'Himadri',callsign:'POST 03',region:'Nathu La region',state:'Sikkim',terrain:'Mountain pass',origin:[88.80,27.40],heading:0,altitudeDatum:'EGM2008',environmentId:'mountain-pass',extentMeters:6000,sourceUrl:'https://www.sikkim.gov.in/departments/tourism-civil-aviation-department/where-to-go',provenance:'Copernicus regional elevation and Sentinel-2 imagery. Rounded anchor and fictional graded compound; not a surveyed operational post.'},
];
export const postById = (id: string) => posts.find(post => post.id === id) ?? posts[0];
// Shared WGS84 tangent frame used by the imported terrain and dashboard.
export function offsetPosition(origin: GeographicPosition, east: number, north: number): GeographicPosition {
  return localToGeographic({x:east,z:north},origin);
}
