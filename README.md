# Project Interceptor

Three regional border training environments are implemented in this project. The latest instruction narrowed delivery to finishing these environments and stopping; extended dashboard/sensor verification has been deferred.

## Run locally

```powershell
npm install
npm run dev
```

Open /trainer for ground observation, or /dashboard to select a post. A production static server is currently available at http://127.0.0.1:4181/trainer.

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

The shared session and simulated radar/EO foundation were added during implementation. Their extended desktop QA is unfinished following the scope change. Recorded replay, persistent history, cloud/voice assistance, interceptor physics and XR remain future work.

## Build and checks

```powershell
npm test
npm run build
node tools/verify-regions.mjs
node tools/serve-static.mjs
```

Deploy dist/ to a static host with /trainer and /dashboard rewritten to index.html. The included server supports TRAINER_PORT and TRAINER_BASE_PATH. Packaged 3D worlds require no rendering server or runtime Sketchfab login.

Verified: 75 tests, production build, all three worlds in Chrome at 1280 x 720, imported terrain/collision alignment and local asset loading. The broader Chrome/Edge performance suite is available through npm run qa but is not claimed complete.

## Assets and evidence

[Regional sources and import instructions](docs/REGIONAL_ASSETS.md), [asset manifest](docs/ASSET_MANIFEST.md), [verification record](VERIFICATION.md).

Raw crops, source models, hashes and licences are retained under assets-source/. Optimized worlds are public/assets/regions/; compound modules are public/assets/environment/. Geranium retains its noncommercial/ShareAlike licence. No cookies or API credentials are stored.

Screenshots and browser diagnostics: artifacts/qa/phase3/. Scene selection does not place these geographically distant posts beside one another; one regional exercise is active at a time.

