# Local JSON Preset Export & Import

The existing `templates/aquarium-director-gui.js` now includes a **Preset Management** folder:

- **Export Preset (JSON)** requests a local `.json` download.
- **Import Preset (JSON)** opens a local, single-file JSON picker.
- Existing **Copy Config JSON** remains available as a separate clipboard action.

Both the demo Director Studio and cinematic main use the same generated panel, so no parallel hardcoded studioConfig, second GUI or HTML-specific runtime is required. File APIs are lazy: constructing/importing the module or mounting a GUI does not access document, open a picker, download anything, read storage or initialize audio.

## Format and scope

```json
{
  "version": 1,
  "preset": "Custom",
  "parameters": {
    "activeFishCount": 350,
    "swimSpeed": 2.2,
    "cameraMode": "Orbit View",
    "bloomStrength": 0.38,
    "aperture": 0.0014,
    "timeOfDay": 12,
    "autoCycle": true,
    "waterTint": "#06283d"
  }
}
```

This is an illustrative subset, valid only when those controllers are bound. An actual export includes **all editable parameters supported by the current panel**: population/cruise/tail/flora, lens/post, colors/fog/light, audio scalars/mute, feeder input, day/night, camera mode/auto settings and water-surface controls where available. Export reads current bound runtime values, including external speed/post changes, rather than only stale GUI input state. Group controls represent the existing group's common/first-controller values, not separate overrides for every material/plant.

A preset is **not a complete simulation savegame**. Assets/model URLs/manifests, scene graph, geometry/textures, audited capacity/bounds/reserves, camera world pose/path, selected CPU target, fish positions, pellet/ripple pools, elapsed clocks, native mixer playback and AudioContext/user consent are not serialized. It contains no callback functions, file platform, DOM objects or credentials. No network upload, localStorage or server filesystem write occurs.

Use the panel's exported format, not the draft's unversioned flat `{fishCount,fishSpeed,bokehAperture,auto}` object. Actual runtime keys are `activeFishCount`, `swimSpeed`, `aperture` and `autoCycle`. Mode values come from the real camera director, including Macro Drift and **Cluster Follow (Wide Angle)**, not a nonexistent per-GPU-fish mode.

## Validation and application

- Files must be nonempty and at most **256 KiB**. Reported file size is checked before reading; decoded text is independently checked by UTF-8 byte length before JSON parsing, including File.text adapters. A UTF-8 BOM is supported.
- Version must be exactly numeric **1**. Only version/preset/parameters are permitted at the envelope level. `preset` is optional and must be Custom or a known atmosphere label; it is metadata, not an instruction to overwrite the saved parameters with that built-in atmosphere preset.
- Parameters must be an object containing supported keys, finite numbers in the current panel's ranges, valid booleans, known camera mode and '#rrggbb' colors. Arrays, functions-as-strings, unknown/prototype keys, unavailable module fields and values exceeding preallocated fish capacity/deformation/wave reserves are rejected.
- The entire parameter object is validated **before any runtime setter is called**. Malformed/unsupported presets leave simulation settings unchanged; raw JSON is never Object.assign'ed into GUI actions/state or evaluated.
- Population is applied before follow mode, so a valid restored nonzero population can be followed even if the current population is zero. Setters, not raw draw-count/pass writes, update the actual controllers. Zero visible follow targets still use the camera director's documented Orbit fallback.
- The GUI and exported snapshot refresh from actual live values after application. Invalid externally modified values outside panel ranges cause export validation to fail rather than silently produce a non-loadable preset.

This preflight prevents validation-driven partial changes; it is **not a universal transaction/rollback engine for arbitrary third-party setter failures** or renderer/audio device faults. Recreate the panel when replacing/disposal of bound controllers changes its schema. Enable the same optional systems/capacity before importing a preset that uses them; unsupported fields fail clearly rather than guessing or silently dropping settings.

The day-night/camera directors retain their established authority: running clocks, automatic lens/focus and optical updates can change restored values on the next frame. To keep an exact static hour/mode, save appropriate auto flags or relinquish the relevant controller's ownership. Import does not call audio init/resume, spawn food, scatter fish or rebuild school capacity. A saved audio mute flag can affect an already activated synth; it is not a saved autoplay permission.

## Programmatic API

```js
// Existing string/clipboard APIs remain supported.
const json = panel.exportConfigJSON();
panel.importConfigJSON(json);
await panel.copyConfigToClipboard();

// Browser actions must be explicitly requested, preferably in a user gesture.
const result = panel.downloadPreset('my_aquarium.json');
// result: {filename,json}; a download REQUEST, not confirmation it reached disk.

const configOrNull = await panel.importPresetFromFile();
const config = await panel.importPresetFile(selectedFile);
panel.cancelPresetImport();
```

`downloadPreset()` defaults to `aquarium_preset_<timestamp>.json`. Custom names are simple ASCII word/dot/hyphen names ending in .json, maximum 128 characters, without path separators. The file is an application/json UTF-8 Blob, not a large data URI. A temporary anchor is removed immediately; its object URL is revoked after one second or on panel disposal. At most four download URLs/timers may be pending; additional rapid exports fail until cleanup rather than grow without bound. Browser sandbox/gesture/download policy may block a request; UI says **Download requested**, not Saved.

`importPresetFromFile()` uses one hidden `.json,application/json` input. Change/cancel/replacement/disposal remove its handlers, focus listener, fallback timer and DOM node. Native cancel events are used; a one-second window-focus fallback supports browsers that omit cancel. Native dialog/focus timing varies across browsers and the OS dialog itself cannot be forcibly closed from script. Selecting a renamed JSON file is safe because content/schema—not MIME alone—is validated.

`importPresetFile(file)` uses abortable FileReader when available, otherwise File.text. It resolves to the applied configuration, resolves null on cancellation/replacement/disposal, and rejects on read/schema/runtime errors. A newer valid import replaces/cancels an older pending import. Disposed panels never apply a delayed result. File.text itself cannot be physically aborted; delivery/application of its late result is ignored. FileReader handlers detach and reads are aborted on cancellation.

File-button failures appear in the existing GUI Status and optional onError callback, not blocking alert dialogs. Public methods throw/reject for the caller to handle. No selected preset contents are dumped to the console.

For tests/embedded hosts, optional `filePlatform` supplies document, Blob, URL.createObjectURL/revokeObjectURL, timers, optional window focus events and optional FileReader. Defaults to globalThis. String APIs remain usable under Node; browser file buttons report unavailable APIs rather than attempting DOM access on mount.

## Ownership and verification

Dispose/rebuild the panel before replacing its controllers. Panel.dispose cancels picker/read delivery, aborts owned FileReader, clears timers, revokes every pending object URL and destroys GUI controls. It never disposes fish, camera, lights, scene, post effects, audio or surface resources. Existing frame/update/render ownership is unchanged.

Tests cover live-state Blob contents, URL limits/revocation, click failures, UTF-8 size/BOM, schema/version/prototype/unknown/capacity validation, preset-label round-trip, FileReader and File.text errors/cancellation/late completion, picker selection/cancel/focus/replacement, no mutation after disposal, population-before-follow ordering and no automatic audio activation. Existing full aquarium tests continue to run.

These are injected-platform/unit tests plus production bundling/package/HTTP checks, **not an actual OS file-picker/download or browser sandbox permission certification**. Verify file-dialog timing and download behavior in target browsers; string/clipboard APIs provide a manual fallback.
