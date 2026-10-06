# Project Interceptor

Three regional border training environments, an instructor dashboard, and the first sensor-led trainee exercise are implemented. The [revised PRD](docs/PRD.md) and [implementation roadmap](docs/IMPLEMENTATION_PLAN.md) define the broader training loop. Competency progression, a command-room interior, and VR remain planned work.

## Run locally

Run the current project from `C:\Users\subho\OneDrive\Documents\Project Interceptor`. The older `Downloads\UAV_Intercept_Simulator_V1.5\web-trainer` copy predates the dashboard.

```powershell
npm install
npm run dev
```

Open `/trainer` for the sensor-led Basic Detection exercise, `/observer` for the ground-level 3D view, or `/dashboard` for the instructor map. Completed exercise replays open at `/aar/:sessionId`.

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

The `/trainer` exercise delivers a delayed neutral radar cue, acknowledgment timing, EO/RF/flight-roster/movement evidence requests, qualitative analysis support, separate object/coordination/affiliation/threat assessments, high-level decisions, a scheduled simulated consequence, weighted scoring, and an AAR. Completed practice attempts are saved in the browser's IndexedDB and can be replayed or exported as JSON. The trainee view withholds scenario truth until the AAR. This is one authored Basic Detection exercise; the ambiguous-target and swarm exercises, procedural variation, cross-session competency tracking, 3D command room, and VR remain on the roadmap. The simulated response is a command-level outcome, without interceptor physics.

## Build and checks

```powershell
npm test
npm run build
node tools/verify-regions.mjs
node tools/serve-static.mjs
node tools/sensor-smoke.mjs # while the static server is running
```

Deploy dist/ to a static host with `/trainer`, `/observer`, `/dashboard`, and `/aar/:sessionId` rewritten to index.html. The included server supports TRAINER_PORT and TRAINER_BASE_PATH. Packaged 3D worlds require no rendering server or runtime Sketchfab login.

The first sensor-led exercise is covered by engine unit tests and a Chrome browser smoke test at 1280 x 720. See [verification record](VERIFICATION.md) for current results and limits. The broader Chrome/Edge performance suite is available through `npm run qa` but is not claimed complete.

## Assets and evidence

[PRD](docs/PRD.md), [implementation roadmap](docs/IMPLEMENTATION_PLAN.md), [technical architecture](docs/ARCHITECTURE.md), [regional sources and import instructions](docs/REGIONAL_ASSETS.md), [asset manifest](docs/ASSET_MANIFEST.md), [verification record](VERIFICATION.md).

Raw crops, source models, hashes and licences are retained under assets-source/. Optimized worlds are public/assets/regions/; compound modules are public/assets/environment/. Geranium retains its noncommercial/ShareAlike licence. No cookies or API credentials are stored.

Screenshots and browser diagnostics: `artifacts/qa/phase3/` and `artifacts/qa/sensor/`. Scene selection does not place these geographically distant posts beside one another; one regional exercise is active at a time.

