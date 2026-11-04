# Interactive feeding: CPU cluster attraction, GPU fish animation

`templates/interactive-feeder.js` exports `InteractiveFishFeeder` and the injectable `createInteractiveFishFeeder(THREE)` factory. The typed factory is also exported at the package root and `threejs-instant-deployer-skill/interactive-feeder`.

**This is a cluster-center approximation.** GPU school members have procedural offsets/deformation, not CPU `fishData` or independently simulated mouths. CPU cluster centers seek and consume pellets; the entire cluster gets faster tail motion and can pitch vertically. A visible individual fish may not touch a pellet when the CPU center consumes it. There is no per-fish simulation, readback, raycast picking or per-frame fish `setMatrixAt` loop.

## Integrate with the existing loop

```js
import {InteractiveFishFeeder} from './templates/interactive-feeder.js';

// Use audited WORLD tank dimensions, not guessed model scale. These are the
// actual water/floor planes, which can differ from the fish-center swim box.
const feeder = new InteractiveFishFeeder(scene, camera, renderer.domElement, {
  bounds: tankWorldBounds,
  waterSurfaceY: tankWorldBounds.max.y,
  floorY: tankWorldBounds.min.y,
  audioSynth, // optional borrowed UnderwaterAudioSynthesizer; never initialized here
  seed: 7291,
  maxPellets: 120,
  maxRipples: 16,
  interaction: 'shift'
});
school.manager.setFeeder(feeder); // or manager.feeder = feeder

// Existing application loop: read delta once; retain existing effect/render owner.
function animate(delta, elapsed) {
  school.manager.update(delta, elapsed); // also advances feeder inside fixed steps
  // Existing bubbles/caustics/global updater/controls/post render remain here.
}

// Optional buttons; feeding does not turn on audio.
dropFoodButton.onclick = () => feeder.feedAtCenter(15);
clearFoodButton.onclick = () => feeder.clear();

// Teardown UI first. Feeder owns its pools/listeners, not the scene/camera/audio.
feeder.dispose(); // detaches from live manager and restores normal feeding state
school.manager.dispose();
```

Do **not** also call `feeder.update()` while attached: it throws to prevent double stepping. The manager owns its feeder's fixed-step timing, then synchronizes visuals once per displayed update. `createCinematicAquarium({..., feedingOptions:{audioSynth,bounds:tankWorldBounds}})` optionally constructs/attaches/owns a feeder and exposes `system.feeder`; its existing `render(delta,elapsed)` remains the only frame entry point. It disposes the feeder before the school. Omitting `feedingOptions` creates no feeder resources.

For independent CPU records, `feeder.update(delta, elapsed?, records=[])` advances a standalone feeder. Elapsed must be monotonic; delta must be nonnegative and finite. Records must have finite world-space `position` vectors. This mode consumes at supplied center positions; it does not update external fish locomotion or invent GPU fish positions. `computeFoodAttractionForce(record,maxSpeed=2.2,maxForce=1.8,senseRadius)` requires `position` and `velocity` Vector3s, sets `isFeeding`/`motionSpeedBoost`, and returns a **reused scratch vector or null**: add it immediately to acceleration, never retain it as another record's vector. Full manager integration already does this.

## Input and defaults

- **Shift + primary click** on the visible tank surface spawns a seeded batch of **8–15 pellets**. Pointerdown/up must match, movement must stay within 4 CSS pixels, and the release must be inside the canvas rectangle. Raycasting uses local canvas coordinates, current camera matrices, and a horizontal world-space water plane.
- Hits behind the camera, outside clip depth or outside tank XZ are rejected, not clamped onto a tank edge. Programmatic out-of-tank points throw. Programmatic points supply XZ; pellet Y is always the surface minus pellet radius.
- Plain click still belongs to focus/optional bubble audio, and dragging still belongs to OrbitControls. Existing focus and audio canvas binders reserve Shift gestures for feeding. The feeder never stops propagation or captures pointers.
- `interaction:'click'` explicitly opts into unmodified clicks; the app must disable competing click-to-focus/bubble handlers. `'disabled'` installs no input listeners. The default modifier gesture is intended for desktop; touch users can use **Drop Food** or deliberately select click mode.
- `setEnabled(boolean)` gates canvas input only, not existing pellet simulation or explicit button/API drops. It is not a physics pause or audio mute.

| Option | Default / contract |
| --- | --- |
| `bounds` | Standalone fallback `[-6,.2,-5]..[6,4.5,5]`; pass audited world bounds in real scenes |
| `waterSurfaceY`, `floorY` | Bounds max/min Y; finite planes inside bounds with room for pellets |
| `pelletRadius` | `.055` scene units, visual scales `.75..1.25`; not inferred asset units/meters |
| `maxPellets`, `maxRipples` | `120`, `16`; integer caps `1..1024`, `1..64` |
| `pelletLifetime` | `18` simulated seconds from spawn, including floor residence |
| `eatRadius`, `senseRadius` | `.32`, `7` scene units, cluster centers only |
| `speedBoost` | `1.65`, accepted `1..2.5`; speed ceiling and GPU tail time rate |
| `attractionStrength` | `2.8`, accepted `0..10`; multiplier of max steering force |
| `seed` | `7291`, safe integer; no Math.random dependency |
| `fixedDelta`, `maxFrameDelta`, `maxSubSteps` | Standalone `1/60`, `.2`, `12` (`maxSubSteps` cap 120); attached mode uses manager solver timing |
| `castShadow` | `false`; opt in to pellet shadow draw cost |
| `audioSynth`, `onAudioError` | Optional borrowed sound provider/error callback |

