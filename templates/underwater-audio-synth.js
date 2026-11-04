// Generated from mcp-server/codeDeployer/underwaterAudio.ts by npm run build.
export function createUnderwaterAudioSynthesizer(platform = globalThis) {
    function minnaertFrequency(radius, pressure = 101325, density = 1000, gamma = 1.4) {
        if (![radius, pressure, density, gamma].every(n => Number.isFinite(n) && n > 0))
            throw new Error('Positive finite bubble radius/pressure/density/gamma required');
        const frequency = Math.sqrt(3 * gamma * pressure / density) / (2 * Math.PI * radius);
        if (!Number.isFinite(frequency) || frequency <= 0)
            throw new Error('Bubble inputs exceed finite frequency range');
        return frequency;
    }
    const defaults = { masterVolume: .35, droneIntensity: .45, bubbleRate: .4, zenChimesEnabled: false, chimeRate: .08, currentVelocity: 1.8, reverbMix: .38 };
    function validate(params) {
        for (const [key, value] of Object.entries(params)) {
            if (!Object.hasOwn(defaults, key))
                throw new Error(`Unknown audio parameter ${key}`);
            if (key === 'zenChimesEnabled') {
                if (typeof value !== 'boolean')
                    throw new Error('zenChimesEnabled must be boolean');
            }
            else if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
                throw new Error(`${key} must be finite and nonnegative`);
        }
        for (const key of ['masterVolume', 'droneIntensity', 'reverbMix', 'chimeRate'])
            if (params[key] > 1)
                throw new Error(`${key} must be 0..1`);
        if (params.bubbleRate > 8)
            throw new Error('bubbleRate must be 0..8 clusters/sec');
    }
    class UnderwaterAudioSynthesizer {
        ctx = null;
        nodes = {};
        buffers = {};
        isInitialized = false;
        isMuted = false;
        disposed = false;
        _params;
        _context;
        _ownsContext;
        _allNodes = new Set();
        _sources = new Set();
        _voices = new Set();
        _timer = null;
        _initPromise = null;
        _disposePromise = null;
        _random;
        maxVoices;
        _autoSchedule;
        _nextBubble = Infinity;
        _nextChime = Infinity;
        _lastTick = 0;
        _rescheduleNeeded = false;
        stats = { activeVoices: 0, droppedVoices: 0, schedulerDrops: 0, bubbleVoices: 0, whooshes: 0, chimes: 0 };
        constructor(options = {}) {
            this._params = { ...defaults };
            for (const key of Object.keys(defaults))
                if (options[key] !== undefined)
                    this._params[key] = options[key];
            validate(this._params);
            this.maxVoices = options.maxVoices ?? 32;
            if (!Number.isInteger(this.maxVoices) || this.maxVoices < 1 || this.maxVoices > 128)
                throw new Error('maxVoices must be 1..128');
            if (options.seed !== undefined && !Number.isSafeInteger(options.seed))
                throw new Error('seed must be safe integer');
            let seed = (options.seed ?? 17321) >>> 0;
            this._random = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
            this._context = options.context;
            this._ownsContext = !options.context;
            this._autoSchedule = options.autoSchedule !== false;
        }
        get params() { return { ...this._params }; }
        _live() { if (this.disposed)
            throw new Error('Audio synthesizer is disposed'); }
        _node(type, voice) { const node = this.ctx[`create${type}`](); this._allNodes.add(node); voice?.nodes.add(node); if (type === 'Oscillator' || type === 'BufferSource') {
            this._sources.add(node);
            voice?.sources.add(node);
        } return node; }
        _release(voice, stop = false) { if (!this._voices.delete(voice))
            return; for (const node of voice.sources) {
            node.onended = null;
            if (stop)
                try {
                    node.stop();
                }
                catch { }
            this._sources.delete(node);
        } for (const node of voice.nodes) {
            try {
                node.disconnect();
            }
            catch { }
            this._allNodes.delete(node);
        } this.stats.activeVoices = this._voices.size; }
        _voice(build) {
            if (!this.isInitialized || this.isMuted || this.ctx?.state !== 'running')
                return false;
            if (this._voices.size >= this.maxVoices) {
                this.stats.droppedVoices++;
                return false;
            }
            const voice = { nodes: new Set(), sources: new Set(), ended: 0 };
            this._voices.add(voice);
            this.stats.activeVoices = this._voices.size;
            try {
                build(voice);
                for (const source of voice.sources)
                    source.onended = () => { voice.ended++; if (voice.ended >= voice.sources.size)
                        this._release(voice); };
                return true;
            }
            catch (error) {
                this._release(voice, true);
                throw error;
            }
        }
        _smooth(param, value) { const now = this.ctx.currentTime; if (typeof param.cancelAndHoldAtTime === 'function')
            param.cancelAndHoldAtTime(now);
        else {
            const current = param.value;
            param.cancelScheduledValues(now);
            param.setValueAtTime(current, now);
        } param.linearRampToValueAtTime(value, now + .04); }
        _noise(seconds, channels, pink = false) {
            const length = Math.max(2, Math.floor(this.ctx.sampleRate * seconds)), buffer = this.ctx.createBuffer(channels, length, this.ctx.sampleRate);
            for (let ch = 0; ch < channels; ch++) {
                const data = buffer.getChannelData(ch);
                let last = 0, b0 = 0, b1 = 0, b2 = 0, peak = 0;
                for (let i = 0; i < length; i++) {
                    const white = this._random() * 2 - 1;
                    if (pink) {
                        b0 = .99765 * b0 + white * .099046;
                        b1 = .963 * b1 + white * .296516;
                        b2 = .57 * b2 + white * 1.052691;
                        data[i] = (b0 + b1 + b2 + white * .1848) * .08;
                    }
                    else {
                        last = (last + .02 * white) / 1.02;
                        data[i] = last;
                    }
                }
                // Bridge the boundary rather than looping with an abrupt sample discontinuity.
                const jump = data[length - 1] - data[0];
                for (let i = 0; i < length; i++) {
                    data[i] = data[i] - jump * i / (length - 1);
                    peak = Math.max(peak, Math.abs(data[i]));
                }
                if (peak > 0)
                    for (let i = 0; i < length; i++)
                        data[i] = data[i] * .65 / peak;
            }
            return buffer;
        }
        _build() {
            const ctx = this.ctx;
            if (!Number.isFinite(ctx.sampleRate) || ctx.sampleRate < 8000 || ctx.sampleRate > 192000)
                throw new Error('Audio sample rate must be 8..192 kHz');
            const now = ctx.currentTime, master = this._node('Gain'), compressor = this._node('DynamicsCompressor'), dry = this._node('Gain'), wet = this._node('Gain'), reverb = this._node('Convolver');
            compressor.threshold.setValueAtTime(-18, now);
            compressor.knee.setValueAtTime(24, now);
            compressor.ratio.setValueAtTime(6, now);
            compressor.attack.setValueAtTime(.01, now);
            compressor.release.setValueAtTime(.3, now);
            // Every path, INCLUDING wet reverb, reaches the same final master/mute gate.
            dry.connect(compressor);
            reverb.connect(wet);
            wet.connect(compressor);
            compressor.connect(master);
            master.connect(ctx.destination);
            master.gain.setValueAtTime(0, now);
            const ir = ctx.createBuffer(2, Math.floor(ctx.sampleRate * 2.8), ctx.sampleRate);
            for (let ch = 0; ch < 2; ch++) {
                const data = ir.getChannelData(ch);
                let last = 0;
                for (let i = 0; i < data.length; i++) {
                    last = (last + .04 * (this._random() * 2 - 1)) / 1.04;
                    data[i] = last * Math.pow(1 - i / data.length, 3.2) * 2.5;
                }
            }
            reverb.buffer = ir;
            this.buffers = { drone: this._noise(4, 2), whoosh: this._noise(1, 1, true) };
            const noise = this._node('BufferSource'), high = this._node('BiquadFilter'), deep = this._node('BiquadFilter'), surge = this._node('BiquadFilter'), drone = this._node('Gain');
            noise.buffer = this.buffers.drone;
            noise.loop = true;
            high.type = 'highpass';
            high.frequency.setValueAtTime(20, now);
            deep.type = 'lowpass';
            deep.Q.setValueAtTime(.8, now);
            surge.type = 'lowpass';
            surge.frequency.setValueAtTime(260, now);
            surge.Q.setValueAtTime(.7, now);
            deep.frequency.setValueAtTime(Math.min(110 + Math.min(this._params.currentVelocity, 20) * 48, ctx.sampleRate * .4), now);
            drone.gain.setValueAtTime(this._params.droneIntensity * .35, now);
            wet.gain.setValueAtTime(this._params.reverbMix, now);
            noise.connect(high);
            high.connect(deep);
            deep.connect(surge);
            surge.connect(drone);
            drone.connect(dry);
            const lfo = this._node('Oscillator'), lfo2 = this._node('Oscillator'), depth = this._node('Gain'), depth2 = this._node('Gain');
            lfo.frequency.setValueAtTime(.08 + Math.min(this._params.currentVelocity, 20) * .06, now);
            lfo2.frequency.setValueAtTime(.05 + Math.min(this._params.currentVelocity, 20) * .025, now);
            depth.gain.setValueAtTime(35, now);
            depth2.gain.setValueAtTime(80, now);
            lfo.connect(depth);
            depth.connect(deep.frequency);
            lfo2.connect(depth2);
            depth2.connect(surge.frequency);
            for (const frequency of [55, 82.4]) {
                const sub = this._node('Oscillator'), gain = this._node('Gain');
                sub.frequency.setValueAtTime(frequency, now);
                gain.gain.setValueAtTime(.025, now);
                sub.connect(gain);
                gain.connect(drone);
                sub.start(now);
            }
            this.nodes = { masterGain: master, compressor, dry, reverbConvolver: reverb, reverbMix: wet, deepFilter: deep, surgeFilter: surge, lfo, lfo2, droneGain: drone };
            noise.start(now);
            lfo.start(now);
            lfo2.start(now);
            this.isInitialized = true;
            this._apply();
            this._reschedule();
        }
        init() {
            try {
                this._live();
                if (this._initPromise)
                    return this._initPromise;
                if (!this.ctx) {
                    const Ctor = platform.AudioContext ?? platform.webkitAudioContext ?? platform.window?.AudioContext ?? platform.window?.webkitAudioContext;
                    if (!this._context && !Ctor)
                        throw new Error('Web Audio API unavailable');
                    this.ctx = this._context ?? new Ctor();
                    try {
                        this._build();
                    }
                    catch (error) {
                        void this.dispose().catch(() => { });
                        throw error;
                    }
                }
                if (this.ctx.state === 'closed')
                    throw new Error('AudioContext is closed; create a new synthesizer');
                // Called synchronously inside the user gesture, before yielding to a promise.
                if (this.isMuted) {
                    this.nodes.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
                    this.nodes.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
                }
                const resumed = this.ctx.state === 'running' ? Promise.resolve() : this.ctx.resume();
                this._initPromise = Promise.resolve(resumed).then(() => { this._initPromise = null; this._live(); if (this.ctx.state !== 'running')
                    throw new Error('Audio still suspended; activate again from a user gesture'); this._reschedule(); if (this._autoSchedule && this._timer === null)
                    this._timer = platform.setInterval(() => this._tick(), 250); return this; }, (error) => { this._initPromise = null; throw error; });
                return this._initPromise;
            }
            catch (error) {
                return Promise.reject(error);
            }
        }
        _apply() { if (!this.isInitialized)
            return; const p = this._params, now = this.ctx.currentTime, speed = Math.min(p.currentVelocity, 20); this._smooth(this.nodes.masterGain.gain, this.isMuted ? 0 : p.masterVolume); this._smooth(this.nodes.droneGain.gain, p.droneIntensity * .35); this._smooth(this.nodes.reverbMix.gain, p.reverbMix); this.nodes.deepFilter.frequency.setTargetAtTime(Math.min(110 + speed * 48, this.ctx.sampleRate * .4), now, .3); this.nodes.lfo.frequency.setTargetAtTime(.08 + speed * .06, now, .3); this.nodes.lfo2.frequency.setTargetAtTime(.05 + speed * .025, now, .3); }
        setConfig(patch) { this._live(); if (!patch || typeof patch !== 'object' || Array.isArray(patch))
            throw new Error('Audio config object required'); const next = { ...this._params, ...patch }; validate(next); const reset = ['bubbleRate', 'chimeRate', 'zenChimesEnabled'].some(key => Object.hasOwn(patch, key)); this._params = next; this._apply(); if (reset && this.isInitialized)
            this._reschedule(); }
        setCurrentSpeed(speed) { this.setConfig({ currentVelocity: speed }); }
        setMasterVolume(value) { this.setConfig({ masterVolume: value }); }
        setMuted(value) { this._live(); if (typeof value !== 'boolean')
            throw new Error('Mute must be boolean'); this.isMuted = value; this._apply(); if (this.isInitialized)
            this._reschedule(); return value; }
        toggleMute() { return this.setMuted(!this.isMuted); }
        _interval(rate) { return rate > 0 ? -Math.log(Math.max(1e-9, 1 - this._random())) / rate : Infinity; }
        _reschedule() { const now = this.ctx.currentTime; this._nextBubble = now + this._interval(this._params.bubbleRate); this._nextChime = now + this._interval(this._params.zenChimesEnabled ? this._params.chimeRate : 0); this._lastTick = now; this._rescheduleNeeded = false; }
        _tick() {
            if (this.disposed || !this.ctx)
                return;
            const now = this.ctx.currentTime;
            if (this.ctx.state !== 'running' || this.isMuted) {
                this._rescheduleNeeded = true;
                return;
            }
            if (this._rescheduleNeeded || now - this._lastTick > .75) {
                this._reschedule();
                return;
            }
            this._lastTick = now;
            for (const kind of ['bubble', 'chime']) {
                const field = kind === 'bubble' ? '_nextBubble' : '_nextChime', rate = kind === 'bubble' ? this._params.bubbleRate : this._params.zenChimesEnabled ? this._params.chimeRate : 0;
                let count = 0;
                while (this[field] <= now && count < 4) {
                    if (kind === 'bubble')
                        this.triggerBubbleCluster(.6, this._random() * 1.6 - .8);
                    else
                        this.triggerZenHarmonicNote();
                    this[field] += this._interval(rate);
                    count++;
                }
                if (this[field] <= now) {
                    this.stats.schedulerDrops++;
                    this[field] = now + this._interval(rate);
                }
            }
        }
        triggerBubbleCluster(intensity = 1, panX = 0) {
            this._live();
            if (!Number.isFinite(intensity) || intensity < 0 || intensity > 2 || !Number.isFinite(panX) || Math.abs(panX) > 1)
                throw new Error('Bubble intensity 0..2 and pan -1..1 required');
            if (!intensity || !this.isInitialized || this.isMuted || this.ctx.state !== 'running')
                return 0;
            const count = Math.min(12, 2 + Math.floor(this._random() * 6 * intensity));
            let played = 0;
            const now = this.ctx.currentTime + .005;
            for (let i = 0; i < count; i++) {
                if (this._voice(v => {
                    const start = now + i * (.035 + this._random() * .05), duration = .045 + this._random() * .055, radius = .003 + this._random() * .006, frequency = Math.min(minnaertFrequency(radius), this.ctx.sampleRate * .2), end = Math.min(frequency * (1.6 + this._random() * .5), this.ctx.sampleRate * .4);
                    const osc = this._node('Oscillator', v), env = this._node('Gain', v), pan = this._node('StereoPanner', v);
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(frequency, start);
                    osc.frequency.exponentialRampToValueAtTime(end, start + duration);
                    env.gain.setValueAtTime(.0001, start);
                    env.gain.linearRampToValueAtTime((.025 + this._random() * .03) * intensity, start + duration * .2);
                    env.gain.exponentialRampToValueAtTime(.0001, start + duration);
                    pan.pan.setValueAtTime(Math.max(-1, Math.min(1, panX + (this._random() - .5) * .3)), start);
                    osc.connect(env);
                    env.connect(pan);
                    pan.connect(this.nodes.dry);
                    pan.connect(this.nodes.reverbConvolver);
                    osc.start(start);
                    osc.stop(start + duration + .02);
                })) {
                    played++;
                    this.stats.bubbleVoices++;
                }
            }
            return played;
        }
        triggerFishScatterWhoosh(panX = 0) {
            this._live();
            if (!Number.isFinite(panX) || Math.abs(panX) > 1)
                throw new Error('Scatter pan must be -1..1');
            const played = this._voice(v => { const now = this.ctx.currentTime + .005, noise = this._node('BufferSource', v), filter = this._node('BiquadFilter', v), env = this._node('Gain', v), pan = this._node('StereoPanner', v), thump = this._node('Oscillator', v), gain = this._node('Gain', v); noise.buffer = this.buffers.whoosh; filter.type = 'bandpass'; filter.Q.setValueAtTime(1.2, now); filter.frequency.setValueAtTime(110, now); filter.frequency.exponentialRampToValueAtTime(520, now + .12); filter.frequency.exponentialRampToValueAtTime(75, now + .75); env.gain.setValueAtTime(.0001, now); env.gain.linearRampToValueAtTime(.18, now + .08); env.gain.exponentialRampToValueAtTime(.0001, now + .75); pan.pan.setValueAtTime(panX, now); thump.type = 'triangle'; thump.frequency.setValueAtTime(125, now); thump.frequency.exponentialRampToValueAtTime(36, now + .35); gain.gain.setValueAtTime(.1, now); gain.gain.exponentialRampToValueAtTime(.0001, now + .38); noise.connect(filter); filter.connect(env); thump.connect(gain); gain.connect(pan); env.connect(pan); pan.connect(this.nodes.dry); pan.connect(this.nodes.reverbConvolver); noise.start(now, this._random() * .1); noise.stop(now + .8); thump.start(now); thump.stop(now + .4); });
            if (played) {
                this.stats.whooshes++;
                this.triggerBubbleCluster(1.2, panX);
            }
            return played;
        }
        _feedingAccent(snap, panX) {
            this._live();
            if (!Number.isFinite(panX) || Math.abs(panX) > 1)
                throw new Error('Feeding pan must be -1..1');
            return this._voice(v => { const now = this.ctx.currentTime + .005, osc = this._node('Oscillator', v), gain = this._node('Gain', v), pan = this._node('StereoPanner', v), duration = snap ? .055 : .13; osc.type = snap ? 'triangle' : 'sine'; osc.frequency.setValueAtTime(snap ? 240 + this._random() * 140 : 320, now); if (!snap)
                osc.frequency.exponentialRampToValueAtTime(140, now + .035); osc.frequency.exponentialRampToValueAtTime(snap ? 920 : 680, now + (snap ? .045 : .11)); gain.gain.setValueAtTime(.0001, now); gain.gain.linearRampToValueAtTime(snap ? .045 : .09, now + .01); gain.gain.exponentialRampToValueAtTime(.0001, now + duration); pan.pan.setValueAtTime(panX, now); osc.connect(gain); gain.connect(pan); pan.connect(this.nodes.dry); if (!snap)
                pan.connect(this.nodes.reverbConvolver); osc.start(now); osc.stop(now + duration + .01); });
        }
        triggerWaterPlop(panX = 0) { return this._feedingAccent(false, panX); }
        triggerFishSnap(panX = 0) { return this._feedingAccent(true, panX); }
        triggerZenHarmonicNote() {
            this._live();
            if (!this._params.zenChimesEnabled)
                return false;
            const played = this._voice(v => { const scale = [293.66, 329.63, 349.23, 440, 466.16, 587.33, 659.25, 698.46], frequency = scale[Math.floor(this._random() * scale.length)], now = this.ctx.currentTime + .005, carrier = this._node('Oscillator', v), mod = this._node('Oscillator', v), depth = this._node('Gain', v), env = this._node('Gain', v); carrier.frequency.setValueAtTime(frequency, now); mod.frequency.setValueAtTime(frequency * 2, now); depth.gain.setValueAtTime(frequency * .4, now); depth.gain.exponentialRampToValueAtTime(.01, now + .6); env.gain.setValueAtTime(.0001, now); env.gain.linearRampToValueAtTime(.035, now + .08); env.gain.exponentialRampToValueAtTime(.0001, now + 3.8); mod.connect(depth); depth.connect(carrier.frequency); carrier.connect(env); env.connect(this.nodes.reverbConvolver); carrier.start(now); mod.start(now); carrier.stop(now + 3.8); mod.stop(now + 3.8); });
            if (played)
                this.stats.chimes++;
            return played;
        }
        dispose() {
            if (this._disposePromise)
                return this._disposePromise;
            this.disposed = true;
            this.isInitialized = false;
            if (this._timer !== null) {
                platform.clearInterval(this._timer);
                this._timer = null;
            }
            for (const voice of [...this._voices])
                this._release(voice, true);
            for (const source of this._sources) {
                source.onended = null;
                try {
                    source.stop();
                }
                catch { }
            }
            for (const node of this._allNodes) {
                try {
                    node.disconnect();
                    if ('buffer' in node)
                        node.buffer = null;
                }
                catch { }
            }
            this._sources.clear();
            this._allNodes.clear();
            this.nodes = {};
            this.buffers = {};
            const ctx = this.ctx;
            this.ctx = null;
            this._context = null;
            try {
                this._disposePromise = Promise.resolve(this._ownsContext && ctx && ctx.state !== 'closed' ? ctx.close() : undefined);
            }
            catch (error) {
                this._disposePromise = Promise.reject(error);
            }
            return this._disposePromise;
        }
    }
    function bindUnderwaterAudioCanvas(audio, canvas, options = {}) {
        if (!audio?.init || !canvas?.addEventListener || !canvas?.getBoundingClientRect)
            throw new Error('Audio synthesizer and canvas required');
        let press = null, disposed = false, pending = Promise.resolve(0);
        const down = (event) => { if ((event.button ?? 0) === 0 && event.isPrimary !== false)
            press = { x: event.clientX, y: event.clientY, id: event.pointerId }; };
        const up = (event) => {
            const start = press;
            press = null;
            if (event.shiftKey)
                return;
            if (!start || event.pointerId !== start.id || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4)
                return;
            const rect = canvas.getBoundingClientRect();
            if (!rect.width || !rect.height)
                return;
            const x = (event.clientX - rect.left) / rect.width, y = (event.clientY - rect.top) / rect.height;
            if (x < 0 || x > 1 || y < 0 || y > 1)
                return;
            pending = audio.init().then(() => disposed ? 0 : audio.triggerBubbleCluster(.7, x * 2 - 1)).catch((error) => { if (!disposed)
                options.onError?.(error); return 0; });
        };
        const cancel = () => { press = null; };
        canvas.addEventListener('pointerdown', down);
        canvas.addEventListener('pointerup', up);
        canvas.addEventListener('pointercancel', cancel);
        return { get ready() { return pending; }, dispose() { if (disposed)
                return; disposed = true; press = null; canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', cancel); } };
    }
    return { UnderwaterAudioSynthesizer, minnaertFrequency, bindUnderwaterAudioCanvas };
}
const api=createUnderwaterAudioSynthesizer();
export const UnderwaterAudioSynthesizer=api.UnderwaterAudioSynthesizer;
export const minnaertFrequency=api.minnaertFrequency;
export const bindUnderwaterAudioCanvas=api.bindUnderwaterAudioCanvas;
