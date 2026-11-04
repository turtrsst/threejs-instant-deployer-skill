# Clustered Instanced Boids Aquarium

## What this mode does—and does not do

`templates/instanced-boids-manager.js` exports `InstancedBoidsAquariumManager`. The CPU runs the existing Boids/obstacle solver for **cluster centers**, not individual fish. GPU per-instance attributes provide bounded local position, motion phase, tail-speed scale and small yaw/drift variation. Cluster transforms are uploaded in a 4×clusterCount Float DataTexture. Ordinary `instanceMatrix` attributes are identity and initialized once; no per-fish matrix update loop runs during `update()`.

Default clusterSize 64 gives **500 instances → 8 CPU clusters**, **1,000 → 16**. Each update with a simulation step schedules `clusterCount × 16 floats × 4 bytes`; 16 clusters is **1,024 bytes** of matrix payload. The driver may upload/allocate differently; this is the CPU-side texture payload, not a measured GPU bus trace. Constructor initialization remains O(instance count × mesh parts) and allocates static instance attributes/matrices.

This is **not** full per-fish separation/alignment/cohesion or exact fish collision avoidance. All fish in a cluster share a smoothed heading/center trajectory with bounded local variation. A large conservative cluster sphere protects its envelope against obstacle AABB proxies; it can reject narrow spaces that individual fish could traverse. Independent per-fish interactions, large varied trajectories, native skeletal animation and exact mesh collisions need other architectures. Keep the existing individual manager where behavior fidelity matters more than bulk instancing.

No stable **60 FPS** guarantee is made. Geometry vertex count, texture/shader cost, resolution, materials, render passes, browser and GPU dominate real performance too. An InstancedMesh does not make those free.

## Files / integration

- Source: `mcp-server/codeDeployer/instancedBoidsManager.ts`.
- Generated template: `templates/instanced-boids-manager.js`. Copy it **together with** `bio-motion-injector.js` and `boids-manager.js`; all import the same `three`.
- Package factory: `createInstancedBoidsAquariumManager(THREE)` from `threejs-instant-deployer-skill/instanced-boids`.
- Helper: `examples/instanced-aquarium.js` loads a GLB with Meshopt decoding and owns its loaded source resources through teardown.
- Demo: `/instanced.html` via `npm run demo`, synthetic two-part fish with live counters and optional shadows/caustics.

Targets **Three.js r180 WebGLRenderer/WebGL2**, using vertex `texelFetch` on RGBA FloatType textures. It is not WebGPU/TSL. Float sampling does not require rendering into float targets, but the device must support the material's attribute/sampler requirements. Default tests inspect shader composition and CPU state; they do not establish successful live GPU compilation/appearance.

## Safe GLB loading (all static parts preserved)

The following assumes an existing client scene/camera/renderer, world bounds, lighting/environment and JSON `manifest` returned by scout. Use the computed scale, not a guessed constructor default.

```js
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {InstancedBoidsAquariumManager} from './templates/instanced-boids-manager.js';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const gltf = await loader.loadAsync('/models/BarramundiFish.glb');
let school;
try {
  school = InstancedBoidsAquariumManager.fromGLTF(scene, gltf, 1000, {
    recommendedScale: manifest.recommendedScale,
    bounds: aquariumWorldBounds,
    clusterSize: 64,
    clusterRadius: 0.75,
    seed: 42,
    obstacles: [rockModel], // Registered before free-spawn sampling.
    castShadow: false      // Profile extra shadow passes before enabling.
  });
  school.validateRenderer(renderer);
} catch (error) {
  school?.dispose();
  throw error; // Caller still owns the loaded glTF resources on failure.
}
const clock = new THREE.Clock();
let elapsed = 0;
renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();
  elapsed += delta;
  school.update(delta, elapsed);
  renderer.render(scene, camera);
});
// Teardown: stop loop, dispose later FX, school.dispose(), then source glTF resources.
```

`fromGLTF` traverses **every static mesh part**, clones/bakes each child transform into model-root coordinates, retains UV/normal/tangent attributes and geometry groups, and applies `recommendedScale` once. It does not take just the first geometry/material. It rejects native animation clips, skins, morph targets, batched/instanced source meshes, hidden parts, mirrored/singular node transforms line/point parts and custom source shadow materials rather than silently changing the asset. Authored scene-root world placement is excluded: this is a reusable model-root asset, not a copy of its previous placement in another scene.

