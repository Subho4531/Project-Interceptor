# 3D Asset Manifest & Specification (Project Interceptor)

> **Mandatory Rule**: All 3D meshes, terrain maps, and sky environments must be imported from validated PBR assets (GLB / glTF / HDR / PBR texture maps). Procedural placeholder primitives (cubes, cylinders) and procedural terrain generation are strictly prohibited.

---

## 1. Required Aerial Threat Assets

| Asset Name | Target Format | Nodes / Hierarchy Requirements | Recommended Sources |
|---|---|---|---|
| **Commercial / Tactical Quadcopter** | `.glb` / `.gltf` (PBR) | • Separate child nodes for all 4 rotor blades (`rotor_FL`, `rotor_FR`, `rotor_RL`, `rotor_RR`) for rotational animation<br>• Central gimbal camera node (`sensor_gimbal`)<br>• Status LED strobe material node | Sketchfab (CC-BY / Standard), Fab, CGTrader |
| **FPV Kamikaze / Munition Drone** (Phase 2) | `.glb` / `.gltf` (PBR) | • Streamlined racing frame with forward payload<br>• High-RPM 3-blade prop nodes | Sketchfab, Fab |

---

## 2. Required Tactical Compound Environment Assets

| Asset Category | Target Format | Specifications | Sources |
|---|---|---|---|
| **Terrain Mesh & Materials** | `.glb` mesh + 4K PBR textures | • 400m × 400m imported terrain elevation mesh<br>• PBR texture sets: packed gravel, dry earth, weathered asphalt (Albedo, Normal, Roughness, AO) | Poly Haven, ambientCG, Quixel Megascans |
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
