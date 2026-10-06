# Project Interceptor — Implementation Roadmap

**Version:** 4.0 · 6 October 2026

**Authority:** [PRD v4](PRD.md) defines product behaviour; [architecture](ARCHITECTURE.md) defines the current runtime and integration contracts. This roadmap builds on the delivered three regional worlds and shared instructor session. Phases are delivery gates, not claims that future work has already shipped.

## Delivery order and completion policy

Implement **documentation alignment → one complete sensor led desktop exercise → ambiguity and procedural variants → progression and history → 3D command room and environmental variety → desktop release verification → immersive VR**. Do not broaden a phase merely to add more maps or aircraft before its vertical workflow works. Each phase ends with tests, browser evidence, and an update to VERIFICATION.md that distinguishes implemented from verified behaviour.

Existing observer exercises, instructor dashboard, sourced terrain, and model licenses remain in the project. Preserve their data and navigation while moving the main trainee learning path to the new console. New assessments never use the current rubric match counts as if they were weighted scores.

## Phase 0 — Documentation and contract alignment

1. Replace the stale PlayCanvas PRD, roadmap, and architecture descriptions with Babylon.js reality and the sensor led training requirements.
2. Update repository agent guidance to preserve asset guardrails while referring to the implemented folders, event/projection contracts, and phased score.
3. Mark existing four flight exercises as legacy familiarisation and document current AAR limitations.
4. Establish versioned types for exercise, resolved scenario, private truth, delivered evidence, observed tracks, assessments, actions, rubric, attempt record, and score breakdown. Keep the runtime definitions in pure TypeScript.
5. Record document cross references and a current implementation/verification matrix.

**Gate:** documents agree on product scope, engine, mode rules, scoring, and phase status. No future feature is presented as implemented.

## Phase 1 — Complete Basic Detection exercise on desktop

**Goal:** a trainee at Shakti completes one authored, fixed seed, sensor led exercise from briefing to scored AAR. This is the first playable delivery, before a 3D control room or many scenario variants.

1. Add a neutral briefing and trainee console at /trainer, using the existing shared SessionController as the single clock. Retain outdoor observer access for familiarisation and optional visual evidence. The instructor /dashboard selects the same post, exercise, and state.
2. Extend the headless sensor pipeline so a neutral radar return becomes visible after the quiet period. Create a trainee track ID unrelated to the simulation entity ID. Record capture, delivery, and first presentation timestamps. Acknowledging the return creates a report without a model ray pick.
3. Add investigation requests: EO cue from measured coordinates, RF observation, movement history, and fictional authorization lookup. Give each a configured delay and an evidence item with source, uncertainty, age, and health. The first release uses an authored UAV case and a friendly fixture for validation. The trainee projection contains only delivered evidence.
4. Split assessment into object type, coordination, affiliation, and threat level. Record every revision and time. Allow unknown when evidence is incomplete.
5. Add the high level decision sequence, including verification, report/alert, authorization request, and authorized abstract simulated response. Process resulting events on fixed simulation steps; keep the world progressing while answer panels are open.
6. Implement the local rule assistant from trainee evidence. Show qualitative support and explanation. Practice may suggest the next investigation; assessment does not.
7. Implement the versioned rubric and weighted 25/30/20/25 score. Show component explanation and a chronological AAR. Persist the resolved exercise, seed, evidence, actions, and result locally. Provide trainee and instructor read only replay of completed attempts.
8. Keep existing instructor monitoring functional. Route changes pause/flag assessed attempts rather than silently letting the clock or score continue.

**Gate:** from a fresh static build, a trainee completes briefing → cue → acknowledgement → investigation → assessment → decisions → consequence → AAR, with no instructor UI and no mandatory sky search. An identical seed and action transcript produce the same evidence and score. The friendly fixture does not get automatic hostile labels.

## Phase 2 — Ambiguity, coordination, and procedural variants

1. Add the ambiguous non UAV showcase, the friendly flight exercise, and the coordinated incident showcase. Use imported, licensed bird visuals only where a physical bird is represented. Sensor only false returns have no 3D object.
2. Extend sensor health with seeded delay, measurement noise, intermittent delivery, outage, and false returns. Distinguish acquisition quality from threat support. Implement track coasting, loss, reacquisition, and grouping history.
3. Build constrained scenario templates for population, route/behaviour, conditions, sensor health, authorization, and evidence schedule. Use separate seeded random streams and store the fully resolved configuration.
4. Validate terrain clearance, modeled coverage, evidence availability, rubric solvability, and time budget before briefing. Use bounded retries and a recorded validated fallback.
5. Run each exercise at all three posts, accounting for the existing imported heightfields and the fictional compound layout. Group level reporting should not force a report for every member of a coordinated group.
6. Add difficulty tiers that vary information quality and workload. Renderer quality remains independent.