Sources must use supported Standard/Physical/Basic surface materials; arbitrary ShaderMaterial/NodeMaterial/displacement maps are rejected. Basic env-map normals need a dedicated path and are rejected. Configure extra loaders such as KTX2 when the GLB requires them; `MeshoptDecoder` alone does not handle every possible extension.

For ownership-safe async setup, use `loadInstancedAquarium({scene,url,manifest,count,renderer,...options})` from `examples/instanced-aquarium.js`. The returned `{manager,source,update,dispose}` owns that load's source resources and releases them after disposing manager clones. You may pass a configured GLTFLoader via `loader` for extra extensions. Handle the helper's rejected promise; it cleans up a failed manager/loaded source. Do not externally share/dispose its textures while its instances are alive. Bitmap/image ownership and app-wide texture caches still require application review.

## Constructor and options

```js
const school = new InstancedBoidsAquariumManager(
  scene, baseGeometry, baseMaterial, 500, {
    recommendedScale: manifest.recommendedScale,
    bounds: aquariumWorldBounds
  }
);
```

This direct signature is for **one already model-root-space static part**. Use `fromGLTF` for full assets. Input geometry/material remain unchanged; geometry and surface materials are cloned. Shared source textures stay shared and caller-owned.

| Option | Default | Contract |
|---|---:|---|
| recommendedScale | Required | Finite positive value from final manifest; baked once into cloned geometry |
| bounds | `[-6,.5,-5]..[6,4.5,5]` | Finite world Box3, cloned; use audited scene dimensions |
| count | 500 argument | Allocated capacity, integer 1–100,000; not a performance promise |
| activeCount | count | Visible prefix, integer 0..capacity; all mesh parts share draw count |
| maxAmplitude | initial Bio amplitude | Construction-time runtime deformation reserve; proxy and Bio setter enforce it |
| clusterSize | 64 | Positive integer; target instances per CPU center |
| clusterCount | ceil(count/clusterSize) | Optional override; 1..min(count,256) |
| clusterRadius | .75 | Radius of static GPU offsets around each cluster, in world units |
| driftAmplitude | .08 | Bounded per-instance GPU drift allowance |
| driftSpeed | .8 | GPU drift/yaw temporal multiplier |
| individualYaw | .18 | Small yaw variation in radians, not independent steering |
| seed | 42 | Safe integer seeded RNG for repeatable setup |
| bioOptions | fish preset | Override speed/frequency/amplitude/spineAxis/spineDirection etc.; preset forced to fish_swim |
| deformationMargin | computed conservative bound | Expert override for GPU body displacement; must remain conservative |
| maxSpeed / maxForce | 2.2 / 1.8 | Cluster center speed and steering acceleration in world units/sec and units/sec² |
| boids | existing defaults | Other underlying Boids options, including fixed timestep/work limits |
| obstacles | [] | Objects/world Box3 proxies or `{object,padding,dynamic}` entries, registered before spawning |
| castShadow / receiveShadow | true / true | Instanced draw flags; every shadow pass adds GPU work |

Capacity/geometry/cluster layout/radius/bounds and deformation reserve are fixed after construction. Recreate for those changes; `setActiveCount` changes only the visible prefix within capacity, while validated motion setters support live tuning. All CPU cluster positions are world-space; the draw objects cancel their scene parent's world matrix. Scene ancestors require the positive uniform scale rules of the underlying heading solver; nonuniform parent shear is not supported. Update after parent changes and do not manually manipulate owned InstancedMesh transforms.

Default proxy radius includes clusterRadius, bounded drift, a sphere about the **fish origin** enclosing all baked mesh parts, and a conservative Bio-Motion translation bound. Yaw preserves that sphere. Explicitly shrinking margin/radius can invalidate geometric safety. If the sphere cannot fit world bounds, construction fails. Overlapping clusters are not hard fish–fish exclusion; inspect actual density.

## API / lifecycle

