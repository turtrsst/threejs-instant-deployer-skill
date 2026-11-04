# Architecture and contracts

## Data flow

1. Search Poly Haven, optional Sketchfab, curated Khronos and bounded Hugging Face discovery concurrently; partial provider failure becomes a warning. Lexical relevance must be positive. Optional vision ranking receives only query, IDs and thumbnail URLs; it can reorder a shortlist but cannot introduce unknown IDs.
2. Poly Haven glTF JSON and include resources are downloaded in memory; paths are checked, HTTPS enforced, redirects rejected, per-resource timeout and 128 MiB size cap applied. No remote resource is written to a path supplied by a provider. Sketchfab must expose a direct GLB; archive extraction is intentionally not implemented.
3. NodeIO registers all glTF extensions and Meshopt/Draco decoders. MeshoptSimplifier reduces geometry within a fixed error tolerance; texture encoder makes WebP. Compression and simplification are distinct operations. Centering occurs last so quantization does not invalidate the final scale calculation. Source geometry dimensions are measured before optimization; scale uses final normalized geometry dimensions.
4. Budget is evaluated before asset write. File mode writes one GLB; Data URI mode embeds the same binary and writes none. Names are sanitized for local inputs. Explicit provider IDs are restricted to alphanumeric, underscore, hyphen.
5. Candidate loading/processing tries up to five relevant candidates in rank order, retaining failure warnings. `--animated` excludes known static candidates and rejects binary files without animation channels before and after optimization. Default CC0 filtering is relaxed only for known-license HF/registry assets with explicit opt-in. See [federated contracts](federated-scout.md).
6. Babel inserts imports/runtime and updates into a recognized animation loop. parse5 source offsets preserve surrounding HTML. An existing importmap is extended without replacing unrelated mappings. No direct source rewriting occurs in the MCP injection tool; CLI writes only with --output/--write.

## Manifest example

```json
{
  "status": "success",
  "assetId": "fixture",
  "savedPath": "/project/public/models/fixture.glb",
  "originalDimensions": [2, 4, 6],
  "normalizedDimensions": [2, 4, 6],
  "targetSize": [1, 2, 3],
  "recommendedScale": 0.5,
  "recommendedScaleVector": [0.5, 0.5, 0.5],
  "scaledDimensions": [1, 2, 3],
  "fitMode": "contain",
  "pivotMode": "bottom-center",
  "meshes": [{"index": 0, "name": "FixtureMesh", "primitives": 1}],
  "materials": [{"index": 0, "name": "Copper", "roughness": 0.35, "metalness": 0.7, "alphaMode": "OPAQUE", "doubleSided": false}],
  "animations": [{"index": 0, "name": "Sway", "channels": 1}],
  "nodes": [{"index": 0, "name": "Lantern", "mesh": "FixtureMesh", "children": []}],
  "skins": [],
  "fileSizeKB": 3.5,
  "budgetMet": true,
  "warnings": []
}
```

Illustrative sizes/nodes vary after transforms. Additional fields include query, assetName, selectedProvider, matchedAssetId, legal, licenseEvidence, revision, alternativeCandidates, xray summary, requiredExtensions, source, license and dataUri (only datauri mode). Names are not guaranteed unique; indices remain available. Uniform contain scale is `min(target[i] / normalized[i])` over positive constrained axes with nonzero measured extents. Invalid/empty/nonfinite geometry is rejected.

## Runtime contract

`createAssetDeployer(THREE, GLTFLoader, MeshoptDecoder, RoomEnvironment)` returns `{deploy,update,dispose}`. `deploy(primitive,manifest,url,renderer,scene)` returns a handle immediately with a `ready` promise and `dispose()` method. Handle `model`/`mixer` become available after loading. Do not use the handle as the promise resolution of itself (it is not thenable).

The wrapper inherits parent-space position/quaternion/scale and offsets the bottom in the primitive's oriented local Y direction. Original children/material remain untouched. On error the primitive remains visible; the promise rejects. Runtime applies normalized model scale once, shadows/material intensity, and first animation clip. It only owns the new group/resources and environment it creates. Caller owns primitive geometry/material and renderer. Call dispose before destroying renderer. On Next.js instantiate in client lifecycle and return cleanup from effect. Runtime doesn't register a global animation scheduler: callers update it in their existing loop. Native clips take priority; static organisms may use the [Bio-Motion fallback](bio-motion.md), while inanimate/unknown names remain static. `update(delta?,elapsedTime?)` accepts explicit frame timing or derives timing from performance.now(). `deploy` accepts a sixth options argument with `bioPreset`/`bioOptions`; `bioPreset:null` or `none` disables the fallback.

