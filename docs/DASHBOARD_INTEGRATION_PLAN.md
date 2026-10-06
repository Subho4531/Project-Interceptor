# Indian border dashboard and simulator integration plan

Status: Historical dashboard delivery plan. Shared session and Phase 3 regional worlds were implemented; extended dashboard/sensor acceptance remains pending. The sensor-led trainee path, weighted scoring, AAR and VR are now specified in [PRD v4](PRD.md) and the [current roadmap](IMPLEMENTATION_PLAN.md). See [Phase 1 delivery](DASHBOARD_PHASE1.md) and [verification](../VERIFICATION.md).

Working project: `C:\Users\subho\OneDrive\Documents\Project Interceptor`.

## Intended result

Add a map-led instructor dashboard at `/dashboard` in the existing React/TypeScript/Vite application. Provide a trainee route at `/trainer`, retaining `/` as a compatible entry. The dashboard selects and monitors three named Indian border training posts, configures military-UAV exercises, controls the simulation and provides an assistant grounded in session data.

The supplied reference establishes the composition: large geographic map, compact command toolbar, left object hierarchy, track/sector overlays and a support assistant on the right. Use its layout principles rather than embedding the reference image or reproducing its airport geography and software branding.

Keep the existing Babylon renderer and pure TypeScript simulation core. Older PlayCanvas architecture documents describe the previous scaffold; this feature does not require an engine migration.

## Three proposed posts

Post names and compounds are fictional training locations placed within real, publicly documented Indian border regions. Coordinates below are deliberately rounded, proposed regional map anchors, not surveyed post coordinates or verified operating military installations.

| Post ID | Display name | Public geographic region | Proposed WGS84 map anchor, latitude / longitude | Environment direction |
|---|---|---|---|---|
| shakti-punjab | Shakti Training Post | Attari region, Amritsar, Punjab | 31.60 N / 74.60 E | Agricultural plains, roads and a checkpoint |
| maru-rajasthan | Maru Training Post | Tanot region, Jaisalmer, Rajasthan | 27.80 N / 70.40 E | Arid terrain, dunes, scrub and desert facilities |
| himadri-sikkim | Himadri Training Post | Nathu La region, Sikkim | 27.40 N / 88.80 E | Mountain pass, steep terrain and seasonal snow |

