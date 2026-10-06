# Project Interceptor

Three regional training posts now share a sensor-led exercise system, instructor dashboard, curriculum, saved reviews, and an imported command room. A seated WebXR adapter targets PC VR through Chrome/Edge and OpenXR; real headset acceptance remains pending. The [PRD](docs/PRD.md) and [implementation roadmap](docs/IMPLEMENTATION_PLAN.md) retain the full product requirements.

## Run locally

Run the current project from `C:\Users\subho\OneDrive\Documents\Project Interceptor`. The older `Downloads\UAV_Intercept_Simulator_V1.5\web-trainer` copy predates the dashboard.

```powershell
npm install
npm run dev
```

Open `/` or `/progress` for profiles, Levels 0–4, and history. `/trainer` provides focused sensor controls; `/room` provides spatial command-room controls and PC VR entry. `/observer` opens the ground-level 3D view and `/dashboard` the instructor sensor wall/map. Reviews open at `/aar/:sessionId`.

`npm run dev:dashboard` launches the development server and opens the dashboard directly. Its default sensor wall shows radar returns, a live EO camera, synthetic thermal visualization and sensor/RF status; use **Tactical map** to switch to the geographic map. The thermal view colourizes the optical render and is not an independent infrared measurement.

## Training posts

| Post | Region | Latitude / longitude | World |
|---|---|---|---|
| Shakti · POST 01 | Attari / Amritsar, Punjab | 31.60 N / 74.60 E | Agricultural plains |
| Maru · POST 02 | Tanot / Jaisalmer, Rajasthan | 27.80 N / 70.40 E | Arid desert |
| Himadri · POST 03 | Nathu La region, Sikkim | 27.40 N / 88.80 E | Mountain terrain |

Each world covers 6 x 6 km using locally packaged Copernicus GLO-30 elevation and frozen Sentinel-2 imagery. These are fictional training compounds at rounded regional anchors. Terrain includes a documented graded platform; source elevation is a 30 m surface model, not a surveyed military installation.

The posts use imported security booths, chain-link fencing, road barriers, vegetation, real HDR lighting and ground normal detail. Collision heights match imported terrain triangles. Texture transparency has been restored using original source opacity maps. Assets and licences are local; only optional online overview basemaps need internet.

## Observer controls

WASD moves, mouse looks, Shift walks briskly, Z zooms, E/Space marks a contact, C opens contact reports and Esc/P pauses. Losing pointer lock, hiding the tab or changing views pauses the shared session. Resume explicitly.

Settings select the post, exercise, day/night, visibility and rendering quality. Default: Shakti, low-altitude ingress, 25-second quiet period, daytime, clear visibility. Existing FPV, Orlan, Lancet and Geranium models remain available for four fictional exercise families and familiarisation. They are imported Sketchfab representations; the original cooked Unreal model export remains a separate blocked pipeline.

Exercises include Basic Detection, uncertain sensor returns, authorization review, independent contacts, and coordinated activity. Neutral radar cues lead to acknowledgement, EO/RF/roster/history investigation, qualitative evidence analysis, separate classification and threat assessment, high-level decisions, consequences, and weighted scoring. Seeded routes and degraded sensors vary the workload. False returns are sensor-only; no bird model is implied.

Guided practice and practice remain open at every level. Assessments unlock through two distinct-seed qualifying attempts (80 overall, 60 per component, no critical error). Interrupted, demo, instructor-viewed and aborted attempts cannot unlock competency. Level 0 is familiarisation. IndexedDB stores profiles, delivered evidence, revisions, chronology, checkpoints and final explanations; `/progress` exports/imports validated JSON bundles. Reloaded incomplete attempts are held for review, not resumed.

The command room uses imported Kenney CC0 furniture modules and shares the same clock, evidence and actions as the focused console. Desktop pointer and WebXR controller rays operate its panels. Connect a PC headset to its OpenXR runtime and use a trusted localhost/HTTPS context for immersive entry. No headset performance, comfort or controller acceptance is claimed without hardware testing. The simulated response remains a command-level outcome, without interceptor physics.

## Build and checks

```powershell
npm test
npm run build
node tools/verify-regions.mjs
node tools/serve-static.mjs
node tools/sensor-smoke.mjs # while the static server is running
```

Deploy dist/ to a static host with `/progress`, `/room`, `/trainer`, `/observer`, `/dashboard`, and `/aar/:sessionId` rewritten to index.html. The included server supports TRAINER_PORT and TRAINER_BASE_PATH. Packaged 3D worlds require no rendering server or runtime Sketchfab login.

See [verification record](VERIFICATION.md) for current automated checks, browser results and remaining acceptance limits. Additional browser flows run with `tools/scenario-smoke.mjs` and `tools/curriculum-smoke.mjs` against a running static build.

## Assets and evidence

[PRD](docs/PRD.md), [implementation roadmap](docs/IMPLEMENTATION_PLAN.md), [technical architecture](docs/ARCHITECTURE.md), [regional sources and import instructions](docs/REGIONAL_ASSETS.md), [asset manifest](docs/ASSET_MANIFEST.md), [verification record](VERIFICATION.md).

For Vercel, enable the project’s Git LFS setting and redeploy so model binaries are included; see [Vercel deployment notes](docs/VERCEL_DEPLOYMENT.md).

Raw crops, source models, hashes and licences are retained under assets-source/. Optimized worlds are public/assets/regions/; compound modules are public/assets/environment/. Geranium retains its noncommercial/ShareAlike licence. No cookies or API credentials are stored.

Screenshots and browser diagnostics: `artifacts/qa/phase3/` and `artifacts/qa/sensor/`. Scene selection does not place these geographically distant posts beside one another; one regional exercise is active at a time.

