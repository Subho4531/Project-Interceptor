export function appBase(pathname:string):string {
  if(/\/aar\/[^/]+\/?$/.test(pathname)) return pathname.replace(/\/aar\/[^/]+\/?$/,'/');
  if(/\/(dashboard|trainer|observer|progress|room)\/?$/.test(pathname)) return pathname.replace(/\/(dashboard|trainer|observer|progress|room)\/?$/,'/');
  return pathname.endsWith('/')?pathname:pathname.slice(0,pathname.lastIndexOf('/')+1);
}
export const appLink=(route:'dashboard'|'trainer'|'observer'|'progress'|'room')=>`${appBase(location.pathname)}${route}${new URLSearchParams(location.search).has('qa')?'?qa=1':''}`;
export const assetUrl=(path:string)=>new URL(path.replace(/^\.\//,''),document.baseURI).href;
