# Spatial Boids & Obstacle Avoidance

## Contract and ownership

`templates/boids-manager.js` exports `BoidsAquariumManager`. Copy it beside the existing templates; its only dependency is `three`. Source of truth is `mcp-server/codeDeployer/boidsManager.ts`; `npm run build` generates the standalone template. Package `threejs-instant-deployer-skill/boids` exports `createBoidsAquariumManager(THREE)` with no implicit Three.js dependency for server-only consumers.

The manager owns CPU simulation state/registrations only. It does not load models, change measured scale, add meshes to the scene, dispose geometry/materials, update AnimationMixer, or advance Bio-Motion time. One existing application loop updates locomotion first, shader/mixer second, renderer last. Do not create a second animation loop just for the manager.

## API

```js
const aquarium = new BoidsAquariumManager(scene, {
  bounds: new THREE.Box3(new THREE.Vector3(-4, .2, -3), new THREE.Vector3(4, 3.5, 3)),
  seed: 42,
  maxSpeed: 1.8,
  maxForce: 1.8
});
const obstacle = aquarium.addObstacle(rockGroup, { padding: .05 });
const record = aquarium.addFish(fishModel, bioController, {
  randomizePosition: true,
  deformationMargin: .08
});
aquarium.update(deltaSeconds);
aquarium.removeFish(record); // Or fishModel.
aquarium.removeObstacle(obstacle); // Or rockGroup.
aquarium.clear();
aquarium.dispose();
```

`scene` may be a Scene or Group. Bounds, velocities, radii, distances, forces and obstacle proxies are in **world coordinates**, not scene-local coordinates. An attached fish must descend from the managed scene/group. A rotated/translated, positively uniformly-scaled parent is supported; ancestors with nonuniform/mirrored scale are rejected because their shear cannot be corrected by a heading quaternion alone. Fish scale must be finite/positive and is never overwritten.

### Manager options

| Option | Default | Meaning |
|---|---:|---|
| bounds | `[-4,.2,-3]..[4,3.5,3]` | Cloned finite world Box3; provide audited scene bounds |
| maxSpeed | 1.8 | World units/second before individual multiplier |
| minSpeed | .35 | Requested cruise minimum; collision handling may stop fish below it |
| maxForce | 1.8 | Steering acceleration cap per behavior in units/second², not per frame |
| neighborRadius | 1.5 | Alignment/cohesion search range |
| separationDist | .6 | Separation range; choose appropriately for fish sizes |
| avoidanceLookAhead | 1.2 | Anticipation ray length; hard sweep independently checks the next actual step |
| boundsMargin | .8 | Smooth wall-steering zone inside radius-inset bounds |
| turnRate | 5 | Quaternion smoothing rate, `1-exp(-rate*dt)` |
| fixedDelta | 1/60 | Fixed simulation step in seconds |
| maxSubSteps | 12 | Bounded work per update; positive integer |
| maxFrameDelta | .2 | Maximum accepted real delta before discarded pause time |
| seed | 12345 | Safe integer seed for deterministic RNG |
| random | seeded RNG | Optional function returning finite `[0,1)` values |
| weights | see below | Nonnegative behavior weights; zero disables a steering behavior |

Weights: `{separation:1.8, alignment:1, cohesion:1, avoidance:3.5, bounds:2}`. Turning weights off does not disable hard bounds/proxy constraints. Configuration is intended to remain stable after registration; changing bounds/radius/ancestor scales needs re-registration so cached radius-inset bounds and heading assumptions remain valid. Public fish/obstacle arrays are for inspection; don't mutate their internals.

### Fish options

- `radius`: explicit conservative world sphere radius about the **model origin**. If omitted, the manager finds the farthest corner of the actual world Box3 from the origin, then adds `deformationMargin` (default .05). This conservatively includes off-center pivots but can overestimate elongated fish. An explicit radius must include the whole body and shader displacement to remain a useful collision proxy.
- `deformationMargin`: nonnegative allowance added only to the automatically measured radius. GPU tail/bob extents are not measured by CPU Box3; review the chosen margin.
- `randomizePosition:false` default preserves current world position and rejects a spawn outside radius-inset bounds. `true` tries at most 64 seeded spawn samples outside inflated obstacle boxes; throws if none succeed. It does not reserve nonoverlapping spawn spheres for other fish.
- `velocity`: optional initial world Vector3; otherwise seeded random cruise heading. `speedMultiplier` defaults to seeded .8–1.2; must be positive and allow the configured minimum speed.
- `forwardAxis:0|2`, `forwardSign:-1|1`: local axis/sign pointing toward the **head**. With a Bio-Motion controller, default axis is `uSpineAxis` and sign is **negative** `uSpineDir`, because Bio-Motion's normalized spine increases from head to tail. Without a controller, default is +Z. Never apply an unconditional extra 90-degree rotation.
- `horizontalOnly:true` suppresses visual pitching, while Y velocity still moves fish vertically. Set false for full 3D look direction. Heading preserves upright orientation and smoothly converts world rotation into parent-local rotation.

For native GLTFs whose root is itself animated, register a locomotion wrapper group rather than competing with animation tracks on the same transform. If the GLTF has an authored root rotation, review/override forward axis/sign; bounding boxes cannot infer anatomical direction.

### Obstacles

`addObstacle(meshOrGroupOrWorldBox3, {padding:0, dynamic:false})` returns a proxy record. Mesh/group bounds include child geometry/transforms, not just the object's origin. Static proxies are cached at registration; moving the object does not update the cache automatically. Call `refreshObstacle(objectOrRecord)` after edits, or set `dynamic:true` for refresh once per update. Box3 inputs are interpreted as world coordinates and copied into the proxy; dynamic Box3 inputs are recopied each update.

