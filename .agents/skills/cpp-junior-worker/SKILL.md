---
name: cpp-junior-worker
description: Operational playbooks and coding standards for junior C++ workers spawned in parallel branches by Senior Leads.
---

# Junior C++ Worker Operational Skill

This skill defines conventions, task scopes, and safety constraints for `junior_cpp_worker` subagents executing parallelized development tasks.

---

## 1. Task Execution Protocol

### 1.1 Scope Boundaries
* Junior agents execute **atomic, well-bounded tasks** assigned by a senior lead.
* Examples of allowed junior tasks:
  * Generating scenario configuration JSON files.
  * Writing C++ struct definitions and enum declarations with UE5 reflection macros (`UPROPERTY`, `UENUM`).
  * Creating isolated unit test fixtures (`IMPLEMENT_SIMPLE_AUTOMATION_TEST`).
  * Implementing isolated pure math helper functions (e.g. angular subtense formula).
* Junior agents must **NEVER**:
  * Alter core architecture contracts without lead instructions.
  * Delete or overwrite existing subsystem files indiscriminately.
  * Violate the "Iron Separation" rule.

---

## 2. Unreal Engine 5 C++ Standards

### 2.1 Prefix Conventions
* `A` for Actors (`ADroneActor`, `AScenarioManager`)
* `U` for UObjects/Subsystems/Components (`UTrainingEventSubsystem`, `UScoringSubsystem`)
* `F` for plain C++ Structs (`FTrainingEvent`, `FScenarioConfig`)
* `E` for Enums (`ETrainingEventType`, `EDroneClassification`)
* `I` for Interfaces (`IControllableActor`)

### 2.2 Include Discipline
* Never include heavy headers in `.h` if a forward declaration suffices:
  ```cpp
  class USplineComponent;
  class UCameraComponent;
  ```
* In `.cpp`, include specific headers, never monolithic umbrellas unless required.
* Ensure `#include "ClassName.generated.h"` is always the final include in any UObject/AActor header.

---

## 3. Parallel Reporting Handoff
Upon completion of a parallel task:
1. Validate code syntax and compile safety.
2. Send a structured completion message back to the Senior Lead via `send_message`:
   * Files created or edited.
   * Summary of logic implemented.
   * Unit tests or verification steps performed.