**Gate:** identical seed/configuration reproduces cue order, tracks, assessments and score; different seeds create meaningful variants. Tests cover UAV, independent contacts, coordinated group, friendly flight, bird group, false return, and valid unknown. No generated assessment requires unavailable evidence.

## Phase 3 — Curriculum, persistence, and unit AAR

1. Add Levels 0–4 as defined in the PRD, with guided practice, unassisted practice, and assessment. Keep all practice open. Enforce the two distinct seed, 80 overall, 60 each component, no critical error unlock rule.
2. Store local profiles, ordered event chunks, checkpoints every five simulation seconds, score explanations, and interruption/assistance flags in IndexedDB. Move AAR history away from bounded in memory arrays and length based cursors.
3. On reload, recover an interrupted record for review; do not silently resume an assessed clock. If storage fails mid run, warn visibly and offer an in memory export.
4. Implement /aar/:sessionId and /progress. Replay historical trainee evidence or instructor truth without mutating the live session. Show trends by component, level, mode, and rubric version.
5. Export versioned JSON bundles and validate imports. Deduplicate by profile/session IDs, retain source provenance, reject malformed or unsupported versions. Preserve old exports as unscored legacy history.

**Gate:** qualifying attempts unlock levels exactly; demo, instructor modified, legacy, aborted, and interrupted attempts do not. AAR and progress survive reload and transfer through a file to a second installation.

## Phase 4 — Command room and environmental variety

1. Import a reusable licensed command room interior and record provenance. Place it at each fictional post. Use wall map, radar, EO/IR, RF, and operator panels as adapters to the existing trainee commands.
2. Provide a focused desktop view for each monitor so all assessment text remains legible. The 3D room cannot become a required pointer accuracy challenge.
3. Add a fictional semi urban compound variant from imported modules. Add rain and a clearly labelled simulated IR evidence channel. Preserve local regional terrain, collision, and existing map/source credits.
4. Limit background screen refresh and reuse textures/render targets. The simulation step, evidence and scoring remain independent of graphics quality.

**Gate:** the same assessed exercise works from consolidated desktop controls and room monitors. Rural/semi urban, day/night, clear/fog/rain, single/group and degraded sensor combinations run without revealing scenario truth.

## Phase 5 — Desktop release verification

- Run deterministic unit tests for sensor timing, classification/rubrics, accepted decision orders, consequences, generation fairness, persistence/replay, and projection privacy.
- Run integration checks across all three posts, scene/heightfield alignment, route changes, pause/hidden tab, repeated resets, and asset failures.
- Inspect Chrome and Edge at 1280×720 and 1920×1080, including direct routes, offline operation, pointer lock recovery, export/import, long enough repeated runs to detect duplicate render resources, and AAR.
- Measure basic, ambiguous, and coordinated exercises on the previously recorded Ryzen 5 5600H/Radeon integrated graphics PC. Record frame times/FPS, quality, browser, resolution, and asset load failures. Target at least 30 FPS at 1280×720 and 60 FPS where feasible.
- Package a static build, licenses/provenance, sample profile, showcase fixtures, and instructor demonstration instructions.

**Gate:** the desktop feature and acceptance matrix is backed by current evidence. Any unmet browser, FPS, or offline target is reported as a limitation rather than inferred from older builds.

## Phase 6 — Immersive VR

1. Build a Babylon.js WebXR input adapter to the same session commands, evidence, scoring and persistence. Use seated interaction by default, controller ray selection, readable spatial panels, safe pause/exit, recenter, and desktop fallback.
2. Add optional standing operation, teleportation and snap turn without changing scenario truth. Log input mode in AAR so desktop and VR timing comparisons remain interpretable.
3. Serve to headsets with a trusted HTTPS context where needed. Test a named real headset/browser combination for legibility, comfort, interaction, session loss/recovery, and measured frame rate before claiming support.

**Gate:** a complete assessed scenario works on the named real headset and reproduces the desktop result for the same actions and simulation times. Exact supported headset and hardware performance requirements are selected and recorded when this deferred milestone begins.

## Cross phase invariants

- One authoritative simulation clock; rendering, UI, assistant, and replay do not advance separate copies.
- Scenario truth, sensor observation, trainee knowledge, and instructor view are distinct contracts.
- Decisions are high level and do not simulate weapon controls.
- Preserve source licenses and truthfully label georeferenced terrain and fictional compounds.
- Record scenario, generator, event schema, and rubric versions so old results are not silently rescored.
- Keep a completed phase status/evidence entry in VERIFICATION.md; roadmap text alone is not release evidence.
