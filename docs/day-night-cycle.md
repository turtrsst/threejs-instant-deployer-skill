# Dynamic Day–Night & Bioluminescence

`templates/day-night-cycle.js` exports `DayNightAquariumCycle` and `createDayNightAquariumCycle(THREE)`. The package root and `threejs-instant-deployer-skill/day-night-cycle` export the typed factory. Targets Three.js r180 WebGLRenderer, not WebGPU/TSL.

## Construction and one-loop integration

```js
import {DayNightAquariumCycle} from './templates/day-night-cycle.js';

const cycle = new DayNightAquariumCycle({
  scene, sunLight, hemiLight, camera, postFX,
  causticControllers, // injectWaterCaustics controllers, not guessed material.uniforms
  orbitRadius: 9,    // author to your audited WORLD tank dimensions
  orbitCenter: tankBounds.getCenter(new THREE.Vector3()),
  timeOfDay: 12,
  autoCycle: true,
  dayDurationSeconds: 90
});

// Register actual render meshes AFTER Bio-Motion/instancing/caustic injection.
// Multi-part fish should share one source/pattern-space bounding box.
for (const mesh of school.manager.instancedMeshes) {
  cycle.registerMesh(mesh, 'fish', {
    bounds: commonFishRestBounds,
    axis: 'x',  // choose the audited source spine direction, not an assumed GLTF axis
    upAxis: 'y'
  });
}

// In the EXISTING owner loop: read delta only once, accumulate elapsed yourself.
const delta = clock.getDelta();
elapsed += delta;
school.update(delta, elapsed); // attached feeder is stepped here, not separately
// existing bubbles/caustics/native AnimationMixer/global updater calls...
controls.update();
cycle.update(delta, elapsed); // project light using this frame's final camera pose
postFX.render(delta, elapsed);
```

Never add a second requestAnimationFrame, renderer.render or global updater for the cycle. Do not call `clock.getElapsedTime()` after `getDelta()` and accidentally advance the clock twice.

`createCinematicAquarium({..., dayNightOptions:{sunLight,hemiLight,orbitRadius:9}})` optionally owns construction, registration of all school mesh/material parts, one update immediately before post rendering, and disposal before other shader controllers. It exposes `system.dayNightCycle`. Omitting this option creates no cycle. It derives a common pattern box from actual source geometry and uses the school's existing spine-axis uniform; it never replaces `recommendedScale` or native animation routing.

The demo `/instanced.html` has **DYNAMIC DAY-NIGHT + BIO-GLOW**, optional cinematic post FX and a Director time folder. Its synthetic leaf planes and fish are both registered. The cinematic main example enables a cycle; its scene/camera/lights/environment still remain app-owned.

## Photometric timing and optical authority

Six authored keyframes at **0, 6, 12, 17.5, 21, 24** interpolate linear-space colors and intensities with smoothstep. Midnight duplicates 24:00. Sun intensity reaches 3 at noon, .35 at midnight; bloom threshold changes from .74 to .28, bloom strength .36 to .88, and glow strength 0 to 1. Fog/background Color, hemisphere sky/ground, directional light, caustic color, water tint and rays all interpolate.

The dominant night interval is roughly 19:00–05:00, with authored twilight residual glow (.25 at 17:30, .15 at 06:00), **not a binary 19:00/05:00 switch**. These are artistic optical values, not measured photometry, solar ephemerides or astronomical/geographic calculations.

- `timeOfDay` getter/setter and `applyTimeOfDay(hour)` apply immediately. Finite hours wrap modulo 24, including negatives and 24→0.
- `autoCycle` is validated boolean; false freezes the hour but leaves pulse animation and application of that hour's optics running.
- `dayDurationSeconds` defaults to 90; finite range **5..86400**. Delta is nonnegative seconds; elapsed is finite and monotonic. No timer or scheduler is created. The cycle advances from supplied delta, so the app decides whether hidden-tab gaps advance or pause it.
- `update(delta,elapsed?)` does not iterate organisms or rewrite fish instance buffers. Shared uniforms work before and after material compilation.
- `setGlowColor(Color | 0xRRGGBB | '#rrggbb', secondary=false)` changes the shared cyan/purple palette with validation.

