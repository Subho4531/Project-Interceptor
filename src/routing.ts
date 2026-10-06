export function appBase(pathname:string):string {
  if(/\/(dashboard|trainer)\/?$/.test(pathname)) return pathname.replace(/\/(dashboard|trainer)\/?$/,'/');
  return pathname.endsWith('/')?pathname:pathname.slice(0,pathname.lastIndexOf('/')+1);
}
export const appLink=(route:'dashboard'|'trainer')=>`${appBase(location.pathname)}${route}${new URLSearchParams(location.search).has('qa')?'?qa=1':''}`;
export const assetUrl=(path:string)=>new URL(path.replace(/^\.\//,''),document.baseURI).href;
