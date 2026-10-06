# Project Interceptor — Technical Architecture

**Version:** 4.0 · 6 October 2026

**Runtime today:** React 19 + TypeScript + Vite, Babylon.js/WebGL2, MapLibre; static build with local assets

**Target:** Extend the existing runtime for the [PRD v4](PRD.md), in the order defined by the [roadmap](IMPLEMENTATION_PLAN.md).

## Current implementation

`src/simulation/` holds a fixed-step, headless world model, authored routes, training state, terrain-height logic and a radar/EO sensor engine. `src/session/SessionController.ts` owns the simulation, loads and validates local GLBs/regional assets, schedules time, and publishes session snapshots. `src/rendering/` owns the Babylon.js scene, imported terrain and aircraft, camera, observer controls and EO rendering. `src/dashboard/` owns the instructor map and assistant; `src/ui/` contains the trainee observer, panels and routing. All three posts use a local 6 × 6 km georeferenced terrain asset and heightfield. The dashboard and trainer share one controller in one browser tab.

The current trainer still starts with visual observation and uses a four-value concern classification with a basic rubric match review. The new scenario/evidence/scoring/persistence contracts below are architectural targets until implemented. Do not represent target interfaces as currently shipped.

## Runtime boundaries

```text
               Authoring + seeded generator
                         |
                   ResolvedScenario
                         |
               Simulation / truth state
                         | fixed simulation ticks
       +-----------------+-------------------+
       |                 |                   |
    Sensor models    Consequence queue   Event recorder
       |                 |                   |
       +--------- Evidence delivery ----------+
                         |
                  Track association
                         |
          +--------------+--------------+
          |                             |
   Trainee projection              Instructor projection
          |                             |
   Console / 3D panels             Dashboard / AAR truth
          |                             |
   Assistant + commands --------> SessionController
                         |
                Versioned local record
                         |
             AAR replay / progress / export
```

The controller is authoritative for session state and simulation time. Rendering, React updates, map tiles, assistant language, and review playback cannot advance a second simulation. Desktop console, command-room screens and later WebXR input use the same validated command API. No cloud service is required for core training.

## Versioned data contracts

Implement these contracts in pure TypeScript without React or Babylon imports:

| Contract | Minimum responsibility |
| --- | --- |
| `ExerciseDefinition` | ID/version, level, objectives, mode, template, completion criteria, rubric ID |
| `ResolvedScenario` | Generator version/seed, post, conditions, population, routes, sensor profiles, authorization rules, fallback flag |
| `ScenarioTruth` | Private identity, affiliation, group membership, authored behaviour, ground-truth outcome |
| `EvidenceObservation` | Neutral contact reference, source, measured facts, quality, uncertainty, capture/delivery time, availability |
| `ObservedTrack` | Neutral track ID, association history, measurement history, acquisition/coasting/lost state |
| `ContactAssessment` | Object type, coordination, affiliation, threat level, time, revision history |
| `DecisionAction` | Contact/group, action, time, supporting evidence IDs, authorization/command result |
| `TrainingRubric` | Version, objectives, acceptable assessments by evidence stage, decision graph, component weights and critical errors |
| `ScoreBreakdown` | Four component scores, per-objective explanations, overall score, eligibility and critical errors |
| `SessionRecord` | Profile/session IDs, versions, resolved config, ordered events, checkpoints, interruptions, outcome and scores |

Each record uses simulation time plus a monotonic sequence for stable ordering. Use simulation ticks for sensor sampling, delivery delays, decisions and consequences. Wall time is metadata only. An event records the issued command and accepted/rejected result, not merely the selected button.

### Truth and trainee privacy

The renderer and instructor projection may use `ScenarioTruth`. Trainee-facing components, their exports and the assistant receive only delivered evidence and the trainee’s own reports/actions. Do not pass the current instructor `SessionSnapshot` directly to the new trainee console and filter fields in JSX. Create a dedicated projection at the simulation/session boundary.

Internal entity IDs and model URLs must not become trainee track IDs. A measured return can correspond to several entities, and detections can split or merge. Sensor acquisition quality is not a hostility probability. Track association history supports replay and review without exposing future ground truth.