- `instancedMeshes[]`: one InstancedMesh for each source static part, each with the same per-instance attributes/cluster mapping.
- `instancedMesh`: first part alias for simple callers; do not interpret it as the whole multi-part asset.
- `clusterRecords[]`: all preallocated CPU centers. `getInteractionSources()`: borrowed cached list of only centers used by the visible prefix (empty at activeCount=0), not individual GPU fish positions. Bubble influence using these records is coarse approximation only.
- `shaderUniforms`: available before first compile; `uBioTime` and backward-friendly `uTime` alias the same uniform; geometry-time motion is independent of compile latency.
- `addObstacle`, `refreshObstacle`, `removeObstacle`: delegate to the cluster proxy solver. A new enclosing obstacle is resolved on the next simulation step; do not claim safe placement before that step.
- `update(delta,elapsedTime?)`: finite nonnegative delta; elapsed defaults to accumulated delta and must be finite/monotonic. Runs center solver, syncs scene transform cancellation and uploads one cluster texture only when simulation steps occur. Does not write any per-fish matrices. Do not also register every instance with the non-instanced animation updater.
- `validateRenderer(renderer)`: checks WebGL2/vertex textures, max texture size, and conservative source attribute slot estimate. It does **not** compile shaders, prove total sampler budgets, or measure FPS. Compile/profile on the actual renderer/device.
- `dispose()`: idempotent; removes instanced objects/cluster nodes, clears CPU manager, disposes owned geometry clones, material/shadow clones, instance buffers and cluster texture. Does **not** dispose input geometry/material/textures.

Dispose any caustic controllers attached after construction first, then this manager, then owned source GLTF resources. For a manually loaded glTF, deduplicate shared geometry/material/texture disposal in app code. The async helper does that for its own load.

## Rendering correctness and costs

The module extends built-in Three.js shaders via `onBeforeCompile`; it does not replace the PBR fragment shader with a flat custom color. Existing UV textures, metallic/roughness/normal maps, environment, material groups and original compile/cache hooks remain. Arbitrary source compile hooks can still invalidate bounds or chunk assumptions; audit their displacement and normal math rather than assuming compatibility. Source node transforms are baked before shared model bounds are measured. All parts use consistent instance phase/cluster arrays so body/tail parts do not drift out of sync.

Per-instance phase/speed modify the existing Bio-Motion time; position and inverse-transpose Jacobian normal/tangent deformation remain. Cluster/yaw rotations are applied before normal transforms; stock instance matrices stay identity. Directional/spot depth and point-distance materials share the exact position/time/cluster texture path. Caustics attached afterward observe final GPU world positions.

**Draw calls are not universally one:** each mesh part/material group adds draws, shadow lights add passes, and point shadows can require multiple faces. One draw may include many triangles/vertices. Source attributes plus the four instance-matrix slots and four custom per-instance attribute slots can exceed hardware limits on complex GLBs; preflight is conservative and shader-specific active attribute use can differ. Sampler/extension/driver limitations still need GPU validation.

GPU positions are not reflected in CPU instance matrices. Default raycasting is explicitly disabled, and frustum culling is disabled rather than using incorrect origin-only bounds. Picking individual fish, per-fish collision/interaction, precise GPU bounds/culling and per-instance animation clips are not implemented. GPU readback or reconstructing every fish on CPU would change the architecture and performance tradeoff.

## Profiling—no universal FPS claims

```bash
npm run bench:instanced -- --count 500 --steps 240
npm run bench:instanced -- --count 1000 --steps 240
npm run demo
```

The Node benchmark warms up a synthetic 24-vertex box, then reports CPU `update()` median/p95, cluster writes and scheduled matrix payload. It **excludes rendering, driver/GPU uploads, shader work, texture sampling, shadows and browser scheduling**. It is not a real-fish benchmark or FPS evidence. Do not extrapolate a tiny CPU update time into a 60 FPS guarantee.

`/instanced.html` renders a synthetic two-part fish in the browser and shows observed frame rate, CPU update timing, renderer draw/triangle counters, cluster payload and blocked clusters. Defaults disable costly shadows/caustics; enable one at a time to profile. The demo does not automatically certify GPU rendering or provide a cross-device result. Inspect shader errors, visual orientation, material maps, shadows, heat/throttling and full-frame time on target hardware.

Start with optimized low-poly source GLBs, reduced texture sizes/resolution, few material groups and sensible shadows. Test LOD, distance-based count reduction, lower pixel ratio and simplified optional effects before increasing population. Such strategies are recommendations, not automatically implemented LOD/occlusion systems in this module.

## Ringkasan Bahasa Indonesia

