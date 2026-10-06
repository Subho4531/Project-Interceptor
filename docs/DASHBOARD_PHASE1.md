# Dashboard Phase 1

`/dashboard` opens the instructor map console; `/trainer` opens the existing ground trainer, and `/` retains its previous behaviour. The dashboard uses an independent, explicitly labelled preview adapter. Changing routes does not carry preview state into the trainer.

## Posts

| Fictional post | Public region | Rounded latitude / longitude |
|---|---|---|
| Shakti / POST 01 | Attari · Amritsar, Punjab | 31.60 N / 74.60 E |
| Maru / POST 02 | Tanot · Jaisalmer, Rajasthan | 27.80 N / 70.40 E |
| Himadri / POST 03 | Nathu La region, Sikkim | 27.40 N / 88.80 E |

These are regional exercise anchors, not surveyed operational compounds. Local overlays use approximate metre offsets in WGS84; exact terrain/elevation and 3D alignment follow in Phases 2–3.

## Preview controls

Select a post and low ingress, surveillance, perimeter penetration or coordinated swarm. Start, pause/resume, reset, finish, 1×/2×/4× speed and +10-second stepping operate on the preview. The default swarm enters in two pairs at 25 and 29 seconds. Post/exercise changes reset the preview. Conditions persist across resets but update metadata only; they do not alter imagery or the trainer. A hidden page pauses its clock.

Search/select posts, contacts and configured sensors. Selection focuses the map and opens coordinates, altitude AGL, speed, heading and schedule. Routes, trails, protected zone, coverage and 1 km grid have separate toggles. Coverage is illustrative, without a detection model. All-posts overview, zoom, north reset, metric scale, coordinate readout and imagery credits are included. Desktop panels scroll independently; narrow screens put details and assistance below the map, with an Objects drawer.

Reset clears clock/events. Preview replay is read-only, bounded by current time, and does not reconstruct a trainee session. Transition events record the sample crossing a transition; stepping can record a 25-second spawn at the 30-second sample. Export includes post/configuration/tracks/events with `mode: preview`. It is not a trainee score or AAR.

## SAARTHI

The deterministic local assistant reads the displayed snapshot, labels replies with preview time, and needs no credentials or hosted language service. Try **Brief post**, **Selected contact**, **Last event**, `show UAV 02`, `start`, `pause` or `reset`. Explicit commands use the toolbar's validated interface and acknowledge the actual result. Reset, finish and post changes require confirmation inside the app. Questions and negated requests do not execute commands; replay rejects mutations. Chat stays in page memory.

## Online imagery

| Layer | Source | Terms/configuration |
|---|---|---|
| Satellite, default | EOX EOxCloudless Sentinel-2 2024, `s2cloudless-2024_3857` | Public WMTS; no key; native zoom up to 14. CC BY-NC-SA 4.0 for noncommercial use; commercial use requires an appropriate EOX licence. |
| Terrain | OpenTopoMap, OSM, SRTM | Public raster tiles; no key; native zoom up to 17; CC BY-SA attribution. |

Credits/data/license links appear on the map. Imagery brightness/saturation are reduced for overlays. Sources: [EOX service](https://maps.eox.at/), [EOxCloudless licence](https://cloudless.eox.at/documentation/license), [OpenTopoMap terms](https://wiki.opentopomap.org/about), [MapLibre raster documentation](https://maplibre.org/maplibre-gl-js/docs/examples/map-tiles/).

Internet and provider availability/rate limits apply. No bulk downloader, offline imagery package or service-worker tile cache is added. Missing tiles display a retry notice; coordinates and object panels remain usable. Unsupported WebGL/context loss displays a renderer message. Trainer models/textures/fonts remain locally hosted.

## Static hosting

Run `npm ci`, `npm test`, `npm run build`, then `node tools/serve-static.mjs`. Open `http://127.0.0.1:4173/dashboard`. Direct `/dashboard/` and `/trainer/` links are supported. On another host, serve `dist/`, rewrite application routes to `index.html` and keep missing assets as 404. Preserve a deployment directory such as `/project/` and redirect `/project` to `/project/`.

```powershell
$env:TRAINER_PORT='4183'
$env:TRAINER_BASE_PATH='/project'
node tools/serve-static.mjs
```

Dashboard and Babylon trainer load as separate lazy chunks. Vite still reports the existing large trainer bundle advisory; it is not a build failure.

## Integration boundary

`types.ts` defines snapshot/command/adapter contracts, `posts.ts` defines anchors, `PreviewSession.ts` provides headless fixture state, `assistant.ts` handles local intent, and React/MapLibre own presentation. Preview state never constructs `Trainer` or `Simulation`. Phase 2 supplies one shared controller/clock, geographic conversion and instructor/trainee projections; Phase 3 supplies regional 3D worlds and sensor rules. Remote authenticated control, certified UAV performance, real feeds, interception effects, persistent history and cloud AI are outside this milestone.

See [verification](../VERIFICATION.md) and the [integration plan](DASHBOARD_INTEGRATION_PLAN.md).
