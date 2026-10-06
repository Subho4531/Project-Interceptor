# Project Interceptor — Product Requirements Document

**Version:** 4.0 · 6 October 2026

**Implementation update:** the desktop prototype now includes five sensor-led cases, constrained seed variation, sensor degradation, competency levels, profile/unit history, replay and JSON transfer, imported command-room controls and a seated WebXR adapter. The original requirements remain the acceptance target. Independent IR, broader physical benign populations and real PC-headset acceptance are not yet verified or complete; consult VERIFICATION.md before making product claims.

**Requirement source:** SIH26247 text supplied by the project owner

**Delivery:** Offline capable desktop training first; immersive VR in a later milestone

**Current stack:** React 19, TypeScript, Vite, Babylon.js, WebGL2, MapLibre

## Product goal

Train personnel to notice unusual aerial activity, investigate incomplete sensor evidence, classify what they observe, assess risk separately, make proportionate high level decisions, and learn from an after action review (AAR). Classroom instruction and limited live fire drills do not provide affordable, repeatable exposure to single UAVs, benign activity, and coordinated groups across varied conditions.

The primary exercise is **briefing → sensor cue → acknowledgement → investigation → classification → threat assessment → decision sequence → consequence → AAR**. The trainee does not know in advance whether an observation represents a UAV, several independent UAVs, a coordinated group, a friendly flight, wildlife, a sensor false return, or an unresolved object. Finding a tiny model manually in the sky is not the required entry point.

This is a fictional training prototype. It does not model weapon operation, certify operational doctrine, use real sensor feeds, or reproduce real border installations.

## Decisions and current baseline

- Deliver one complete desktop loop first. VR is a separate later acceptance milestone.
- Use guided practice with competency gated assessments. Keep practice open.
- Store individual attempts on each device; exchange validated files to consolidate unit results. No cloud service is required.
- Use deterministic, explainable local rules for sensor fusion and assistant output. Qualitative support is not calibrated ML probability.
- Assessment time continues through reading panels and entering answers. Interruptions pause safely and invalidate progression eligibility.
- Keep the Babylon.js runtime, fixed simulation step, shared session, instructor dashboard, and three existing environments. Older PlayCanvas specifications are superseded.

The implemented posts are Shakti/Punjab, Maru/Rajasthan, and Himadri/Sikkim. They have locally packaged regional terrain, compound assets, aircraft models, collisions, licenses, and provenance. The existing outdoor observer, four authored flight exercises, radar/EO observations, map dashboard, and basic review remain available. The current classification combines identity and concern, and the review counts matches; the new scoring and full AAR are future requirements until implemented.

## Audience, modes, and navigation

The trainee selects a local profile, enters practice or an unlocked assessment, receives a neutral briefing, investigates, and reviews results. The instructor configures post, level, seed, sensors, and mode; monitors the same simulation; and can inspect authored truth. Local role separation protects the exercise interface but is not tamper resistant examination security. Opening instructor truth during an assessment marks it ineligible for progression.

| Route | Purpose |
| --- | --- |
| `/` | Profile, curriculum, progression, recent attempts |
| `/trainer` | Main sensor led trainee experience |
| `/dashboard` | Existing instructor console and truth view |
| `/aar/:sessionId` | Completed attempt, scores, read only replay |
| `/progress` | Individual and imported unit trends |

Preserve direct route loads, static hosting, and subdirectory deployments. Keep outdoor observation as a supplementary familiarisation and evidence view. Rendering can use private truth, but trainee panels and assistant inputs must receive only a trainee projection.

**Practice** permits pause and optional hints. **Assessment** runs at 1×, locks configuration, removes hints, and keeps time moving while panels are open. **Instructor demo** permits override without awarding competency. Hidden tabs, renderer loss, or interruption pause the clock, record the interruption, and prevent that attempt from unlocking a level.

## Scenario specification

Separate **environment** (post, terrain, protected zone, lighting, weather, visibility), **situation** (population, authorization, behaviour, schedules, sensor state), and **exercise** (learning objective, difficulty, rubric, evidence opportunities, completion).

