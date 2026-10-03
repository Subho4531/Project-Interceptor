---
name: ue5-core
description: Unreal Engine 5 C++ Architecture & Subsystems Specialist. Covers UGameInstanceSubsystem, Actor lifecycle, Unreal Build Tool (UBT), USplineComponent, LineTraceSingleByChannel raycasting, Enhanced Input, and JSON serialization.
---

# Unreal Engine 5 Core & C++ Simulation Skill

This skill provides expert patterns, conventions, and implementations for Unreal Engine 5.4+ C++ simulation projects.

---

## 1. Architectural Guardrails

### 1.1 The "Iron Separation" Rule
- **C++ Exclusively**:
  - State machines, scenario lifecycle management, and timer countdowns.
  - Telemetry event logging, thread safety, and JSON serialization.
  - Mathematical scoring formulas and evaluation matrices.
  - Kinematic calculations, spline interpolation, and raycast traces.
- **Blueprints / UMG Exclusively**:
  - Visual layout, responsive anchoring, fonts, animations, and palette styling.
  - Audio asset references and attenuation radius settings.
  - Level geometry, lighting presets (Day / Night), and Post-Process Volumes.

### 1.2 Include Hygiene & Compilation Speed
- Always forward declare classes in header files (`class USplineComponent;`, `class UCameraComponent;`).
- Include the minimum necessary headers in `.h`; place full component headers in `.cpp`.
- Ensure `#include "YourClass.generated.h"` is strictly the **last** include in any UObject/AActor header.

---

## 2. Core Subsystems Pattern

### 2.1 GameInstance Subsystem (`UGameInstanceSubsystem`)
Use `UGameInstanceSubsystem` for systems that must persist across level changes (e.g., telemetry bus, scoring engine):

```cpp
#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "TrainingEventSubsystem.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnTrainingEventLogged, const FTrainingEvent&, Event);

UCLASS()
class PROJECTINTERCEPTOR_API UTrainingEventSubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()

public:
    virtual void Initialize(FSubsystemCollectionBase& Collection) override;
    virtual void Deinitialize() override;

    UFUNCTION(BlueprintCallable, Category = "Simulation|Telemetry")
    void LogEvent(ETrainingEventType EventType, const FString& PayloadJson = TEXT("{}"));

    UFUNCTION(BlueprintPure, Category = "Simulation|Telemetry")
    const TArray<FTrainingEvent>& GetSessionEvents() const { return SessionEvents; }

    UFUNCTION(BlueprintCallable, Category = "Simulation|Telemetry")
    FString ExportSessionToJson() const;

    UPROPERTY(BlueprintAssignable, Category = "Simulation|Telemetry")
    FOnTrainingEventLogged OnEventLogged;

private:
    UPROPERTY()
    TArray<FTrainingEvent> SessionEvents;

    FCriticalSection TelemetryLock;
};
```

---

## 3. High-Precision Raycasting & Frustum Checks

### 3.1 Multi-Point Line of Sight Trace
```cpp
bool CheckLineOfSight(UWorld* World, const FVector& ObserverEyeLocation, const AActor* TargetActor)
{
    if (!World || !TargetActor) return false;

    FCollisionQueryParams QueryParams;
    QueryParams.AddIgnoredActor(TargetActor);
    QueryParams.bTraceComplex = false;

    FHitResult HitResult;
    const FVector TargetCenter = TargetActor->GetActorLocation();

    const bool bHit = World->LineTraceSingleByChannel(
        HitResult,
        ObserverEyeLocation,
        TargetCenter,
        ECC_Visibility,
        QueryParams
    );

    // If no blocking hit occurred, line of sight is clear
    return !bHit;
}
```

---

## 4. JSON Serialization with `FJsonObjectConverter`

```cpp
#include "JsonObjectConverter.h"

FString SerializeScenarioDef(const FScenarioDefinition& Def)
{
    FString OutputString;
    TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&OutputString);
    FJsonObjectConverter::UStructToJsonObjectString(Def, OutputString);
    return OutputString;
}

bool DeserializeScenarioDef(const FString& JsonString, FScenarioDefinition& OutDef)
{
    return FJsonObjectConverter::JsonObjectStringToUStruct(JsonString, &OutDef, 0, 0);
}
```
