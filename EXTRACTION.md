# Original drone extraction evidence

## Confirmed package metadata

- Provided binary: `../Windows/UAV_Intercept_Simulator/Binaries/Win64/UAV_Intercept_Simulator-Win64-Shipping.exe`.
- Embedded engine string: `++UE5+Release-5.4-CL-35576357`.
- Recovered project metadata: `EngineAssociation: 5.4`.
- Both IO Store TOCs use version 6. CUE4Parse mounts the project `.utoc` and `.pak` without an AES key: 1,140 IO Store files + 1,563 PAK files = 2,703 entries.
- No `.usmap` exists in the supplied loose files or the mounted-file listing.
- Inspection report: `artifacts/extraction/package-inspection.json`.
- CUE4Parse source commit used: `c1770411182f8a7e94ddcd19683e68736e1a0020`, from https://github.com/FabianFG/CUE4Parse (Apache-2.0).

## Actual export result

FPV was attempted first:

```text
UAV_Intercept_Simulator/Content/TypeAStarFighter/Meshes/FPV_Drone__1207175058_generate.uasset
UAV_Intercept_Simulator/Content/TypeAStarFighter/Meshes/SK_FPV_Drone__1207175058_generate.uasset
UAV_Intercept_Simulator/Content/TypeAStarFighter/Meshes/SKM_FPV_Drone__1207175058_generate.uasset
```

All three failed at package deserialization with:

```text
CUE4Parse.UE4.Exceptions.MappingException:
Package has unversioned properties but mapping file is missing, can't serialize
```

The follow-up attempted all 91 matching packages, including Orlan, Geran/Shahed and Lancet meshes, skeletons and textures. Every attempt returned the same missing-mapping exception. See `assets-source/drones/fpv/export-report.json`, `assets-source/drones/all/export-report.json`, `assets-source/drones/all/mounted-files.txt` and `artifacts/extraction/all-families.log`.

**Exact missing dependency:** a `.usmap` generated for the supplied UAV_Intercept_Simulator UE 5.4 build, covering its native and Blueprint property layouts. An arbitrary UE 5.4 game's mapping does not establish compatible custom schemas. Alternatively, obtain the original uncooked meshes, material/texture sources and Blueprint component transforms, or a complete original GLB/FBX export from the project owner. No AES key or native Oodle DLL was required to mount/read project metadata; neither is the observed blocker. Later mesh/texture decoding requirements cannot be confirmed until properties deserialize.

No complete original geometry was exported; texture recovery, multipart assembly, dimensions, orientation and animation verification remain pending. The initial extraction attempt created or enabled no replacement. The subsequent user instruction explicitly authorized Sketchfab replacements.

## Sketchfab API investigation (2026-10-05)

Public search and model metadata requests succeeded. Downloadable candidates include FPV Drone (`0294037f390a4351926c11caf3e5c43e`), Orlan-10 (`e2efb223c1814b7291818a9a7b4e80c5`), and Lancet (`9820cfa9d1084d918c85c6dfb6287737`), each listed as CC BY. Geranium-2 (`8f12f601efe44a73b47e30a7077cf249`) is listed as CC BY-NC-SA. Metadata, author links and license requirements are recorded in `artifacts/extraction/sketchfab-candidates.json`. These are candidates only; no evidence connects them to the simulator's original assets.

The FPV model's official `/v3/models/{uid}/download` endpoint returned HTTP 401, `Authentication credentials were not provided.`, both anonymously and with the user-provided AWS WAF cookie. The cookie was used only in the request and is not saved in project files. It does not authenticate a Sketchfab account. Downloading through the API requires supported account authentication (an API token or OAuth access token); see https://sketchfab.com/developers/download-api/downloading-models and https://docs.sketchfab.com/data-api/v3/index.html. No model archive was downloaded during that API probe.

The subsequent user-authorized Chrome download succeeded using their existing logged-in Sketchfab session. All four candidates were downloaded using the site's 2K GLB controls. Files remain in the user's Downloads directory, with preserved copies in `assets-source/sketchfab/{uid}/`, accompanied by `ATTRIBUTION.txt` and `PROVENANCE.json`. The combined manifest is `assets-source/sketchfab/downloads.json`; it records source URLs, authors/licenses, SHA-256 hashes, sizes, and geometry/material/image counts. Checks confirm GLB v2 headers, geometry, embedded images and no external buffer dependencies. At download time, visual rendering, dimensions and orientation had not yet been verified. Geranium-2's NC-SA restrictions differ from the other candidates' CC BY licenses. The FPV uploader describes their asset as "FPV Drone from War Thunder"; none of the candidates has established original-simulator provenance. The later user instruction authorized these downloads for the simulator. They are now normalized, textured and enabled in the browser catalog, explicitly marked as Sketchfab assets rather than simulator originals. See ASSETS.md and VERIFICATION.md for the current integration. Original Unreal extraction remains a separate unresolved dependency.

## Reproduce or resume

The utility is `tools/AssetExporter/`. CUE4Parse currently targets .NET 10. A local SDK and dependency restore were used; the browser application has no .NET dependency.

```powershell
git clone https://github.com/FabianFG/CUE4Parse.git tools/vendor/CUE4Parse
git -C tools/vendor/CUE4Parse checkout c1770411182f8a7e94ddcd19683e68736e1a0020
dotnet build tools/AssetExporter/AssetExporter.csproj -c Release -p:CUE4PARSE_SKIP_NATIVE=true --source https://api.nuget.org/v3/index.json
dotnet tools/AssetExporter/bin/Release/net10.0/AssetExporter.dll ../Windows/UAV_Intercept_Simulator/Content/Paks assets-source/drones/fpv GAME_UE5_4 FPV C:/path/to/matching.usmap
```

For all families replace `FPV` with `all`; another regex can select specific package paths. The utility writes mounted paths, available metadata, exported object properties/component transforms, mesh GLBs and referenced material/texture exports. It never changes the packaged simulator. No GLB means a nonzero exit code. Failed packages are recorded rather than silently substituted.

The CUE4Parse GLB writer used here converts Unreal centimetres to metres (`0.01`) and swaps Y/Z; its GLB material slots are white placeholders while materials and textures are exported separately. Once mappings permit extraction, bind the recovered textures/material values to those slots, and assemble static components using recovered transforms, in Blender or a dedicated conversion pass. Preserve the raw outputs, material metadata and transform evidence. Then use glTF Transform dedup/weld/prune/texture optimization, check silhouettes and texture detail, and record measured dimensions, further scale/orientation corrections and source package identities in the browser catalog. Do not treat the first emitted GLB as a complete textured original drone.

The local restore reported a transitive `Microsoft.Bcl.Memory` 9.0.0 advisory in the upstream tooling dependency graph. This tooling is separate from the shipped browser bundle; review/update its upstream dependencies before handling other untrusted packages.