`removeObstacle()` returns false if unregistered. Obstacles are not automatically removed on scene detach because intentionally detached world proxies are supported; explicitly unregister them. Dynamic proxies are snapshots at each update, not swept motion histories of moving rigid bodies.

## Algorithm and limits

1. Snapshot all fish world positions and build a 3D uniform spatial hash with cell width `max(neighborRadius,separationDist)`.
2. Query the surrounding 27 cells, accumulating separation, alignment and cohesion once per neighbor. Exact overlapping positions receive deterministic antisymmetric separation. Forces for the whole school are computed before any velocity/position is integrated, avoiding in-place neighbor update bias.
3. Look ahead along velocity and intersect a ray with each relevant obstacle **AABB inflated by radius+padding**. A side-steer breaks head-on symmetry. This is analytical proxy intersection, not triangle `Raycaster.intersectObjects()`.
4. Integrate velocity with fixed timestep and bounded cruise speed. Resolve existing proxy penetration in a bounded loop; sweep the intended step against inflated obstacle boxes and clip at the earliest hit, removing inward normal velocity. Clamp/reflect at radius-inset aquarium walls.
5. Write world position through the parent inverse and smooth heading using the fish's actual configured head axis. Update animation uniforms/mixers separately in the existing render loop.

Spatial hashing reduces neighbor work in sparse schools; dense schools still approach quadratic work. Obstacle queries remain linear per fish per step (no obstacle BVH). The implementation intentionally avoids CPU per-vertex fish animation and per-triangle rock raycasting, but it is not a performance guarantee for arbitrarily large schools. Profile the actual target device.

**Not a general physics engine:** fish–fish separation is steering, not hard collision exclusion; conservative AABBs may block empty rock arches, and world sphere radii may be too conservative for long fish. GPU extents, moving/rotating obstacles, intersecting rocks, and impossible packing require scene-specific review. Non-overlapping feasible static proxy setups are sweep-constrained, but do not promise arbitrary actual mesh collision safety. An unresolved penetration after eight passes sets `record.blocked` and `stats.blockedFish`; affected fish are stopped, not silently treated as safe. Fix the scene/radius/proxies rather than hiding this signal.

### Timing/statistics

`update(delta)` requires finite nonnegative seconds. The accumulator executes up to maxSubSteps and discards oversized pause/backlog time rather than simulating minutes on tab resume. `stats.droppedTime` records cumulative discarded seconds; `subSteps`, `neighborChecks`, `obstacleChecks`, `fishCount`, and `blockedFish` describe the latest update. Delta zero doesn't advance simulation. Under the work limits and identical input, seeded schools produce the same fixed-step trajectory at 30/60 FPS (within floating-point tolerance). No render interpolation is implemented.

Removing a fish explicitly or detaching it from the managed scene stops simulation; detached records are pruned on the next update. `clear()` empties registrations/hash and resets the accumulator; `dispose()` is idempotent, clears registrations, and prevents further add/update calls. Neither removes nor disposes render objects. Tear down manager registrations **before** disposing deployer handles to release CPU references immediately, especially when the render loop is paused.

## Full integration with existing templates

```js
import * as THREE from 'three';
import {
  deploySmart3DModel, updateAllDeployedModels
} from './templates/smart-deploy.js';
import { BoidsAquariumManager } from './templates/boids-manager.js';

// fishManifest and rockManifest come from scout JSON; don't guess their scales.
const aquarium = new BoidsAquariumManager(scene, { bounds: aquariumWorldBounds, seed: 42 });
const handles = [];
const rock = deploySmart3DModel('/models/mineral_rock.glb', {
  scene, manifest: rockManifest, bioPreset: null,
  onLoaded: ({ model }) => aquarium.addObstacle(model, { padding: .05 })
});
handles.push(rock);
await rock.ready; // Register obstacle before sampling free fish spawn positions.
for (let i = 0; i < 8; i++) {
  handles.push(deploySmart3DModel('/models/BarramundiFish.glb', {
    scene, manifest: fishManifest, bioPreset: 'fish_swim',
    onLoaded: ({ model, bioController }) => aquarium.addFish(model, bioController, {
      randomizePosition: true, deformationMargin: .08
    })
  }));
}
await Promise.all(handles.map(handle => handle.ready));
const clock = new THREE.Clock();
let elapsed = 0;
renderer.setAnimationLoop(() => {
  const delta = clock.getDelta(); // One read per frame.
  elapsed += delta;
  aquarium.update(delta);
  updateAllDeployedModels(delta, elapsed); // Exactly one owner of shader/mixer updates.
  renderer.render(scene, camera);
});
// Teardown:
// aquarium.dispose();
// for (const handle of handles) handle.dispose();
```

The examples assume an existing client scene/camera/renderer, lighting/environment and audited world bounds, not fabricated scales. `examples/aquarium.js` provides a reusable setup/teardown helper without installing a competing render loop. Handle its `ready` promise and dispose the helper if setup fails. The demo `/boids.html` uses synthetic multi-mesh fish with Bio-Motion, actual rock proxy bounds and optional helper visualization. Default tests cover CPU/math behavior and generated modules, not live GPU visual correctness; inspect the target browser before claiming visual verification.


## Larger schools

For fewer CPU transforms/draw calls, consider [clustered instanced rendering](instanced-boids.md). It reuses this manager only for cluster centers, not every fish. This deliberately changes behavior fidelity; keep individual Boids when independent per-fish avoidance is required.