Public region references: [Amritsar district: Attari/Wagah border](https://amritsar.nic.in/tourist-place/wagah-border/), [Incredible India: Tanot near the India–Pakistan border](https://www.incredibleindia.gov.in/en/rajasthan/jaisalmer/tanot-mata-temple), [Government of Sikkim: Nathu La](https://www.sikkim.gov.in/departments/tourism-civil-aviation-department/where-to-go).

These geographically distant posts belong to separate local exercise worlds. A national overview shows all three; selecting one opens its local map and exercise. Do not represent them as adjacent posts inside one small 3D compound. Initially run one active exercise at one post; retain independent history per post. Simultaneous independent scenarios across all three posts are a later extension.

## Phase 1 — Build the dashboard first

Deliver a complete dashboard UI with a replaceable preview session adapter, before attaching the live 3D runtime.

### Layout and routes

- `/dashboard`: instructor map console; `/trainer`: existing ground-observer experience. Navigation identifies which view is open. Add route-aware asset paths and static-host routing fallback or deployment rewrites so direct links/reloads work, including subdirectory deployments.
- Top toolbar: post selector, exercise selector, session status, simulation time, start, pause/resume, reset, finish and playback-speed controls.
- Left sidebar: searchable hierarchy of posts, simulated sensors, aerial contacts and map layers. Selecting an item focuses its map symbol and opens its details.
- Main map: geographic basemap, post marker, coordinate readout, scale, north indicator, sector/grid overlays, configured protected zone, simulated sensor coverage and contact trails. Layer toggles and a legend keep the view readable.
- Right dock: selected-contact details and SAARTHI, the simulation support assistant. The dock collapses to preserve map space. Optional avatar/voice controls follow after the text assistant works.
- Bottom strip: chronological event feed and review/replay controls. Replay controls are explicitly preview-only until real event recording is integrated.
- Military-console visual direction: compact Barlow and IBM Plex Mono typography, dark slate panels, subdued cyan for observations, amber for alerts and muted crimson for explicitly classified exercise threats. Symbols and text identify state without relying only on colour.

### Map and assistant foundation

Use [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) with real geographic data, a terrain/topographic basemap and an optional licensed satellite layer. A rendering library does not supply imagery rights. Choose and record a provider, attribution, configuration/key requirements and offline permissions during this phase. Use a local map package only where redistribution/caching is permitted; the public [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/) does not permit bulk/offline downloading from its standard tile service. Show useful map-load errors and a coordinate/track-list fallback.

Create `PostDefinition` with ID, display name, region, WGS84 origin, heading alignment, altitude datum, environment ID, local extent and imagery/elevation provenance. Coordinates use longitude/latitude ordering in GeoJSON and explicit units in UI/API contracts.

Create `SessionSnapshot`, `SimulationCommand` and `SessionAdapter` contracts before wiring components. Preview mode uses clearly labelled fixture data. Its controls update that preview; it does not imply connection to a live simulation or real radar. The same adapter boundary will receive the actual session in Phase 2.

The first assistant supports local structured requests such as “summarise this post”, “show selected contact”, “explain the last event” and “show session status”. Responses cite simulation time and their data source. It cannot invent tracks or claim actions succeeded. Commands use the same validated command interface as toolbar buttons and return acknowledgement/result text.

### Phase 1 acceptance

All three geographic regions are selectable and visibly change the map. The layout, object tree, layer toggles, details, preview controls and assistant work. Every fixture view is marked preview. Direct navigation/reload works. Verify 1280×720 and 1920×1080 desktop layouts plus a narrow-screen fallback. No simulator integration is claimed at this milestone.

## Phase 2 — Connect dashboard and trainer to one session

The existing `Trainer` currently constructs and advances `Simulation`; move session ownership and its clock into a renderer-independent `SessionController`. Both the dashboard and Babylon renderer subscribe to it. The dashboard must function when the trainer canvas is absent.

- Implement start, pause, resume, reset, finish, conditions, post/scenario selection and bounded simulation-speed commands. Commands are validated and logged with source, simulation time and result.
- One scheduler advances fixed steps. Playback speed changes simulated time through those steps rather than multiplying renderer movement. Rendering and map tracks interpolate snapshots; dashboard updates are throttled independently.
- Route changes retain the active session without double-advancing, silently resetting or leaking a renderer. Hidden-tab and pause behaviour remain explicit and consistent with the existing trainer.
- Map local metre-space coordinates into each post's geographic origin using a tested local tangent-frame transform. Maintain north/east alignment, heading, terrain height and AGL versus absolute-altitude conventions. Preserve original metre-space scenario data.
- Define separate instructor truth and trainee observation projections. Instructor mode can reveal authored routes/model identities and all simulated entities. Trainee mode retains neutral contacts and submitted classifications; it does not inherit instructor-only truth through an assistant answer.
- Full control means control of the training session: select presets, change permitted conditions, configure contact count/schedule, focus tracks, enable simulated sensor layers and end/review runs. Configuration edits apply before start or through explicitly logged exercise events. No real UAV/radar/weapon connection is part of this app.
- Keep one tab authoritative initially. Separate windows or remote instructors need an explicit synchronization/authority protocol and are not silently supported by route navigation. Local instructor/trainee modes are UI roles, not a claim of authenticated multi-user access control.

### Phase 2 acceptance

The dashboard and trainer show the same session ID, post, clock, conditions, contacts and event sequence. Toolbar commands change the actual simulation. Changing routes preserves the run; repeated transitions/resets do not grow active entity/resource counts. Geographic conversion tests cover round trips, distance, heading and all three anchors. Existing simulation tests continue to pass.

## Phase 3 — Regional worlds and military-UAV exercises

Retain the four implemented exercise families: low-altitude ingress, surveillance/loiter, perimeter penetration and coordinated multi-contact incursion. Reuse the validated FPV, Orlan, Lancet and Geranium models. They are military-UAV representations for fictional exercises; model names are not automatic evidence of intent, real operators, or validated weapon capability.

- Replace generic environment labels/POST 07 with the selected post's identity throughout briefing, HUD, dashboard and review.
- Bring in licensed, georeferenced regional imagery and elevation, then imported environment modules. Align the visible local geographic footprint with the 3D world. Current rural/mountain/valley scenes can support integration tests, but renaming them alone does not make them exact reproductions of Attari, Tanot or Nathu La.
- Build one post environment at a time: Shakti plains first, Maru desert next, Himadri mountain last. Validate materials, walkable ground, principal obstacle collisions, visibility and route clearance on each.
- Improve authored flight presentation with smooth heading/attitude, terrain-relative height and source animations where model structure allows. Do not claim rotor animation when assets contain no suitable separated parts.
- Extend coordinated activity to configurable staged groups while maintaining individual entity/contact identity and deterministic schedule/reset behaviour. Use existing authored profiles rather than optimizing attack routes against real installations.
- If radar/EO sectors are shown, implement their exercise detection/update rules, coverage/noise settings and confidence. Instructor truth and simulated sensor tracks are distinct data. Until those rules exist, coverage rings are labelled configuration overlays, not live sensor detections.
- Abstract response decisions remain recorded exercise actions. Interceptor/jammer physics and weapon effects require a separately scoped future model rather than a cosmetic button claiming an interception.

### Phase 3 acceptance

Each selected regional map and 3D environment shares a tested origin/footprint. All four scenarios run at each post with recognizable aircraft, terrain clearance, stable collisions and repeatable schedules. Every active swarm entity can be independently observed/reported. No automatic hostility or airframe identity appears in the trainee projection. Asset provenance and the Geranium noncommercial/ShareAlike requirements remain visible.

## Phase 4 — Live assistant, review and final verification

Connect SAARTHI to the integrated session projection and event log. It summarises activity, locates selected contacts on the map, explains conditions and recorded decisions, and supports instructor session commands. Use deterministic local answers first so the app remains usable without API credentials. An optional LLM adapter can add language flexibility later, with a server-side key and tool access restricted to the app's simulation commands.

Assistant responses identify observations, unknowns and instructor-only facts. A trainee assistant must not reveal scenario truth or the expected rubric before completion. All mutating commands show the requested action, validation result and actual resulting state; reset/post changes discard the current run only through an explicit visible control or assistant confirmation within the UI.

Add persisted per-post session history and a replayable after-action timeline using configuration, ordered events and deterministic snapshots/checkpoints. The map, tracks, choices and event feed must reconstruct the selected review time. Keep replay read-only and isolated from a live run. Extend existing JSON export to include post/georeference, configuration, seed, events and review. Export only implemented metrics; visibility and latency scoring require real probe instrumentation first.

### Final acceptance

- Full instructor control is reflected in the same trainee session, with no second clock or duplicated contacts.
- Geographic positions and 3D tracks align at all three posts; all scenarios pass lifecycle, coverage, privacy, pause/reset and replay tests.
- Assistant summaries match recorded events; commands cannot bypass validation, expose trainee-hidden answers or report false success.
- Chrome and Edge checks at 1280×720 and 1920×1080 include direct routes, maps, imagery failures, pointer lock, hidden-tab handling, export, replay and repeated route changes.
- Record ordinary-PC hardware and measure dashboard-only, trainer-only and optional combined-view performance. Target at least 30 FPS on the recorded hardware; do not infer current performance from the earlier ground-only benchmark.
- Production build works on a standard static host. Document online imagery requirements; packaged assets and any permitted offline map data have complete credits. Optional hosted language assistance is the only feature requiring its own service.

## Implementation sequence and dependencies

Deliver Phase 1 as the first reviewable milestone: dashboard route, three post definitions, real regional map, controls, hierarchy and local assistant in preview mode. Then proceed through shared-session integration, geographically aligned worlds/UAV activity, and live assistant/review verification.

Before imagery import, settle the provider and permitted online/offline usage. Exact regional 3D fidelity depends on usable elevation/imagery and imported assets. Animated rotors depend on the downloaded asset hierarchy. Cloud LLM/voice is optional and must not block the local assistant or dashboard. A PS-defined official four-category taxonomy is still unavailable; the existing local-PRD scenario families remain the training defaults.

