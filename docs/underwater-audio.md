# Zero-Asset Underwater Acoustic Synthesizer

`templates/underwater-audio-synth.js` exports `UnderwaterAudioSynthesizer`, `minnaertFrequency` and opt-in `bindUnderwaterAudioCanvas`. It generates AudioBuffers and oscillator/filter envelopes in memory using Web Audio—**no MP3/WAV fetches, audio codecs, external impulse response files, recording or microphone access**.

The module is optional and silent until explicitly activated. Constructor/import/configuration do not create an AudioContext, allocate PCM buffers, start timers or request audio permissions. A configured synthesizer can exist alongside an unmuted-looking GUI without audible output until the user chooses Enable/Resume or an explicitly installed canvas interaction requests it.

## Sounds and physical limits

- **Drone:** looping stereo leaky-integrated brown-ish noise, DC-removing highpass, two lowpass filters with independent sine LFOs, plus quiet 55/82.4 Hz tones. Current/motion rate maps artistically to cutoff/LFO rates. This is not a fluid/pressure solver or an exact broadband 1/f² spectrum.
- **Bubbles:** damped sine envelopes, small stereo variation, base frequency from the small-spherical-bubble Minnaert approximation:

  `f0 = sqrt(3 × gamma × pressurePa / density) / (2π × radiusMeters)`.

  Defaults: gamma 1.4, pressure 101,325 Pa, density 1,000 kg/m³; random radius 3–9 mm. The helper supports other positive finite inputs. The model omits surface tension, viscosity, wall effects and propagation. The visual Points size is not used as a physically calibrated bubble radius.
- **Bubble pitch:** deliberately rising exponential ramp, `f(t)=f0 × (f1/f0)^(t/T)`. The supplied `f0(1+alpha*t)` expression would be **linear**, not exponential. Neither upward shape follows from Minnaert alone or universally describes bubbles detaching from surfaces. It is a designed “blup,” not a claim of full bubble acoustics.
- **Scatter:** cached pink-ish noise through a swept bandpass, short triangle thump and bubble accent. This is designed turbulence, not a computed vortex/water-displacement pressure field.
- **Zen notes:** optional sine FM with D/E/F/A/B-flat pitch classes and octave variants, sent through a procedural warm-decay convolution IR. Chimes default **off**. Reverb is an invented impulse, not a measured tank response or an acoustic room geometry model.

Panning is **stereo left/right**, not HRTF, 3D PannerNode positioning, Doppler or underwater sound-speed propagation. Effects are designed for an aquarium presentation; do not describe them as physically exact, medically therapeutic or verified to be free of clipping. The dynamics compressor reduces peaks but is not a brick-wall limiter/hearing-protection system. Start quietly, especially on headphones; device/OS listening level is outside the module's control.

## Basic usage / explicit user gesture

```js
import {UnderwaterAudioSynthesizer} from './templates/underwater-audio-synth.js';

const audio = new UnderwaterAudioSynthesizer({
  masterVolume: 0.25,
  bubbleRate: 0.5,
  zenChimesEnabled: false,
  seed: 42
});
const enableButton = document.querySelector('#enable-audio');
const enable = () => {
  // init calls AudioContext/resume synchronously in this handler, then returns a promise.
  audio.init().then(() => {
    audio.setMuted(false);
    audio.triggerBubbleCluster(0.7, 0);
  }).catch(error => showAudioError(error.message));
};
enableButton.addEventListener('click', enable);
// Teardown: remove this listener, dispose any canvas binding/GUI, await audio.dispose().
```

`showAudioError` is your application's UI. Handle the returned promise; autoplay/permission/device restrictions can deny or leave audio suspended even when the code is valid. There is no global `window.pointerdown` listener that starts audio for every UI click. Use an explicit button; audio should not automatically enable merely because a scene finishes loading, a JSON file is imported or a volume slider moves.

