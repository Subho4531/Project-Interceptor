---
name: tactical-umg-ui
description: Military & Tactical UI/UX design in Unreal Engine UMG and Slate. Implements heading compass tape, crosshair reticles, azimuth/elevation readouts, high-contrast alert states, and responsive HUD telemetry widgets.
---

# Tactical UMG & HUD Design Skill

This skill governs the aesthetic and technical patterns for modern military, aerospace, and defense heads-up display (HUD) interfaces built in Unreal Engine 5 UMG and C++.

---

## 1. Visual Design Tokens ("The Tactical Vibe")

### 1.1 Color Hierarchy
* **Void Background**: `#080C13` (Deep graphite / near black, opacity 85-92%)
* **Border Trim**: `#1E293B` (Subtle 1px tactical divider)
* **Status Nominal / Cyan**: `#00F0FF` (Telemetry readouts, bearing indicators)
* **Active Radar / Emerald**: `#00FF88` (Confirmed detection, friendly targets)
* **Advisory / Amber**: `#FFB300` (Potential concern, unknown classification)
* **Critical Alarm / Coral**: `#FF2A55` (Simulated threat, immediate escalation)

### 1.2 Typography
* Headers & Numeric Tapes: Monospaced uppercase with letter-spacing (e.g. `JetBrains Mono`, `Rajdhani`, `Orbitron`).
* Data labels: 10-12pt muted slate (`#64748B`), values: 14-18pt bright cyan or amber.

---

## 2. Core Tactical Components

### 2.1 Compass / Heading Tape
A horizontal strip at the top of the HUD dynamically displaying camera azimuth ($0^\circ - 360^\circ$):
- Center tick indicates current camera Yaw.
- Cardinal markers: `N (000)`, `E (090)`, `S (180)`, `W (270)`.
- Minor ticks every $5^\circ$, numeric labels every $15^\circ$.

### 2.2 Central Reticle & Angular Coordinates
- Subtle minimalist crosshair (`+` or dual bracket `[  ]`).
- Side readouts: Elevation angle on left, Azimuth on right.
- Reticle expands on camera movement; tightens during binocular zoom.

### 2.3 Detection Trigger ("MARK DETECTION")
- Prominent bottom-center or right-aligned action widget.
- Bound to `Spacebar` and gamepad primary button.
- Transitions through 3 visual states:
  1. **Scanning**: Pulsing cyan border (`SCANNING AIRSPACE`).
  2. **Detected**: High-contrast solid emerald with audio click (`TARGET ACQUIRED: 04.4s`).
  3. **Locked / Classifying**: Amber flash opening classification modal.

---

## 3. UMG C++ Architecture Pattern

Always create a C++ base class inheriting from `UUserWidget` with `meta = (BindWidget)` pointers, and derive the visual Widget Blueprint in editor:

```cpp
#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "TrainingHUDWidget.generated.h"

class UTextBlock;
class UProgressBar;
class UButton;

UCLASS(Abstract)
class PROJECTINTERCEPTOR_API UTrainingHUDWidget : public UUserWidget
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category = "Tactical HUD")
    void UpdateBearing(float HeadingDegrees);

    UFUNCTION(BlueprintCallable, Category = "Tactical HUD")
    void SetMissionTimer(float ElapsedSeconds);

    UFUNCTION(BlueprintCallable, Category = "Tactical HUD")
    void OnDroneDetected(float DetectionLatency);

protected:
    UPROPERTY(meta = (BindWidget))
    TObjectPtr<UTextBlock> Text_HeadingValue;

    UPROPERTY(meta = (BindWidget))
    TObjectPtr<UTextBlock> Text_MissionTimer;

    UPROPERTY(meta = (BindWidget))
    TObjectPtr<UButton> Button_MarkDetection;

    UPROPERTY(meta = (BindWidget))
    TObjectPtr<UTextBlock> Text_DetectionStatus;
};
```
