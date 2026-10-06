"""Restore source opacity omitted by the Poly Haven JPEG glTF export.

Produces RGBA PNG from genuine CC0 diffuse and alpha source channels, no inferred masks.
"""
from pathlib import Path
import json, hashlib, sys
import requests
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parent.parent
ITEMS=[
    ('fence','assets-source/compound/fence/source-files.json','assets-source/compound/fence','wire_diff','wire_alpha'),
    ('tree','tools/tree_small_02-files.json','assets-source/environment/tree','leaves_diff','leaves_alpha'),
    ('shrub','tools/shrub_03-files.json','assets-source/environment/shrub','Diffuse','Alpha'),
]
for name,manifest,folder,diffuse,opacity in ITEMS:
    if len(sys.argv)>1 and name not in sys.argv[1:]: continue
    data=json.loads((ROOT/manifest).read_text(encoding='utf8'));folder=ROOT/folder
    records=[];inputs=[]
    for channel in [diffuse,opacity]:
        info=data[channel]['1k']['png'];dest=folder/('source-'+channel.lower()+'.png')
        if not dest.exists() or hashlib.md5(dest.read_bytes()).hexdigest()!=info['md5']:
            r=requests.get(info['url'],timeout=60);r.raise_for_status()
            if hashlib.md5(r.content).hexdigest()!=info['md5']:raise RuntimeError('Source checksum mismatch')
            dest.write_bytes(r.content)
        inputs.append(dest);records.append({'channel':channel,'sourceUrl':info['url'],'md5':info['md5'],'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'license':'CC0-1.0'})
    rgb=Image.open(inputs[0]).convert('RGB');alpha=Image.open(inputs[1]).convert('L')
    if rgb.size!=alpha.size: raise RuntimeError('Source opacity dimensions differ')
    rgba=rgb.convert('RGBA');rgba.putalpha(alpha);out=folder/'source-diffuse-rgba.png';rgba.save(out)
    values=np.array(alpha);stats={'transparentFraction':float((values<102).mean()),'solidFraction':float((values>=102).mean()),'minAlpha':int(values.min()),'maxAlpha':int(values.max())}
    if stats['minAlpha']==stats['maxAlpha']:raise RuntimeError('No source cutout opacity')
    (folder/'alpha-provenance.json').write_text(json.dumps({'sourceChannels':records,'modification':'Packed original source opacity into diffuse PNG alpha; material MASK cutoff0.4','outputSha256':hashlib.sha256(out.read_bytes()).hexdigest(),'outputFile':'source-diffuse-rgba.png','statistics':stats},indent=2),encoding='utf8')
    print(name,stats,flush=True)
