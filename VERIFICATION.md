# Verification record

## Three regional environments — 6 October 2026

Delivery narrowed by the user's latest instruction to finish the three training posts and stop.

- Shakti/Punjab, Maru/Rajasthan and Himadri/Sikkim load successfully in Chrome 154 at 1280 x 720.
- All three use locally packaged real Copernicus elevation and Sentinel-2 imagery, with fictional graded compound platforms.
- Imported booths, chain-link fencing, barriers and vegetation are present; original opacity maps restore fence/leaf transparency.
- Five renderer ray probes per region match collision heights within 0.02 m; offline validation reports maximum terrain/heightfield discrepancy below 0.000031 m and map-corner alignment below 0.001 m. These are internal alignment checks, not source-data survey accuracy.
- All 75 tests and the production TypeScript/Vite build pass. Unit checks include all 12 post/exercise combinations, clearance, deterministic resets and sensor rules.
- Browser smoke checks report no JavaScript errors or asset-dependency warnings in the three worlds.
- Evidence: artifacts/qa/phase3/environments-report.json and shakti-punjab-environment.png, maru-rajasthan-environment.png, himadri-sikkim-environment.png.
- Extended Edge, 1920 x 1080, performance and dashboard lifecycle acceptance remain unverified after the requested stop. No new FPS guarantee or full Phase 3 acceptance is claimed.



## Dashboard Phase 1 — 5 October 2026

Implemented in `C:\Users\subho\OneDrive\Documents\Project Interceptor`. All **53 tests pass** (38 existing simulation/scenario tests and 15 dashboard tests). The TypeScript/Vite production build passes; Vite retains a nonfatal advisory for the existing large Babylon trainer bundle. Dashboard and trainer are separate lazy routes.

| Check | Result |
|---|---|
| Three regional posts | Shakti/Punjab, Maru/Rajasthan and Himadri/Sikkim change the geographic map and details; coordinates are rounded fictional anchors |
| Real imagery | EOX Sentinel-2 satellite imagery loaded for Punjab/Rajasthan; OpenTopoMap loaded for Sikkim; provider/license credits displayed |
| Regional overview and resize | All three post markers shown; hiding/restoring assistant resizes the map without a second canvas |
| Quiet period and swarm | Production preview starts empty; stepping to 30 seconds shows four active tracks; scheduled pairs are at 25/29 seconds |
| Selection and layers | Contact selection focuses the map/opens telemetry; coverage toggle works; MapLibre marker positioning classes retained |
| Local assistant | Selected-contact facts match fixture state; start/pause commands acknowledge validated results; reset confirmation can be cancelled without changing time |
| Conditions | Night/reduced visibility update preview metadata and assistant summary; imagery is explicitly unchanged |
| Replay | Rewinding to zero shows zero active contacts and disables resume/mutating controls; exiting restores live preview time |
| JSON export | Downloaded `interceptor-shakti-punjab-preview.json`; parsed mode preview, Shakti post, time 30, four tracks and eight events |
| Static routes | `/dashboard`, `/dashboard/`, `/trainer/` and `/project/dashboard/`, `/project/trainer/` return HTML; missing JS returns 404; directory mount redirects to trailing slash |
| Nested trainer assets | `/project/trainer/?qa=1` ready with four asset templates, WebGL2 and one drone entity/visual at 30 seconds |
| Desktop/narrow layout | Chrome inspected at 1280×720, 1920×1080 and 390×844; narrow object search/drawer and condition/assistant controls checked |
| Lifecycle/intent/unit contracts | Tests cover reset determinism, speed/pause, completion, subscriptions, bounded replay, fixture placement, assistant confirmations/negation/questions and route-base resolution |

Visual QA corrected map style-startup timing, lost marker positioning classes, overlapping contact labels and narrow workspace/chat scrolling. Final evidence: `artifacts/qa/dashboard-*.jpg`, `dashboard-export.json`, `dashboard-tests.log` and `dashboard-build.log`.

This is a **preview console**, not a shared live trainer session or real sensor system. Map tiles need internet; no offline imagery package is included. Error/retry and unsupported-renderer UI are implemented, but deliberately blocked tile/WebGL failure cases were not browser-tested this milestone. No new Edge, foreground FPS, long-duration GPU/resource soak or real UAV performance validation is claimed. See [Phase 1 delivery](docs/DASHBOARD_PHASE1.md).

## Four trainee scenarios — 5 October 2026

The new working project is `C:\Users\subho\OneDrive\Documents\Project Interceptor`. All **38 simulation/collision tests pass** and the TypeScript/Vite production build passes. Four defensive observation exercises extend the existing maps and Sketchfab aircraft; the local PRD is the basis for these categories, not a verified official four-category PS taxonomy.

| Check | Result |
|---|---|
| Four scenarios on all three maps | Passed fixed-step tests for quiet period, peak contacts, terrain clearance, actual zone crossings and automatic completion |
| Swarm rendering | Connected Chrome reports four entities and four visual instances at 30 seconds |
| Reticle acquisition, classification and decision | Actual model ray pick creates Contact 01; chosen classification and response recorded with assessment clock held |
| Manual swarm review | One detected of four; three missed; completed state has zero aerial entities/visuals |
| Local JSON export | Downloaded `interceptor-swarm-review.json`; configuration, seed, conditions and submitted choices checked |
| Repeat and scenario selection | Repeat clears time, reports and entities; four scenarios plus five familiarisation options available |
| Single-contact profiles | Low ingress, surveillance and penetration each render one entity/visual at 30 seconds with distinct authored positions |
| Automatic completion | Perimeter exercise concludes at 105 seconds; zero entities/visuals, one actual zone entry, missed contact counted |
| Conditions and map change | Night/reduced visibility carry into mountain pass; training starts at zero with no reports; four swarm entities/visuals render at 30 seconds |
| Panel lifecycle | Empty report remains open during updates; return and choose-another work; changing scenario after completion resets clock/reports |
| Final production page | Static preview at port 4180 loads with enabled entry, four scenario choices, zero QA controls and no observed application console errors |
| Privacy and assessment validity | Tests verify no expected answers/identity/routes in trainee state before completion, acquisition deduplication and classification-before-response |
| Desktop and narrow layout | Chrome briefing at 1280×720, review at 1920×1080 and narrow 390×844 layout visually inspected |

Evidence is `artifacts/qa/training-browser-report.json`, `training-*.jpg`, `training-tests.log` and `training-build.log`. Browser action checks use opt-in QA stepping; the ordinary trainee page omits developer controls. No fresh Edge or foreground FPS result is claimed. Rubric matches are illustrative exercise feedback, not certified scoring; response choices have no interceptor effects. Full AAR timeline, visibility/latency scoring and trainee history remain future work.

## Earlier Sketchfab delivery — 5 October 2026

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

The historical checks below predate the four trainee exercises. Full scoring, AAR timeline, tactical console, interceptor responses and VR remain future work. Exact original Unreal interface parity remains unverified.

