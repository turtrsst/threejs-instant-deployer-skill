# Water Surface & Snell's Window

`templates/underwater-surface.js` exports `createUnderwaterSurface(options)`, `dielectricFresnel(cosIncident,eta)`, `MAX_RIPPLES=8` and injectable `createUnderwaterSurfaceFactory(THREE)`. The typed factory is available at the package root and `threejs-instant-deployer-skill/underwater-surface`. Targets Three.js r180 WebGLRenderer.

## What is physical, what is stylized

For a camera ray exiting water, relative index is **eta=n_water/n_air=1.333**. The unpolarized dielectric Fresnel calculation uses Snell's law, returning R=1 when eta²(1−cos²(theta_i))≥1. Critical angle is asin(1/1.333)≈**48.61°** from the local normal. Normal-incidence reflectance is approximately **.02037**. Viewing from air uses reciprocal eta; there is no corresponding air→water TIR. Equal media return zero reflectance, including the grazing limit.

**This is not actual aquarium-image reflection/refraction.** The mirror region samples a procedural teal/deep-water shimmer; the window uses a directional sky/light color. No planar reflection camera, scene-color/depth sampling, cube capture, SSR, ray tracing or extra render pass is created. Refracted/reflected directions drive procedural shading, not transported images of rocks/fish. Alpha blending, cyan critical-edge rim and highlights are artistic, not energy-conserving radiometry or wavelength-dependent rainbow dispersion.

The surface is a sum of vertical sinusoidal height waves plus damped circular impact packets. It has **no horizontal Gerstner displacement, CFD, shallow-water solver, buoyancy, splash particles or fluid/solid collision**. Analytical world-space height slopes produce normals without three finite-difference samples per vertex. The ripple center is softly regularized to keep slopes finite.

## Use audited world dimensions

```js
import {createUnderwaterSurface} from './templates/underwater-surface.js';

const surface = createUnderwaterSurface({
  width: tankBounds.max.x - tankBounds.min.x,
  depth: tankBounds.max.z - tankBounds.min.z,
  centerX: (tankBounds.min.x + tankBounds.max.x) / 2,
  centerZ: (tankBounds.min.z + tankBounds.max.z) / 2,
  surfaceY: tankBounds.max.y,
  waveHeight: .045,
  maxWaveHeight: .2, // reserve fixed conservative culling bounds at construction
  waveFrequency: 1.6,
  segments: 96
});
scene.add(surface.mesh);
const feedingBinding = surface.bindFeeder(feeder); // matching mean water plane

// In the EXISTING rendering owner, once per frame:
school.update(delta, elapsed); // also owns attached feeder stepping
// existing effects/native updater...
cameraDirector.update(delta, elapsed); // owns controls.update
cycle.update(delta, elapsed);          // day/night updates the actual sun
surface.update(elapsed, sunLight);     // then sample world sun-target direction
postFX.render(delta, elapsed);

// Reverse ownership; no monkey-patching and no borrowed asset disposal.
feedingBinding.dispose(); // optional if surface.dispose follows
surface.dispose();
```

Do not add another requestAnimationFrame/render, duplicate fish/feeder update or `clock.getElapsedTime()` after `clock.getDelta()`. Read delta once and accumulate elapsed. The surface creates no timer, controls binding or global pointer listener.

`createCinematicAquarium({..., surfaceOptions:{sunLight,segments:96}})` optionally constructs/owns it, derives width/depth/center/mean Y from the helper's audited tank bounds, attaches an existing feeder if present, updates after day-night and before post render, exposes `system.waterSurface`, and disposes/unbinds before feeder/post/school teardown. `dayNightOptions.sunLight` is the fallback light if surfaceOptions.sunLight is omitted. Omitting surfaceOptions allocates nothing. The helper deliberately overrides duplicate dimension fields in surfaceOptions to keep the tank/feeder plane consistent.

## Options and validated setters

