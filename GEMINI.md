# GEMINI.md — Project Interceptor (Critical Guardrails)

Please refer to [AGENTS.md](AGENTS.md) and [docs/ASSET_MANIFEST.md](docs/ASSET_MANIFEST.md) for full project rules and architectural constraints.

## ⛔ Non-Negotiable Guardrails

1. **NO Procedural 3D Objects**: Never generate procedural primitive meshes (cubes, cylinders, spheres). Import only validated PBR GLB assets.
2. **NO Procedural Maps**: Do not write procedural terrain generation in code. Import real terrain meshes, satellite PBR textures, and real HDR environment maps.
3. **NO Toyish Status Colors**: Prohibit bright neon green/red traffic-light status indicators. Use muted tactical palettes (subdued cyan, tactical amber, deep crimson, slate glass).
4. **Professional UI Graphics**: Aerospace/defense military aesthetic. Crisp monospace typography, precision reticles, zero clutter.
5. **Military Brevity**: Be less verbal. Keep messages concise, technical, and direct with zero conversational filler.