`init()` is asynchronous and resolves to the synthesizer only when its context is running. Concurrent calls share the pending promise; subsequent calls reuse the graph and timer. If resume is denied, the initialized graph stays suspended and can be retried from another user gesture. A graph-construction failure disposes partial resources; create a new synthesizer after that fatal failure. Unsupported Web Audio rejects cleanly without affecting visual rendering unless your application treats the error as fatal.

The browser template has no Three.js dependency. Package entry `threejs-instant-deployer-skill/underwater-audio` exports the typed `createUnderwaterAudioSynthesizer(platform=globalThis)` factory, returning the class plus helpers. It is safe to import/construct under Node; actual audio requires a browser AudioContext or a compatible injected test context.

## Optional canvas bubble interaction

```js
import {bindUnderwaterAudioCanvas} from './templates/underwater-audio-synth.js';

// Install only after the user has opted into this behavior.
const clicks = bindUnderwaterAudioCanvas(audio, renderer.domElement, {
  onError: error => showAudioError(error.message)
});
// Removing the interaction does not dispose or take ownership of the shared synthesizer:
clicks.dispose();
```

Only primary left pointer down/up within 4 CSS pixels creates a click. Orbit drags are ignored. Pan comes from the canvas bounding rectangle and page offset, not `window.innerWidth`; out-of-canvas events and zero-size bounds are ignored. Activation/resume occurs inside the pointer-up gesture; transient sound waits for successful activation and still respects the mute gate. It does not select/deform fish, replace click-to-focus or sound on other DOM controls. `ready` exposes the last interaction promise for integration/tests. Dispose removes its three canvas listeners and suppresses pending click accents; the synthesizer remains caller-owned, so dispose it separately when the app unmounts.

## Director integration

```js
const director = createAquariumDirectorGUI({
  renderer, scene, sunLight, postFX, fishAquarium,
  causticControllers, bubbles, plantControllers,
  audioSynth: audio
});
```

When supplied, the panel adds **Procedural Audio (Opt-In)**:

- Enable/Resume Audio: explicit gesture; after successful activation, unmute and refresh display.
- Master volume, drone intensity, bubble **clusters/sec**, optional Zen chimes and all-path mute.
- The existing flora `currentSpeed` broadcasts to both plant sway rate and audio current-motion mapping. With no plants, a dedicated ambient-motion control still appears. This is an artistic coupling, not a shared physical water velocity simulation.
- The GUI/public Director `scatterFish()` triggers the existing seeded cluster startle plus the audio whoosh if audio is active/unmuted. Calling the manager's scatter directly elsewhere does not silently install sound hooks; explicitly call audio when needed.

No panel creation, preset switch, parameter edit, JSON export/import, focus sync or school reset implicitly calls `init()`. Atmosphere presets keep audio choices unchanged. Audio parameters join versioned Director JSON as scalar/bool fields, but AudioContext state, user consent, nodes, phases and buffers are not serialized. Imported controls configure a silent instance without activating it. `syncDisplay()` additionally reads externally changed volume/mute; the ordinary per-frame focus sync remains independent of audio.

GUI bindings borrow the synthesizer. Destroying/recreating GUI around geometry/post effects does not stop/rebuild the audio graph. Destroy the panel before `audio.dispose()`. If a bound audio controller is disposed, recreate the panel with a new controller or omit the optional audio binding.

The complete [cinematic-main.js](../examples/cinematic-main.js) demonstrates this lifetime. The [Director guide](aquarium-director.md) covers visual controller ownership and its one render/update loop. Audio uses its own audio-clock scheduler; do not call audio `init()` or create audio instances per render frame, fish, bubble, material or GUI reset.

## Configuration

Use `setConfig(patch)`, `setCurrentSpeed()` and `setMasterVolume()`; `params` is a **snapshot**, not a live object to mutate with raw GUI bindings.

| Parameter | Default | Meaning / range |
|---|---:|---|
| masterVolume | .35 | Final dry+wet gain, 0..1; start lower if needed |
| droneIntensity | .45 | Drone/sub intensity, 0..1 |
| bubbleRate | .4 | Expected ambient **clusters per audio second**, 0..8; not per-tick probability |
| zenChimesEnabled | false | Optional tonal FM ambience |
| chimeRate | .08 | Expected notes/sec when enabled, 0..1 |
| currentVelocity | 1.8 | Nonnegative finite artistic motion-rate input; filter mapping saturates above 20 |
| reverbMix | .38 | Wet output level, 0..1; dry level is not reduced in parallel |

