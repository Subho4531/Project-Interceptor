# Vibecoding Playbook & Agent Guidelines

## Project: Drone Threat Simulation Trainer
**Philosophy**: Architect in structured C++, style in Blueprints & UMG, steer via targeted Agent Prompts.

---

## 1. What is "Vibecoding" in Simulation & UE5?

Vibecoding is high-leverage development where:
1. **You steer**: Define data contracts, high-level architecture, tactile aesthetic targets ("vibes"), and acceptance criteria.
2. **AI Agents code**: The agent generates production-grade C++ subsystems, telemetry buses, JSON serializes, math formulas, and widget logic.
3. **You verify**: Rapid visual and behavioral iteration in the engine.

To make vibecoding succeed in Unreal Engine, you must eliminate ambiguity by enforcing **strict architectural separation**.

---

## 2. The Iron Separation Rule

> [!IMPORTANT]
> **Keep all game intelligence OUT of Blueprint spaghetti graphs!**  
> AI coding agents excel at C++, data structures, and text-based logic, but struggle to edit binary `.uasset` Blueprint node noodles without errors.

| System Domain | Language / Tool | Rationale |
| :--- | :--- | :--- |
| **State Machine, Scenario Lifecycle** | **C++** (`AScenarioManager`) | Clean enum state transitions, testable in headless tests. |
| **Telemetry & Event Bus** | **C++** (`UTrainingEventSubsystem`) | Immutable structs, microsecond timing, JSON serialization. |
| **Scoring Formula** | **C++** (`UScoringSubsystem`) | Pure mathematical functions, deterministic unit tests. |
| **Data Models & Schemas** | **C++** (`USTRUCT` / JSON) | Strict types, easily extended for AI-enabled phases. |
| **UI Aesthetics & Layout** | **UMG / Blueprints** | Fluid layout styling, responsive anchors, font styling. |
| **Materials, Lighting, FX** | **Blueprints / Lumen** | Real-time visual feedback, Day/Night lighting parameters. |
| **Camera & Binocular Zoom** | **Blueprint / Camera Component**| Smooth camera interpolation, post-process vignette. |

---

## 3. Tactical Aesthetic Guidelines ("The Vibe")

The simulation should feel like a **modern defense tactical training console**:

* **Color Palette**:
  * Background: Deep slate / Charcoal (`#0B0F17`)
  * Primary Accent: HUD Cyan / Tactical Green (`#00F0FF` / `#00FF88`)
  * Threat Warning: High-vis Amber / Alert Red (`#FFB300` / `#FF2A55`)
  * Typography: Crisp monospaced headers (`JetBrains Mono`, `Rajdhani`, or `Inter`)
* **HUD Layout**:
  * Clean, unobtrusive perimeter elements.
  * Heading / Compass tape at the top center.
  * Elapsed mission timer at top-right.
  * Single, high-contrast **MARK DETECTION** button or keyboard binding (`Spacebar`).
  * Minimalist crosshair / reticle with angular coordinate readouts.
* **Audio Feedback**:
  * Subtle low-frequency drone propeller hum (3D spatialized with distance attenuation).
  * Tactile mechanical click on detection mark.
  * Crisp radio/scanner chime when modal opens.

---

## 4. Agent Prompts Library (Copy-Paste Prompts)

Use these targeted prompts to have coding agents generate each component with zero friction:

### Prompt 1: Telemetry Event Subsystem
```markdown
Context: UE 5.4 C++ Drone Threat Simulation Trainer.
Task: Create UTrainingEventSubsystem as a UGameInstanceSubsystem.
Requirements:
1. Define ETrainingEventType enum (SCENARIO_STARTED, DRONE_SPAWNED, DRONE_VISIBLE, PLAYER_DETECTION, CLASSIFICATION_SUBMITTED, RESPONSE_SELECTED, SCENARIO_COMPLETED).
2. Create FTrainingEvent struct with EventId (FGuid), SessionId (FGuid), ScenarioId (FString), Timestamp (double), EventType, and DataPayload (FString JSON).
3. Provide LogEvent(), GetSessionEvents(), and ExportSessionToJson() functions.
4. Broadcast OnTrainingEventLogged dynamic multicast delegate for UI bindings.
5. Provide thread-safety and zero allocations on hot paths.
```

### Prompt 2: Drone Entity with Spline Movement
```markdown
Context: UE 5.4 C++ ADroneActor for aerial target observation.
Task: Implement ADroneActor moving along a USplineComponent.
Requirements:
1. Expose configurable SpeedMps, FlightSpline, and AltitudeOffset to Blueprint.
2. Tick moves drone along spline based on DeltaTime * SpeedMps.
3. Broadcast OnDroneReachedWaypoint and OnDroneCompletedFlightPath delegates.
4. Implement a line-of-sight raycast helper CanBeSeenFrom(FVector ObserverPos) returning bool based on collision trace ignoring itself.
```

### Prompt 3: Deterministic Scoring Engine
```markdown
Context: UE 5.4 UScoringSubsystem.
Task: Implement pure deterministic scoring calculation matching PRD specs.
Formula:
- Detection Score (30%): Max(0, 100 - (Latency / MaxLatency) * 100).
- Classification Score (30%): 100 for exact match, 50 for adjacent caution, 0 for miss.
- Decision Score (30%): 100 for SOP match, scaled penalties for under/over escalation.
- Response Latency Score (10%): Evaluated from detection to final action.
Provide unit-testable C++ methods: EvaluateSession(const TArray<FTrainingEvent>& Events, const FScenarioDefinition& ScenarioDef) -> FTrainingScoreResult.
```

### Prompt 4: Scenario Manager State Machine
```markdown
Context: UE 5.4 AScenarioManager actor.
Task: Implement the training scenario state machine and lifecycle coordinator.
States: Unloaded -> Initializing -> Standby -> Running -> DroneVisible -> Detected -> Classified -> Responded -> Completed.
Expose BlueprintNativeEvents for UI transitions while keeping all timing and event dispatch in C++.
```

---

## 5. Rapid Prototyping & Free Asset Sourcing

For the rural/semi-industrial environment:
* **Terrain & Textures**: Poly Haven (CC0 4K ground textures), ambientCG.
* **Industrial Structures & Props**: Fab (Megascans / Unreal Marketplace free industrial kit).
* **Quadcopter Drone Model**: Free CC0 drone models on Sketchfab or standard primitive drone scaffold.
* **Audio**: Free tactical UI sound packs from Soniss GDC Archive or Freesound.

---

## 6. Coding Agent Quality Checklist

Before committing code written by an agent, verify:
- [ ] **No Hardcoded Paths**: Content paths use `TEXT("/Game/...")` references or DataAsset soft pointers.
- [ ] **Pure Types in Headers**: Minimal includes in `.h`, forward declare classes (`class USplineComponent;`).
- [ ] **Deterministic Floating Point**: Avoid frame-rate dependent math; multiply by `DeltaTime`.
- [ ] **JSON Safety**: All JSON parsers handle malformed fields gracefully with fallback defaults.
- [ ] **Event Telemetry Verified**: All 7 lifecycle events trigger in chronological sequence.
