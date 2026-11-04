# Panduan Referensi Lengkap — Three.js Instant Deployer

[Kembali ke README bilingual](../README.md) · [English overview](../README.md#english-documentation)

**Federated license-aware search → binary GLB normalization → scene-graph X-Ray → AST integration.**

Agentic tooling untuk mengganti primitif Three.js tanpa skala tebakan, pivot tenggelam, atau animasi yang terputus. Mendukung Claude Code Skills, Cursor Rules, CLI, dan MCP stdio. MIT, Node.js **≥20.19**.

## Mulai

```bash
git clone https://github.com/turtrsst/threejs-instant-deployer-skill.git
cd threejs-instant-deployer-skill
npm install
npm run check

# Internet + akses API Poly Haven diperlukan
node scripts/scout-and-process.mjs --query "weathered rock" \
  --target-height 1.5 --output-dir public/models --mode file \
  --manifest rock.manifest.json

# Review hasil AST tanpa menimpa sumber
node scripts/inject-three-code.mjs --file src/scene.js --target rock \
  --manifest rock.manifest.json --url /models/rock.glb --output src/scene.integrated.js
```

`npm link` opsional mengekspos `threejs-deploy-3d`, `threejs-inject-3d`, dan `threejs-deployer-mcp`. Source checkout otomatis membangun `dist` yang belum ada; setelah mengubah TypeScript jalankan `npm run build`.

## Uji sepenuhnya offline

```bash
node scripts/generate-fixtures.mjs
node scripts/scout-and-process.mjs --input examples/input.glb \
  --target-size 1,2,3 --mode datauri --manifest examples/fixture.manifest.json
npm run demo
```

Demo di port 5173 menggunakan **fixture sintetis**, bukan klaim hasil pencarian model realistis. Berisi GLB animasi, loader Meshopt, PBR, ground grid, dan toggle fallback. `npm run test:live` menguji jaringan Poly Haven secara terpisah; tidak dijalankan di CI offline.

## Fitur dan batasan yang disengaja

| Komponen | Implementasi |
|---|---|
| Federated search | Smart routing `auto`: Poly Haven, Sketchfab CC0, Khronos registry, dan Hugging Face per-asset GLB; fuzzy token/prefix; query tak relevan ditolak |
| Animasi | `--animated` mengecualikan properti statis, memfilter metadata provider, dan memvalidasi channel dalam GLB aktual sebelum/sesudah optimasi |
| Fallback | Maksimal 5 kandidat relevan dicoba jika unduhan, format GLB, animasi, atau budget gagal; warning tetap dicatat |
| Vision opsional | `--visual-rank`, endpoint OpenAI-compatible; thumbnail saja, ranking ID tervalidasi; fallback lexical dengan warning |
| Surgery | dedup, weld, MeshoptSimplifier (ratio .8/error .001), resample, prune, WebP 1024, EXT_meshopt_compression |
| Pivot / fit | bottom-center setelah optimasi; uniform contain dari `getBounds`; 0 pada targetSize = unconstrained |
| X-Ray | mesh, material PBR, node, animation, skin/bone; entri unnamed tetap berindeks |
| Bundler | `public/models/` → `/models/id.glb`; kode loader client-side |
| HTML | GLB Data URI termasuk tekstur; importmap addons versi cocok; library CDN tetap memerlukan internet |
| AST | Babel JS/TS dan parse5 HTML; alias Three.js didukung; loop `animate`/inline `setAnimationLoop` |
| Safety | HTTPS, timeout, limit 128 MiB per unduhan, tolak traversal resources; stdout JSON tanpa log |

**Bukan janji <1 MB universal.** Default budget **1 MiB**; proses gagal sebelum menulis GLB bila melebihi budget. `--allow-over-budget` menghasilkan `budgetMet:false`; tidak ada penurunan kualitas agresif diam-diam. Tekstur KTX2 yang sudah ada tidak ditranskode; project pengguna harus mengonfigurasi KTX2Loader bila aset memerlukannya. Draco input didukung; output menggunakan Meshopt.

**Bukan framework rewriter universal.** Injector membutuhkan Mesh top-level dengan `new BoxGeometry/CylinderGeometry/SphereGeometry/ConeGeometry` inline dan dimensi statis. Factory, React Three Fiber, JSX lifecycle, loop dinamis, beberapa deployment dalam satu file, serta kode yang sudah diinjeksi menggunakan [runtime API](../SKILL.md#tahap-4-injeksi-kode-threejs--harmonisasi-pbr). Geometri tidak otomatis dihapus: fallback dipertahankan. `handle.dispose()`/`assets.dispose()` membersihkan model, mixer, environment milik runtime dan memulihkan primitif.

**Lisensi default tetap CC0.** Poly Haven CC0; Sketchfab diverifikasi `license.slug === cc0`, termasuk saat unduh dengan ID eksplisit. Sketchfab archive-only tanpa GLB ditolak, bukan diasumsikan selalu menyediakan konversi GLB. Khronos dan Objaverse/Hugging Face memiliki lisensi campuran: `--allow-non-cc0` adalah opt-in eksplisit dan tidak mengubah Sketchfab menjadi pencarian lisensi bebas. `legal[]`, `licenseEvidence`, `source`, dan `revision` (HF) disertakan dalam manifest. Tripo bukan provider aktif. Model lokal bukan otomatis CC0. Simpan manifest bersama aset dan periksa kewajiban atribusi/redistribusi.

## Auto-Procedural Bio-Motion

Static GLB organisme kini dapat bergerak melalui shader GPU, tanpa menambahkan rig atau AnimationClip ke biner. Animasi asli tetap mendapat prioritas. Tiga preset: `fish_swim`, `aquatic_plant`, `soft_coral`; objek mati/nama tidak dikenal tetap statis.

```bash
node scripts/inject-three-code.mjs --file src/scene.js --target fish \
  --manifest fish.manifest.json --url /models/BarramundiFish.glb \
  --bio-preset fish_swim --output src/scene.integrated.js
```

Tanpa flag, injector menggunakan rekomendasi manifest/nama. `--bio-preset none` mematikan fallback. Runtime loader tetap memeriksa animasi aktual sebelum memilih jalur. Scout menambahkan `bioMotion` sebagai **saran**; `xray.hasAnimations` tetap melaporkan isi biner yang sebenarnya. `--animated` tetap meminta klip asli, bukan shader prosedural.

- **Auto-spine** memilih sumbu X/Z terpanjang dari bounds gabungan di ruang model, termasuk mesh dengan transform lokal. Arah kepala tidak dapat diketahui dari bounding box: gunakan `spineDirection: 1|-1` setelah review visual.
- **Normal analitik** memakai inverse-transpose Jacobian deformasi (termasuk envelope/roll) sebelum chunk transform normal Three.js; tangent juga ikut berubah.
- **Shadow sync:** customDepthMaterial dan customDistanceMaterial memakai deformasi/waktu yang sama; renderer dan light harus mengaktifkan shadow.
- **Lifecycle:** material di-clone, hook/cache key sebelumnya dipertahankan, `dispose()` memulihkan material/culling/shadow sebelumnya. `setSpeed()` bekerja sebelum dan sesudah shader compile, termasuk material array.

Salin dua file `templates/bio-motion-injector.js` dan `templates/smart-deploy.js` ke project untuk API objek baru `deploySmart3DModel()` / `updateAllDeployedModels()`. Keduanya standalone (memerlukan Three.js/addons), tanpa dependensi runtime pada repo skill. Alternatif modul: ekspor `./bio-motion` menyediakan factory `createBioMotionInjector(THREE)`. Sumber otoritatif TypeScript; `npm run build` meregenerasi template injector agar implementasinya konsisten.

Demo shader tersedia di **`/bio.html`** setelah `npm run demo`; seluruh organisme demo adalah geometri sintetis. [Kontrak, contoh, dan batasan Bio-Motion](bio-motion.md). Didukung: **Three.js r180 WebGLRenderer**, bukan WebGPU/TSL; mesh skinned/morph/instanced/batched dilewati. Deformasi tidak memperbarui raycast/collision CPU, tidak memindahkan ikan sepanjang lintasan, dan tidak menjamin gerakan biologis realistis pada semua bentuk model.

## Spatial Boids & Obstacle Avoidance

`templates/boids-manager.js` menambahkan locomotion CPU terpisah dari deformasi Bio-Motion GPU:

```js
import { BoidsAquariumManager } from './templates/boids-manager.js';
import { updateAllDeployedModels } from './templates/smart-deploy.js';

const aquarium = new BoidsAquariumManager(scene, { bounds: aquariumWorldBounds, seed: 42 });
aquarium.addObstacle(rockModel); // Setelah GLB batu selesai dimuat.
aquarium.addFish(fishModel, bioController, { randomizePosition: true });

let elapsed = 0;
renderer.setAnimationLoop(() => {
  const delta = clock.getDelta(); // Baca sekali.
  elapsed += delta;
  aquarium.update(delta);
  updateAllDeployedModels(delta, elapsed); // Shader/mixer hanya di-update sekali.
  renderer.render(scene, camera);
});
// Teardown: aquarium.dispose(); kemudian dispose handle deployer.
```

- Separation/alignment/cohesion dengan spatial-hash neighbor dan snapshot dua tahap.
- Ray look-ahead + sweep terhadap **AABB world-space yang diperbesar radius ikan**, bukan radius pusat seragam atau triangle mesh raycast.
- Fixed 60 Hz simulation, seeded RNG, bounds inset, quaternion slerp, head-axis correction dari Bio-Motion.
- Static obstacle cache; refresh/dynamic option; remove/clear/dispose tanpa membuang resource render milik pemanggil.

Default mempertahankan posisi ikan; spawn acak harus diminta. Radius konservatif diukur dari model bila tidak diberikan; tambahkan margin untuk deformation GPU. Separation bukan jaminan collision-free antarikan; obstacle proxy juga bukan physics engine. Ruang yang tidak mungkin dipenuhi dilaporkan melalui `stats.blockedFish`.

[Lihat API/opsi dan contoh lengkap](boids.md), [helper integrasi](../examples/aquarium.js). Demo **`/boids.html`** menggunakan fish sintetis, obstacle proxies opsional dan statistik neighbor/sweep. Ekspor paket `./boids` menyediakan factory `createBoidsAquariumManager(THREE)` untuk integrasi tanpa template. Tidak ada bukti visual GPU atau klaim benchmark pada semua perangkat.

## Smart Provider Routing

```bash
# Tanpa key: fish CC0 dari registry Khronos (bukan ikan berenang)
node scripts/scout-and-process.mjs --query "barramundi fish aquatic" \
  --target-height 0.25 --provider openpbr --manifest fish.manifest.json

# Token hanya melalui environment, tidak melalui argumen command line
export SKETCHFAB_TOKEN="your-token"
node scripts/scout-and-process.mjs --query "tropical fish swim" \
  --animated --provider sketchfab --target-height 0.15 --manifest fish-swim.manifest.json

# Fox tanpa key, tetapi rig/animasi CC-BY memerlukan opt-in + atribusi
node scripts/scout-and-process.mjs --query fox --animated \
  --provider openpbr --allow-non-cc0 --target-height 0.15 --manifest fox.manifest.json

# Routing otomatis memprioritaskan Poly Haven untuk properti statis
node scripts/scout-and-process.mjs --query "mossy rock stone" --target-height 1.2

# Discovery HF saja, tanpa download
node scripts/scout-and-process.mjs --query fish --provider objaverse-hf --dry-run
```

`--target-height 0.25` mengatur **tinggi**, bukan panjang ikan. Untuk panjang tertentu tentukan sumbu dengan `--target-size`; 0 berarti tidak dibatasi. Query ikan berenang tidak akan diam-diam memakai Barramundi statis atau Fox yang tidak relevan. Jika tidak ada aset animasi yang cocok, CLI gagal dengan penjelasan.

**Katalog Khronos:** BarramundiFish (CC0, statis), Fox (CC0 model + CC-BY rig/konversi), AnisotropyBarnLamp/IridescenceLamp/MosquitoInAmber (CC-BY), DragonAttenuation (Stanford Graphics + CC0). Lisensi per-komponen disertakan, bukan disamaratakan sebagai CC0. Fitur material lanjutan memerlukan dukungan renderer/loader sesuai extension; misalnya KTX2 memerlukan KTX2Loader.

**Discovery Hugging Face/Objaverse:** pencarian Hub publik pada repositori **datasets dan models**, bukan indeks semantik lengkap seluruh objek Objaverse. Maksimal 4 repo per jenis, halaman tree terbatas 100 entri. Hanya GLB ≤35 MB yang terdaftar dalam `asset-metadata.json` per-file yang diterima. Repo tanpa metadata ini dilewati dengan warning walaupun kartu dataset berlisensi CC0. Ini menghindari menganggap semua rehost Objaverse bebas lisensi. Lihat [kontrak metadata dan routing](federated-scout.md) untuk menerbitkan/menyiapkan repo kompatibel. Tidak ada jaminan setiap query mendapatkan hasil atau setiap API dapat diakses tanpa autentikasi pada semua jaringan.

## CLI

```text
--query STRING                 Default rock (gunakan istilah bahasa Inggris)
--input FILE                   Proses lokal tanpa pencarian
--asset-id ID                  Bypass pencarian; wajib provider polyhaven|sketchfab|openpbr
--provider auto|all|polyhaven|sketchfab|objaverse|openpbr|objaverse-hf
--animated                     Wajib channel animasi dalam GLB aktual
--allow-non-cc0                 Opt-in lisensi non-CC0 yang dikenal (baca legal notices)
--target-height NUMBER         Default 1
--target-size W,H,D             Contain fit; menggantikan height; 0 = unconstrained
--output-dir DIR               Default public/models
--mode file|datauri             Default file; datauri tidak menulis GLB
--resolution 1k                Resolusi Poly Haven yang diminta (tidak fallback diam-diam)
--max-mb NUMBER                Budget MiB, default 1
--allow-over-budget            Sukses dengan peringatan dan budgetMet:false
--dry-run                      Hanya daftar kandidat
--limit NUMBER                 Jumlah kandidat dry-run, default 10
--visual-rank                  Opt-in vision endpoint
--manifest FILE                Simpan salinan stdout JSON
```

`auto` adalah default; `all` alias backward-compatible. `objaverse` menggabungkan HF dan Khronos (nama provider hasil tetap terpisah: `objaverse-hf` / `openpbr`). `openpbr` hanya katalog Khronos, bukan dataset Objaverse dan bukan MaterialX OpenPBR.

Sukses: JSON ke stdout. Gagal: JSON ke stderr, exit 1. `savedPath` adalah filesystem path absolut dan **bukan URL browser**. Dalam datauri mode `savedPath:null`. Dimensi `[width,height,depth]` berasal dari koordinat aset sumber, tidak mengasumsikan satuan meter. Skala belum dibakar ke GLB; terapkan `recommendedScale` sekali. Bounds animasi/skinning/morph berdasarkan rest pose. Target dengan transform nonuniform mempertahankan transform itu, bukan mengubah bounding box dunia menjadi kubus.

## Integrasi agen

### Claude Code Skills

Salin/clone repo ke `.claude/skills/threejs-instant-deployer/`, lalu `npm install` di sana. `SKILL.md` memuat trigger dan workflow empat tahap. Jalankan CLI dengan path absolut jika cwd berbeda, dan gunakan output-dir absolut milik project pengguna.

### Cursor

Gunakan `.cursor/rules/threejs-deployer.mdc` dalam project pengguna; sesuaikan lokasi skill di rule. Instruksi utamanya tetap `SKILL.md`.

### MCP (Claude Code / Cursor / client MCP lain)

Tambahkan konfigurasi berikut pada konfigurasi MCP client (path harus absolut):

```json
{
  "mcpServers": {
    "threejs-deployer": {
      "command": "node",
      "args": ["/absolute/path/threejs-instant-deployer-skill/scripts/mcp-server.mjs"]
    }
  }
}
```

Tools: `scout_and_process` (search/download/process, dapat menulis aset) dan `inject_three_code` (mengembalikan source tanpa menulis berkas). Gunakan izin MCP/project yang sesuai; tool pemrosesan lokal memiliki akses filesystem setara proses Node. Secrets lewat environment client, bukan JSON yang di-commit. Server hanya memakai stdio dan tidak membuka HTTP listener.

## Struktur

```text
SKILL.md
mcp-server/
  searchProviders/   polyhaven.ts, sketchfabCC0.ts, openPbr.ts, objaverseHF.ts, visualRanker.ts
  glbSurgeon/        normalizeBBox.ts, optimizeWeb.ts, xrayIntrospect.ts
  codeDeployer/     auditThreeCode.ts, injectThreeCode.ts, runtime.ts, bioMotion.ts, boidsManager.ts
  pipeline.ts, server.ts, index.ts
templates/          Standalone bio-motion, boids manager + smart deploy bridge
scripts/            CLI wrappers, fixture/demo builder, live smoke
.cursor/rules/      Cursor integration
examples/           Input scene and offline workflow
tests/              Offline binary, provider, runtime, AST, CLI and MCP tests
demo/               Interactive synthetic-fixture workshop
```

Lihat [manifest dan arsitektur](architecture.md), [kontribusi](../CONTRIBUTING.md), [keamanan](../SECURITY.md), dan [lisensi pihak ketiga](../THIRD_PARTY_NOTICES.md).


## Underwater FX: Caustics & Bubble Particles

`templates/underwater-fx.js` melengkapi Bio-Motion/Boids dengan proyeksi caustics prosedural dan partikel gelembung yang berinteraksi dengan record posisi **world-space** ikan. Material/hook dipulihkan saat dispose; pergerakan partikel memakai fixed timestep dan spatial hash. Ini bukan simulasi refraksi/collision fisik. Baca [kontrak underwater FX](underwater-fx.md) dan [contoh helper](../examples/underwater-aquarium.js). Demo `/boids.html` memiliki toggle efek. Shader perlu diverifikasi pada browser/GPU target.


## Instanced Boids Berbasis Cluster

Untuk kawanan besar, gunakan `templates/instanced-boids-manager.js` dan baca [kontrak instanced](instanced-boids.md). CPU menyimulasikan pusat cluster, GPU menangani variasi per instance. Default 1.000 instance = 16 pusat cluster; tidak ada upload matriks per ikan setiap frame. Mode ini bukan Boids individual, tidak mendukung native skin/morph, dan tidak menjamin 60 FPS. Demo `/instanced.html` serta `npm run bench:instanced` memisahkan statistik browser dari benchmark CPU-only.


## Post-Processing Sinematik

[Kontrak post-processing](underwater-postprocessing.md) meliputi HDR/MSAA adaptif, depth Bokeh yang mengikuti deformasi GPU, fokus kedalaman kamera, Bloom, lensa screen-space dan OutputPass akhir. Contoh lengkap ada di examples/cinematic-main.js. Gunakan satu clock/updater/render, koordinat klik canvas, resize container dan cleanup semua pass. Bloom bukan seleksi objek; rays/snow bukan volumetrik fisik. Profil GPU/perangkat target tetap diperlukan.


## Director Studio

[Panel Director](aquarium-director.md) memakai lil-gui bawaan Three addons untuk preset, uniform, populasi, flora, bubbles dan lensa. Kapasitas tetap; setActiveCount hanya mengubah draw count semua mesh part. CPU cluster tidak berkurang secara proporsional. Cadangkan maxAmplitude sejak awal, pakai setter/uniform aktual, ekspor JSON berversi dengan clipboard fallback, dan dispose GUI sebelum mengganti binding. Tidak ada render loop tambahan atau klaim mikrodetik/60 FPS universal.


## Audio Prosedural Tanpa Aset

[Underwater Audio](underwater-audio.md) menghasilkan drone, gelembung, whoosh dan chime opsional dari Web Audio. Aktivasi gesture eksplisit, master gate dry/wet, voice/cache/scheduler terbatas dan disposal context owned/borrowed wajib. Director menerima audioSynth tanpa auto-init; klik canvas opsional dan lokal. Minnaert hanya basis resonansi; efek stereo bergaya bukan simulasi akustik fisik penuh. Tes/build belum menguji kualitas bunyi atau latensi browser.

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
