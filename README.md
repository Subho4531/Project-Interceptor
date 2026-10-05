# Border observation trainer · Phase 1

A standalone React / TypeScript / Vite application using Babylon.js and WebGL2, with locally hosted assets and a static deployable build.

**Current delivery: user-authorized Sketchfab drones and three selectable maps.** The user's subsequent instruction authorized the downloaded Sketchfab assets, replacing the original-only constraint for this implementation. The original Unreal extraction remains documented in [EXTRACTION.md](EXTRACTION.md); these models are not claimed simulator-original exports.

## Run

```powershell
npm ci
npm run dev
```

Open `http://127.0.0.1:5173` and click **Enter observation post**. WASD moves, Shift walks faster, mouse looks, Z/right-click toggles 5× optics, E records an observation, R restores your viewpoint, and P/Esc pauses. Losing focus, changing tabs or releasing mouse capture pauses; click Resume to continue.

**Change map & flight exercise** or the settings button exposes map, exercise, lighting, visibility, quality and quiet-period controls. Changing map or exercise starts a new session, carrying the chosen conditions, quality and delay. Reset before changing the quiet period.

## Maps and flights

- **Rural border post:** open fields, wooded hills and roadside facilities.
- **Mountain pass:** snowy Sketchfab mountain ridges, rising foothills, scanned boulders and fewer trees.
- **Rocky valley:** dry Sketchfab terrain, warm ground materials, sparse vegetation and scanned boulders.

The central observation post remains level. Each map has its own surrounding height field, exploration bounds, vegetation density and asset placements. Height sampling matches the triangles used to render the ground. Imported mountain/terrain tiles form distant scenery outside the walking area; nearby boulder fields have conservative collision bounds. Buildings, pillars, barriers, fences, tree trunks and rocks participate in ground collision. The gate is open. North is +Z, east +X, up +Y.

The default **Rotating patrol** makes four successive passes: Orlan-10, Lancet, FPV and Geranium-2. The quiet period defaults to 25 seconds; spawn offsets after it are 0, 60, 120 and 180 seconds. Only one object is active at a time. Routes A–D select individual FPV, Orlan, Lancet and Geranium flights. Exercise names and the trainee HUD do not identify the active object or assign hostility labels. Settings list credits for all assets independently of the active object.

Drone hierarchies are centered and scaled into metres while retaining proportions and embedded textures. Authored widths are 0.48 m, 3.1 m, 1.03 m and 2.5 m respectively. These are training dimensions, not certified manufacturer measurements. No source animations are supplied; the whole aircraft follows its route without propeller animation.

## Production and verification

```powershell
npm test
npm run build
node tools/serve-static.mjs
```

The production URL is `http://127.0.0.1:4173`. Deploy `dist/` to a standard static host, including a subdirectory. No rendering server, CDN, runtime Sketchfab login or external asset request is needed. Raw source files and extraction tools are excluded from the build. The 18 simulation tests cover lifecycle, resets, observations, zones, hidden-tab pause, collisions, all four patrol aircraft on all maps, non-overlap and route clearance above terrain. See [VERIFICATION.md](VERIFICATION.md) for browser results and limitations.

`npm run qa` runs the original automated desktop Chrome/Edge regression checks when the static server is running. The opt-in `?qa=1` URL adds development-only stepping, model inspection, movement probes, a DOM diagnostic output and a diagnostic API. Ordinary trainee sessions omit those controls and truth data.

## Architecture and sources

- `src/simulation/types.ts`: maps, scenario configuration, asset provenance, entities/events and trainee-facing state.
- `src/simulation/config.ts`: map library, sourced scenery placements and repeatable authored exercises.
- `src/simulation/world.ts`: terrain triangle heights, swept movement, bounds and collision helpers.
- `src/simulation/Simulation.ts`: renderer-independent 60 Hz fixed steps and interpolation; pause/reset/session and zone events.
- `src/rendering/environment.ts`: sourced scenery, reusable post modules, shared materials, lighting, batching and tree LOD.
- `src/rendering/Trainer.ts`: model template cache, instance disposal, source metadata validation, local asset loading and observer controls.
- `src/ui/`: restrained field interface using self-hosted Barlow and IBM Plex Mono. A map change disposes the previous renderer and its asset containers before opening the next.

Simulation events have unique IDs, times, types, optional entity IDs and payloads. The session-local log is bounded at 10,000 events. Resets preserve conditions and delay and clear entities/visuals. Quality settings change resolution, shadows and tree detail while retaining world objects and scenario conditions.

Raw Sketchfab GLBs and provenance are in `assets-source/sketchfab/{uid}/`. `tools/prepare-sketchfab.mjs` produces local drone/scenery GLBs, adjacent provenance/license files, the drone catalog, and runtime credits. It preserves drone geometry and simplifies landscape geometry with glTF Transform/Meshoptimizer. `npm run assets:prepare` regenerates the Poly Haven environment assets. Runtime loading accepts only available catalog entries with complete source/license metadata, positive dimensions and valid geometry. Sketchfab models are explicitly marked `simulatorOriginal: false`.

See [ASSETS.md](ASSETS.md) for sources and licenses. **Geranium-2 uses CC BY-NC-SA 4.0:** its source and modified browser model are for noncommercial use and retain ShareAlike terms. The other enabled Sketchfab models use CC BY 4.0. Credits and license links are also available in settings. No browser cookies or API tokens are stored in the project.

Phase 1 does not include scoring, AAR UI, tactical console, interceptors or XR. Exact original Unreal UI parity has not been verified.
