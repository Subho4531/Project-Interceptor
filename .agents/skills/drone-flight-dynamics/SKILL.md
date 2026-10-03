---
name: drone-flight-dynamics
description: Aerial vehicle kinematics, 3D waypoint interpolation along splines, angular subtense visual thresholding, and multi-point line-of-sight frustum occlusion checks.
---

# Drone Flight Dynamics & Target Visibility Skill

This skill provides mathematical formulas, flight spline algorithms, and optical visibility calculation methods for small Unmanned Aerial Systems (sUAS) simulated in Unreal Engine.

---

## 1. Aerial Kinematics & Spline Trajectories

### 1.1 Spline Distance & Movement Calculation
A drone travels along a `USplineComponent` parameterized by total distance:

```cpp
void ADroneActor::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);

    if (!FlightSpline || bHasCompletedFlight) return;

    CurrentDistanceAlongSpline += CurrentSpeedMps * 100.0f * DeltaTime; // Unreal units (cm)
    const float TotalLength = FlightSpline->GetSplineLength();

    if (CurrentDistanceAlongSpline >= TotalLength)
    {
        CurrentDistanceAlongSpline = TotalLength;
        bHasCompletedFlight = true;
        OnFlightCompleted.Broadcast();
        return;
    }

    const FVector NewLocation = FlightSpline->GetLocationAtDistanceAlongSpline(
        CurrentDistanceAlongSpline,
        ESplineCoordinateSpace::World
    );
    const FRotator NewRotation = FlightSpline->GetRotationAtDistanceAlongSpline(
        CurrentDistanceAlongSpline,
        ESplineCoordinateSpace::World
    );

    SetActorLocationAndRotation(NewLocation, NewRotation);
}
```

---

## 2. Optical Visibility & Ground-Truth Detection

In real-world tactical scenarios, an aerial target is observable if and only if:
1. It is within the observer's Field of View (FOV).
2. It is not occluded by terrain, buildings, or foliage.
3. Its angular size (angular subtense) is large enough to be resolved by the human eye.

### 2.1 Angular Subtense Formula
Given the physical wingspan/diameter of the drone $d$ (meters) and observer distance $R$ (meters):

$$\theta \approx 2 \cdot \arctan\left(\frac{d}{2R}\right) \approx \frac{d}{R} \text{ (radians)}$$

In degrees:

$$\theta^\circ = \left(\frac{d}{R}\right) \cdot \left(\frac{180}{\pi}\right)$$

For human vision on a 1080p desktop monitor:
- Minimum naked-eye detection threshold: $\theta_{\min} \approx 0.05^\circ$ (~3 arcminutes).
- At $3\times$ binocular magnification: Resolvable up to $3\times$ further distance.

### 2.2 Complete Visibility Assessment Function

```cpp
bool CheckObservableGroundTruth(
    const APlayerCameraManager* CameraManager,
    const AActor* DroneActor,
    float DronePhysicalDiameterMeters = 0.5f,
    float MinSubtenseDegrees = 0.05f)
{
    if (!CameraManager || !DroneActor) return false;

    const FVector CamLoc = CameraManager->GetCameraLocation();
    const FVector CamForward = CameraManager->GetActorForwardVector();
    const FVector DroneLoc = DroneActor->GetActorLocation();

    // 1. Distance & Subtense Check
    const float DistanceCm = FVector::Dist(CamLoc, DroneLoc);
    const float DistanceMeters = DistanceCm / 100.0f;
    if (DistanceMeters <= 0.1f) return false;

    const float SubtenseDegrees = FMath::RadiansToDegrees(DronePhysicalDiameterMeters / DistanceMeters);
    if (SubtenseDegrees < MinSubtenseDegrees) return false;

    // 2. Frustum / Cone of Vision Check
    const FVector DirToDrone = (DroneLoc - CamLoc).GetSafeNormal();
    const float DotProduct = FVector::DotProduct(CamForward, DirToDrone);
    const float HalfFovRad = FMath::DegreesToRadians(CameraManager->GetFOV() * 0.5f);
    if (DotProduct < FMath::Cos(HalfFovRad)) return false;

    // 3. Multi-Ray Line-of-Sight Check (Center, Top, Bottom)
    UWorld* World = DroneActor->GetWorld();
    FCollisionQueryParams Params;
    Params.AddIgnoredActor(DroneActor);

    FHitResult Hit;
    const bool bBlocked = World->LineTraceSingleByChannel(
        Hit,
        CamLoc,
        DroneLoc,
        ECC_Visibility,
        Params
    );

    return !bBlocked;
}
```
