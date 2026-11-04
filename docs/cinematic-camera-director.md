# Cinematic Camera Director

`templates/cinematic-camera-director.js` exports `CinematicCameraDirector`, `CAMERA_MODES` and `createCinematicCameraDirector(THREE)`. The typed factory is exported at the package root and `threejs-instant-deployer-skill/cinematic-camera-director`. Targets Three.js r180 PerspectiveCamera/OrbitControls/WebGLRenderer; not an orthographic, WebGPU or fisheye projection implementation.

**Follow targets are CPU cluster centers, NOT individual GPU fish or tails.** The real instanced manager has no CPU fishData array corresponding to deformed GPU school members. Camera selection uses `getInteractionSources()` and its visible prefix, including the partially visible cluster approximation. No GPU readback, per-fish matrix reconstruction/upload or second Boids simulation is introduced.

## Single owner, single clock

```js
import {CinematicCameraDirector, CAMERA_MODES} from './templates/cinematic-camera-director.js';

const cameraDirector = new CinematicCameraDirector({
  camera, controls, postFX,
  fishAquarium: school.manager,
  bounds: auditedTankBounds, // WORLD dimensions, not a guessed model scale
  floorY: auditedFloorY,
  seed: 8129,
  // Optional explicit opt-in; omit to install no keyboard listeners.
  keyboardTarget: window
});

// Inside the existing application animation owner:
const delta = clock.getDelta();
elapsed += delta;
school.update(delta, elapsed); // attached feeder is already stepped by school
// existing bubbles / caustics / native mixers / global updater...
cameraDirector.update(delta, elapsed); // owns controls.update; don't call it again
cycle?.update(delta, elapsed); // projects rays from the final camera pose
postFX.render(delta, elapsed); // or existing direct render when no post stack
panel?.syncDisplay();
```

Do not add another requestAnimationFrame, `clock.getElapsedTime()` after getDelta, a duplicate controls update or a second render/update loop. The director does not simulate the school, render, resize the viewport or create/dispose OrbitControls/post effects itself.

`createCinematicAquarium({..., cameraOptions:{floorY:0, keyboardTarget:window}})` optionally owns construction, one update after school/effects and before day-night/post, and disposal before post/school. It exposes `system.cameraDirector`. Omitting cameraOptions retains the existing controls owner. Use the actual floor plane: fish-center swim bounds may start higher than the visible sand floor.

The demo `/instanced.html` includes C/N buttons and optional Director controls. Demo resets recreate the director/school and restore the original camera snapshot. Post toggles use `cameraDirector.setPostFX(newPostOrNull)` to release old lens/focus state and rebind without resetting the live camera pose.

## Modes and controls

| Constant | Behavior |
| --- | --- |
| `CAMERA_MODES.ORBIT` | `Orbit View`; interactive controls, target FOV **45°**, nominal aperture **.0012** |
| `CAMERA_MODES.MACRO_DRIFT` | `Macro Drift`; smooth waypoint glide/sway, target FOV **32°**, aperture **.0024** |
| `CAMERA_MODES.FISH_FOLLOW` | `Cluster Follow (Wide Angle)`; coarse cluster chase/banking, target FOV **68°**, aperture **.0016** |

68° is ordinary perspective, **not fisheye radial distortion**. FOV values are camera.fov targets; existing camera.zoom is preserved. Aperture controls BokehPass's artistic blur, not a physically calibrated lens f-number.