`spawnFoodCluster(worldVector3,count=10)` accepts an integer `0..64` and returns the requested writes; `0` creates no sound/ripple. `feedAtCenter(count=15)` uses the tank's world XZ center. A full pellet pool recycles the oldest active spawn; ripple slots cycle through their fixed pool. Counters count recycled writes, so a request can exceed currently free slots. `clear()` removes all food/ripples and immediately resets bound cluster frenzy metadata/caps. It does not reset cumulative counters.

`pellets` is an inspection snapshot of active records; avoid reading it in a hot loop because it allocates an array. `records` is the fixed pool, never an array of GPU fish. `stats` exposes active counts plus cumulative spawned/consumed/expired/recycled/candidateChecks/audioErrors and standalone droppedTime. Counters are not GPU timings or individual-fish counts.

## Motion, consumption and rendering

Food uses slow constant sinking speed `.45..0.8` scene units/second, seeded horizontal drift and an integrated sinusoidal sway. It stays within the tank, rests at floor + its visual radius, and expires. This is a **stylized kinematic model**, not computational fluid dynamics, buoyancy/turbulence, mass transfer or collision against arbitrary rocks. Pellets can settle in obstacles and expire there.

At each manager fixed step, food advances first; cluster flock/obstacle/bounds forces are combined with nearest-food attraction; normal velocity integration, swept collisions, bounds and source-axis-aware orientation remain in control. Food goals clamp to a cluster's safe inner bounds, but consumption checks the **actual pellet**, not that clamped goal. Centers that cannot reach a surface/wall/floor pellet wait/seek nearby; pellets outside reachable cluster-center space may simply expire. Feeding does not shrink collision proxies, teleport clusters, use negative scale, or override native animated asset routing.

After movement, active cluster-center swept segments consume within eatRadius. Each pellet is marked inactive once before another center can consume it. Hidden clusters still simulate per the existing school architecture, but only clusters represented by the visible prefix attract/eat. A partially visible cluster is still one coarse center. Frenzy flags/caps/orientation restore on the next non-feeding step; clear/detach reset immediately. This is a higher allowed speed, not an instantaneous velocity jump. GPU time-rate switching is direct (not a phase-continuous gait transition), so changing frenzy state can change the instantaneous tail pose.

Pellets use one bounded dynamic InstancedMesh; ripples use a shared flat ring geometry and fixed per-ring opacity/material slots. No geometry/material/mesh is created per click. Up to `maxRipples` additional color draw calls are possible; pellet shadows add cost if enabled. Food matrices are dynamic; **fish** per-instance attributes/matrices remain static. The existing cluster texture stays **4 × C RGBA32F / 64 bytes per cluster**: column 0 `.w` holds frenzy rate (zero when inactive), is decoded once during vertex-frame setup and reset to zero before reconstructing the affine transform. Color, analytical normals, depth and distance shadow shaders use the same boosted Bio time. There is no extra per-instance attribute, texture sampler or additional texture fetch for this metadata. Raw debug texture contents are therefore not a pure affine matrix while feeding.

World transforms cancel the supplied scene/group parent so food and rings remain world-space. Parents must be invertible; the school's existing positive-uniform parent constraints still apply. Dynamic mesh frustum culling is disabled rather than retaining stale instance bounds. Food/rings do not participate in focus raycasts. Ripples use depthWrite:false and do not become opaque DoF depth occluders.

Work is O(clusters × pellet capacity), plus bounded pellet matrix writes—not O(individual GPU fish × pellets). Simulation catch-up remains capped; TTL/ripples use accepted simulation time, not wall-clock time after hidden-tab gaps. No universal FPS/draw-call/smoothness guarantee is made.

## Sound and Director

The existing synth adds `triggerWaterPlop(pan=0)` and `triggerFishSnap(pan=0)`: short stylized oscillator accents, not recordings or physical mouth/acoustic simulation. Both use `_voice`, its source/node cleanup, maxVoices budget and existing compressor → final master. Plop optionally sends to the shared reverb, which still passes master mute. They no-op before activation, while suspended/muted, or at voice capacity. Pan is normalized stereo, not physical 3D propagation. Feeding **never calls init/resume, changes mute or creates an AudioContext**. A disposed borrowed synth is skipped; sound errors increment audioErrors without deleting visual food.

Pass `fishFeeder` to `createAquariumDirectorGui` for a canvas-input toggle, **Drop Food at Tank Center** and **Clear Food / Ripples**. Only the boolean flag participates in versioned JSON; export/import/mount does not spawn food or activate audio. The GUI borrows the feeder. Demo `/instanced.html` provides a Drop Food button and Shift+click even without the optional Director panel.

## Verification boundary

Tests cover pools/buffer reuse, local gesture/drag filtering, deterministic standalone and coupled 30/60 FPS stepping, swept consume-once, active-prefix approximation, speed restoration, affine metadata/shadow shader hooks, borrowed audio routing, disposal/partial construction cleanup, Director integration and cinematic single-step ownership. Production bundling and package inclusion are checked separately. These are **not actual browser WebGL compilation, visual mouth matching, real-device touch/audio audition or measured GPU/FPS certification**.

## Optional water surface / impact binding

[Underwater Surface](underwater-surface.md) combines dielectric Fresnel/TIR with procedural sky/mirror colors, analytic height-field normals and eight bounded ripple slots. Helper `surfaceOptions` derives the audited tank plane and runs after day-night/before the existing post render; GUI `waterSurface` binds validated scalar setters. `surface.bindFeeder(feeder)` uses the new bounded `onFoodSpawn` subscription after successful nonzero drops, not a method monkey-patch. Mean-plane contact and camera medium classification are approximate; no actual reflected aquarium image, full Gerstner/CFD, dynamic Boids water-boundary collision or extra render/capture loop is claimed. Dispose subscriptions/owned mesh/material/geometry; borrow lights/scene/feeder and retain post depthWrite:false/focus exclusion.