- CPU menggerakkan **pusat cluster**, GPU menangani offset/fase/gerak per-instance. Ini bukan simulasi Boids individual untuk semua ikan.
- Skala wajib dari manifest; gunakan `fromGLTF` agar semua mesh/material/transform anak dipertahankan, bukan hanya mesh pertama.
- PBR, normal deformasi dan shadow dipertahankan. Native skin/morph/klip animasi memerlukan jalur animasi sebelumnya dan ditolak eksplisit di sini.
- Default 1.000 ikan = 16 pusat CPU dan payload matriks 1.024 byte per update bersimulasi, tanpa upload matriks per ikan. Inisialisasi dan kerja GPU tetap bertambah sesuai jumlah instance/part.
- Proxy seluruh cluster dapat menghalangi celah sempit. Posisi GPU tidak tersedia sebagai snapshot CPU untuk picking/interaction per ikan.
- Benchmark Node hanya CPU. Tidak ada jaminan 60 FPS, single draw call untuk semua aset/pass, atau tampilan shader sudah terverifikasi di seluruh browser.


## Optional cinematic output

Use the [post-processing stack](underwater-postprocessing.md) when adding DoF/Bloom/lens effects. Its per-group Bokeh depth clones preserve cluster/Bio position hooks; stock scene-wide Bokeh depth does not. Track a CPU cluster or world point, not an individual GPU fish. The cinematic helper also composes existing caustics/bubbles and one updater/render loop; profile the additional full-screen/depth cost separately from CPU school timing.


## Live Director controls

[Director Studio](aquarium-director.md) uses `setActiveCount` (all mesh parts, no instance-buffer writes/reallocation), `setMaxSpeed` with `minimumCruiseSpeed`, `setTailSpeed`, `setFrequency`, `setAmplitude` and seeded cluster `scatter`. `count`/`stats.capacity` stay allocated capacity, while `activeCount`/`stats.activeCount` reflect draws. All CPU clusters keep simulating even at zero visible fish, preserving hidden trajectories and flocking influence. Reserve `maxAmplitude` at construction; the default cap is initial amplitude. Greater reserve enlarges initial proxy safety bounds and may reject crowded tanks. This is not a per-fish active-only CPU optimization or a guarantee of microsecond updates.

## Optional interactive feeding

[Interactive Feeder](interactive-feeder.md) pools food/ripples and binds into the existing fixed-step cluster solver through `manager.setFeeder(feeder)`. Shift+click reserves the local gesture without stealing plain focus/bubble clicks or orbit drags. CPU cluster centers seek/consume and allow pitch/frenzy; there are no individual GPU mouth positions, per-fish CPU updates or per-fish matrix uploads. Packed matrix-row metadata carries tail rate without changing the 64-byte/cluster budget, and affine zeros are restored before transforms in all shader passes. The manager owns attached stepping; helper `feedingOptions` owns feeder disposal. Audio is optional/budgeted, never activated by feeding. See the contract for caps, kinematic limitations and validation boundaries.

## Optional dynamic day–night cycle

[Day–Night Cycle](day-night-cycle.md) interpolates optical keyframes and normalized HDR PBR emission in the existing frame owner. Register actual mesh/material parts after earlier shader injection; restore in reverse disposal order. No per-fish matrix writes, native animation replacement or emission in depth/normal/shadow shaders. `dayNightOptions` opts the cinematic helper into ownership; Director `dayNightCycle` exposes time/auto/duration/color and mirrors current optical values for JSON. The updating cycle takes precedence over independent optical presets, including when its hour is paused. It borrows lighting/post/caustic resources and leaves the last optical values on disposal. Screen rays and biological masks are stylized, bloom is not selective and PMREM is not regenerated. See the contract for bounds/axis validation and browser GPU verification limits.

## Optional cinematic camera ownership

[Camera Director](cinematic-camera-director.md) owns OrbitControls updates or automatic macro/CPU-cluster shots and synchronizes lens/focus through the real post API. `cameraOptions` opts the cinematic helper into construction, one update before day-night projection/render and reverse disposal; `cameraDirector` opts the GUI into mode/stand-off/auto/rotation controls and current aperture/JSON synchronization. C/N key bindings are explicit and ignore GUI typing. Zero visible clusters fall back safely. No per-individual GPU fish tracking, matrix readback/upload, true fisheye distortion or collision-safe rock/frustum navigation is claimed. Do not independently call controls.update or add another clock/render loop while bound.