- `setMode(value)` validates enum values and never immediately teleports the camera. Same-mode calls are no-ops. `mode` setter routes through it. Missing visible follow targets return false, retain/fall back to Orbit and set a diagnostic status instead of modulo-zero/NaN. Target loss during update also falls back safely.
- `nextMode()` cycles the three authored modes. `autoSwitchEnabled=false` by default, `autoSwitchInterval=18` seconds; allowed interval **1..86400**. Auto mode visits at most one mode per update, no long-gap catch-up burst.
- `orbitAutoRotate` defaults to the borrowed controls' setting (usually false), never unconditionally true. `orbitAutoRotateSpeed=.45`, validated **-20..20**. Original enabled/rotation/damping flags are restored on disposal. Without controls, Orbit holds the current view and optional rotation has no controls to drive.
- `followDistance=.85` is a **minimum stand-off in scene units, not assumed meters or measured tail distance**. Finite range `.001..1e6`. Desired distance is at least cluster collision radius + camera clearance + absolute height offset. This avoids deliberately choosing a desired eye inside the coarse envelope; it is not an actual fish-body collision guarantee.
- `followHeightOffset=.22`, range `-1e6..1e6`, offsets along the original normalized up basis. `cameraStiffness=4.5`, range `.01..100`.
- `pickNextCluster()` / `pickRandomCluster()` select proxies, returning **-1** when none are visible. `followNextCluster()` enters follow and advances predictably, starting at cluster 0. `pickNextFish()` / `pickRandomFish()` are naming-compatibility aliases only; they still choose clusters. Read-only `trackedClusterIndex` and `trackedFishIndex` are the selected proxy index, retained across Orbit for future selection—not an individual GPU fish ID.
- `seed=8129` must be uint32 integer. Random selection is deterministic, not Math.random-dependent.

The director writes camera/controls while active: do not attach another camera writer or independently call controls.update. Automatic modes disable controls input. Returning to Orbit keeps the current view, damps bank back to upright and updates controls.target to the current look point. A single public-API damping flush clears residual OrbitControls drag motion; the rendered pose is reapplied before rendering, with no private spherical-field mutation or second controls update in the same director frame. Originally disabled controls are not forced enabled.

## Paths, damping and safety

`macroWaypoints` option or `setMacroWaypoints(array)` accepts **2..64** entries `{pos:Vector3, look:Vector3}` in world space. Each position/look pair must be finite and noncoincident; vectors are copied, not retained from caller-owned input. The `macroWaypoints` getter is an inspection copy—use the setter method to edit, not mutations of that copy.

Prefer authored positions near actual aquascape geometry. Defaults derive a proportional four-point path from supplied bounds, or an explicitly synthetic 8×4×6 working volume if no bounds exist. They do **not** locate rocks/leaves semantically or infer asset size. `macroCycleSpeed=.08` waypoint-segments/second, range `.000001..10`; default sways scale with bounds (`.02 × width`, `.024 × height`) and can be overridden with nonnegative `macroSwayX/Y`.

Position/look/FOV/bank use bounded exponential weights `1-exp(-lambda*dt)`; follow look damping uses a higher lambda rather than multiplying an interpolation factor above 1. This gives exact exponential convergence for **constant targets**, not a physical spring solver or a mathematical zero-jerk/C² trajectory guarantee. Moving targets, mode changes, floor constraints and OrbitControls' own damping still affect visual smoothness. Macro paths use smoothstep between waypoints plus continuous sinusoidal sway.

Delta must be finite/nonnegative; optional elapsed must be finite/monotonic. Default maximum accepted control step is **.1 second**, configurable `maxFrameDelta` `.000001..1`; rejected time accumulates in stats.droppedTime. Auto-switch timing uses accepted delta; macro phase uses supplied elapsed. Long gaps can advance the desired macro phase but the camera still damps toward it—no unbounded catch-up loop.

`floorY` defaults to supplied bounds min Y or synthetic 0; `clearance` defaults to max(2×camera.near, .1) scene units. Only the **camera center** is floor-clamped. There is no tank-wall/glass, swept camera sphere, near-frustum or rock/plant obstacle avoidance. Smooth pursuit and floor clamping can still put the rendered eye inside a moving cluster/proxy or geometry, despite the desired stand-off. Author unobstructed waypoints/distances and inspect the full near-plane/frustum path; do not claim collision-safe navigation or exact tail clearance.

For controls-based use, the camera must have an **identity world parent transform**, matching OrbitControls' normal world-target/local-position assumptions. Without controls, positive uniform-scale, non-sheared parents are supported using world-space poses converted to local position/quaternion. Nonuniform, mirrored, sheared or invalid parent rigs fail explicitly. Source model scale/orientation/native animation paths are untouched.

