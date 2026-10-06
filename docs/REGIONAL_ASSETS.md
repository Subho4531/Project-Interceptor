# Phase 3 regional assets

These are imported, georeferenced source-data worlds. The compounds and exercise routes are fictional. They do not represent surveyed border installations.

| Post | WGS84 longitude / latitude | Sentinel-2 frozen scene | Center elevation, EGM2008 |
|---|---|---|---|
| Shakti / Attari region | 74.60 / 31.60 | `S2A_T43RDQ_20241013T054552_L2A` | 222.836 m |
| Maru / Tanot region | 70.40 / 27.80 | `S2B_T42RXR_20250323T061051_L2A` | 96.337 m |
| Himadri / Nathu La region | 88.80 / 27.40 | `S2B_T45RXL_20230109T044620_L2A` | 4426.893 m |

Each 6 × 6 km footprint uses Copernicus GLO-30 public surface elevations and Sentinel-2 Collection 1 Level-2A true-colour imagery. Files were obtained anonymously from the public Copernicus/Sentinel AWS datasets through source COG byte ranges. Source metadata, cropped GeoTIFFs and SHA-256 hashes are retained under `assets-source/regions/<postId>`. No basemap tiles were scraped.

Copernicus is a **surface model**, including vegetation/infrastructure. Its nominal source spacing is 30 m; resampling to a 20 m runtime mesh does not increase survey accuracy. Its published absolute horizontal/vertical accuracy differs from the internal mesh/map alignment checks. See [official dataset specifications and licence notice](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM). Sentinel imagery has native 10 m pixels, resampled into 1024 × 1024 browser imagery. Snow, shadows and source acquisition lighting remain visible. Night simulation changes lighting; it does not replace optical imagery with nighttime data.

## Rebuild

Create a Python virtual environment, then install `rasterio numpy pillow pyproj requests` from PyPI. Run:

```powershell
.cache/regions-venv/Scripts/python.exe tools/prepare-regions.py
node tools/prepare-compound.mjs
node tools/verify-regions.mjs
```

`prepare-regions.py <postId>` rebuilds one region. Cached selected scenes remain frozen on subsequent runs. Initial selection searches 2023–2025 scenes with tile-level cloud cover ≤20%, ordered by lowest cloud cover then newest date, and evaluates the source SCL on the actual training footprint. Classes 0/1/3/8/9/10 are masked. All selected footprints have 0% masked samples; snow is retained. A missing/unacceptable source fails explicitly.

The pipeline interpolates source data offline; it does not synthesize relief. A documented fictional 120 × 140 m platform is graded at the origin, with a 60 m smooth transition into the original terrain. This is particularly significant in Himadri; it must not be interpreted as a real compound or site engineering design.

## Browser contract

`public/assets/regions/<postId>/` contains `terrain.glb`, `imagery.jpg`, `heightfield.json`, `metadata.json`, and `provenance.json`. The GLB embeds the same locally hosted imagery. Metadata includes source scene/date, source URLs, hashes, licence links, modifications, origin elevation and NW/NE/SE/SW geographic corners.

Positions are metres in **x east, y up, z north**, with geographic heading zero. Source elevations are offset by the sampled center elevation; AGL is measured above the imported heightfield. Vertical datum is EGM2008, not an ellipsoidal GPS altitude. Horizontal geographic transforms use the WGS84 zero-altitude ECEF tangent frame.

The heightfield has 301 × 301 samples, `spacing:20`, `size:6000`, `minX:-3000`, `minZ:-3000`. Its flat array is ordered by increasing z row, then increasing x column. `width`/`height` and `columns`/`rows` are sample counts. Triangle interpolation uses diagonal `u+v=1`, matching the imported GLB exactly. Image row zero is north; northwest UV is `(0,0)`.

**Babylon import:** remove the glTF loader's left-handed root conversion for these terrain GLBs only. They already contain runtime coordinates (`gltfImportRootIdentity:true`). Retain normal loader conversion for ordinary drone and compound assets. Terrain material is double-sided. Otherwise east/west mirrors despite correct geographic metadata.

`verify-regions.mjs` checks all baked positions against collision data, triangle topology, UV orientation, platform grading, geographic corners and imagery selection. Results are recorded in `artifacts/extraction/regional-validation.json`: corner agreement <1 mm, mesh heights <0.031 mm. These are internal consistency results, not source-data survey accuracy or a measured browser FPS claim.

## Imported compound kit

- **Security Booth / Cabina de seguridad**, claudio (@Claudio12345), [Sketchfab source](https://sketchfab.com/3d-models/security-booth-cabina-de-seguridad-b15e6647ee434bcea57b2d965d3a1b30), CC BY 4.0. Downloaded through the user's authenticated Chrome UI in GLB/1k format. Source includes the booth and checkpoint boom. Browser model is bottom-centred and uniformly normalized to 8 m total assembly width; height 3.516 m, depth 3.065 m. File 9.84 MB. This is an authored training scale.
- **Modular chain-link fence**, [Poly Haven](https://polyhaven.com/a/modular_chainlink_fence), CC0. Two imported wire modules and three imported posts are assembled offline into a repeatable 4 m panel; height 2.432 m, depth 0.144 m. File 4.17 MB. Unused exploded-kit components are pruned; source PBR materials remain.
- **Concrete road barrier**, [Poly Haven](https://polyhaven.com/a/concrete_road_barrier), CC0. Bottom-centred, authored width 3 m, height 1.613 m, depth 1.24 m. File 2.54 MB.

The official Copernicus GLO-30 free/open licence PDF and Sentinel legal notice PDF are archived with SHA-256 hashes under `assets-source/regions/licenses` and included in the static build under `public/assets/regions/licenses`.

Raw compound sources and provenance remain under `assets-source/compound`. Browser models, licence notices and provenance are under `public/assets/environment`. No generated primitive substitutes were introduced by this importer.

## Required notices

Terrain derivative notice: produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved.

Imagery: Contains modified Copernicus Sentinel data 2024 (Shakti), 2025 (Maru), and 2023 (Himadri). See the [Sentinel data legal notice](https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice).

Security booth: Security Booth / Cabina de seguridad by claudio, CC BY 4.0. Modified by centering, authored metre scaling and glTF Transform deduplication/welding/pruning. Retain its adjacent licence and provenance files when distributing the build. Poly Haven assets are CC0; source attribution is retained for traceability.
