# Verification record

## Current Sketchfab delivery — 5 October 2026

The production build passes and all **18 simulation/collision tests pass**. Four downloaded Sketchfab aircraft and three selectable environments are enabled. These are user-authorized replacements, not exports from the packaged Unreal simulator. Matching `.usmap` data is still needed for the separate original-asset extraction path.

Connected desktop Chrome rendered the production build through `tools/serve-static.mjs` with WebGL2. The renderer reported `ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001638) Direct3D11 vs_5_0 ps_5_0, D3D11)`. All four aircraft were visually inspected with embedded textures. FPV and Orlan orientation corrections were checked and corrected; Lancet and Geranium retained their reviewed correction. Authored metre-space dimensions were checked against normalized geometry within 0.001 m. These dimensions are training choices, not certified manufacturer measurements. Propellers are not animated.

| Current check | Result |
|---|---|
| FPV, Orlan, Lancet and Geranium textured geometry | Passed Chrome rendering and local GLB validation |
| Rural, mountain pass and rocky valley | All load; 2 / 9 / 9 sourced scenery placements respectively |
| Quiet period and delayed aerial activity | Empty before 25 s; rendered object after 30 s; fixed-step checks |
| Four successive patrol passes on each map | Passed simulation tests: deterministic schedules, non-overlap and terrain clearance |
| Spawn/reset stability | Eight flight/reset cycles retain 1,073 meshes, 24 materials, 13 textures after first template use; zero active entities/visuals after reset |
| Ground collision | Fence probe stops at x = 39.4 m, before the east fence |
| Terrain following | Mountain gate walk retains 1.72 m eye height above rendered terrain |
| Night, reduced visibility and performance quality | Controls apply; scene object/resource counts retained |
| No active identity or hostility labels in trainee UI | Generic flight exercises and HUD; source truth appears only in opt-in QA diagnostics |
| Static deployment | Build includes local GLBs, embedded textures, metadata, licenses, fonts and environment textures |
| Current Chrome/Edge 720p/1080p FPS target | **Unverified for the new drone/scenery build** |

The rocky terrain needs `KHR_materials_pbrSpecularGlossiness`; its loader was added after the first check revealed missing terrain. The final build loads all nine rocky-valley placements. Tile bases were lowered into the surrounding terrain and visually checked. Map changes dispose the previous renderer and source containers. Stable scene counts are a regression signal, not proof of total GPU memory stability or a long-duration soak test.

Evidence: `artifacts/qa/sketchfab-browser-report.json`, `sketchfab-asset-validation.json`, `sketchfab-unit-tests.log`, `sketchfab-build.log`, and `sketchfab-*-*.jpg`. The browser report combines checks from successive builds during the implementation session; final FPV and valley captures use the corrected final build. Geranium's visual evidence is `sketchfab-geran-preview.jpg`. The ordinary user page has no QA toolbar.

The request to bring the Chrome test tab into the foreground was declined. Background rendering was throttled, so its reported FPS is excluded from performance conclusions. Current Edge and explicit 1280×720 / 1920×1080 checks were not rerun. No current full-build 30 FPS claim is made. Browser console inspection found extension-origin messages but no observed application errors after the material-loader correction.

## Historical ground-only verification

The earlier ground environment passed ten tests and installed Chrome/Edge checks using actual WebGL2 hardware rendering. Hardware: AMD Ryzen 5 5600H, 12 logical processors, approximately 15 GiB usable physical memory, AMD Radeon integrated graphics.

| Browser | Resolution | Historical daytime average FPS, short sample |
|---|---|---:|
| Chrome 154.0.8037.95 | 1280×720 | 142.7 |
| Chrome 154.0.8037.95 | 1920×1080 | 108.1 |
| Edge 155.0.4283.33 | 1280×720 | 144.0 |
| Edge 155.0.4283.33 | 1920×1080 | 111.4 |

These are headless samples of the previous ground-only scene, without the new drones or imported landscape tiles. They do not establish current performance. Historical artifacts are `artifacts/qa/report.json` and `quality-report.json`; rerunning the original automated QA replaces them.

Historical checks covered entry/pointer lock, WASD, zoom, observation logging, pause/resume, lighting/fog, swept fence collision, visibility-change pause, locally hosted requests, unsupported WebGL2 and deliberately missing environment textures. Twenty-five resets retained 1,065 meshes, 21 scene materials and 13 textures. Those counts describe the previous build.

Phase 1 remains the observation foundation. Scoring, AAR, tactical console, interceptors and VR are future phases. Exact original Unreal interface parity remains unverified.