Assistant rules consume the same trainee projection. Guided practice may return investigation guidance; assessed mode returns evidence summaries/hypotheses without the rubric or expected actions. Instructor truth is never offered through assistant wording or export before completion.

## Simulation and sensor pipeline

At each fixed tick, update world entities and zone crossings; sample radar, EO and later RF and authorization data according to configured health; queue delayed observations; deliver due evidence; associate and age tracks; process accepted commands; schedule and apply consequences; append ordered events; publish projections. A browser render frame can contain several fixed ticks. Views interpolate rendering only.

Define four distinct times: object introduced, observation captured, evidence delivered/presented, and trainee acknowledged. Scored detection latency uses the latter two. A delayed observation cannot retroactively start the trainee’s response timer at capture time. Pause holds the entire simulation clock, including queued evidence and consequences.

The current radar/EO engine can seed the measured evidence layer but requires explicit delivery queues, neutral track association, false returns, RF, authorization, and versioned histories. EO cueing starts at measured coordinates; subsequent following requires fresh acquisition. Sensor health changes signal availability and quality, not hidden affiliation labels.

Generate constrained scenarios with separate random streams. Validate world geometry and modeled coverage, then objective solvability before creating an assessed session. Store the fully resolved scenario; rerunning from it and the same command transcript must reproduce events and scores. A bounded generator fallback is an explicit record field.

## Decisions, scores and AAR

A decision graph maps evidence stages and situation conditions to accepted high-level action paths. It supports alternative ordering where valid. Requesting authorization is separate from receiving it, and only the scenario rule grants it. Consequence events occur on future ticks; response commands do not instantly remove aircraft.

Score at completion using the stored rubric version and event/evidence history. Components are detection 25%, classification 30%, threat assessment 20%, and decision quality 25%. Detection uses first qualifying delivered evidence and acknowledgement. Classification scores object type/coordination/affiliation within its component at 50/30/20. Decision quality checks verification/proportionate action/follow-through at 30/40/30. Average applicable objectives before final weighting, and do not double penalize one error. The result stores explanations and progression eligibility.

AAR replay reconstructs what the trainee knew at a selected time from ordered evidence/decisions and checkpoints. Instructor truth is a separate optional layer available after completion. Replay is read only and cannot drive the live controller or change scores.

## Local persistence and file exchange

Use IndexedDB for profiles, session metadata, event chunks, checkpoints every five simulation seconds, AARs and progress. The current in-memory event arrays are bounded; do not use their array length as a durable persistence cursor. Append with monotonic sequence numbers and persist regularly. On reload, recover an interrupted record for review instead of resuming an assessment silently. If persistence fails, show a warning and allow an in-memory export.

Version exported JSON. Imports validate schema and supported versions, deduplicate by profile/session IDs, preserve provenance, and reject malformed bundles. Old v2/v3 exports stay as unscored legacy records; do not fabricate four component scores. Unit aggregation groups by level, mode and rubric version and remains file based.

The offline app packages training assets and regional imagery locally. Internet basemaps are optional decoration. All asset provenance and license notices must travel with the static build.

## UI, rendering and XR

Use the existing React routing and Babylon.js scene. The new /trainer console is the assessed entry; the outdoor observer remains accessible for supplementary practice/evidence. Instructor /dashboard keeps its current map and session controls but must make assessment-invalidating changes explicit. The later command-room interior uses imported validated models and maps its screens to the existing trainee commands. A focused desktop panel must remain readable independent of scene camera position.

For VR, add a Babylon.js WebXR input/view adapter after desktop release. Seated controller ray selection is the baseline; standing, teleportation and snap turn are optional. XR session loss uses the same interruption policy. Record input mode in AAR. A headset accessing a different host needs an appropriate trusted HTTPS context. No VR support is claimed until a named real device passes interaction, legibility, comfort and frame-rate checks.

## Verification contracts

Unit tests: tick ordering; delayed evidence; neutral track privacy; justified unknown; accepted decision paths; authorization; exact score fixtures; seeded repeat; generator solvability; interruption/eligibility; persistence/import migration. Browser checks: all posts; direct routes; offline core workflow; Chrome/Edge at 720p and 1080p; map/EO failure recovery; repeated resets; memory/resource stability; measured frame times. A desktop run is complete only when briefing, cue, investigation, assessment, action, consequence and AAR work through the trainee interface.
