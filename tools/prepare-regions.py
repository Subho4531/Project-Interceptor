"""Offline source-data importer. Requires rasterio, numpy, Pillow, pyproj, requests.

Run with .cache/regions-venv/Scripts/python.exe tools/prepare-regions.py.
Remote COG byte ranges are cropped and frozen locally. Runtime never generates terrain.
"""
from pathlib import Path
import json, hashlib, struct, math, os, shutil
import numpy as np
import requests
import rasterio
from rasterio.windows import from_bounds
from rasterio.enums import Resampling
from pyproj import Transformer
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
POSTS = [('shakti-punjab', 74.60, 31.60), ('maru-rajasthan', 70.40, 27.80), ('himadri-sikkim', 88.80, 27.40)]
SIZE, SPACING, PIXELS = 6000, 20, 1024
SEARCH = 'https://earth-search.aws.element84.com/v1/search'
DEM_LICENSE = 'https://docs.sentinel-hub.com/api/latest/static/files/data/dem/resources/license/License-COPDEM-30.pdf'
SENTINEL_LICENSE = 'https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice'
os.environ.update(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif', GDAL_HTTP_TIMEOUT='60', GDAL_HTTP_MAX_RETRY='3')

def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def dump(p, obj): p.write_text(json.dumps(obj, separators=(',', ':')), encoding='utf8')

def prepare_licenses():
    source=ROOT/'assets-source/regions/licenses';out=ROOT/'public/assets/regions/licenses'
    source.mkdir(parents=True,exist_ok=True);out.mkdir(parents=True,exist_ok=True)
    records=[]
    for name,url in [('License-COPDEM-30.pdf',DEM_LICENSE),('Sentinel_Data_Legal_Notice.pdf',SENTINEL_LICENSE)]:
        p=source/name
        if not p.exists():
            r=requests.get(url,timeout=60);r.raise_for_status();p.write_bytes(r.content)
        if p.read_bytes()[:4]!=b'%PDF': raise RuntimeError('Licence archive is not PDF: '+name)
        shutil.copyfile(p,out/name)
        records.append({'file':name,'sourceUrl':url,'sha256':digest(p),'bytes':p.stat().st_size})
    dump(source/'manifest.json',records);dump(out/'manifest.json',records)

def coordinates(lon, lat, x, z):
    # Exact inverse of WGS84 ECEF -> east/north/up, with local up=0.
    fwd = Transformer.from_crs(4979, 4978, always_xy=True)
    inv = Transformer.from_crs(4978, 4979, always_xy=True)
    origin = np.array(fwd.transform(lon, lat, 0))
    lo, la = np.radians([lon, lat])
    e = np.array([-np.sin(lo), np.cos(lo), 0])
    n = np.array([-np.sin(la)*np.cos(lo), -np.sin(la)*np.sin(lo), np.cos(la)])
    xyz = origin[:, None] + e[:, None]*np.asarray(x).ravel() + n[:, None]*np.asarray(z).ravel()
    ll = inv.transform(*xyz)
    return np.array(ll[0]).reshape(np.shape(x)), np.array(ll[1]).reshape(np.shape(z))

def crop(url, lon, lat, output):
    if output.exists(): return output
    with rasterio.open(url) as src:
        project = Transformer.from_crs(4326, src.crs, always_xy=True)
        px, py = project.transform(lon, lat)
        padding = max(abs(src.transform.a), abs(src.transform.e))*3
        win = from_bounds(float(px.min())-padding, float(py.min())-padding, float(px.max())+padding, float(py.max())+padding, src.transform).round_offsets().round_lengths()
        data = src.read(window=win)
        profile = src.profile.copy()
        profile.update(width=data.shape[2], height=data.shape[1], transform=src.window_transform(win), compress='deflate', tiled=False)
        # Source block dimensions cannot exceed the regional crop.
        profile.pop('blockxsize', None); profile.pop('blockysize', None)
        with rasterio.open(output, 'w', **profile) as dst: dst.write(data)
    return output

def sample(path, lon, lat, nearest=False):
    with rasterio.open(path) as ds:
        project = Transformer.from_crs(4326, ds.crs, always_xy=True)
        x, y = project.transform(lon, lat)
        col = (x-ds.transform.c)/ds.transform.a-.5
        row = (y-ds.transform.f)/ds.transform.e-.5
        data = ds.read()
        if nearest:
            return data[:, np.clip(np.rint(row).astype(int), 0, ds.height-1), np.clip(np.rint(col).astype(int), 0, ds.width-1)]
        c0 = np.floor(col).astype(int); r0 = np.floor(row).astype(int)
        u = col-c0; v=row-r0
        c0=np.clip(c0,0,ds.width-2); r0=np.clip(r0,0,ds.height-2)
        return (data[:,r0,c0]*(1-u)*(1-v) + data[:,r0,c0+1]*u*(1-v) + data[:,r0+1,c0]*(1-u)*v + data[:,r0+1,c0+1]*u*v)

def glb(path, heights, image):
    rows, cols = heights.shape
    zz, xx = np.meshgrid(np.linspace(-3000,3000,rows), np.linspace(-3000,3000,cols), indexing='ij')
    position=np.stack([xx, heights, zz],axis=-1).reshape(-1,3).astype('<f4')
    # glTF uses +Y up; source z points north. The material is double-sided.
    dz, dx = np.gradient(heights, SPACING, SPACING)
    normal=np.stack([-dx,np.ones_like(dx),-dz],axis=-1).reshape(-1,3)
    normal=(normal/np.linalg.norm(normal,axis=1)[:,None]).astype('<f4')
    uv=np.stack([(xx+3000)/6000, (3000-zz)/6000],axis=-1).reshape(-1,2).astype('<f4')
    a=np.arange(rows*cols).reshape(rows,cols)[:-1,:-1].ravel()
    b=a+1;c=a+cols;d=c+1
    # diagonal a=d? a,b,c / d,c,b matches TerrainSurface interpolation.
    indices=np.stack([a,c,b,d,b,c],axis=-1).ravel().astype('<u4')
    chunks=[position.tobytes(),normal.tobytes(),uv.tobytes(),indices.tobytes(),image.read_bytes()]
    views=[]; binary=b''
    for i, chunk in enumerate(chunks):
        binary += b'\0'*((-len(binary))%4)
        views.append({'buffer':0,'byteOffset':len(binary),'byteLength':len(chunk), **({'target':34963 if i==3 else 34962} if i<4 else {})})
        binary += chunk
    accessors=[]
    for i, (arr,typ,comp) in enumerate([(position,'VEC3',5126),(normal,'VEC3',5126),(uv,'VEC2',5126),(indices,'SCALAR',5125)]):
        acc={'bufferView':i,'componentType':comp,'count':len(arr),'type':typ}
        if i==0: acc.update(min=arr.min(axis=0).tolist(),max=arr.max(axis=0).tolist())
        accessors.append(acc)
    doc={'asset':{'version':'2.0','generator':'Project Interceptor offline Copernicus importer'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'name':'ImportedRegionalTerrain','mesh':0}], 'meshes':[{'primitives':[{'attributes':{'POSITION':0,'NORMAL':1,'TEXCOORD_0':2},'indices':3,'material':0}]}], 'materials':[{'name':'Sentinel2RegionalSurface','doubleSided':True,'pbrMetallicRoughness':{'baseColorTexture':{'index':0},'metallicFactor':0,'roughnessFactor':1}}], 'textures':[{'source':0}], 'images':[{'bufferView':4,'mimeType':'image/jpeg'}], 'buffers':[{'byteLength':len(binary)}],'bufferViews':views,'accessors':accessors}
    header=json.dumps(doc,separators=(',',':')).encode();header+=b' '*((-len(header))%4);binary+=b'\0'*((-len(binary))%4)
    path.write_bytes(struct.pack('<III',0x46546c67,2,12+8+len(header)+8+len(binary))+struct.pack('<II',len(header),0x4E4F534A)+header+struct.pack('<II',len(binary),0x004E4942)+binary)

