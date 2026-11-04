# Three.js Instant 3D Deployer & Autonomous Living Scene Engine

**Federated scouting → binary GLB normalization → X-Ray manifests → AST deployment → optional Bio-Motion + Boids + underwater FX.**

`threejs-instant-deployer-skill` is an open-source AI Agent Skill and MCP toolset bridging Three.js primitive prototypes and integrated 3D scenes. It scouts licensed assets, normalizes pivots, calculates fit, inspects scene graphs, and helps agents deploy assets with animation and optional autonomous schooling.

**MIT · Node.js ≥20.19 · ESM · Claude Code Skills / Cursor Rules / MCP**

## 🌍 Language Selection / Pilihan Bahasa

- [🇺🇸 English Documentation](#english-documentation)
- [🇮🇩 Dokumentasi Bahasa Indonesia](#dokumentasi-bahasa-indonesia)
- [Complete reference / Referensi lengkap](docs/reference-id.md)

<a id="english-documentation"></a>

## 🇺🇸 English Documentation

### Key Problems Solved

1. **Scale & pivot chaos:** imported assets can have inconsistent dimensions and origins. The pipeline normalizes to **bottom-center**, measures the final bounding box, and computes a uniform contain-fit `recommendedScale`. Primitive replacement preserves the original transform and corrects the center-to-bottom offset.
2. **Binary blindness:** the X-Ray manifest exposes meshes, material properties, node relationships, skin/bone names, and animation clips as JSON—no guessed node names.
3. **Static organisms brought to life:** native animation clips take priority. Suitable static organisms can receive GPU vertex deformation: fish S-waves, root-pinned vegetation sway, or coral pulses. Rocks, lamps, and unrecognized names stay static; explicit overrides are available.
4. **Autonomous schooling & obstacle avoidance:** optional CPU Boids handles separation, alignment, cohesion, bounds, and look-ahead/swept obstacle proxies while the GPU animates surfaces. It is not a general physics engine or a guarantee of collision-free schooling.
5. **Underwater atmosphere:** optional texture-free caustic overlays and circular bubble particles follow world-space fish positions. These are stylized effects, not physically traced water optics.
6. **Two deployment architectures:** bundlers use `public/models/`; single-file HTML can embed the GLB as a Data URI. Three.js/addons still require a compatible importmap, CDN, or vendored libraries.

### Repository Architecture

```text
threejs-instant-deployer-skill/
├── SKILL.md                       # Ordered agent execution rules
├── package.json                   # ESM CLI bins, exports, build/test scripts
├── mcp-server/
│   ├── searchProviders/           # Poly Haven, Sketchfab CC0, Khronos, HF discovery
│   ├── glbSurgeon/                # Bounds/pivot, Meshopt/WebP, X-Ray
│   ├── codeDeployer/              # AST injection, runtime, Bio-Motion, Boids
│   ├── pipeline.ts                # Routing, fallback, license/budget policy
│   └── server.ts                  # MCP stdio tools
├── scripts/
│   ├── scout-and-process.mjs      # Federated search + binary processing CLI
│   ├── inject-three-code.mjs      # JS/TS/HTML AST integration CLI
│   └── mcp-server.mjs             # MCP entry point
├── templates/
│   ├── smart-deploy.js            # GLTF loader, native/procedural/static routing
│   ├── bio-motion-injector.js     # GPU deformation, normals, depth/distance shadows
│   ├── boids-manager.js           # Spatial neighbor search + obstacle proxies
│   ├── underwater-fx.js           # Procedural caustics + interactive bubble particles
│   ├── instanced-boids-manager.js # CPU clusters + GPU instanced Bio-Motion
│   ├── underwater-postprocessing.js # HDR/MSAA + DoF + Bloom + lens + output
│   ├── aquarium-director-gui.js  # Optional lil-gui live controller/preset panel
│   ├── underwater-audio-synth.js # Opt-in asset-free procedural Web Audio
│   ├── interactive-feeder.js     # Pooled food/ripples + CPU cluster feeding
│   ├── day-night-cycle.js        # Continuous optical cycle + HDR PBR bio-glow
│   ├── cinematic-camera-director.js # Single-owner orbit/macro/cluster camera
│   └── underwater-surface.js     # Dielectric Fresnel + pooled height-field ripples
├── .cursor/rules/                 # Cursor integration
├── examples/                     # Primitive scene + aquarium lifecycle helper
├── demo/                         # Synthetic binary, shader, and schooling labs
├── tests/                        # Offline pipeline/runtime/CLI/MCP/math tests
└── docs/                         # Detailed contracts, limits, and examples
```

### Quick Start Guide

**1. Install and verify the skill**

```bash
git clone https://github.com/turtrsst/threejs-instant-deployer-skill.git
cd threejs-instant-deployer-skill
npm install
npm run check
```

**2. Scout and process a fish**

```bash
node scripts/scout-and-process.mjs \
  --query "barramundi fish aquatic" \
  --provider openpbr \
  --target-height 0.3 \
  --output-dir ./public/models \
  --manifest ./public/models/BarramundiFish.manifest.json
```

This explicit provider selects the **CC0, static** Barramundi from the curated Khronos registry without an API key. Omit `--provider openpbr` for automatic federation. Network access to the selected providers/CDNs is required; no result is guaranteed. `--target-height` controls height, not fish length. Default output budget is **1 MiB**; an oversized result fails rather than pretending to meet it.

**3. Deploy in an existing Three.js bundler project**

The [shared working example below](#living-scene-example) is client-side code for an existing bundler app. Copy the generated `public/models/` files to that project's `public/models/` and the twelve `templates/*.js` files to its `src/templates/`. Use matching Three.js/addons—these templates target **Three.js r180 WebGLRenderer** (`three@0.180.0`), not WebGPU/TSL. Serve the app with its dev server, not `file://`.

For another project directory, give the scouting CLI absolute `--output-dir` and `--manifest` paths. Do not use `manifest.savedPath` as a browser URL.

<a id="living-scene-example"></a>

### Living Scene Example / Contoh Scene Hidup

Place this in the target app's `src/main.js`. It creates its own renderer and loop; when integrating into an existing scene, merge the update calls into that scene's **single existing loop** instead. It uses the measured manifest scale, explicit spawn sampling, correct updater import, and one clock read per frame.

```js
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  deploySmart3DModel,
  updateAllDeployedModels
} from './templates/smart-deploy.js';
import { BoidsAquariumManager } from './templates/boids-manager.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x142822);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
camera.position.set(9, 6, 10);
camera.lookAt(0, 1.5, 0);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.body.style.margin = '0';
document.body.append(renderer.domElement);

const pmrem = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment();
const environment = pmrem.fromScene(room, 0.04);
scene.environment = environment.texture;
room.dispose();
pmrem.dispose();
scene.add(new THREE.HemisphereLight(0xe9fff2, 0x334d3d, 2));

const aquarium = new BoidsAquariumManager(scene, {
  bounds: new THREE.Box3(
    new THREE.Vector3(-4, 0.2, -3),
    new THREE.Vector3(4, 3.5, 3)
  ),
  seed: 42
});
const handles = [];
const clock = new THREE.Clock();
let elapsed = 0;
let disposed = false;

// Start rendering immediately; assets join after their GLBs finish loading.
renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();
  elapsed += delta;
  aquarium.update(delta);
  updateAllDeployedModels(delta, elapsed);
  renderer.render(scene, camera);
});

try {
  const response = await fetch('/models/BarramundiFish.manifest.json');
  if (!response.ok) throw new Error(`Manifest HTTP ${response.status}`);
  const manifest = await response.json();
  if (!disposed) for (let i = 0; i < 8; i++) {
    const handle = deploySmart3DModel('/models/BarramundiFish.glb', {
      scene,
      manifest, // Uses computed recommendedScale; never a guessed constant.
      bioPreset: 'fish_swim',
      onLoaded: ({ model, bioController }) => aquarium.addFish(model, bioController, {
        randomizePosition: true,
        deformationMargin: 0.08
      })
    });
    handles.push(handle);
  }
  await Promise.all(handles.map(handle => handle.ready));
} catch (error) {
  console.error('Aquarium setup failed:', error);
  aquarium.clear();
  for (const handle of handles) handle.dispose();
}

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', resize);

// Call this from the app's teardown/unmount lifecycle.
export function disposeAquarium() {
  if (disposed) return;
  disposed = true;
  renderer.setAnimationLoop(null);
  removeEventListener('resize', resize);
  aquarium.dispose();
  for (const handle of handles) handle.dispose();
  scene.environment = null;
  environment.dispose();
  renderer.dispose();
  renderer.domElement.remove();
}
```

To avoid a loaded rock/decor group, register it with `aquarium.addObstacle(rockModel)` **after loading**; register obstacles before random fish spawning when possible. See [the aquarium helper](examples/aquarium.js) for a combined fish/rock setup. Review actual fish head direction, bounds, body radius, and GPU displacement margin; the example's aquarium dimensions are illustrative, not automatic scene measurements.

### Agents, CLI, and MCP

- **Claude Code:** install the repo under `.claude/skills/threejs-instant-deployer/`, run `npm install` there, and follow [SKILL.md](SKILL.md).
- **Cursor:** copy/adapt [.cursor/rules/threejs-deployer.mdc](.cursor/rules/threejs-deployer.mdc) for the skill's location.
- **MCP:** run `node /absolute/path/to/skill/scripts/mcp-server.mjs`. Tools: `scout_and_process` and `inject_three_code`. Configure stdio transport in your client; secrets belong in environment variables.
- **AST replacement:** run `node scripts/inject-three-code.mjs --help`. Review output before `--write`; complex factories/React lifecycles need explicit runtime integration.
- **Offline verification/demo:** `npm run check` and `npm run demo`. Preview `/`, `/bio.html`, `/boids.html`, `/instanced.html` uses synthetic fixtures, not downloaded realistic models. `npm run test:live` is a separate opt-in network smoke test.

### Underwater Caustics & Interactive Bubbles

`templates/underwater-fx.js` exports `injectWaterCaustics(material, options)` and `InteractiveBubbleSystem`. Caustics follow the final world-space vertex position (including Bio-Motion), compose existing shader hooks/cache keys, and add light before tone mapping. Bubbles use circular GPU sprites, seeded fixed-step CPU movement, and spatial-hash fish interaction—without allocating vectors for every particle/fish pair.

Use world-space Boids records (`aquarium.fishInstances`) for bubble interaction, not `mesh.position` under transformed parents. Advance the clock once per frame and dispose effects before owned GLTF resources. The return from `injectWaterCaustics` supports both `.value = elapsed` and controller `.update(elapsed)` / `.dispose()`.

[Full integration and limitations](docs/underwater-fx.md) · [Aquarium + FX helper](examples/underwater-aquarium.js). The existing `/boids.html` demo now includes an optional caustics/bubbles toggle. Effects are decorative: no true refraction, shadow-aware light transport, physical bubble collisions, or automatic water detection. Shader execution/appearance still needs verification on the target GPU.

### Large Schools: Clustered Instanced Rendering

`templates/instanced-boids-manager.js` provides `InstancedBoidsAquariumManager` for static GLB schools. Unlike an O(fish-count) matrix-update loop, it simulates one CPU Boid per cluster and stores cluster transforms in a vertex-readable Float DataTexture. Per-instance offsets, phase, speed variance and bounded drift stay on the GPU; identity instance matrices are initialized once.

At the default cluster size 64, 500 fish use 8 CPU clusters and 1,000 fish use 16. A normal update schedules `clusterCount × 64` bytes of matrix data, **not one matrix per fish**. PBR textures/materials, analytical deformation normals, and depth/distance shadow passes are retained. `fromGLTF` preserves all static mesh parts/material groups instead of selecting only the first mesh. Use the manifest's measured `recommendedScale`.

**This is clustered schooling, not independent per-fish Boids.** A conservative whole-cluster sphere steers around obstacle AABBs; narrow passages may be blocked and fish do not independently avoid one another. Native skeletal/morph animation requires the existing non-instanced path. One draw per school is not guaranteed: each mesh part/material group and shadow pass adds work. Neither instancing nor a CPU-only benchmark guarantees **60 FPS** on all hardware.

[API, GLB loading, ownership and profiling](docs/instanced-boids.md) · [Async loader helper](examples/instanced-aquarium.js). Run `npm run bench:instanced -- --count 1000` for a clearly labeled CPU-only test; `/instanced.html` profiles a synthetic school in the browser. Use `validateRenderer(renderer)` to preflight WebGL2 vertex-texture and attribute limits; it is not shader/performance certification.

### Optional Cinematic Post-Processing

`templates/underwater-postprocessing.js` adds an HDR/MSAA composer with deformation-aware Bokeh depth, luminance-threshold Bloom, a screen-space underwater lens/snow/ray overlay and final OutputPass. Focus uses camera-axis depth, canvas-local click coordinates and frame-independent rack focus. Resize follows the container, and teardown disposes all owned passes/targets/listeners without disposing the renderer or scene assets.

[Post-processing API and tuning](docs/underwater-postprocessing.md) · [Complete bundler entry](examples/cinematic-main.js) · [Instanced + atmosphere + post helper](examples/cinematic-aquarium.js). The helper owns one global animation update and one composer render per frame; don't call additional updaters/renderers alongside it. GPU fish focus uses a coarse CPU cluster center, not exact individual picking. Enable **CINEMATIC POST FX** at `/instanced.html` to compare the incremental workload.

Requires r180 WebGL2/HDR float render targets; MSAA count is capability-dependent. Bloom is **not object-selective**; rays/snow/tint are stylized overlays, **not physical volumetric scattering**. Full-screen effects can dominate GPU cost even when school CPU simulation is cheap. Live shader/visual/FPS verification is separate from unit tests/builds; no universal 60 FPS is claimed.

### Optional Interactive Director Studio

`templates/aquarium-director-gui.js` binds current fish, flora, caustics, bubbles and post-processing controllers to lil-gui, with three atmosphere presets and versioned JSON/clipboard export. It starts from actual settings without applying a preset. [Director API and safety contract](docs/aquarium-director.md).

Allocate capacity once, then `setActiveCount(n)` changes draw counts on **all** mesh parts without rebuilding geometry/instance buffers. CPU centers remain simulated for continuity; this does not proportionally reduce cluster CPU work or guarantee microsecond latency/FPS. Reserve `maxAmplitude` at construction before exposing larger fish deformations. Setters update shared uniforms before compilation; cluster scatter is bounded/seeded, not per-fish explosion physics.

`examples/cinematic-main.js` includes panel setup/cleanup and one render loop; `/instanced.html` offers **DIRECTOR STUDIO** plus population, post-FX and synthetic flora controls. Dispose the panel before changing bindings. Lens focus uses the post API and manual display synchronization, not a second updater or render loop.

### Optional Zero-Asset Procedural Audio

`templates/underwater-audio-synth.js` generates a colored-noise/sub drone, Minnaert-based bubble tones, scatter whoosh and optional pentatonic FM chimes with procedural convolution—no audio files/microphone/network requests. Activation is explicit and asynchronous; master mute covers both dry and reverb paths. Voice limits, cached PCM, ended cleanup and owned-versus-borrowed AudioContext disposal are explicit. [Audio API, ownership and acoustic limits](docs/underwater-audio.md).

Pass `audioSynth` to Director for controls, current-motion coupling and scatter accents; panel creation, presets and JSON imports never activate audio. `/instanced.html` has **Enable / Resume Procedural Audio** and separately opt-in canvas bubble clicks. The complete cinematic entry mutes/suspends on hide and requires explicit return activation. This is stylized stereo sound design, not verified physical acoustics/3D propagation. Automated stub tests/builds do not audition sound, certify autoplay compatibility or guarantee latency, clipping safety or FPS; start at low listening levels.

### Licensing and Important Limits

Poly Haven is CC0; Sketchfab search/download remains CC0 and needs `SKETCHFAB_TOKEN` for downloads. A direct Sketchfab GLB is not available for every asset. Khronos and Objaverse/Hugging Face are **not universally CC0**: known non-CC0 assets require `--allow-non-cc0` and preserved legal notices. HF discovery is bounded repository search with per-file license evidence, **not** a full semantic Objaverse index.

`--animated` requires real animation channels; Bio-Motion does not satisfy it or fabricate clips. Auto-spine only detects the X/Z axis, not the anatomical head direction. Boids separation is not hard fish–fish collision prevention; obstacle avoidance uses conservative world AABBs. Inspect `stats.blockedFish`, `stats.droppedTime`, manifest warnings, budget, and license evidence. GPU rendering still needs review on the target browser; offline tests do not establish visual correctness or universal production readiness.

---

<a id="dokumentasi-bahasa-indonesia"></a>

## 🇮🇩 Dokumentasi Bahasa Indonesia

`threejs-instant-deployer-skill` menghubungkan prototipe Three.js dengan aset 3D yang terukur dan terintegrasi: pencarian berlisensi, normalisasi biner, manifest X-Ray, injeksi kode, serta Bio-Motion dan Boids opsional.

### Masalah Utama yang Diselesaikan

1. **Kekacauan skala dan pivot:** model internet dapat memiliki origin/dimensi yang tidak konsisten. Skill menormalisasi pivot ke **bottom-center**, menghitung bounding box akhir, dan menghasilkan `recommendedScale`. Penggantian primitif mempertahankan transform serta mengoreksi perbedaan center-to-bottom.
2. **Kebutaan biner agen:** mesh, material PBR, hubungan node, tulang/skin, dan klip animasi dibedah menjadi JSON, bukan ditebak dari nama file.
3. **Model statis menjadi hidup:** animasi asli diprioritaskan. Organisme statis yang sesuai dapat memakai shader GPU untuk renang S-wave, goyangan vegetasi berakar terkunci, atau denyut karang. Batu, lentera, dan nama tidak dikenal tetap statis.
4. **Kecerdasan kawanan dan avoidance:** Boids CPU menangani separation/alignment/cohesion, batas ruang, dan proxy rintangan; GPU tetap menggerakkan permukaan. Ini bukan physics engine atau jaminan ikan tidak saling bersinggungan.
5. **Atmosfer bawah air:** caustics prosedural tanpa tekstur dan partikel gelembung bundar dapat merespons posisi dunia ikan. Efek bersifat stilisasi, bukan simulasi optik air fisik.
6. **Dua arsitektur project:** bundler memakai `public/models/`; single-file HTML dapat memakai GLB Data URI. Library Three.js/addons tetap memerlukan CDN/importmap yang cocok atau vendoring.

### Arsitektur Repositori

Lihat [pohon direktori di atas](#repository-architecture). Inti implementasi berada pada `mcp-server/`, wrapper CLI pada `scripts/`, modul browser siap salin pada `templates/`, dan protokol empat tahap pada [SKILL.md](SKILL.md). Template Bio-Motion dan Boids diregenerasi dari sumber TypeScript saat `npm run build`.

### Panduan Penggunaan Cepat

**1. Instal dan verifikasi**

```bash
git clone https://github.com/turtrsst/threejs-instant-deployer-skill.git
cd threejs-instant-deployer-skill
npm install
npm run check
```

**2. Cari dan proses model**

```bash
node scripts/scout-and-process.mjs \
  --query "barramundi fish aquatic" \
  --provider openpbr \
  --target-height 0.3 \
  --output-dir ./public/models \
  --manifest ./public/models/BarramundiFish.manifest.json
```

Provider eksplisit ini memilih Barramundi **CC0 dan statis** dari registry Khronos tanpa API key. Hilangkan `--provider openpbr` untuk pencarian federasi otomatis. Jaringan tetap diperlukan dan hasil tidak dijamin tersedia. Target `0.3` adalah **tinggi**, bukan panjang ikan. Budget default **1 MiB** ditegakkan; model yang melebihi budget tidak diam-diam dianggap memenuhi batas.

**3. Integrasikan ke project**

Gunakan [contoh scene hidup](#living-scene-example) di atas. Salin hasil `public/models/` ke folder `public/models/` project bundler dan kedelapan file `templates/*.js` ke `src/templates/`; simpan contoh sebagai `src/main.js`. Pastikan Three.js dan addons versi sama—template menargetkan **r180/WebGLRenderer** (`three@0.180.0`), bukan WebGPU/TSL. Jalankan melalui dev server, bukan `file://`.

Contoh sudah mengimpor `updateAllDeployedModels`, membaca clock sekali, memakai skala dari manifest, meminta spawn acak secara eksplisit, dan menyediakan teardown. Bila scene/render loop sudah ada, gabungkan panggilan update ke loop tersebut, jangan membuat loop kedua. Untuk menulis langsung ke project lain, berikan path absolut pada `--output-dir` dan `--manifest`. `savedPath` adalah path filesystem, bukan URL browser.

Daftarkan batu/dekorasi setelah selesai dimuat melalui `aquarium.addObstacle(model)`, idealnya sebelum sampling spawn ikan. Gunakan [helper aquarium](examples/aquarium.js) untuk lifecycle gabungan ikan dan batu. Bounds contoh bukan hasil pengukuran scene pengguna; audit batas dunia, arah kepala, radius tubuh, dan margin deformasi GPU terlebih dahulu.

### Caustics Air & Gelembung Interaktif

Modul `templates/underwater-fx.js` menyediakan `injectWaterCaustics` dan `InteractiveBubbleSystem`. Proyeksi memakai posisi dunia setelah deformasi Bio-Motion dan menambahkan cahaya sebelum tone mapping. Gerak gelembung memakai fixed timestep dan neighbor hash; sprite berbentuk lingkaran, bukan kotak.

Untuk interaksi, berikan record dunia `aquarium.fishInstances`, bukan posisi lokal mesh. Ambil delta clock sekali; dispose FX sebelum membuang resource GLTF. Efek ini dekoratif—tidak menyimulasikan refraksi fisik, hamburan air, atau tabrakan gelembung dengan batu. Lihat [panduan lengkap](docs/underwater-fx.md) dan [helper integrasi](examples/underwater-aquarium.js); demo `/boids.html` memiliki toggle FX.

### Kawanan Besar: Mode Instanced Berbasis Cluster

`templates/instanced-boids-manager.js` memakai satu Boid CPU per cluster, texture matriks pusat cluster, serta offset/fase/variasi gerak per-instance di GPU. Default 64 ikan per cluster berarti 1.000 ikan memakai 16 pusat CPU; matriks per ikan tidak diunggah ulang tiap frame. PBR, bagian GLB multi-mesh, normal deformasi, serta shadow tetap dipertahankan.

Ini **bukan** Boids individual dan bukan jaminan **60 FPS**. Proxy bola seluruh cluster dapat menutup celah sempit; draw call tetap bertambah per mesh/material group dan shadow pass. Aset skeletal/morph tidak diam-diam dibekukan—gunakan jalur animasi asli. Review batas atribut dan vertex texture WebGL2, model LOD, resolusi dan biaya shading.

Lihat [panduan instanced](docs/instanced-boids.md) dan [helper GLB](examples/instanced-aquarium.js). `npm run bench:instanced -- --count 1000` hanya mengukur CPU tanpa renderer; `/instanced.html` menyediakan profil browser dengan fixture sintetis. Tidak ada klaim tampilan atau performa GPU yang sudah diverifikasi di semua perangkat.

### Post-Processing Sinematik Opsional

`templates/underwater-postprocessing.js` menyediakan composer HDR/MSAA adaptif, Bokeh dengan depth Bio-Motion/instanced yang konsisten, Bloom berbasis luminansi, overlay lensa bawah air dan OutputPass akhir. Fokus memakai kedalaman ruang kamera, klik memakai koordinat canvas, dan resize mengikuti container. [Panduan/tuning](docs/underwater-postprocessing.md), [entry lengkap](examples/cinematic-main.js), dan [helper integrasi](examples/cinematic-aquarium.js) menjelaskan satu clock, satu updater dan satu render per frame.

Bloom tidak memilih khusus caustics/gelembung/ikan; efek rays/snow bukan volumetrik fisik. Auto-focus ikan GPU menggunakan pusat cluster CPU sebagai pendekatan. Periksa dukungan HDR, jumlah sampel MSAA nyata, biaya DoF/Bloom, dan hasil visual/GPU target—tes/build bukan bukti 60 FPS. Toggle **CINEMATIC POST FX** tersedia di `/instanced.html`.

### Director Studio Interaktif Opsional

`templates/aquarium-director-gui.js` menyediakan lil-gui untuk parameter ikan, flora, caustics, bubbles, lensa, mood preset dan ekspor JSON. [Panduan Director](docs/aquarium-director.md) menjelaskan uniform aktual, fokus, lifecycle dan clipboard fallback. Populasi memakai kapasitas tetap dan draw count semua bagian, bukan alokasi ulang buffer; CPU cluster tetap berjalan. Cadangkan `maxAmplitude` sejak konstruksi agar perubahan amplitudo tidak melewati margin obstacle. Tidak ada klaim latensi mikrodetik atau FPS universal.

Toggle **DIRECTOR STUDIO** tersedia di `/instanced.html`; entry `examples/cinematic-main.js` juga memasangnya dengan cleanup yang benar. Sinkronisasi fokus tidak menambah updater/render loop dan tidak melepas auto-tracking.

### Audio Bawah Air Prosedural Opsional

`templates/underwater-audio-synth.js` menyediakan drone, gelembung berbasis frekuensi Minnaert, scatter whoosh dan chime FM opsional tanpa file audio. [Kontrak audio](docs/underwater-audio.md) menjelaskan aktivasi pengguna, master mute dry/wet, batas voice, buffer cache dan cleanup AudioContext. Director dapat menerima `audioSynth`; membuat panel/mengimpor JSON tidak menyalakan audio.

Demo menyediakan tombol aktivasi dan opsi klik gelembung khusus canvas. Audio dimute/disuspend saat halaman tersembunyi dan memerlukan aktivasi eksplisit untuk kembali. Efek adalah desain suara stereo, bukan simulasi akustik/propagasi 3D penuh. Tes stub/build belum membuktikan kualitas bunyi, autoplay, latensi atau performa perangkat; mulai dengan volume rendah.

### Agen, Pengujian, dan Batasan

- **Claude Code / Cursor / MCP:** ikuti [SKILL.md](SKILL.md), [Cursor Rule](.cursor/rules/threejs-deployer.mdc), dan [referensi integrasi](docs/reference-id.md#integrasi-agen). Token hanya lewat environment, bukan source atau manifest.
- **Pengujian/demo:** `npm run check` dan `npm run demo`. Halaman `/`, `/bio.html`, `/boids.html`, `/instanced.html` memakai fixture sintetis. `npm run test:live` adalah tes jaringan opt-in terpisah.
- **Lisensi:** Poly Haven CC0; Sketchfab tetap difilter CC0 dan perlu `SKETCHFAB_TOKEN` untuk unduh. Khronos/Objaverse/HF tidak semuanya CC0; gunakan `--allow-non-cc0` hanya setelah menyetujui kewajiban lisensinya. HF mensyaratkan bukti lisensi per-file dan bukan indeks semantik lengkap Objaverse.
- **Animasi:** `--animated` tetap mensyaratkan channel animasi asli. Shader prosedural tidak menciptakan klip atau mengubah status animasi biner.
- **Boids/shader:** auto-spine tidak mengetahui arah kepala; separation bukan collision keras antarikan; avoidance memakai proxy AABB konservatif. Periksa `blockedFish`, `droppedTime`, warning manifest, budget, dan legal notices. Tes offline bukan bukti tampilan GPU benar pada semua browser atau jaminan siap produksi universal.

## Further Reading / Bacaan Lanjutan

| Topic / Topik | Documentation / Dokumentasi |
|---|---|
| Full CLI options, agent installation, MCP configuration | [Referensi lengkap Bahasa Indonesia](docs/reference-id.md) |
| Pipeline and manifest contracts | [Architecture](docs/architecture.md) |
| Routing, provider licenses, HF metadata | [Federated Scout](docs/federated-scout.md) |
| Shader presets, normals, shadow and lifecycle | [Bio-Motion](docs/bio-motion.md) |
| World bounds, radius, timestep, proxy avoidance | [Boids](docs/boids.md) |
| Caustics, circular bubbles, update/cleanup order | [Underwater FX](docs/underwater-fx.md) |
| Clustered instancing, multi-part GLB, device/profile limits | [Instanced Boids](docs/instanced-boids.md) |
| HDR/MSAA, Bokeh depth, focus, Bloom and screen-space lens | [Underwater Post-Processing](docs/underwater-postprocessing.md) |
| Live lil-gui controls, safe count/amplitude scaling and JSON | [Aquarium Director](docs/aquarium-director.md) |
| Native-ESM Jest core math and production X-Ray manifest validation | [Core Testing](docs/core-testing.md) |
| Local JSON preset download/import, validation and file-resource lifecycle | [Preset Management](docs/preset-management.md) |
| Water surface Fresnel/TIR, procedural mirror and impact-pool contract | [Underwater Surface](docs/underwater-surface.md) |
| Cinematic orbit/macro/cluster camera, focus, shortcut and handoff ownership | [Camera Director](docs/cinematic-camera-director.md) |
| Continuous 24-hour optical interpolation, normalized PBR glow and ownership | [Day–Night Cycle](docs/day-night-cycle.md) |
| Pooled click-to-feed, cluster frenzy and gesture/ownership contract | [Interactive Feeder](docs/interactive-feeder.md) |
| Asset-free audio synthesis, activation, mute and ownership | [Underwater Audio](docs/underwater-audio.md) |
| Contribution and tests | [Contributing](CONTRIBUTING.md) |
| Security and untrusted model processing | [Security](SECURITY.md) |
| Project and third-party licenses | [MIT License](LICENSE) · [Third-party notices](THIRD_PARTY_NOTICES.md) |

### Click-to-feed & feeding frenzy

`templates/interactive-feeder.js` adds Shift+click water feeding, 8–15 seeded sinking/drifting pellets, bounded ripple/food pools and optional budgeted plop/snap accents. Bind with `school.manager.setFeeder(feeder)`; its existing fixed-step loop owns the feeder—no second update/render loop. CPU **cluster centers** seek/eat, boost allowed speed/tail rate by 1.65 and allow vertical pitch; this is not exact GPU fish-mouth collision or fluid simulation. Fish instance matrices/attributes stay static; cluster payload remains 64 bytes each. Director accepts optional `fishFeeder` for Drop Food/Clear/toggle controls. Feeding never initializes/unmutes audio. [API, integration, bounds and limitations](docs/interactive-feeder.md).

### Dynamic Day–Night & Bioluminescence

`templates/day-night-cycle.js` adds a continuous 24-hour fog/light/caustic/water/bloom/ray cycle and pulsing HDR emission for registered fish/plant materials. PBR emission is added before tone mapping; existing maps, alpha, native animation, GPU instancing and shadow/normal paths remain intact. Pattern bounds/axes come from audited source frames, not guessed asset scale. Director accepts `dayNightCycle`; cinematic helper accepts `dayNightOptions` without creating another animation loop. Bloom is luminance-based, masks/solar orbit are stylized and static PMREM is not regenerated. [API, live-control authority and lifecycle](docs/day-night-cycle.md).

### Cinematic Camera Director

`templates/cinematic-camera-director.js` adds interactive Orbit (45°), Macro Drift (32°) and coarse CPU Cluster Follow (68° wide-angle) with exponential position/look/lens damping and view-relative banking. It owns controls.update exactly once in Orbit, disables competing controls input during automatic shots, and restores borrowed state on disposal. Follow is not an individual GPU fish/tail chase; 68° is perspective, not fisheye distortion. C/N shortcuts are opt-in and ignore GUI text inputs. Director accepts `cameraDirector`; the cinematic helper accepts `cameraOptions` without adding another clock/render/update loop. Authored paths and floor clamp are not obstacle-safe navigation. [Camera API and lifecycle](docs/cinematic-camera-director.md).

### Water Surface & Snell’s Window

`templates/underwater-surface.js` adds a horizontal world-space wave surface with analytic normals, dielectric Fresnel/TIR (water→air critical angle ≈48.61°), eight reusable impact slots and day-night sun synchronization. `surface.bindFeeder(feeder)` uses a bounded disposable spawn subscription, never monkey-patching spawnFoodCluster. Director accepts `waterSurface`; helper `surfaceOptions` updates after day-night and before the existing post render. The sky/mirror are procedural colors—not actual aquarium reflection/refraction—and waves are a vertical height field, not full Gerstner/CFD. [Optical limits, bounds, ownership and API](docs/underwater-surface.md).

### Local JSON Preset Files

Director Studio now provides **Preset Management → Export Preset (JSON) / Import Preset (JSON)** alongside Copy Config JSON. Export snapshots current supported runtime parameters; import validates the complete version-1 envelope, supported keys/types/ranges and fish/wave reserves before calling real setters. It does not copy untrusted JSON into action objects, initialize audio or save a full simulation/scene. Files are capped at 256 KiB; picker/FileReader/URL/timer cleanup handles cancellation, replacement and panel disposal. [Format, APIs and browser limitations](docs/preset-management.md).

### Core Jest verification

`npm test` now builds and runs **both** the existing node:test suite and `tests/deployer-core.test.js` under native-ESM Jest. Core tests use real glTF-Transform documents and production normalization/X-Ray/schema functions, not duplicated mock math. `scoutAndProcess` validates its success manifest before writing/returning output. [Focused commands, schema and verification boundaries](docs/core-testing.md). Tests pass, but the current dependency audit still has unresolved advisories—see [SECURITY.md](SECURITY.md) before release.
