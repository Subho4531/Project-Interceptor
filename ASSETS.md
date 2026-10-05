# Asset provenance

Environment sources are provided under [Poly Haven's CC0 asset license](https://polyhaven.com/license). They are downloaded through its public API and served locally. Original byte checksums and download URLs are in `assets-source/environment/provenance.json`.

| Source | Use | Conversion |
|---|---|---|
| [aerial_grass_rock](https://polyhaven.com/a/aerial_grass_rock) | Terrain diffuse/normal | 1k JPEGs, no image edits |
| [gravelly_sand](https://polyhaven.com/a/gravelly_sand) | Courtyard/access road | 1k JPEGs |
| [concrete_wall_006](https://polyhaven.com/a/concrete_wall_006) | Walls/plinths/barriers | 1k JPEGs |
| [corrugated_iron](https://polyhaven.com/a/corrugated_iron) | Facility/canopy roofs | 1k JPEGs |
| [rock_07](https://polyhaven.com/a/rock_07) | Landscape rocks | glTF Transform dedup/weld/prune; GLB |
| [tree_small_02](https://polyhaven.com/a/tree_small_02) | Instanced trees | 1k textures; simplified to 72,113 triangles; distant LOD 12,993 triangles |
| [shrub_03](https://polyhaven.com/a/shrub_03) | Instanced vegetation | 1k textures; simplified to 4,142 triangles |
| [kloofendal_48d_partly_cloudy_puresky](https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky) | Daytime sky and lighting | 1k HDR; runtime cubemap |

Source transforms and GLB materials are preserved by glTF Transform. Scene placements apply authored metre-space scales and rotations. Repeated plants/rocks share their template geometry/materials. Trees retain high and low detail variants instead of disappearing when quality changes. Post construction modules are original code in `src/rendering/environment.ts` and are merged by material for rendering.

Barlow and IBM Plex Mono are self-hosted from Fontsource and licensed under SIL OFL 1.1; package license files are retained by their npm packages. Babylon.js is Apache-2.0, glTF Transform and Meshoptimizer are MIT, React is MIT. Dependency versions are pinned by `package-lock.json`.

## User-authorized Sketchfab assets

| Asset | Author | License | Use |
|---|---|---|---|
| [FPV Drone](https://sketchfab.com/3d-models/fpv-drone-0294037f390a4351926c11caf3e5c43e) | Jeyhun1985 | CC BY 4.0 | Route A / patrol |
| [Orlan-10](https://sketchfab.com/3d-models/orlan-10-e2efb223c1814b7291818a9a7b4e80c5) | flightclubua | CC BY 4.0 | Route B / patrol |
| [Lancet](https://sketchfab.com/3d-models/lancet-9820cfa9d1084d918c85c6dfb6287737) | flightclubua | CC BY 4.0 | Route C / patrol |
| [Geranium-2](https://sketchfab.com/3d-models/geranium-2-8f12f601efe44a73b47e30a7077cf249) | Karosio | CC BY-NC-SA 4.0 | Route D / patrol; noncommercial |
| [Snowy Mountain - Terrain](https://sketchfab.com/3d-models/snowy-mountain-terrain-9fa3c56fd32746bcb0e06cd2c4229ca0) | artfromheath | CC BY 4.0 | Mountain backdrop |
| [FREE - Dry rock sand terrain](https://sketchfab.com/3d-models/free-dry-rock-sand-terrain-d8c7c59079c649bfb96ab31afa919378) | josevega | CC BY 4.0 | Rocky valley backdrop |
| [Cliff Rock Boulder Field](https://sketchfab.com/3d-models/cliff-rock-boulder-field-d1f2ce6f71aa4c19adbdc541cc888194) | Pers Scans | CC BY 4.0 | Instanced collision scenery |

All were downloaded through the user's authenticated Chrome session. Drones use the 2K GLB download; landscapes use the 1K option. Original files and checksummed records remain in `assets-source/sketchfab/{uid}/`. No account credentials or cookies are stored.

`tools/prepare-sketchfab.mjs` preserves source drone geometry and materials, centers hierarchies and applies authored metre-space scales; dedup/weld/prune do not simplify drone geometry. Landscape models are normalized to unit width and simplified with Meshoptimizer, preserving embedded textures. Optimized triangle counts: mountain 62,544; dry terrain 62,661; boulders 27,345. Isolated point primitives in the boulder scan are omitted. Authored landscape placements select their widths in metres and vertical scales.

Modified Geranium-2 assets retain CC BY-NC-SA 4.0. Adjacent `.LICENSE.txt` and `.provenance.json` files ship with browser GLBs. `public/assets/credits.json` supplies visible settings credits. Detailed conversion records are in `artifacts/extraction/sketchfab-optimization.json`. Drone scale choices retain proportions but are not certified manufacturer dimensions, and no source animations are supplied.

These are authorized Sketchfab replacements, not Unreal exports. The snowy terrain's NoAI source notice is recorded here; it is used as runtime scenery for human training, not in an AI-training dataset or generative asset pipeline.