**While attached and updated, the cycle owns its optical fields.** Manual Director atmosphere/bloom/sun edits or presets can be overwritten at the next cycle update, even with autoCycle:false. Pause automatic time to inspect an hour; to return optical authority to independent presets, dispose/detach the cycle and remove it from GUI/update bindings. Director `syncDisplay()` mirrors current sun/fog/caustics/bloom/tint/ray values rather than exporting stale daylight sliders. Focus, aperture, exposure, fog density and audio are not controlled by this cycle.

The light orbit uses a **24-hour-periodic** proxy trajectory; unlike a half-frequency Z term it has no jump at midnight. Position is converted into the borrowed light parent's local space; the parent must be invertible. Aim the DirectionalLight target at your intended tank center yourself. At night the same above-tank proxy stands in for moonlight; no separate moon mesh/light is created. Optional camera projection drives the screen-space ray origin; invalid/outside clip-depth sources suppress ray intensity, and edge coordinates clamp to safe screen bounds. Without a camera, a documented orbit-based screen approximation is used. This is not true occlusion/volumetric light transport.

Regular Color backgrounds and fog colors update; image/cubemap backgrounds are left intact. `postFX.setConfig` receives tint, ray origin/intensity and bloom settings; actual caustic controllers use `setColor`. Alternatively `causticsFloor` accepts a floor whose materials already carry injected `userData.causticUniforms`; it does not pretend a MeshStandardMaterial has ShaderMaterial uniforms. Caustic wave speed/depth/intensity and fog density are preserved.

Static PMREM/environment maps, scene environment intensity and material envMapIntensity are **not** regenerated/automatically dimmed. Author IBL for your night look if needed; direct/hemi dimming alone does not remove a bright environment reflection.

## Pattern frames and PBR shader composition

`registerBioluminescentMaterial(material,type='fish',options)` requires:

- MeshStandardMaterial or MeshPhysicalMaterial, with r180 emissive shader chunks.
- `options.bounds`: finite nonempty **rest/pattern-space Box3**, not guessed world-scaled values.
- `axis` (default z) and `upAxis` (default y): distinct x/y/z axes. Fish axis follows the spine; upAxis is body height. Plant upAxis follows base→tip.
- Optional invertible `toPattern` Matrix4 mapping geometry-local rest vertices into that common pattern space. Default identity.

`registerMesh(mesh,type,options={})` handles material arrays and derives bounds from actual geometry if not explicitly supplied. For multi-part organisms, use common bounds and matching per-part toPattern transforms to avoid seams. All fish geometry in the instanced helper is already baked into the common model frame. For plants, register actual leaf parts in their authored frames; this is **not semantic recognition of leaves, veins or fish anatomy**.

Example for an audited plant loaded through the existing deployer (do not invent a scale or missing asset URL):

```js
const handle = await deploySmart3DModel(plantUrl, {
  scene,
  manifest: plantManifest,
  recommendedScale: plantManifest.recommendedScale,
  bioPreset: 'aquatic_plant'
});
handle.model.traverse(node => {
  if (node.isMesh) cycle.registerMesh(node, 'plant', {axis:'x', upAxis:'y'});
});
```

If multiple different leaf geometries share a material, clone materials per distinct pattern frame **before** registration, or provide a common frame. Duplicate registrations of the same type/frame reuse a handle; conflicting frames/types throw rather than silently picking the first mesh's box. Distinct cycles/factory/generated classes cannot own the same material simultaneously.

Rest positions are normalized by bounds, giving dimension-independent lateral stripe/spot or leaf-tip masks. Rest attributes stay attached to deformed/skinned/morphed vertices; native mixers, skinning, source geometry and GPU school offset/feeding/normal paths remain untouched. Bounds normalization is not asset rescaling and does not infer anatomical direction.