| Dimension | Required values |
| --- | --- |
| Setting | Existing rural, desert, mountain posts; fictional semi urban compound later |
| Conditions | Day/night; clear/fog; rain in the advanced environment milestone |
| Population | Single UAV, independent UAVs, coordinated group, friendly UAV, birds, sensor only false return |
| Behaviour | Passing, approaching, loitering, turning, departing |
| Sensors | Normal, delayed, noisy, intermittent, unavailable |
| Difficulty | Foundation, intermediate, advanced |
| Source | Authored showcase or constrained seeded variant |

“Unknown” describes what the trainee can infer, not an absence of internal scenario truth. A recognizable airframe does not automatically establish affiliation or hostility. Track count need not equal entity count: returns may split, merge, coast, disappear, or be reacquired.

Generation uses independent seeded streams for population, behaviour/routes, sensors, and weather. Before starting, validate terrain clearance, protected zone relationships, modeled sensor coverage, usable evidence, and sufficient response time. Reject invalid combinations. After bounded retries, use a packaged valid fallback and record it. “Repeat” preserves the resolved configuration and seed; “New variant” changes the seed. Rendering quality never changes the situation. Sensor ranges are fictional training parameters rather than equipment claims.

The four first authored situations are:

1. **Basic detection:** daytime single contact, functioning sensors; acknowledge, verify, classify, assess, report.
2. **Ambiguous activity:** night and reduced visibility, weak returns, no decisive RF, later non UAV evidence; preserve uncertainty and avoid unnecessary escalation.
3. **Coordinated incident:** converging contacts with degraded evidence; compare history, recognize coordination, assess urgency, alert/report, request authorization, and request an abstract response if granted.
4. **Friendly flight:** UAV and matching fictional authorization record; verify and avoid treating every UAV as a threat.

Showcase names and expected outcomes are instructor facing. Trainee briefings show neutral exercise codes and objectives. Existing low ingress, surveillance, penetration, and swarm flight exercises become legacy familiarisation patterns; the supplied problem statement does not define these as its exact four categories.

## Trainee workspace and evidence

The first complete desktop release has a tactical map and observed histories, radar, EO cueing/view, RF observations, fictional flight authorization lookup, selected contact investigation, classification and threat assessment, decisions/alerts, sensor health, local analysis assistant, and ordered event feed. Then add an imported reusable 3D command room with wall map, radar, EO/IR, RF, and operator station. Focused readable panels remain available. Outdoor visual observation adds evidence but is not mandatory for detection.

Each evidence item records source, capture time, delivery time, age, measured values, uncertainty, quality, and availability. Store distinct timestamps for object introduction, first qualifying evidence delivered to the trainee, acknowledgement, investigation request/return, assessment revisions, decisions, and consequences. **Scored detection latency begins at first qualifying delivered evidence**, not hidden spawn time. Spawn to acknowledgement is a separate AAR diagnostic.

Acknowledging a displayed track creates a neutral contact report. Investigation can cue EO from measured position, request RF, inspect measured movement, query a fictional roster, compare related tracks, and request verification. Requests consume configured simulation time. EO can fail through occlusion or poor visibility. RF silence and a missing roster match do not independently prove threat. Automatic EO following depends on continued acquisition rather than hidden truth.

The assessment records four independent fields:

| Field | Values |
| --- | --- |
| Object type | UAV, non UAV, unknown |
| Coordination | Single, multiple independent, coordinated group/swarm, unknown |
| Affiliation | Authorized/friendly, confirmed unauthorized, unconfirmed |
| Threat level | Low, medium, high, critical |

The UI may summarize “friendly UAV” or “possible swarm,” but stores the fields separately. Assessment revisions remain in event history. A later correction does not erase an earlier action. “Unknown” can earn credit when evidence is insufficient. Threat level depends on behaviour, proximity, authorization, and available evidence, separately from aircraft type.

## Assistant, decisions, and consequences

The offline rule based assistant consumes only trainee visible evidence. It explains ranked hypotheses, supporting and conflicting observations, evidence age, limitations, and missing information. Guided practice can suggest investigation steps. Assessment removes coaching and expected actions and logs assistant use. Show qualitative support, not invented percentages. The assistant cannot submit an answer or command a response.

