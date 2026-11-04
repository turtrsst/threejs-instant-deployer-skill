// Generated from mcp-server/codeDeployer/aquariumDirectorGui.ts by npm run build.
import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
export function createAquariumDirectorFactory(THREE, GUI) {
    const ATMOSPHERE_PRESETS = {
        'Zen Crystal Daylight': { waterFogColor: '#041b2d', waterTint: '#06283d', causticColor: '#4ee4e8', fogDensity: .075, exposure: 1.08, sunIntensity: 2.8, bloomStrength: .38, bloomThreshold: .72, godRayIntensity: .18, aperture: .0012 },
        'Deep Bioluminescence Night': { waterFogColor: '#010712', waterTint: '#020b1c', causticColor: '#00ffcc', fogDensity: .11, exposure: 1.25, sunIntensity: .65, bloomStrength: .85, bloomThreshold: .35, godRayIntensity: .06, aperture: .0022 },
        'Golden Hour Amazonas': { waterFogColor: '#1a1409', waterTint: '#2b1d0c', causticColor: '#ffbb55', fogDensity: .095, exposure: 1, sunIntensity: 3.2, bloomStrength: .48, bloomThreshold: .65, godRayIntensity: .26, aperture: .0015 }
    };
    for (const preset of Object.values(ATMOSPHERE_PRESETS))
        Object.freeze(preset);
    Object.freeze(ATMOSPHERE_PRESETS);
    function createAquariumDirectorGUI(options) {
        const { renderer, scene, sunLight, postFX, fishAquarium, bubbles, audioSynth, fishFeeder, dayNightCycle, cameraDirector, waterSurface } = options;
        if (options.plantControllers !== undefined && !Array.isArray(options.plantControllers))
            throw new Error('plantControllers must be array');
        const plantControllers = [...(options.plantControllers ?? [])];
        if (options.width !== undefined && (!Number.isFinite(options.width) || options.width <= 0))
            throw new Error('GUI width must be positive');
        if (!renderer?.isWebGLRenderer || !scene?.isScene)
            throw new Error('Director requires a WebGLRenderer and Scene');
        if (!Array.isArray(plantControllers) || plantControllers.some(c => !c?.setAmplitude || !c?.setSpeed || !c?.uniforms))
            throw new Error('Supply actual Bio-Motion plant controllers');
        if (fishAquarium && (!fishAquarium.setActiveCount || !fishAquarium.setMaxSpeed || !fishAquarium.setAmplitude))
            throw new Error('Supply the clustered instanced manager, not legacy fishData');
        if (postFX && (!postFX.setConfig || !postFX.setFocusDistance))
            throw new Error('Supply the aquarium post-processing controller');
        if (bubbles && (!bubbles.setOpacity || !bubbles.setRiseSpeed))
            throw new Error('Supply InteractiveBubbleSystem with live setter support');
        if (audioSynth && (!audioSynth.init || !audioSynth.setConfig || !audioSynth.setMuted || !audioSynth.triggerFishScatterWhoosh))
            throw new Error('Supply UnderwaterAudioSynthesizer');
        if (fishFeeder && (typeof fishFeeder.enabled !== 'boolean' || !fishFeeder.feedAtCenter || !fishFeeder.clear || !fishFeeder.setEnabled))
            throw new Error('Supply InteractiveFishFeeder');
        if (dayNightCycle && (!dayNightCycle.applyTimeOfDay || !dayNightCycle.setGlowColor))
            throw new Error('Supply DayNightAquariumCycle');
        if (cameraDirector && (!cameraDirector.setMode || !cameraDirector.availableModes || !cameraDirector.followNextCluster))
            throw new Error('Supply CinematicCameraDirector');
        if (waterSurface && (!waterSurface.setWaveHeight || !waterSurface.setIorRatio))
            throw new Error('Supply underwater surface controller');
        const caustics = [];
        const addCaustic = (entry) => { const u = entry?.uniforms ?? entry?.userData?.causticUniforms; if (!u?.uCausticColor || !u?.uCausticSpeed)
            throw new Error('Supply caustic controllers or patched materials'); if (!caustics.some(c => c.uniforms === u))
            caustics.push({ source: entry, uniforms: u }); };
        if (options.causticControllers !== undefined && !Array.isArray(options.causticControllers))
            throw new Error('causticControllers must be array');
        for (const entry of options.causticControllers ?? [])
            addCaustic(entry);
        if (options.causticsFloor) {
            const materials = Array.isArray(options.causticsFloor.material) ? options.causticsFloor.material : [options.causticsFloor.material];
            for (const m of materials)
                addCaustic(m);
        }
        const state = { preset: 'Custom' }, ranges = {}, labels = {}, controls = new Map();
        let gui, disposed = false, committed = {};
        const hex = (c) => `#${c.getHexString()}`;
        const numeric = (key, value, min, max, step, label) => { if (!Number.isFinite(value))
            throw new Error(`Invalid initial ${key}`); state[key] = value; ranges[key] = [min, Math.max(max, value), step]; labels[key] = label; };
        const color = (key, value, label) => { state[key] = hex(value); labels[key] = label; };
        if (fishAquarium) {
            const u = fishAquarium.shaderUniforms;
            numeric('activeFishCount', fishAquarium.activeCount, 0, fishAquarium.count, 1, 'Visible Fish / Capacity');
            numeric('swimSpeed', fishAquarium.maxSpeed, Math.max(.0001, fishAquarium.minimumCruiseSpeed), 6, .1, 'Cluster Cruise Speed');
            numeric('tailBeatSpeed', u.uBioSpeed.value, 0, 14, .1, 'Tail Motion Rate');
            numeric('tailWaveAmplitude', u.uBioAmp.value, 0, fishAquarium.maxAmplitude, .01, 'Tail Amplitude (Reserved)');
            numeric('tailWaveFrequency', u.uBioFreq.value, 0, 12, .1, 'Tail Spatial Frequency');
        }
        if (plantControllers.length) {
            numeric('currentSpeed', plantControllers[0].uniforms.uBioSpeed.value, 0, 6, .1, 'Flora Sway Rate');
            const limit = Math.min(.5, ...plantControllers.map(c => c.amplitudeLimit ?? Infinity));
            numeric('plantSwayAmplitude', plantControllers[0].uniforms.uBioAmp.value, 0, limit, .01, 'Flora Amplitude (Unitless)');
            ranges.plantSwayAmplitude[1] = Math.min(...plantControllers.map(c => c.amplitudeLimit ?? Infinity), ranges.plantSwayAmplitude[1]);
        }
        if (waterSurface) {
            numeric('surfaceWaveHeight', waterSurface.waveHeight, 0, waterSurface.maxWaveHeight, .005, 'Wave Height (Reserved)');
            numeric('surfaceWaveFrequency', waterSurface.waveFrequency, .05, 8, .1, 'Wave Spatial Frequency');
            numeric('surfaceIor', waterSurface.iorRatio, 1, 2, .01, 'Water / Air IOR');
            numeric('surfaceMirrorOpacity', waterSurface.mirrorOpacity, 0, 1, .01, 'Artistic Mirror Opacity');
        }
        if (cameraDirector) {
            state.cameraMode = cameraDirector.mode;
            labels.cameraMode = 'Camera View';
            state.cameraAutoSwitch = cameraDirector.autoSwitchEnabled;
            labels.cameraAutoSwitch = 'Auto TV Director';
            numeric('cameraFollowDistance', cameraDirector.followDistance, .001, Math.max(5, cameraDirector.followDistance), .05, 'Min Follow Distance (Scene Units)');
            numeric('cameraSwitchInterval', cameraDirector.autoSwitchInterval, 1, Math.max(120, cameraDirector.autoSwitchInterval), 1, 'Mode Interval (Seconds)');
            if (cameraDirector.controls) {
                state.cameraOrbitRotate = cameraDirector.orbitAutoRotate;
                labels.cameraOrbitRotate = 'Optional Orbit Rotation';
            }
        }
        if (dayNightCycle) {
            numeric('timeOfDay', dayNightCycle.timeOfDay, 0, 24, .1, 'Time of Day (24h)');
            numeric('dayDurationSeconds', dayNightCycle.dayDurationSeconds, 5, 86400, 5, 'Day Length (Seconds)');
            state.autoCycle = dayNightCycle.autoCycle;
            labels.autoCycle = 'Auto 24h Cycle';
            color('bioGlowColor', dayNightCycle.bioUniforms.uBioPrimaryColor.value, 'Bio-Glow Neon');
        }
        if (fishFeeder) {
            state.feedingEnabled = fishFeeder.enabled;
            labels.feedingEnabled = 'Canvas Feeding Enabled';
        }
        if (audioSynth && !plantControllers.length)
            numeric('currentSpeed', audioSynth.params.currentVelocity, 0, 6, .1, 'Ambient Audio Motion Rate');
        if (audioSynth) {
            const p = audioSynth.params;
            numeric('audioMasterVolume', p.masterVolume, 0, 1, .02, 'Master Volume');
            numeric('audioDroneIntensity', p.droneIntensity, 0, 1, .02, 'Drone Intensity');
            numeric('audioBubbleRate', p.bubbleRate, 0, 8, .05, 'Bubble Clusters / Second');
            state.audioZenChimesEnabled = p.zenChimesEnabled;
            labels.audioZenChimesEnabled = 'Zen Chimes (Optional)';
            state.audioMuted = audioSynth.isMuted;
            labels.audioMuted = 'Mute All / Including Reverb';
        }
        if (caustics.length) {
            numeric('causticsSpeed', caustics[0].uniforms.uCausticSpeed.value, 0, 6, .1, 'Caustics Drift Rate');
            color('causticColor', caustics[0].uniforms.uCausticColor.value, 'Caustic Shimmer');
        }
        if (bubbles) {
            numeric('bubbleRiseSpeed', bubbles.riseSpeedMultiplier, 0, 4, .1, 'Bubble Rise Multiplier');
            numeric('bubbleOpacity', bubbles.material.uniforms.uBubbleOpacity.value, 0, 1, .02, 'Bubble Opacity');
        }
        if (postFX) {
            const p = postFX.passes, u = p.underwaterPass.uniforms;
            numeric('focusDistance', postFX.state.focusDistance, Math.max(postFX.passes.bokehPass.camera.near, Math.min(.0001, postFX.passes.bokehPass.camera.far * .5)), postFX.passes.bokehPass.camera.far, .05, 'Focus (Scene Units)');
            numeric('aperture', p.bokehPass.uniforms.aperture.value, 0, .005, .0001, 'Aperture / Blur');
            numeric('maxBlur', p.bokehPass.uniforms.maxblur.value, 0, .02, .0005, 'Max Bokeh Radius');
            numeric('bloomStrength', p.bloomPass.strength, 0, 2, .02, 'Bloom Strength');
            numeric('bloomRadius', p.bloomPass.radius, 0, 1, .02, 'Bloom Spread');
            numeric('bloomThreshold', p.bloomPass.threshold, 0, 1, .02, 'HDR Bloom Threshold');
            numeric('godRayIntensity', u.uGodRayIntensity.value, 0, .5, .01, 'Screen-Space Rays');
            numeric('chromaticAberration', u.uChromaticAberration.value, 0, .01, .0002, 'Chromatic Edge Offset');
            color('waterTint', u.uWaterTint.value, 'Lens Water Tint');
        }
        numeric('exposure', renderer.toneMappingExposure, 0, 2.5, .02, 'Output Exposure');
        if (scene.fog?.color || scene.background?.isColor)
            color('waterFogColor', scene.fog?.color ?? scene.background, 'Fog / Color Background');
        if (scene.fog?.isFogExp2)
            numeric('fogDensity', scene.fog.density, 0, .25, .005, 'Exponential Fog Density');
        if (sunLight) {
            if (!sunLight.isLight)
                throw new Error('sunLight must be a Three Light');
            numeric('sunIntensity', sunLight.intensity, 0, 6, .1, 'Top Sun Intensity');
        }
        if (ranges.plantSwayAmplitude && state.plantSwayAmplitude > ranges.plantSwayAmplitude[1])
            throw new Error('Plant group amplitude exceeds shared reserve; use separate panels');
        committed = { ...state };
        const live = () => { if (disposed)
            throw new Error('Director panel is disposed'); if (waterSurface?.disposed || cameraDirector?.disposed || dayNightCycle?.disposed || fishFeeder?.disposed || audioSynth?.disposed || fishAquarium?.disposed || postFX?.disposed || bubbles?.disposed || plantControllers.some(c => c.disposed) || caustics.some(c => c.source.disposed))
            throw new Error('A bound controller was disposed; recreate the panel'); };
        function validate(patch) {
            if (!patch || typeof patch !== 'object' || Array.isArray(patch))
                throw new Error('Parameter object required');
            for (const [key, v] of Object.entries(patch)) {
                if (key === 'preset' || !Object.hasOwn(committed, key))
                    throw new Error(`Unavailable/unknown director parameter: ${key}`);
                if (key === 'cameraMode') {
                    if (!Object.values(cameraDirector.availableModes).includes(v))
                        throw new Error('Invalid cameraMode');
                }
                else if (ranges[key]) {
                    const [min, max] = ranges[key];
                    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (key === 'activeFishCount' && !Number.isInteger(v)))
                        throw new Error(`Invalid ${key}; range ${min}..${max}`);
                }
                else if (typeof committed[key] === 'boolean') {
                    if (typeof v !== 'boolean')
                        throw new Error(`Invalid boolean ${key}`);
                }
                else if (typeof v !== 'string' || !/^#[0-9a-f]{6}$/i.test(v))
                    throw new Error(`Invalid #rrggbb color ${key}`);
            }
        }
        function refresh() { for (const c of gui?.controllersRecursive() ?? [])
            c.updateDisplay(); }
        function applyConfig(patch) {
            live();
            validate(patch);
            patch = { ...patch };
            if (audioSynth) {
                const audioPatch = {};
                for (const [k, v] of Object.entries({ audioMasterVolume: 'masterVolume', audioDroneIntensity: 'droneIntensity', audioBubbleRate: 'bubbleRate', audioZenChimesEnabled: 'zenChimesEnabled', currentSpeed: 'currentVelocity' }))
                    if (Object.hasOwn(patch, k))
                        audioPatch[v] = patch[k];
                if (Object.keys(audioPatch).length)
                    audioSynth.setConfig(audioPatch);
                if (Object.hasOwn(patch, 'audioMuted'))
                    audioSynth.setMuted(patch.audioMuted);
            }
            const postPatch = {};
            for (const key of ['aperture', 'maxBlur', 'bloomStrength', 'bloomRadius', 'bloomThreshold', 'godRayIntensity', 'chromaticAberration', 'waterTint', 'exposure'])
                if (Object.hasOwn(patch, key))
                    postPatch[key] = patch[key];
            if ('activeFishCount' in patch)
                fishAquarium.setActiveCount(patch.activeFishCount);
            if ('surfaceWaveHeight' in patch)
                waterSurface.setWaveHeight(patch.surfaceWaveHeight);
            if ('surfaceWaveFrequency' in patch)
                waterSurface.setWaveFrequency(patch.surfaceWaveFrequency);
            if ('surfaceIor' in patch)
                waterSurface.setIorRatio(patch.surfaceIor);
            if ('surfaceMirrorOpacity' in patch)
                waterSurface.setMirrorOpacity(patch.surfaceMirrorOpacity);
            if ('cameraMode' in patch)
                cameraDirector.setMode(patch.cameraMode);
            if ('cameraAutoSwitch' in patch)
                cameraDirector.autoSwitchEnabled = patch.cameraAutoSwitch;
            if ('cameraFollowDistance' in patch)
                cameraDirector.followDistance = patch.cameraFollowDistance;
            if ('cameraSwitchInterval' in patch)
                cameraDirector.autoSwitchInterval = patch.cameraSwitchInterval;
            if ('cameraOrbitRotate' in patch)
                cameraDirector.orbitAutoRotate = patch.cameraOrbitRotate;
            if ('timeOfDay' in patch)
                dayNightCycle.applyTimeOfDay(patch.timeOfDay);
            if ('autoCycle' in patch)
                dayNightCycle.autoCycle = patch.autoCycle;
            if ('dayDurationSeconds' in patch)
                dayNightCycle.dayDurationSeconds = patch.dayDurationSeconds;
            if ('bioGlowColor' in patch)
                dayNightCycle.setGlowColor(patch.bioGlowColor);
            if ('feedingEnabled' in patch)
                fishFeeder.setEnabled(patch.feedingEnabled);
            if (postFX && Object.keys(postPatch).length)
                postFX.setConfig(postPatch);
            if ('swimSpeed' in patch)
                fishAquarium.setMaxSpeed(patch.swimSpeed);
            if ('tailBeatSpeed' in patch)
                fishAquarium.setTailSpeed(patch.tailBeatSpeed);
            if ('tailWaveAmplitude' in patch)
                fishAquarium.setAmplitude(patch.tailWaveAmplitude);
            if ('tailWaveFrequency' in patch)
                fishAquarium.setFrequency(patch.tailWaveFrequency);
            if ('currentSpeed' in patch)
                for (const c of plantControllers)
                    c.setSpeed(patch.currentSpeed);
            if ('plantSwayAmplitude' in patch)
                for (const c of plantControllers)
                    c.setAmplitude(patch.plantSwayAmplitude);
            if ('causticsSpeed' in patch)
                for (const c of caustics)
                    c.uniforms.uCausticSpeed.value = patch.causticsSpeed;
            if ('causticColor' in patch)
                for (const c of caustics)
                    c.uniforms.uCausticColor.value.set(patch.causticColor);
            if ('bubbleRiseSpeed' in patch)
                bubbles.setRiseSpeed(patch.bubbleRiseSpeed);
            if ('bubbleOpacity' in patch)
                bubbles.setOpacity(patch.bubbleOpacity);
            if ('focusDistance' in patch)
                postFX.setFocusDistance(patch.focusDistance, true);
            if ('exposure' in patch && !postFX)
                renderer.toneMappingExposure = patch.exposure;
            if ('waterFogColor' in patch) {
                if (scene.background?.isColor)
                    scene.background.set(patch.waterFogColor);
                scene.fog?.color.set(patch.waterFogColor);
            }
            if ('fogDensity' in patch)
                scene.fog.density = patch.fogDensity;
            if ('sunIntensity' in patch)
                sunLight.intensity = patch.sunIntensity;
            committed = { ...committed, ...patch, preset: 'Custom' };
            Object.assign(state, committed);
            refresh();
            return getConfig();
        }
        function applyPreset(name) { live(); if (!Object.hasOwn(ATMOSPHERE_PRESETS, name))
            throw new Error('Unknown atmosphere preset'); const patch = {}; for (const [k, v] of Object.entries(ATMOSPHERE_PRESETS[name]))
            if (Object.hasOwn(committed, k))
                patch[k] = v; applyConfig(patch); committed.preset = state.preset = name; refresh(); }
        function syncFocusDisplay() { live(); if (postFX) {
            state.focusDistance = committed.focusDistance = postFX.state.focusDistance;
            controls.get('focusDistance')?.updateDisplay();
        } }
        function mirror(key, value) { if (Object.hasOwn(committed, key)) {
            state[key] = committed[key] = value;
            controls.get(key)?.updateDisplay();
        } }
        function syncDisplay() { syncFocusDisplay(); if (fishAquarium) {
            mirror('swimSpeed', fishAquarium.maxSpeed);
            mirror('tailBeatSpeed', fishAquarium.shaderUniforms.uBioSpeed.value);
            mirror('tailWaveAmplitude', fishAquarium.shaderUniforms.uBioAmp.value);
            mirror('tailWaveFrequency', fishAquarium.shaderUniforms.uBioFreq.value);
        } if (plantControllers.length) {
            mirror('currentSpeed', plantControllers[0].uniforms.uBioSpeed.value);
            mirror('plantSwayAmplitude', plantControllers[0].uniforms.uBioAmp.value);
        } if (caustics.length) {
            mirror('causticsSpeed', caustics[0].uniforms.uCausticSpeed.value);
            mirror('causticColor', hex(caustics[0].uniforms.uCausticColor.value));
        } if (bubbles) {
            mirror('bubbleRiseSpeed', bubbles.riseSpeedMultiplier);
            mirror('bubbleOpacity', bubbles.material.uniforms.uBubbleOpacity.value);
        } if (sunLight)
            mirror('sunIntensity', sunLight.intensity); if (scene.background?.isColor || scene.fog?.color)
            mirror('waterFogColor', hex(scene.fog?.color ?? scene.background)); if (scene.fog?.isFogExp2)
            mirror('fogDensity', scene.fog.density); mirror('exposure', renderer.toneMappingExposure); if (postFX) {
            const p = postFX.passes, u = p.underwaterPass.uniforms;
            mirror('aperture', p.bokehPass.uniforms.aperture.value);
            mirror('maxBlur', p.bokehPass.uniforms.maxblur.value);
            mirror('bloomStrength', p.bloomPass.strength);
            mirror('bloomRadius', p.bloomPass.radius);
            mirror('bloomThreshold', p.bloomPass.threshold);
            mirror('godRayIntensity', u.uGodRayIntensity.value);
            mirror('chromaticAberration', u.uChromaticAberration.value);
            mirror('waterTint', hex(u.uWaterTint.value));
        } if (waterSurface) {
            mirror('surfaceWaveHeight', waterSurface.waveHeight);
            mirror('surfaceWaveFrequency', waterSurface.waveFrequency);
            mirror('surfaceIor', waterSurface.iorRatio);
            mirror('surfaceMirrorOpacity', waterSurface.mirrorOpacity);
        } if (cameraDirector) {
            mirror('cameraMode', cameraDirector.mode);
            mirror('cameraAutoSwitch', cameraDirector.autoSwitchEnabled);
            mirror('cameraFollowDistance', cameraDirector.followDistance);
            mirror('cameraSwitchInterval', cameraDirector.autoSwitchInterval);
            mirror('cameraOrbitRotate', cameraDirector.orbitAutoRotate);
            if (postFX)
                mirror('aperture', postFX.passes.bokehPass.uniforms.aperture.value);
            actions.cameraTarget = cameraDirector.trackedClusterIndex < 0 ? 'No cluster selected' : `CPU cluster ${cameraDirector.trackedClusterIndex}`;
            controls.get('cameraTarget')?.updateDisplay();
        } if (dayNightCycle) {
            for (const k of ['timeOfDay', 'autoCycle', 'dayDurationSeconds']) {
                state[k] = committed[k] = dayNightCycle[k];
                controls.get(k)?.updateDisplay();
            }
            state.bioGlowColor = committed.bioGlowColor = '#' + dayNightCycle.bioUniforms.uBioPrimaryColor.value.getHexString();
            controls.get('bioGlowColor')?.updateDisplay();
            if (sunLight)
                mirror('sunIntensity', sunLight.intensity);
            if (scene.fog?.color || scene.background?.isColor)
                mirror('waterFogColor', '#' + (scene.fog?.color ?? scene.background).getHexString());
            if (caustics.length)
                mirror('causticColor', '#' + caustics[0].uniforms.uCausticColor.value.getHexString());
            if (postFX) {
                const p = postFX.passes;
                mirror('bloomStrength', p.bloomPass.strength);
                mirror('bloomThreshold', p.bloomPass.threshold);
                mirror('godRayIntensity', p.underwaterPass.uniforms.uGodRayIntensity.value);
                mirror('waterTint', '#' + p.underwaterPass.uniforms.uWaterTint.value.getHexString());
            }
        } if (fishFeeder) {
            state.feedingEnabled = committed.feedingEnabled = fishFeeder.enabled;
            controls.get('feedingEnabled')?.updateDisplay();
        } if (fishAquarium) {
            state.activeFishCount = committed.activeFishCount = fishAquarium.activeCount;
            controls.get('activeFishCount')?.updateDisplay();
        } if (audioSynth) {
            const p = audioSynth.params;
            if (!plantControllers.length)
                mirror('currentSpeed', p.currentVelocity);
            for (const [key, name] of Object.entries({ audioMasterVolume: 'masterVolume', audioDroneIntensity: 'droneIntensity', audioBubbleRate: 'bubbleRate', audioZenChimesEnabled: 'zenChimesEnabled' })) {
                state[key] = committed[key] = p[name];
                controls.get(key)?.updateDisplay();
            }
            state.audioMuted = committed.audioMuted = audioSynth.isMuted;
            controls.get('audioMuted')?.updateDisplay();
        } }
        function getConfig() { live(); syncDisplay(); return { ...committed }; }
        function exportConfigJSON() { const { preset, ...parameters } = getConfig(); validate(parameters); return JSON.stringify({ version: 1, preset, parameters }, null, 2); }
        const MAX_PRESET_BYTES = 256 * 1024;
        function checkPresetText(json) { if (typeof json !== 'string')
            throw new Error('Preset JSON must be text'); if (json.length > MAX_PRESET_BYTES || new TextEncoder().encode(json).byteLength > MAX_PRESET_BYTES)
            throw new Error('Preset exceeds 256 KiB limit'); return json.replace(/^\uFEFF/, ''); }
        function importConfigJSON(json) {
            live();
            const data = JSON.parse(checkPresetText(json));
            if (!data || Array.isArray(data) || data.version !== 1 || !data.parameters)
                throw new Error('Director JSON version 1 with parameters required');
            for (const key of Object.keys(data))
                if (!['version', 'preset', 'parameters'].includes(key))
                    throw new Error(`Unknown preset envelope field: ${key}`);
            if (data.preset !== undefined && (typeof data.preset !== 'string' || (data.preset !== 'Custom' && !Object.hasOwn(ATMOSPHERE_PRESETS, data.preset))))
                throw new Error('Invalid preset label');
            validate(data.parameters);
            applyConfig(data.parameters);
            committed.preset = state.preset = data.preset ?? 'Custom';
            refresh();
            return getConfig();
        }
        const downloads = new Map();
        let pendingPicker = null, pendingRead = null;
        const filePlatform = () => options.filePlatform ?? globalThis;
        function cancelPresetImport() { pendingPicker?.cancel(); pendingRead?.cancel(); }
        function releaseDownload(url) { const entry = downloads.get(url); if (!entry)
            return; downloads.delete(url); entry.platform.clearTimeout(entry.timer); entry.platform.URL.revokeObjectURL(url); }
        function downloadPreset(filename) {
            live();
            const p = filePlatform(), doc = p.document;
            if (!doc?.body || !doc.createElement || !p.Blob || !p.URL?.createObjectURL || !p.URL?.revokeObjectURL || !p.setTimeout || !p.clearTimeout)
                throw new Error('Browser download APIs unavailable; use exportConfigJSON()');
            const name = filename ?? `aquarium_preset_${Date.now()}.json`;
            if (typeof name !== 'string' || name.length > 128 || !/^[-\w.]+\.json$/i.test(name))
                throw new Error('Preset filename must be a simple .json name');
            if (downloads.size >= 4)
                throw new Error('Wait for pending preset downloads before exporting again');
            const json = exportConfigJSON();
            checkPresetText(json);
            const url = p.URL.createObjectURL(new p.Blob([json], { type: 'application/json;charset=utf-8' }));
            let anchor;
            downloads.set(url, { platform: p, timer: undefined });
            try {
                anchor = doc.createElement('a');
                anchor.href = url;
                anchor.download = name;
                doc.body.appendChild(anchor);
                anchor.click();
                downloads.get(url).timer = p.setTimeout(() => releaseDownload(url), 1000);
            }
            catch (error) {
                releaseDownload(url);
                throw error;
            }
            finally {
                anchor?.remove();
            }
            return { filename: name, json };
        }
        function importPresetFile(file) {
            live();
            if (!file || !Number.isSafeInteger(file.size) || file.size < 1 || file.size > MAX_PRESET_BYTES)
                throw new Error('Preset file must be nonempty and at most 256 KiB');
            const p = filePlatform();
            if (!p.FileReader && typeof file.text !== 'function')
                throw new Error('File reading APIs unavailable');
            cancelPresetImport();
            return new Promise((resolve, reject) => {
                let done = false, reader;
                const token = { cancel() { finish(null); try {
                        reader?.abort();
                    }
                    catch { /* reader may already be closed */ } } };
                const finish = (text, error) => { if (done)
                    return; done = true; if (reader)
                    reader.onload = reader.onerror = reader.onabort = null; if (pendingRead === token)
                    pendingRead = null; if (error) {
                    reject(error);
                    return;
                } if (text === null || disposed) {
                    resolve(null);
                    return;
                } try {
                    resolve(importConfigJSON(text));
                }
                catch (err) {
                    reject(err);
                } };
                pendingRead = token;
                try {
                    if (p.FileReader) {
                        reader = new p.FileReader();
                        reader.onload = () => finish(reader.result);
                        reader.onerror = () => finish(null, reader.error ?? new Error('Unable to read preset file'));
                        reader.onabort = () => finish(null);
                        reader.readAsText(file);
                    }
                    else
                        Promise.resolve(file.text()).then(text => finish(text), error => finish(null, error ?? new Error('Unable to read preset file')));
                }
                catch (error) {
                    finish(null, error);
                }
            });
        }
        function importPresetFromFile() {
            live();
            const p = filePlatform(), doc = p.document;
            if (!doc?.body || !doc.createElement)
                throw new Error('Browser file picker unavailable; use importConfigJSON()');
            cancelPresetImport();
            return new Promise((resolve, reject) => {
                let input, timer, done = false;
                const focusTarget = p.window ?? p;
                const cleanup = () => { if (timer !== undefined)
                    p.clearTimeout(timer); focusTarget.removeEventListener?.('focus', focus); if (input) {
                    input.onchange = input.oncancel = null;
                    input.remove();
                } if (pendingPicker === token)
                    pendingPicker = null; };
                const finish = (file) => { if (done)
                    return; done = true; cleanup(); if (!file || disposed) {
                    resolve(null);
                    return;
                } try {
                    Promise.resolve(importPresetFile(file)).then(resolve, reject);
                }
                catch (error) {
                    reject(error);
                } };
                const focus = () => { if (done || disposed || !p.setTimeout || !p.clearTimeout)
                    return; if (timer !== undefined)
                    p.clearTimeout(timer); timer = p.setTimeout(() => finish(input?.files?.[0] ?? null), 1000); };
                const token = { cancel: () => finish(null) };
                pendingPicker = token;
                try {
                    input = doc.createElement('input');
                    input.type = 'file';
                    input.accept = '.json,application/json';
                    input.style.display = 'none';
                    input.onchange = () => finish(input.files?.[0] ?? null);
                    input.oncancel = () => finish(null);
                    doc.body.appendChild(input);
                    focusTarget.addEventListener?.('focus', focus);
                    input.click();
                }
                catch (error) {
                    if (!done) {
                        done = true;
                        cleanup();
                        reject(error);
                    }
                }
            });
        }
        async function copyConfigToClipboard() { const json = exportConfigJSON(); const clipboard = options.clipboard ?? (typeof navigator !== 'undefined' ? navigator.clipboard : undefined); if (!clipboard?.writeText)
            return { copied: false, json, error: 'Clipboard unavailable; use exportConfigJSON()' }; try {
            await clipboard.writeText(json);
            return { copied: true, json };
        }
        catch (error) {
            return { copied: false, json, error: String(error) };
        } }
        const actions = { status: 'Ready', downloadPreset: () => { try {
                const result = downloadPreset();
                actions.status = `Download requested: ${result.filename}`;
                controls.get('status')?.updateDisplay();
            }
            catch (error) {
                report(error);
            } }, importPresetFromFile: () => { try {
                importPresetFromFile().then(result => { if (!disposed) {
                    actions.status = result ? 'Preset imported' : 'Import cancelled';
                    controls.get('status')?.updateDisplay();
                } }).catch(report);
            }
            catch (error) {
                report(error);
            } }, cameraTarget: 'No cluster selected', nextCameraMode: () => { try {
                live();
                cameraDirector.nextMode();
                syncDisplay();
            }
            catch (error) {
                report(error);
            } }, nextCameraCluster: () => { try {
                live();
                cameraDirector.followNextCluster();
                syncDisplay();
            }
            catch (error) {
                report(error);
            } }, feedFish: () => { try {
                live();
                fishFeeder.feedAtCenter();
            }
            catch (error) {
                report(error);
            } }, clearFood: () => { try {
                live();
                fishFeeder.clear();
            }
            catch (error) {
                report(error);
            } }, scatterFish: () => { live(); fishAquarium?.scatter(); audioSynth?.triggerFishScatterWhoosh(); }, enableAudio: () => { try {
                live();
                audioSynth.init().then(() => { if (!disposed) {
                    audioSynth.setMuted(false);
                    syncDisplay();
                    actions.status = 'Audio running';
                    controls.get('status')?.updateDisplay();
                } }).catch(report);
            }
            catch (error) {
                report(error);
            } }, exportConfigJSON: () => { copyConfigToClipboard().then(result => { if (!disposed) {
                actions.status = result.copied ? 'Config copied' : 'Copy unavailable; use exportConfigJSON()';
                controls.get('status')?.updateDisplay();
                options.onExport?.(result);
            } }).catch(report); } };
        function report(error) { if (disposed)
            return; Object.assign(state, committed); actions.status = error?.message ?? String(error); refresh(); options.onError?.(error); }
        function add(folder, key) {
            const range = ranges[key];
            const c = key === 'cameraMode' ? folder.add(state, key, Object.values(cameraDirector.availableModes)) : range ? folder.add(state, key, ...range) : typeof state[key] === 'boolean' ? folder.add(state, key) : folder.addColor(state, key);
            c.name(labels[key]);
            if (range && range[0] === range[1])
                c.disable();
            c.onChange((value) => { try {
                applyConfig({ [key]: value });
                actions.status = 'Updated';
                controls.get('status')?.updateDisplay();
            }
            catch (error) {
                report(error);
            } });
            controls.set(key, c);
        }
        try {
            gui = new GUI({ title: options.title ?? 'Aquascape Director Studio', width: options.width ?? 310, ...(options.container ? { container: options.container } : {}) });
            gui.add(state, 'preset', ['Custom', ...Object.keys(ATMOSPHERE_PRESETS)]).name('Mood Preset').onChange((name) => { try {
                if (name === 'Custom')
                    committed.preset = 'Custom';
                else
                    applyPreset(name);
            }
            catch (error) {
                report(error);
            } });
            const groups = {
                'Procedural Audio (Opt-In)': ['audioMasterVolume', 'audioDroneIntensity', 'audioBubbleRate', 'audioZenChimesEnabled', 'audioMuted'],
                'Water Surface / Snell Window': ['surfaceWaveHeight', 'surfaceWaveFrequency', 'surfaceIor', 'surfaceMirrorOpacity'],
                'Cinematic Camera (CPU Cluster Follow)': ['cameraMode', 'cameraFollowDistance', 'cameraAutoSwitch', 'cameraSwitchInterval', 'cameraOrbitRotate'],
                'Day-Night / Bioluminescence': ['timeOfDay', 'autoCycle', 'dayDurationSeconds', 'bioGlowColor'],
                'Interactive Feeding': ['feedingEnabled'],
                'Fish Schooling / Bio-Motion': ['activeFishCount', 'swimSpeed', 'tailBeatSpeed', 'tailWaveAmplitude', 'tailWaveFrequency'],
                'Water / Flora Dynamics': ['currentSpeed', 'plantSwayAmplitude', 'causticsSpeed', 'bubbleRiseSpeed', 'bubbleOpacity'],
                'Macro Lens / Bokeh': ['focusDistance', 'aperture', 'maxBlur'],
                'Bloom / Screen Optics': ['bloomStrength', 'bloomRadius', 'bloomThreshold', 'godRayIntensity', 'chromaticAberration', 'exposure'],
                'Water Grading / Caustics': ['waterFogColor', 'waterTint', 'causticColor', 'fogDensity', 'sunIntensity']
            };
            for (const [name, keys] of Object.entries(groups)) {
                const available = keys.filter(k => Object.hasOwn(state, k));
                if (!available.length)
                    continue;
                const folder = gui.addFolder(name);
                for (const key of available)
                    add(folder, key);
                if (name.startsWith('Cinematic Camera')) {
                    folder.add(actions, 'nextCameraMode').name('Next Camera Mode');
                    folder.add(actions, 'nextCameraCluster').name('Follow Next CPU Cluster');
                    controls.set('cameraTarget', folder.add(actions, 'cameraTarget').name('Coarse Follow Target').disable());
                }
                if (name === 'Interactive Feeding') {
                    folder.add(actions, 'feedFish').name('Drop Food at Tank Center');
                    folder.add(actions, 'clearFood').name('Clear Food / Ripples');
                }
                if (name.startsWith('Procedural Audio'))
                    folder.add(actions, 'enableAudio').name('Enable / Resume Audio');
                if (name.startsWith('Water Grading'))
                    folder.close();
            }
            const storage = gui.addFolder('Preset Management');
            storage.add(actions, 'downloadPreset').name('Export Preset (JSON)');
            storage.add(actions, 'importPresetFromFile').name('Import Preset (JSON)');
            if (fishAquarium)
                gui.add(actions, 'scatterFish').name('Startle / Scatter Clusters');
            gui.add(actions, 'exportConfigJSON').name('Copy Config JSON');
            controls.set('status', gui.add(actions, 'status').name('Status').disable());
        }
        catch (error) {
            gui?.destroy();
            throw error;
        }
        return { gui, state, applyConfig, applyPreset, getConfig, exportConfigJSON, importConfigJSON, copyConfigToClipboard, downloadPreset, importPresetFile, importPresetFromFile, cancelPresetImport, syncFocusDisplay, syncDisplay,
            scatterFish() { live(); if (!fishAquarium)
                throw new Error('No fish manager bound'); fishAquarium.scatter(); audioSynth?.triggerFishScatterWhoosh(); },
            dispose() { if (disposed)
                return; disposed = true; cancelPresetImport(); for (const url of [...downloads.keys()])
                releaseDownload(url); gui.destroy(); controls.clear(); }
        };
    }
    return { createAquariumDirectorGUI, ATMOSPHERE_PRESETS };
}
const api=createAquariumDirectorFactory(THREE,GUI);
export const createAquariumDirectorGUI=api.createAquariumDirectorGUI;
export const ATMOSPHERE_PRESETS=api.ATMOSPHERE_PRESETS;