def prepare(post, longitude, latitude):
    source=ROOT/'assets-source'/'regions'/post;out=ROOT/'public'/'assets'/'regions'/post
    source.mkdir(parents=True,exist_ok=True);out.mkdir(parents=True,exist_ok=True)
    points=np.linspace(-3000,3000,SIZE//SPACING+1)
    x,z=np.meshgrid(points,points);lon,lat=coordinates(longitude,latitude,x,z)
    corners=coordinates(longitude,latitude,np.array([-3000,3000,3000,-3000]),np.array([3000,3000,-3000,-3000]))
    map_corners=np.stack(corners,axis=-1).tolist()
    bounds=[float(lon.min()),float(lat.min()),float(lon.max()),float(lat.max())]
    name=f'Copernicus_DSM_COG_10_N{int(latitude):02}_00_E{int(longitude):03}_00_DEM'
    demurl=f'https://copernicus-dem-30m.s3.amazonaws.com/{name}/{name}.tif'
    print(post,'DEM crop',flush=True)
    dem=crop(demurl,lon,lat,source/'dem-source-crop.tif')
    raw=sample(dem,lon,lat)[0]
    origin=float(sample(dem,np.array([longitude]),np.array([latitude]))[0,0])
    if not np.isfinite(raw).all() or np.any(raw < -500): raise RuntimeError('Invalid/missing elevation')
    heights=raw-origin
    # Documented fictional platform, smooth blend back to source relief.
    distance=np.maximum(np.maximum(np.abs(x)-60,0), np.maximum(np.abs(z)-70,0))
    blend=np.clip(distance/60,0,1);blend=blend*blend*(3-2*blend)
    heights=np.round(heights*blend,3)
    candidates=source/'candidates.json';selected=source/'selected-scene.json'
    if not candidates.exists():
        payload={'collections':['sentinel-2-c1-l2a'],'bbox':bounds,'datetime':'2023-01-01T00:00:00Z/2025-12-31T23:59:59Z','query':{'eo:cloud_cover':{'lte':20}},'limit':20,'sortby':[{'field':'properties.eo:cloud_cover','direction':'asc'},{'field':'properties.datetime','direction':'desc'}]}
        r=requests.post(SEARCH,json=payload,timeout=60);r.raise_for_status();dump(candidates,r.json())
    if selected.exists(): scene=json.loads(selected.read_text());sclfraction=scene['regionalMaskedFraction']
    else:
        scene=None
        for candidate in json.loads(candidates.read_text())['features']:
            print(post,'screen',candidate['id'],flush=True)
            try:
                sclpath=crop(candidate['assets']['scl']['href'],lon,lat,source/(candidate['id']+'-scl.tif'))
                scl=sample(sclpath,lon,lat,True)[0]
                masked=float(np.isin(scl,[0,1,3,8,9,10]).mean())
                if scene is None or masked < scene['regionalMaskedFraction']:
                    scene=candidate;scene['regionalMaskedFraction']=masked
                if masked <= .005: break
            except Exception as e: print('Candidate unavailable:',str(e)[:150],flush=True)
        if scene is None or scene['regionalMaskedFraction']>.20: raise RuntimeError('No acceptable regional cloud-screened scene')
        dump(selected,scene);sclfraction=scene['regionalMaskedFraction']
    print(post,'imagery',scene['id'],flush=True)
    visual=crop(scene['assets']['visual']['href'],lon,lat,source/'imagery-source-crop.tif')
    pixelpoints=(np.arange(PIXELS)+.5)*SIZE/PIXELS-3000
    ix,iz=np.meshgrid(pixelpoints,pixelpoints[::-1]); ilon,ilat=coordinates(longitude,latitude,ix,iz)
    rgb=np.moveaxis(np.clip(sample(visual,ilon,ilat),0,255).astype(np.uint8),0,-1)
    if (rgb.sum(axis=2)==0).mean()>.01: raise RuntimeError('Selected scene does not cover complete region')
    Image.fromarray(rgb).save(out/'imagery.jpg',quality=92)
    heightfield={'size':SIZE,'spacing':SPACING,'minX':-3000,'minZ':-3000,'width':len(points),'height':len(points),'columns':len(points),'rows':len(points),'heights':heights.ravel().tolist(),'originHeightEGM2008':origin,'origin':[longitude,latitude],'bounds':bounds,'mapCorners':map_corners,'verticalDatum':'EGM2008','sourceResolutionMeters':30,'imageResolutionMeters':10,'gltfImportRootIdentity':True,'axisConvention':'x east, y up, z north; heading 0','triangleDiagonal':'u+v=1','platform':{'halfWidth':60,'halfDepth':70,'blendMeters':60,'relativeHeight':0},'credits':['produced using Copernicus WorldDEM-30 \u00a9 DLR e.V. 2010-2014 and \u00a9 Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved','Contains modified Copernicus Sentinel data '+scene['properties']['datetime'][:4]]}
    dump(out/'heightfield.json',heightfield)
    glb(out/'terrain.glb',heights,out/'imagery.jpg')
    manifest={**{k:v for k,v in heightfield.items() if k!='heights'},'postId':post,'demSourceURL':demurl,'imagerySourceURL':scene['assets']['visual']['href'],'imagerySceneId':scene['id'],'imageryDate':scene['properties']['datetime'],'sceneCloudPercent':scene['properties']['eo:cloud_cover'],'regionalMaskedFraction':sclfraction,'modifications':['Reprojected into WGS84 local east/north frame; DEM bilinear interpolation onto 20m mesh','Fictional compound platform 120mx140m with 60m smooth transition; terrain height referenced to center','RGB true-colour image resampled to 1024x1024 JPEG; source imagery native10m','GLB contains baked mesh, normals, UVs and embedded regional imagery; no runtime generation'], 'licenses':[{'name':'Copernicus DEM license','url':DEM_LICENSE,'localUrl':'./assets/regions/licenses/License-COPDEM-30.pdf'},{'name':'Copernicus Sentinel data legal notice','url':SENTINEL_LICENSE,'localUrl':'./assets/regions/licenses/Sentinel_Data_Legal_Notice.pdf'}],'sourceCrops':[{ 'file':p.name,'sha256':digest(p),'bytes':p.stat().st_size} for p in [dem,visual]],'outputs':[{ 'file':p.name,'sha256':digest(p),'bytes':p.stat().st_size} for p in [out/'terrain.glb',out/'heightfield.json',out/'imagery.jpg']]}
    dump(source/'provenance.json',manifest);dump(out/'provenance.json',manifest);dump(out/'metadata.json',manifest)
    print(post,'complete', 'origin',round(origin,2),'range',round(float(heights.min()),1),round(float(heights.max()),1),flush=True)

if __name__=='__main__':
    import sys
    prepare_licenses()
    for item in POSTS:
        if len(sys.argv)==1 or sys.argv[1]==item[0]: prepare(*item)
