---
name: web-recon-and-scraping
description: Web intelligence, technical search, and documentation scraping procedures for drone threat simulation assets, military standards, and UE5 C++ references.
---

# Web Reconnaissance & Documentation Scraping Skill

This skill defines standard operating procedures for searching the live web and extracting structured technical knowledge for Project Interceptor.

---

## 1. Search Query Strategies (`web_research_scout`)

When engineers request external technical context, construct precise, high-signal queries:

### 1.1 Military & Drone Standards
- `"NATO STANAG 4670" UAS classification weight operational altitude`
- `"drone optical detection range" visual subtense angular resolution degrees`
- `"counter-UAS" threat levels benign unknown concern hostile criteria`

### 1.2 Unreal Engine 5 C++ Simulation Patterns
- `"UGameInstanceSubsystem" lifecycle persistence UE5.4 site:dev.epicgames.com`
- `"USplineComponent" GetLocationAtDistanceAlongSpline ESplineCoordinateSpace::World UE5`
- `"LineTraceSingleByChannel" multi-point bounds check UE5 C++`
- `"SCompoundWidget" Slate C++ tactical reticle HUD example`

---

## 2. Scraping & Content Ingestion Pipeline (`web_scraper_extractor`)

### 2.1 Fetching and Parsing
1. Use `read_url_content` with target URLs.
2. Strip navigational headers, sidebars, cookie banners, and marketing text.
3. Isolate core sections:
   - Mathematical formulas and variable definitions.
   - C++ function signatures and class definitions.
   - JSON schemas and enumeration values.

### 2.2 Storage & Staging Guidelines
- Staging directory for external references: `docs/references/`
- Filename convention: `<topic>_<source_slug>.md`
  - Example: `docs/references/stanag_4670_uas_classes.md`
  - Example: `docs/references/ue5_spline_kinematics_api.md`

### 2.3 Reference Template
```markdown
# Reference: [Title]
**Source URL**: [https://...]  
**Ingested By**: web_scraper_extractor  
**Date**: [YYYY-MM-DD]  
**Target Consumer**: [backend_physics_telemetry_lead / ml_analytics_engineer / etc.]

## Extracted Formulas / Specifications
[LaTeX / Equations / Constants]

## Extracted C++ Code / Structs
```cpp
// Extracted and verified snippet
```
```
