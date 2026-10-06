# Imported command room and PC VR

The fictional interior is assembled from [Kenney Furniture Kit](https://kenney.nl/assets/furniture-kit), licensed CC0. The frozen ZIP and source provenance are in `assets-source/command-room`; the optimized GLB, transform manifest and license are in `public/assets/command-room`. Repeated modules are deduplicated offline. UI planes are display surfaces, not replacement scenery.

Rebuild the room after extracting the retained ZIP into `assets-source/command-room/furniture`:

```powershell
Expand-Archive -LiteralPath assets-source/command-room/kenney_furniture-kit.zip -DestinationPath assets-source/command-room/furniture -Force
node tools/prepare-room.mjs
```

`/room` uses the shared SessionController. Rendering never advances a separate simulation. Spatial controls select/acknowledge contacts, investigate delivered evidence, revise assessments and submit high-level decisions. The desk radar and local imagery display reflect the current post. The focused console remains available for larger evidence text, EO/thermal images and AAR.

The WebXR adapter checks `immersive-vr`, uses seated controller-ray selection and `local-floor`, records input mode, and pauses on XR exit. Enter/exit, recenter, pause and desktop fallback are explicit. PC VR with Chrome/Edge and an OpenXR runtime is the selected target. A compatible connected headset and trusted localhost/HTTPS origin are required. Browser automation verifies fallback and desktop command integration; it cannot certify headset comfort, text legibility, controller interaction or headset FPS.

Standing locomotion, teleportation and snap turn are not part of the current seated implementation. The thermal pane is an optical false-color transform, not an independent heat/IR sensor. RF and roster evidence use fictional authored training clues. These boundaries remain explicit in the product and verification record.