## Extending providers

Return `Candidate` objects (id, name, provider, score, source, license, optional thumbnail), verify actual downloadable license, and add a document resolver. Do not label mixed-license datasets CC0. Network metadata is untrusted. Add mocked search/download tests and run the opt-in live smoke with appropriate access before claiming live compatibility.

## Known limitations

- Animated/skinned/morph extents measured at rest pose only; geometric simplification can affect fine detail.
- One default scene determines fitting; assets with different scene alternatives need explicit author review.
- GLB may retain extensions such as KHR_texture_basisu requiring additional application loaders.
- Fixed quality recipe is not an iterative quality/budget optimizer. Hard budget errors are intentional.
- Download cap is per resource, not a global memory sandbox; only process assets from trusted providers and restrict worker resources for untrusted bulk processing.
- AST auto-injection is conservative and single-target. Renderer/scene names are explicit options. Runtime supports multiple targets; a shared environment should be owned by the application for complex lifecycle setups.
- CDN dependencies may be blocked by CSP or offline policy. Vendor libraries and configure importmaps/CSP when necessary.


## Optional underwater atmosphere

[Underwater FX](underwater-fx.md) adds a serializable browser factory and standalone template for caustics/bubbles. It does not modify the GLB, measured scale, source licensing or animation metadata. Effects are explicitly scene-owned and opt-in; hooks compose with Bio-Motion and require reverse-order cleanup. Bubble positions and Boids record interactions use world coordinates.

## Optional clustered instancing

[Instanced Boids](instanced-boids.md) is a separate static-asset rendering mode. Its serializable factory reuses Bio-Motion for measured geometry-space deformation and Boids only for cluster proxies. Static per-instance attributes plus a shared Float DataTexture move the fish on GPU without an O(fish) CPU matrix update. All GLB mesh parts retain their materials/groups; there is one InstancedMesh per part, not necessarily one draw for an entire asset or its shadow passes.

The cluster envelope, fixed-step center solver and world-matrix cancellation are CPU-owned; exact individual poses remain GPU-only. This intentionally trades independent fish steering/picking for lower CPU/draw overhead. Native skin/morph clips are rejected instead of silently baking them, and source textures remain caller-owned. Reverse-order effect/manager/source cleanup is explicit. Device preflight and CPU-only benchmarks are not GPU shader or FPS certification; profile the synthetic `/instanced.html` demo and real assets on target hardware.


## Optional cinematic output

[Underwater Post-Processing](underwater-postprocessing.md) injects addons into a server-safe serializable factory. Its HDR/MSAA composer owns Render → deformation-aware Bokeh depth/DoF → Bloom → lens → OutputPass. Bokeh uses per-source-material depth clones with shared Bio/cluster hooks rather than a global override, preserving alpha/clipping and restoring temporary scene/render state on errors. Material-disposal eviction and reverse lifecycle avoid retaining old schools after resets. Focus and resize are camera/canvas/container aware; source assets and renderer remain borrowed.

The cinematic helper composes the instanced loader, existing caustics/bubble API and one global animation updater into a single render owner. This is an optional GPU-heavy output path, not a change to licensing, asset scaling or native animation precedence. Bloom is threshold-based and the ray/snow/tint layer is screen-space stylization, not selective lighting/physical volumetrics. MSAA selection and real visual/performance validation are device-dependent.


## Optional Director Studio

[Director GUI](aquarium-director.md) is a serializable optional adapter around injected lil-gui, with current-state initialization, validated parameter routing, mood presets and versioned clipboard-safe JSON. It owns GUI resources only and relies on the application's existing loop for focus display synchronization. Capacity and active draw count are separate: all parts share the visible prefix, static instance buffers remain unchanged, and all preallocated cluster centers keep simulating. Runtime amplitude is bounded by construction-time deformation reserve shared with the Bio controller/proxy. Cluster startle is seeded and speed-bounded. Recreate bindings around school/post resets; optional controls are omitted rather than faked.


## Optional zero-asset audio