| Parameter | Default / accepted values |
| --- | --- |
| width, depth | 25 scene units, finite .001..1e6; pass audited dimensions, not inferred model scale |
| centerX, centerZ, surfaceY | 0, 0, 4.2; finite world coordinates |
| segments | 128 per axis, integer **2..256**, fixed geometry |
| waveHeight | .045 or maxWaveHeight if smaller; **0..reserved maxWaveHeight** |
| maxWaveHeight | .2, finite **0..2**, construction-only reserve |
| waveFrequency | 1.6, finite **.05..8**, spatial angular frequency in scene units |
| iorRatio | 1.333, finite **1..2**, water/air relative IOR |
| mirrorOpacity, windowOpacity | .92, .38, finite **0..1**; artistic alpha, not Fresnel reflectance |
| skyLightColor | 0xb8f6ff |
| deepMirrorColor, causticRimColor | 0x05263b, 0x4ee4e8 |

Colors accept Color, RGB hex integers or '#rrggbb'; nonfinite values reject. `setWaveHeight`, `setWaveFrequency`, `setIorRatio`, `setMirrorOpacity`, `setSkyLightColor` validate before updating uniforms. Corresponding waveHeight/frequency/iorRatio/mirrorOpacity getters feed GUI state. Do not bypass setters or mutate the reserved pool arrays/dimensions directly.

`update(elapsed,sunLight?)` requires finite monotonic time and optionally a valid DirectionalLight. It uses **world light position minus world light target**, not the light's local position relative to origin. Sky color follows light color/intensity with the authored .12..1.2 intensity-factor clamp; it does not alter the borrowed light. Without a light, the configured sky base color is restored. Deep/rim colors remain independently authored; no PMREM/environment capture is regenerated.

Vertex phase wraps at 20π seconds, a common period for the authored wave/shimmer time coefficients. Ripple ages are calculated separately on the CPU using the caller's monotonic time. This avoids subtracting large float32 absolute timestamps in the shader after long sessions.

## Ripple pool and feeder subscriptions

- `triggerRipple(worldX,worldZ,strength=1)` validates finite XZ and strength **0..2**. Zero strength or a point outside the finite plane returns false; it never clamps an unrelated hit to an edge.
- Exactly **eight Vector4 slots** are reused round-robin. Trigger at elapsed=0 is valid and visible; no startTime>0 sentinel bug. Expiration is **4.5 seconds**; growth speed 2.4 scene units/sec and attenuation are authored stylization.
- The shader uniform layout is **xy=world XZ, z=age, w=active strength**, not xyz+absolute startTime. Unused slots have w=0. Uniform array identities remain fixed.
- `clearRipples()` clears only surface impacts. `stats` exposes activeRipples and cumulative triggered/recycled/expired counts, not energy or measured fluid quantities.
- `bindFeeder(feeder)` requires the feeder's world waterSurfaceY to match within 1e-6, reuses an existing binding for that feeder and returns an idempotent disposable binding. At most 16 feeder bindings; dead bindings prune on a subsequent bind. Detach bindings when replacing feeders or dispose the surface. A partial/smaller surface simply ignores feeder hits outside its XZ footprint.

The feeder now provides `onFoodSpawn(listener) → detachFunction`, capped at **16 distinct listeners**. Each successful nonzero drop emits one immutable `{x,y,z,count,time}` event **after visual commit**, not one per pellet. Zero-count/outside drops emit nothing. A bounded listener snapshot prevents self-rebinding iteration loops; thrown and asynchronously rejected listener errors increment feeder.stats.spawnListenerErrors without undoing food. Surface binding does not replace spawnFoodCluster, create audio or initialize/mute/resume a synth. Feeder/surface disposal can occur in either order without invoking a disposed surface.

Input stays with the existing feeder: default Shift+click differentiates feeding from orbit drag/plain focus. This surface itself has no cursor listener/raycast. For ripple-only input, validate a local-canvas ray against the mean water plane and call triggerRipple through your app's explicit, drag-filtered gesture handler; do not add an unfiltered global pointerdown competing with controls.