Constructor-only: `seed` safe integer (default 17,321), `maxVoices` integer 1..128 (default 32), `autoSchedule` true, optional `context`. Unknown dynamic config keys or invalid values reject before changing config. Set master, mute or current before init to retain that choice on activation.

```js
audio.setConfig({bubbleRate:0.7, droneIntensity:0.3, zenChimesEnabled:true});
audio.setCurrentSpeed(2.5);
audio.setMasterVolume(0.2);
audio.setMuted(true);   // Reaches exact zero after a short scheduled ramp, including reverb.
audio.toggleMute();
```

### Trigger methods / telemetry

- `triggerBubbleCluster(intensity=1,panX=0)`: intensity 0..2, pan -1..1; returns number of voices actually admitted. Zero intensity returns zero. At most 12 bubble voices requested per cluster.
- `triggerFishScatterWhoosh(panX=0)`: stereo pan -1..1; returns whether a whoosh voice was admitted; requests a small bubble accent afterward.
- `triggerZenHarmonicNote()`: returns admission status; disabled when Zen mode is false.
- All triggers are silent/no-op before successful initialization, while muted or when context is not running. Use after disposal throws rather than reviving audio accidentally.
- `stats`: active voice count, dropped voices, scheduler drops, cumulative bubble/whoosh/chime counters. A voice group can contain one bubble oscillator or both FM/whoosh sources; permanent drone/LFO nodes are outside this transient budget.
- `isInitialized`: graph exists, not proof of current audibility. Check `ctx.state`, mute and device policy too.
- `isMuted`: use setMuted/toggleMute to change it; do not assign fields/internal node values directly.
- `disposed`: lifecycle flag.

Voice limits drop new requests instead of allocating without bound. Sources have start/stop schedules and ended callbacks; node chains disconnect when every source in that voice finishes. The whoosh PCM buffer and IR are cached/reused; a scatter click does not synthesize another full noise buffer. Chime reverb tails remain in the shared convolver after source cleanup and remain under the same master gate.

## Graph / mute correctness

```text
noise/subs → drone gain ──────────────────────→ dry bus ─┐
bubbles/whoosh ───────────────────────────────→ dry bus ─┤
bubbles/whoosh/chimes → procedural convolver → wet gain ├→ compressor → FINAL master/mute → destination
                                                       ┘
```

No reverb connection bypasses master gain. Muting fades that final gain to **zero**, not an epsilon, and suppresses new generative/trigger voices. Changing master volume while muted leaves final gain zero. Existing envelopes/tails can continue internally and become audible if you unmute quickly; mute is not transport reset or guaranteed DSP power-off. It is not an instantaneous stop: the short ramp avoids abrupt master switching.

## Scheduling / determinism / background behavior

Ambient events use exponential interarrival times, driven by `AudioContext.currentTime`. The 250 ms JS timer checks due events; it is not the sound oscillator clock. AudioParam/source scheduling runs on the audio engine, but UI timer jitter still affects generative event timing. Per tick, each type is capped at four overdue events; long gaps, suspended contexts and mute reset the schedule instead of replaying missed sound bursts. This is bounded stochastic ambience, not sample-accurate music sequencing or a strict rate guarantee under voice/CPU limits.

Seeded noise, IR and random choices are reproducible for the same sample rate and call sequence. Browser DSP, sample rate, resume timing and user interactions differ; identical cross-device rendered audio is not promised. Default ambience is independent of visual particle respawns/count; it is not a one-to-one sonic reconstruction of all 350 bubbles or actual per-fish GPU trajectories.