[Underwater Audio](underwater-audio.md) is a dependency-free serializable factory with lazy context creation, seeded generated PCM, oscillator/filter envelopes and a shared convolution IR. Dry/wet audio converges through compressor then one final master/mute gain. A bounded audio-clock scheduler and transient voice/source ownership avoid unbounded allocations; graph cleanup distinguishes owned and borrowed contexts, including pending resume/dispose races. Director optionally routes controls/startle accents but never initializes audio during mount/config import. Local canvas interactions and page visibility policy belong to explicit helper/app bindings. Sounds are stylized stereo DSP, not acoustic/hydrodynamic simulation; stub graph tests are not audible browser verification.

## Optional interactive feeding

[Interactive Feeder](interactive-feeder.md) pools food/ripples and binds into the existing fixed-step cluster solver through `manager.setFeeder(feeder)`. Shift+click reserves the local gesture without stealing plain focus/bubble clicks or orbit drags. CPU cluster centers seek/consume and allow pitch/frenzy; there are no individual GPU mouth positions, per-fish CPU updates or per-fish matrix uploads. Packed matrix-row metadata carries tail rate without changing the 64-byte/cluster budget, and affine zeros are restored before transforms in all shader passes. The manager owns attached stepping; helper `feedingOptions` owns feeder disposal. Audio is optional/budgeted, never activated by feeding. See the contract for caps, kinematic limitations and validation boundaries.

## Optional dynamic day–night cycle

[Day–Night Cycle](day-night-cycle.md) interpolates optical keyframes and normalized HDR PBR emission in the existing frame owner. Register actual mesh/material parts after earlier shader injection; restore in reverse disposal order. No per-fish matrix writes, native animation replacement or emission in depth/normal/shadow shaders. `dayNightOptions` opts the cinematic helper into ownership; Director `dayNightCycle` exposes time/auto/duration/color and mirrors current optical values for JSON. The updating cycle takes precedence over independent optical presets, including when its hour is paused. It borrows lighting/post/caustic resources and leaves the last optical values on disposal. Screen rays and biological masks are stylized, bloom is not selective and PMREM is not regenerated. See the contract for bounds/axis validation and browser GPU verification limits.

## Optional cinematic camera ownership

[Camera Director](cinematic-camera-director.md) owns OrbitControls updates or automatic macro/CPU-cluster shots and synchronizes lens/focus through the real post API. `cameraOptions` opts the cinematic helper into construction, one update before day-night projection/render and reverse disposal; `cameraDirector` opts the GUI into mode/stand-off/auto/rotation controls and current aperture/JSON synchronization. C/N key bindings are explicit and ignore GUI typing. Zero visible clusters fall back safely. No per-individual GPU fish tracking, matrix readback/upload, true fisheye distortion or collision-safe rock/frustum navigation is claimed. Do not independently call controls.update or add another clock/render loop while bound.

## Optional water surface / impact binding

[Underwater Surface](underwater-surface.md) combines dielectric Fresnel/TIR with procedural sky/mirror colors, analytic height-field normals and eight bounded ripple slots. Helper `surfaceOptions` derives the audited tank plane and runs after day-night/before the existing post render; GUI `waterSurface` binds validated scalar setters. `surface.bindFeeder(feeder)` uses the new bounded `onFoodSpawn` subscription after successful nonzero drops, not a method monkey-patch. Mean-plane contact and camera medium classification are approximate; no actual reflected aquarium image, full Gerstner/CFD, dynamic Boids water-boundary collision or extra render/capture loop is claimed. Dispose subscriptions/owned mesh/material/geometry; borrow lights/scene/feeder and retain post depthWrite:false/focus exclusion.

## Local preset file management

[Preset Management](preset-management.md) adds Export Preset (JSON) and Import Preset (JSON) to the existing panel, retaining string/clipboard APIs. Version-1 parameters are snapshotted from live bound controllers and fully prevalidated (256 KiB UTF-8 limit, supported schema/keys/types/ranges/capacity) before setters apply them. Files do not serialize functions, geometry, full simulation state or audio consent. Temporary anchors/object URLs and picker/read callbacks/timers are owned/cancelled by GUI disposal; late reads never apply after replacement/disposal. Browser file APIs remain lazy; actual OS picker/download behavior needs target-browser testing.

## Core Jest and success-manifest validation

[Core Testing](core-testing.md) documents native-ESM Jest running alongside the retained node:test suite. Tests exercise actual glTF-Transform bottom-center/contain scaling and structured X-Ray records. The production XRayManifestSchema/validateXRayManifest/assertXRayManifest exports validate success output before GLB write/return; bad status is an array error, finite positive scale and flags/records are checked. This is metadata validation, not licensing or arbitrary binary safety. See the dependency-audit release caveat in SECURITY.md.