Food starts on the **mean plane**, not the GPU-displaced wave height. CPU raycasts/Boids bounds/consumption do not follow individual crests/troughs, and an impact can be sampled up to a frame after the gesture using the surface's last accepted time. This is a decorative coupling, not precise fluid-contact collision.

## Render ownership, bounds and costs

The surface retains its audited world horizontal plane under any invertible scene/group parent by canceling the parent matrix before world displacement. Call update before render after parenting; singular parents reject. The mesh uses a fixed owned matrix, so change placement by recreating the controller rather than manipulating mesh.position/scale while matrixAutoUpdate=false.

Conservative local Y bounds reserve **maxWaveHeight×(1.65+8×2.2×2)**, covering worst-case additive base waves and eight strength-2 impacts. Bounding sphere includes that height. Runtime height setters cannot exceed the reserve; geometry buffers never need vertex updates. Stacked strong ripples can exceed a small-wave physical regime—reservation is a culling guarantee, not a realistic water-volume guarantee.

ShaderMaterial is double-sided, transparent, depthWrite:false, forceSinglePass:true, with fog and standard tone-mapping/color-space chunks. HDR target/output handling stays with the existing Three/post pipeline; no manual gamma is added. Normal rendering needs one mesh color pass, with additional vertex/fragment work—not another scene capture. Transparent sorting/intersection artifacts remain possible; this is not order-independent transparency.

The mesh is excluded from focus picking and CPU raycasting because its geometry is undeformed on the CPU. It does not become an opaque Bokeh depth blocker; post processing keeps its existing depthWrite:false exclusion. Water does not cast/receive a new deformed shadow mesh. Camera mode/scene occlusion determine whether the surface is visible—look up from inside the tank to inspect the underwater window.

Default 128×128 grid has 16,641 vertices and 32,768 triangles. Maximum 256 grid has 66,049 vertices and 131,072 triangles. Choose spatial frequency/subdivision density together; high frequency on a coarse/large plane aliases. GPU cost rises with grid density and active ripple masks; no fixed FPS or zero-GC guarantee is made. Work vectors/slot arrays are reused; GUI/validation/subscription callbacks still make small bounded allocations.

Camera medium selection uses **mean-plane camera Y**, with normals facing the view for stable two-sided shading. Crossing within wave crests/troughs can be approximate; no full water-volume classification or underwater post enable/disable transition is added.

## GUI, lifecycle and verification

Pass `waterSurface` to the Director GUI for reserved wave height, frequency, IOR and artistic mirror opacity. Only these scalar parameters enter existing versioned JSON; mounting/importing does not create geometry, spawn food/impacts or activate audio. `syncDisplay()` reflects setter changes. GUI borrows the surface; dispose GUI before replacing it.

`dispose()` is idempotent: unbind feeders, remove owned mesh, dispose geometry/material and stop accepting setters/triggers/updates. Scene/camera/lights/feeder/post/school are borrowed. Remove the controller from your render owner before disposal. The demo checkbox opts into construction; cinematic main opts into a 96-segment surface without another frame loop.

Tests cover normal-incidence/critical/TIR/reciprocal Fresnel, equal-media edge case, time-zero impacts, slot identity/overflow/expiry/large-time ages, analytic shader structure/HDR hooks, safe bounds and unchanged geometry buffers, world parent/light direction, feeder commit/error/zero-drop/subscription semantics, disposal/partial ownership, GUI setters/JSON, and cinematic cycle→surface→post single-render order. Production/template/package bundling is separate.

These checks do **not** establish actual browser GPU shader compilation, accurate reflected scene imagery, true Gerstner/fluid motion, near-surface volume classification, visual transparency/Bokeh quality or target-device FPS. Inspect the result on actual WebGL hardware before claiming visual optical fidelity.