The core installs no page/global listeners. The demo and cinematic entry **mute and suspend their owned context when hidden**, catch suspension errors and require explicit Enable/Resume to restore sound. They synchronize the GUI on visibility changes and remove their listener on teardown. Muting alone does not suspend a context. If implementing your own background policy, never suspend/close a borrowed/shared context just to silence this one effect; use its local mute gate and coordinate transport with the context owner. Do not automatically re-enable sound on page return.

## Disposal and ownership

`await audio.dispose()` is idempotent. It immediately marks the instance disposed, clears its interval, stops persistent noise/sub/LFO sources and transient voices, removes ended handlers, disconnects tracked nodes and clears buffer references. It closes **only an internally created AudioContext**. With `options.context`, that context is borrowed: no close and no disconnection of foreign nodes. `init()` is nevertheless an explicit resume request on that supplied context; coordinate it with the shared owner.

Dispose during pending activation safely prevents timer startup; the activation promise rejects as disposed. Dispose returns the close promise and can reject if the browser cannot close the owned context; still catch it at application teardown. A disposed instance cannot restart; create another instance and ask for a new user activation. Canvas helpers/Director DOM are separately owned and must be disposed first.

No external audio files are loaded, but generated buffers and convolution use CPU/memory. At 48 kHz, the three Float32 PCM allocations total roughly **2.8 MB** (4-second stereo drone + 1-second mono whoosh + 2.8-second stereo IR), excluding browser DSP/workspace/nodes. Initial generation runs on the calling thread. Polyphony, convolver, two-LFO drone and other app rendering still need profiling; zero assets does not mean zero allocations, zero battery impact, zero latency or guaranteed 60 FPS.

## Demo / validation boundary

Run `npm run demo`, open `/instanced.html`:

1. Click **Enable / Resume Procedural Audio**; default demo master is .25, chimes off.
2. Enable **DIRECTOR STUDIO** for volume, mute, drone/rate/chime and current-motion controls. Scatter uses the existing cluster action plus whoosh.
3. Canvas bubble clicks are **separately opt-in**; orbit drags remain silent.
4. Hide the page to mute/suspend; explicit activation resumes/unmutes on return. School/FX resets reuse the same synthesizer.

Automated tests use a Web Audio **stub**, not a speaker/headphone/OfflineAudioContext renderer. They cover graph routing/master mute, Minnaert base formula, finite seeded buffers, voice budgets/cleanup, cached PCM, gesture/resume promises, scheduling bounds, ownership, pending-init disposal, local canvas interaction and Director configuration that stays silent until activation. Vite/esbuild verify module bundling, not audible quality, real browser autoplay policy, device latency, clipping or CPU/GPU frame performance. No listening/audition or physical acoustic validation has been performed by those checks.

## Ringkasan Indonesia

Audio dibangkitkan dari buffer/osilator/filter matematis tanpa file eksternal. Drone, bubble resonance berbasis Minnaert, whoosh dan chime FM merupakan desain suara generatif—bukan simulasi akustik air lengkap. Sapuan pitch eksponensial tidak sama dengan rumus linear f0(1+alpha*t); stereo panning bukan 3D HRTF.

Aktifkan lewat interaksi pengguna yang jelas, tangani promise init, dan mulai dengan volume rendah. Semua dry/wet/reverb melewati master mute yang sama. Voice/timer/source dibatasi dan dibersihkan; AudioContext borrowed tidak ditutup. Panel tidak otomatis menyalakan audio saat dibuat, impor JSON atau preset diganti. Uji bunyi, autoplay, latensi, clipping dan performa pada browser/perangkat target; tes stub/build bukan audisi atau bukti performa nyata.

## Feeding accents

`triggerWaterPlop(pan=0)` and `triggerFishSnap(pan=0)` are stylized short oscillator accents. Both return boolean admission through the existing transient voice budget and master/mute graph, with ended cleanup. They no-op before activation/when muted/suspended/budget-full and never call init/resume. The plop reverb send also passes the final master. [Interactive Feeder](interactive-feeder.md) optionally borrows these methods; it skips a disposed synth and does not own or unmute it. Shift+click is reserved from the optional bubble canvas binder to avoid duplicate sound on a feeding gesture.
