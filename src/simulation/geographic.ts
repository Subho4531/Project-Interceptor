import type { Vec3 } from './types';
type Geographic = [longitude: number, latitude: number];
const A=6378137, E2=6.6943799901413165e-3, DEG=Math.PI/180;
function cartesian(point: Geographic, altitude=0): Vec3 {
  const lon=point[0]*DEG,lat=point[1]*DEG,n=A/Math.sqrt(1-E2*Math.sin(lat)**2);
  return {x:(n+altitude)*Math.cos(lat)*Math.cos(lon),y:(n+altitude)*Math.cos(lat)*Math.sin(lon),z:(n*(1-E2)+altitude)*Math.sin(lat)};
}
export function geographicToLocal(point: Geographic, origin: Geographic, heading=0): Vec3 {
  const p=cartesian(point),o=cartesian(origin),dx=p.x-o.x,dy=p.y-o.y,dz=p.z-o.z,lon=origin[0]*DEG,lat=origin[1]*DEG;
  const east=-Math.sin(lon)*dx+Math.cos(lon)*dy,north=-Math.sin(lat)*Math.cos(lon)*dx-Math.sin(lat)*Math.sin(lon)*dy+Math.cos(lat)*dz;
  return {x:east*Math.cos(heading)-north*Math.sin(heading),y:Math.cos(lat)*Math.cos(lon)*dx+Math.cos(lat)*Math.sin(lon)*dy+Math.sin(lat)*dz,z:east*Math.sin(heading)+north*Math.cos(heading)};
}
export function localToGeographic(point: Pick<Vec3,'x'|'z'>, origin: Geographic, heading=0): Geographic {
  const east=point.x*Math.cos(heading)+point.z*Math.sin(heading),north=-point.x*Math.sin(heading)+point.z*Math.cos(heading),o=cartesian(origin),lon=origin[0]*DEG,lat=origin[1]*DEG;
  const x=o.x-Math.sin(lon)*east-Math.sin(lat)*Math.cos(lon)*north,y=o.y+Math.cos(lon)*east-Math.sin(lat)*Math.sin(lon)*north,z=o.z+Math.cos(lat)*north;
  const rho=Math.hypot(x,y);let phi=Math.atan2(z,rho*(1-E2));
  for(let i=0;i<8;i++){const n=A/Math.sqrt(1-E2*Math.sin(phi)**2);phi=Math.atan2(z+E2*n*Math.sin(phi),rho);}
  return [Math.atan2(y,x)/DEG,phi/DEG];
}