Available high level actions: continue monitoring; request verification; raise local alert; report to command; mark suspected threat; request authorization; initiate an authorized simulated response. A configurable decision graph accepts more than one valid action order. The exercise authorization rule returns pending, granted, or denied; the trainee cannot grant their own request. Actions schedule observable results: new evidence, acknowledgement, alert state, abstract response outcome, or continued flight and possible fictional zone crossing. A target does not disappear just because a response control was pressed.

## Curriculum and progression

| Level | Competency | Exercise shape |
| --- | --- | --- |
| 0 Familiarisation | Controls, evidence age, reports | Guided unscored walkthrough |
| 1 Detection and verification | Notice/investigate one contact | Strong daytime evidence |
| 2 Ambiguity and restraint | Friendly flight, wildlife, uncertainty | Incomplete/conflicting evidence |
| 3 Prioritisation | Multiple contacts and revisions | Mixed benign and concerning activity |
| 4 Coordinated incident | Coordination under degradation | Multiple contacts, partial sensor loss |

Every level has guided practice, unassisted practice, and assessment. Unlock the next level after **two assessments on distinct seeds** scoring **at least 80 overall and 60 in each component**, with **no critical decision error**, under the current rubric version. Practice is always available. Interrupted, aborted, instructor modified, demo, and legacy attempts remain in history but do not unlock progression. Instructor demo override does not award competency.

Difficulty changes information quality and workload, not merely object count. Foundation gives timely clear evidence. Intermediate delays and weakens evidence. Advanced combines clutter, benign objects, conflict, and outages. Every generated assessment remains solvable.

## Scoring and AAR

**Overall = 25% detection + 30% classification + 20% threat assessment + 25% decision quality.** These are versioned prototype defaults requiring subject matter review before operational adoption.

- Detection: 100 within five simulation seconds of first qualifying delivered cue; linear decay to zero by 60 seconds. An exercise that never delivers required evidence is invalid, not a trainee miss.
- Classification: object type, coordination, affiliation contribute 50/30/20 within the component. The evidence stage rubric may accept unknown.
- Threat assessment: 100 for an accepted evidence supported level, 50 for a rubric approved adjacent level, else zero.
- Decision quality: verification 30, proportionate action 40, follow through 30. The decision graph supplies valid paths at evidence milestones.
- An unauthorized simulated response yields zero decision quality and fails assessment competency; retain its diagnostic overall score.

Average applicable **learning objective** scores before weights. One group does not outweigh the curriculum simply because it contains more aircraft. Do not subtract a second overall penalty for an error already scored in a component. Rubrics can accept cautious uncertainty and alternative action order. Store rubric version and explanation.

AAR shows component scores/reasons; introduction, first evidence, acknowledgement and latency; missed objectives and unnecessary actions; evidence available at each revision and decision; authorization and consequences; zone events; ground truth after completion; and targeted practice advice. Replay switches between the trainee’s historical knowledge and instructor truth without affecting a live session. Keep individual trends and imported unit aggregates separated by level and rubric version.

## Release and acceptance

Core training must run from a locally hosted static build with packaged assets, fonts, and regional imagery, without online basemaps, cloud accounts, or remote AI. Retain all asset attribution and license conditions. Verify Chrome and Edge at 1280×720 and 1920×1080. Target at least 30 FPS at 1280×720 on the previously recorded Ryzen 5 5600H/Radeon integrated graphics system; publish measured settings, scenario, and frame times rather than assuming the target is met.

Accept only when: one desktop exercise runs briefing to AAR; trainee projections reveal no hidden/future truth; radar/EO/RF uncertainty and benign cases work; decisions cause recorded outcomes; scoring/replay reproduce from seed, evidence and actions; qualifying progression rules hold; local attempts survive reload/export/import; all three posts retain collision/map alignment; repeated resets do not leak entities/listeners/resources; and offline/browser/performance results are documented.

The later Babylon.js WebXR adapter reuses the same scenarios, commands, scores, and persistence. It provides seated controller ray interaction, readable panels, safe pause/exit, optional standing/teleport/snap turn, and desktop fallback. Real headset interaction, comfort, and frame rate checks are required before claiming VR support. A headset accessing a different device needs a trusted HTTPS setup.
