# Four trainee scenarios

## Requirements basis

The user requested four attack scenarios chosen according to the problem statement. The available project [PRD](PRD.md) identifies SIH26247 and specifies low-altitude ingress, high-altitude surveillance, perimeter penetration, swarm training, and an observation → detection → classification → decision → review loop. It does not prescribe an exact list of four attack categories. These four authored exercises implement that local requirements basis; they are not presented as a verified official PS taxonomy. Surveillance deliberately tests escalation based on behaviour rather than treating every contact as a confirmed attack.

The implementation extends the already-authorized React/Babylon trainer in `C:\Users\subho\OneDrive\Documents\Project Interceptor`. It reuses the existing Sketchfab models, maps and conditions. No new placeholder aircraft or scenery is generated.

## Authored exercises

| ID | Exercise | Aircraft used internally | Behaviour | Contacts | Illustrative review rubric |
|---|---|---|---|---:|---|
| low-ingress | Low-altitude incursion | FPV | Low approach over terrain, crossing the protected zone | 1 | Simulated threat / request simulated response |
| surveillance | Surveillance and loiter | Orlan | Two elevated orbits outside the protected zone, then departure | 1 | Potential concern / escalate-report |
| penetration | Perimeter penetration | Lancet | Descending approach and a turn across the protected post | 1 | Simulated threat / request simulated response |
| swarm | Coordinated multi-contact incursion | Geranium-2 | Two opposing pairs; second pair delayed by four seconds | 4 | Individual threat assessments / abstract response requests |

Routes use metre coordinates, fixed-step traversal, and ground-relative authored heights. Each map densifies route segments to preserve terrain clearance. This is authored training motion, not aerodynamic flight physics. Seed 26052 and the same configuration reproduce the same route and schedule. The default quiet period is 25 seconds; the exercise window is long enough for the configured routes to finish.

## Trainee flow

1. Choose a map, scenario, day/night, clear/reduced visibility and quiet period. Read the briefing and objectives.
2. Enter the post, explore with WASD and mouse, and use Z/right-click for observation optics.
3. Place a visible contact in the reticle and press E or Space. Only a ray pick against an active aircraft acquires a contact. A building or terrain hit can occlude that pick. A failed acquisition increments unacquired reports; repeated acquisition of the same entity cannot inflate detection coverage.
4. Assessment holds simulation time. Choose one of four classifications and then one of four response decisions. Changing classification clears the previous response. C or Contact reports opens existing reports. Return and resume scanning.
5. The authored exercise window or End exercise & review concludes the run. The clock freezes and aerial entities are cleared. Review shows detected/planned contacts, missed contacts, unacquired reports, actual zone entries and per-contact submitted choices. Manual early completion counts all configured contacts, including ones whose spawn time has not arrived, as the planned coverage denominator.
6. Repeat clears contacts, decisions, review, entities and time while preserving selected conditions. Choose another exercise starts a fresh configuration. Export review JSON downloads configuration identity, seed, conditions and the review/report data locally.

Trainee state contains neutral Contact 01 aliases, observed bearings and submitted decisions. It does not expose model IDs, routes, unseen contact counts or expected answers before completion. Developer truth remains isolated in the opt-in `?qa=1` diagnostics. Briefings teach the exercise focus but do not assign automatic contact classifications.

## Current scope

Rubrics are fictional exercise guidance, not approved operational SOP. Response choices record an abstract decision; they do not simulate jammer operation, weapon deployment or interception. This delivery has no certified aggregate score, continuous visibility probe, detection-latency metric, response-speed score, sensor fusion, persistent trainee history or full AAR timeline. Simulation time is held during assessment, so decision-entry speed must not be inferred from it.

The Geranium model retains its CC BY-NC-SA 4.0 noncommercial/ShareAlike requirements. Other model credits and licenses remain in [ASSETS.md](../ASSETS.md) and in settings.

## Verification

All 38 headless simulation/collision tests pass, including all four profiles on all three maps, quiet periods, terrain clearance, zone crossings, deterministic swarm reset, pause/hidden handling, missing-asset start guards, contact deduplication, per-contact review, privacy and lifecycle event order. TypeScript and the production build pass.

Connected Chrome checks cover the four-contact swarm rendering, one acquired/classified/responded contact, manual 1/4 review, a successful local JSON download, repeat clearing, the scenario selector, all three single-contact profiles, automatic perimeter review, condition/map changes and desktop/narrow layouts. The 1280×720 briefing and 1920×1080 review are visually checked. Edge and foreground FPS targets have not been verified for this delivery. See [VERIFICATION.md](../VERIFICATION.md) and `artifacts/qa/training-browser-report.json`.