Banking derives heading lag around the original up basis and rotates camera up **around the current view direction**, not fixed world Z. Bank is capped ±.35 radians; zero/vertical velocity directions remain finite using previous/view direction fallbacks. Selecting another cluster damps position/look/bank instead of teleporting to a new fish.

## Focus/lens authority and rebind

Automatic modes set a reused world-space focus Vector3 through the real post API: macro focuses its damped look point; follow focuses the current CPU center. Post computes **axial camera-space depth**, clamps to near/far and damps Bokeh focus; Euclidean distance is not injected directly into Bokeh uniforms. Click/manual focus can be superseded on the next automatic update.

Entering automatic mode snapshots the prior tracked/manual focus; Orbit/disposal restores it only while the director still owns the focus target, avoiding clobbering an external focus edit. Manual distance restoration uses setFocusDistance. Aperture and FOV transition exponentially; Orbit allows a subsequent external manual aperture edit to take precedence, while automatic modes remain lens owners. Director GUI mirrors actual aperture and current mode so JSON is not a stale lens snapshot.

Use `setPostFX(controllerOrNull)` rather than directly replacing postFX during an active shot. It releases old owned focus/aperture, snapshots the new binding and reacquires on the next update without changing camera pose. Disposed post controllers are skipped. No AudioContext, sound activation, feed spawning, geometry/material or fish instance writes occur.

## Shortcuts, GUI and ownership

`bindKeyboard(EventTarget)` returns a disposable binding; `unbindKeyboard()` removes it. No listeners are installed by default. Opt-in **C** cycles mode; **N** follows the next CPU cluster. The handler ignores prevented events, repeats, Ctrl/Meta/Alt combinations and input/textarea/select/contenteditable/textbox paths, including shadow-DOM composed paths. Only handled C/N events are prevented. Focused-canvas binding is also supported; set focusability yourself if desired. The class never changes canvas tabindex/touchAction.

Pass `cameraDirector` to `createAquariumDirectorGUI` for mode enum, minimum stand-off, optional orbit rotation, auto TV/interval, Next Mode and Follow Next CPU Cluster. Current mode/parameters participate in existing versioned JSON. Selected target is diagnostic, not serialized per-fish state. GUI bindings do not update/render/dispose the director; mounting does not start screensaver rotation or keyboard handlers.

One live director may own a camera across package/generated factory classes. `dispose()` is idempotent, removes keyboard/ownership markers, restores the construction camera local pose/up/FOV and controls target/flags, and restores only still-owned post state. It does not dispose camera, controls, renderer, scene, post effects, native mixers, geometry or school. Stop/remove it from the frame owner; later updates/setters throw. Dispose GUI → camera director → day-night/post/earlier owners. To preserve a different permanent free-camera view, record/reapply it explicitly after removal rather than relying on a hidden lifecycle side effect.

`stats` contains cumulative controlsUpdates, droppedTime, modeSwitches and current selection/status. These are diagnostics, not individual-fish IDs or GPU timings. An Orbit frame calls controls.update at most once; an automatic frame normally calls it zero times. Work vectors/quaternions are reused; post setters/GUI still allocate small config objects. No universal zero-GC/FPS/smoothness guarantee is made.

## Verification boundary

Tests cover constant-target 30/60 convergence, validated modes/inputs, floor/stand-off/vertical/stopped targets, active-prefix zero-count/target loss, bounded view-relative bank, pose-preserving handoff with **real r180 OrbitControls**, focus/lens release/rebind, manual aperture precedence, seeded/capped auto mode, safe key handling/listener replacement, camera ownership/partial construction cleanup, parent transforms, unchanged fish buffers/simulation, Director enum/JSON and cinematic camera → day-night → render ownership. Production template/package/demo bundling is checked separately.

CPU/source/control tests are not actual browser visual framing, real-model near-frustum collision checks, GPU/Bokeh appearance or measured device FPS certification. Wide-angle follow remains a stylized cluster-center documentary view, not individual-fish VR/fisheye simulation.
