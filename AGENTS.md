# Project Interceptor — Repository Guidance

This file describes the **working repository**. The authoritative product target is [docs/PRD.md](docs/PRD.md), the phased delivery is [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md), and actual integration boundaries are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Read [docs/ASSET_MANIFEST.md](docs/ASSET_MANIFEST.md) and [docs/REGIONAL_ASSETS.md](docs/REGIONAL_ASSETS.md) before changing sourced models, terrain, or attribution.

## Current stack and status

The app uses **React 19, TypeScript, Vite, Babylon.js/WebGL2 and MapLibre**. It already has three georeferenced fictional training posts, imported aircraft and compound assets, ground observation, four authored flight exercises, a fixed-step session, radar/EO observations, and an instructor dashboard. The weighted sensor-led assessed loop, RF, procedural generation, persistent AAR, competency levels, command-room interior, and VR are **planned until implemented and verified**. Never claim roadmap items are shipped based on documentation alone.

The main implementation folders are `src/simulation/` (headless rules and world state), `src/session/` (authoritative clock, assets, commands, projections), `src/rendering/` (Babylon.js), `src/dashboard/` (instructor UI), and `src/ui/` (trainee UI and routes). Keep simulation rules free of React and Babylon imports. Maintain one authoritative session; rendering, map views and replay do not run independent clocks.

## Asset and visual guardrails

- Do not create runtime procedural 3D primitive placeholders or algorithmic terrain grids. Use validated imported GLB/glTF assets and the sourced regional elevation/imagery pipeline, with provenance in the asset manifest.
- Preserve aircraft, booth, vegetation, regional imagery and terrain licenses and required notices. Existing Geranium terms include noncommercial/ShareAlike conditions. Do not present user-authorized Sketchfab aircraft as exports from the packaged Unreal simulator.
- Do not portray the fictional compounds or rounded regional anchors as surveyed operational sites. Sensor parameters and training scale choices are illustrative, not manufacturer or field-performance specifications.
- Maintain restrained tactical visual styling, readable technical typography, clear focus/contrast states, and minimal obstruction of the map and evidence. Avoid saturated arcade-style status indicators.
- Quality settings may reduce rendering cost but must never remove evidence, entities or training conditions.

## Training rules

- Separate private scenario truth, delivered sensor evidence, trainee knowledge, and instructor projection. Trainee UI, assistant and active-session trainee exports must not reveal hidden identity, expected rubric, future routes or internal entity IDs.
- Acknowledgement must work from a neutral sensor track; visual ray picking is supplementary. Detection latency starts when qualifying evidence is delivered to the trainee.
- Keep object type, coordination, affiliation and threat level separate. “Unknown” can be correct when evidence is insufficient.
- Process investigation delays, decision consequences, zone events and completion on simulation ticks. Opening an assessment panel does not pause time.
- Decisions are high-level simulated commands; no weapon operation controls. Assessment requires authorization before an abstract simulated response.
- Score with the versioned 25/30/20/25 rubric in the PRD. Do not represent the existing four-value match counts as the new score. Preserve revisions, accepted/rejected commands, consequences and evidence available at decision time.
- Record interruptions, instructor modification and assistance use. Practice/demo/legacy/interrupted attempts do not unlock competency.
- Use the trainee projection for the local explainable assistant. Do not fabricate calibrated AI probabilities.

## Engineering and verification

Make changes in the order of the implementation roadmap. Finish one briefing-to-AAR exercise before broadening scenario variety or adding the 3D command room. Keep deterministic seeds and resolved scenario/rubric versions so attempts are reproducible. Store full AAR history durably; the current bounded in-memory event arrays are insufficient for persistence.

Run relevant simulation tests and the production build for code changes. Validate asset/provenance changes with the asset verification tools. Browser checks must test the actual trainee path and the shared instructor session. Keep [VERIFICATION.md](VERIFICATION.md) explicit about current results, unverified targets and historical evidence.