Glow is added to **totalEmissiveRadiance immediately after emissivemap_fragment**, before lighting output, fog, tone mapping and color conversion—not appended to final gl_FragColor. Original maps, emissive content, alpha and PBR parameters survive. Pulse/color/strength uniforms are shared; per-material enable/frame uniforms and pattern-specific cache keys keep fish/plant shader variants distinct. Depth/distance/Bokeh shadow shaders are not given color emission, and no new depth/normal approximation is introduced.

Emission can exceed 1 in the HDR scene target, letting UnrealBloomPass respond. Bloom remains **luminance-based, not selective**: other bright objects can also glow when threshold drops. Without post FX, surface emission still renders but no bloom halo is created. Emissive surfaces do not illuminate neighbors, cast colored light or create GI. Pulse patterns and rays are stylized, not biological/physical simulation.

## GUI, ownership and cleanup

Pass `dayNightCycle` to `createAquariumDirectorGUI` for time, autoCycle, day length and primary glow color. Values enter existing versioned scalar/boolean/color JSON. Mount/import does not create a frame loop, initialize audio, spawn food or replace scene assets. External clock changes are read via `syncDisplay()`; update the cycle only in its rendering owner, not in the GUI.

Registration returns a handle (registerMesh returns an array); `handle.dispose()` unregisters emission without disposing the material. Dispose is idempotent. Dispose GUI first, then cycle, then earlier shader controllers/school. The cycle sets emission strength/enable to zero and restores prior compile/cache hooks only if still authoritative. If a later wrapper retained its hook, it is not clobbered; emission is disabled and a marker prevents unsafe re-injection—use reverse disposal order or clone the material before re-registering.

Cycle disposal does **not** dispose the scene, light, camera, post controller, texture, geometry, native mixer or caustic controllers. It leaves the last borrowed optical values in place, rather than stomping edits by another owner. To restore a noon look explicitly, applyTimeOfDay(12) before disposal. Remove disposed cycles from frame/GUI bindings; updates then throw.

## Verification and limits

Tests cover authored keyframes, midnight optical/orbit continuity, negative-hour wrap, 30/60 cadence, pause/pulse, validation, parent/camera projection, HDR insertion order, source alpha/maps, material arrays/cache/ownership, native/instanced/Bio-Motion/caustic composition, live uniforms, unchanged fish buffers, retained-hook disposal, real caustic bindings, Director live/JSON values and cinematic one-step ownership.

Work colors/vectors/keyframes are reused; existing post/caustic validation and GUI setters still perform small allocations. **No zero-GC, fixed FPS, actual browser GPU compile/appearance or audio-device claim is made.** Shader source/CPU tests and production bundling are not GPU visual certification. Profile the extra varyings/fragment masks/HDR bloom on target hardware.

## Optional cinematic camera ownership

[Camera Director](cinematic-camera-director.md) owns OrbitControls updates or automatic macro/CPU-cluster shots and synchronizes lens/focus through the real post API. `cameraOptions` opts the cinematic helper into construction, one update before day-night projection/render and reverse disposal; `cameraDirector` opts the GUI into mode/stand-off/auto/rotation controls and current aperture/JSON synchronization. C/N key bindings are explicit and ignore GUI typing. Zero visible clusters fall back safely. No per-individual GPU fish tracking, matrix readback/upload, true fisheye distortion or collision-safe rock/frustum navigation is claimed. Do not independently call controls.update or add another clock/render loop while bound.

## Optional water surface / impact binding

[Underwater Surface](underwater-surface.md) combines dielectric Fresnel/TIR with procedural sky/mirror colors, analytic height-field normals and eight bounded ripple slots. Helper `surfaceOptions` derives the audited tank plane and runs after day-night/before the existing post render; GUI `waterSurface` binds validated scalar setters. `surface.bindFeeder(feeder)` uses the new bounded `onFoodSpawn` subscription after successful nonzero drops, not a method monkey-patch. Mean-plane contact and camera medium classification are approximate; no actual reflected aquarium image, full Gerstner/CFD, dynamic Boids water-boundary collision or extra render/capture loop is claimed. Dispose subscriptions/owned mesh/material/geometry; borrow lights/scene/feeder and retain post depthWrite:false/focus exclusion.
