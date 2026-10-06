# 3D Asset Manifest & Specification (Project Interceptor)

> **Mandatory Rule**: All 3D meshes, terrain maps, and sky environments must be imported from validated PBR assets (GLB / glTF / HDR / PBR texture maps). Procedural placeholder primitives (cubes, cylinders) and procedural terrain generation are strictly prohibited.

---

## 1. Required Aerial Threat Assets

| Asset Name | Target Format | Nodes / Hierarchy Requirements | Recommended Sources |
|---|---|---|---|
| **Commercial / Tactical Quadcopter** | `.glb` / `.gltf` (PBR) | • Separate child nodes for all 4 rotor blades (`rotor_FL`, `rotor_FR`, `rotor_RL`, `rotor_RR`) for rotational animation<br>• Central gimbal camera node (`sensor_gimbal`)<br>• Status LED strobe material node | Sketchfab (CC-BY / Standard), Fab, CGTrader |
| **FPV Kamikaze / Munition Drone** (Phase 2) | `.glb` / `.gltf` (PBR) | • Streamlined racing frame with forward payload<br>• High-RPM 3-blade prop nodes | Sketchfab, Fab |

> **Sourced (MVP)**: `public/assets/models/quadcopter_threat.glb` — "Drone" quad-rotor + underside camera by NateGazzard, CC-BY via poly.pizza (`Rotor_FL/FR/BL/BR` pivot nodes, 0.57m wingspan). Attribution rendered in HUD credit line.
> **Sourced (overwatch)**: `public/assets/models/overwatch_predator.glb` — "Predator Drone" fixed-wing by sftwr314r8, CC-BY 3.0 via poly.pizza (1.77m, high-altitude circle). Attribution rendered in HUD credit line.

---

## 2. Required Tactical Compound Environment Assets

| Asset Category | Target Format | Specifications | Sources |
|---|---|---|---|
| **Terrain Mesh & Materials** | `.glb` mesh + 4K PBR textures | • 400m × 400m imported terrain elevation mesh<br>• PBR texture sets: packed gravel, dry earth, weathered asphalt (Albedo, Normal, Roughness, AO) | Poly Haven, ambientCG, Quixel Megascans |

> **Sourced (MVP)**: `public/assets/textures/satellite_compound_400m.jpg` — real satellite mosaic (ESRI World Imagery, Jodhpur outskirts 26.2295N 73.0567E, z18 4×4), draped as terrain albedo. Attribution rendered in HUD credit line.
| **Industrial Warehouse / Hangar** | `.glb` (PBR) | • Corrugated metal / concrete industrial structure ($30\text{m} \times 15\text{m} \times 8\text{m}$)<br>• Realistic metallic-roughness weathering | Poly Haven, Fab |
| **Perimeter Security Fence Kit** | `.glb` (PBR) | • Chain-link fence section with barbed-wire topper and metal posts ($3\text{m} \times 2.5\text{m}$ modular tile)<br>• Concrete blast wall barriers | Poly Haven, Sketchfab |
| **Observation Watchtower** | `.glb` (PBR) | • Elevated steel lattice watchtower with roof platform ($12\text{m}$ height) | Sketchfab, Fab |
| **Tactical Props & Obstacles** | `.glb` (PBR) | • Standard 20ft / 40ft ISO shipping containers (multiple weathered liveries)<br>• Concrete Jersey barriers, utility poles, perimeter lights | Poly Haven, ambientCG |
| **Vegetation Occluders** | `.glb` (PBR) | • Realistically textured pine/deciduous trees and scrub bushes for natural line-of-sight occlusion masks | Poly Haven |

---

## 3. Lighting & Environment Maps

| Map Type | Format | Specifications | Source |
|---|---|---|---|
| **Daytime Tactical Sky** | `.hdr` / `.exr` (Prefiltered cubemap) | Clean daytime clear/overcast sky with distinct sun directional vector for crisp PBR reflections | Poly Haven (`kloofendal_48d_partly_cloudy_4k.hdr`) |
| **Night Operations Sky** | `.hdr` / `.exr` (Prefiltered cubemap) | Moonlit night sky ($0.05\text{ lux}$ ambient) with subtle horizon glow | Poly Haven (`moonlit_golf_4k.hdr`) |

---

## 4. Audio Asset Requirements

| Audio Cue | Format | Specifications | Source |
|---|---|---|---|
| **Drone Motor / Propeller Loop** | `.wav` / `.mp3` | Seamless loop of high-RPM brushless motor and prop wash (spatialized 3D attenuation) | Freesound, Soniss GDC Archive |
| **Tactical Switch / Button Click** | `.wav` / `.mp3` | Tactile mechanical relay / military switch click | Soniss GDC Archive |
| **Subdued Alert Tone** | `.wav` / `.mp3` | Clean, low-distortion acoustic chime for modal engagement | Soniss GDC Archive |

---

## Phase 3 validated imported regional worlds (2026-10-06)

See [REGIONAL_ASSETS.md](REGIONAL_ASSETS.md) for the source pipeline, licences, fictional platform modification and geographic contract. Earlier scaffold paths in this document are historical requirements, not proof that those files exist.

| Runtime asset | Source / licence | Verified browser data |
|---|---|---|
| `assets/regions/shakti-punjab/terrain.glb` | Copernicus DEM GLO-30 + Sentinel-2 scene `S2A_T43RDQ_20241013T054552_L2A` | 6km footprint, 180,000 triangles, embedded locally hosted regional imagery |
| `assets/regions/maru-rajasthan/terrain.glb` | Copernicus DEM GLO-30 + Sentinel-2 scene `S2B_T42RXR_20250323T061051_L2A` | Same contract; real desert surface |
| `assets/regions/himadri-sikkim/terrain.glb` | Copernicus DEM GLO-30 + Sentinel-2 scene `S2B_T45RXL_20230109T044620_L2A` | Same contract; real mountain surface |
| `assets/environment/booth.glb` | Security Booth / Cabina de seguridad by claudio, Sketchfab, CC BY 4.0 | Source booth + checkpoint boom, normalized 8m wide, 1k source textures |
| `assets/environment/fence.glb` | Poly Haven modular_chainlink_fence, CC0 | Imported 4m assembled panel; 2.432m high; source PBR materials |
| `assets/environment/barrier.glb` | Poly Haven concrete_road_barrier, CC0 | Imported 3m barrier; source PBR materials |

All regional GLBs are generated **offline from imported elevation data**, not runtime procedural maps. Satellite images, metadata, collision heightfields and provenance are locally hosted alongside each GLB. Source 30m elevation and 10m optical imagery are not survey-grade compound data. Grading at each fictional compound is documented. Copernicus source and derivative notices are present in metadata and regional documentation. Compound adjacent `.LICENSE.txt` / `.provenance.json` files retain attribution and hashes.

Validation: `node tools/verify-regions.mjs`; result `artifacts/extraction/regional-validation.json`. Baked geometry matches the collision sampler; correct northwest texture orientation and geographic corners have <1mm internal horizontal disagreement. No browser-performance result is implied by this asset validation.
