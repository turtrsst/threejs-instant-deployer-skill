// Generated from mcp-server/codeDeployer/underwaterFx.ts by npm run build.
import * as THREE from 'three';
export function createUnderwaterFX(THREE) {
    const patched = new WeakMap();
    const causticsPars = /* glsl */ `
 // WATER_CAUSTICS_V1
 varying vec3 vCausticWorldPos;
 uniform float uCausticTime,uCausticIntensity,uCausticScale,uCausticSpeed,uCausticWaterLevel,uCausticDepthFalloff;
 uniform vec3 uCausticColor;
 vec2 causticHash(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453123);}
 float causticEdge(vec2 p){
  vec2 cell=floor(p),f=fract(p);float first=20.0,second=20.0;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
   vec2 g=vec2(float(x),float(y)),o=causticHash(cell+g);
   o=0.5+0.5*sin(uCausticTime*uCausticSpeed+6.28318530718*o);
   vec2 r=g+o-f;float d=dot(r,r);
   if(d<first){second=first;first=d;}else second=min(second,d);
  }
  return sqrt(second)-sqrt(first);
 }
 `;
    const causticsPosition = /* glsl */ `
 // WATER_CAUSTICS_WORLD_POSITION
 vec4 causticPosition=vec4(transformed,1.0);
 #ifdef USE_BATCHING
  causticPosition=batchingMatrix*causticPosition;
 #endif
 #ifdef USE_INSTANCING
  causticPosition=instanceMatrix*causticPosition;
 #endif
 vCausticWorldPos=(modelMatrix*causticPosition).xyz;
 `;
    const causticsLight = /* glsl */ `
 if(uCausticIntensity>0.0 && vCausticWorldPos.y<=uCausticWaterLevel){
 vec2 causticUV=vCausticWorldPos.xz*uCausticScale;
 float causticA=1.0-smoothstep(0.02,0.15,causticEdge(causticUV*2.0));
 float causticB=1.0-smoothstep(0.02,0.15,causticEdge(causticUV*4.0-1.5));
 float causticDepth=uCausticWaterLevel-vCausticWorldPos.y;
 float causticFade=step(0.0,causticDepth)*exp(-max(causticDepth,0.0)*uCausticDepthFalloff);
 outgoingLight+=uCausticColor*uCausticIntensity*(0.7*max(causticA,causticB)+0.3*causticA*causticB)*causticFade;
 }
 `;
    function finite(name, value, minimum = 0) { if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum)
        throw new Error(`Invalid ${name}`); return value; }
    /** Patches this material in place. Return value is a backward-compatible time uniform/controller. */
    function injectWaterCaustics(material, options = {}) {
        if (!material?.isMaterial || !(material.isMeshStandardMaterial || material.isMeshPhysicalMaterial || material.isMeshBasicMaterial || material.isMeshLambertMaterial || material.isMeshPhongMaterial) || material.isNodeMaterial)
            throw new Error('Caustics requires a built-in WebGL surface material');
        if (patched.has(material))
            throw new Error('Water caustics already attached; dispose before reinjection');
        const waterLevel = options.waterLevel ?? 4;
        if (typeof waterLevel !== 'number' || !Number.isFinite(waterLevel))
            throw new Error('waterLevel must be finite');
        const time = { value: 0 };
        const uniforms = { uCausticTime: time, uCausticColor: { value: new THREE.Color(options.color ?? 0x88ccff) }, uCausticIntensity: { value: finite('intensity', options.intensity ?? 1.4) }, uCausticScale: { value: finite('scale', options.scale ?? .75, .000001) }, uCausticSpeed: { value: finite('speed', options.speed ?? 1.2) }, uCausticWaterLevel: { value: waterLevel }, uCausticDepthFalloff: { value: finite('depthFalloff', options.depthFalloff ?? .15) } };
        if (!uniforms.uCausticColor.value.toArray().every(Number.isFinite))
            throw new Error('Invalid caustic color');
        const previous = material.onBeforeCompile, previousKey = material.customProgramCacheKey;
        const defaultKey = previousKey === THREE.Material.prototype.customProgramCacheKey ? previous.toString() : null;
        const priorData = material.userData.causticUniforms;
        let disposed = false;
        const cache = function () { return `${defaultKey ?? previousKey.call(this)}|water-caustics-v1`; };
        function compile(shader, renderer) {
            previous.call(this, shader, renderer);
            Object.assign(shader.uniforms, uniforms);
            // Idempotent composition also handles cloned materials with inherited callbacks.
            if (shader.fragmentShader.includes('// WATER_CAUSTICS_V1'))
                return;
            for (const token of ['#include <common>', '#include <project_vertex>'])
                if (!shader.vertexShader.includes(token))
                    throw new Error(`Unsupported caustic vertex shader: ${token}`);
            for (const token of ['#include <common>', '#include <opaque_fragment>'])
                if (!shader.fragmentShader.includes(token))
                    throw new Error(`Unsupported caustic fragment shader: ${token}`);
            shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCausticWorldPos;').replace('#include <project_vertex>', `#include <project_vertex>\n${causticsPosition}`);
            shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${causticsPars}`).replace('#include <opaque_fragment>', `${causticsLight}\n#include <opaque_fragment>`);
        }
        material.onBeforeCompile = compile;
        material.customProgramCacheKey = cache;
        material.userData.causticUniforms = uniforms;
        material.needsUpdate = true;
        Object.defineProperty(time, 'disposed', { get: () => disposed });
        Object.defineProperty(time, 'uniforms', { value: uniforms, enumerable: false });
        Object.assign(time, {
            update(elapsed) { finite('elapsed seconds', elapsed); if (!disposed)
                time.value = elapsed; },
            setSpeed(value) { finite('caustics speed', value); if (!disposed)
                uniforms.uCausticSpeed.value = value; },
            setColor(value) { if (!(value?.isColor || (Number.isInteger(value) && value >= 0 && value <= 0xffffff) || (typeof value === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value))))
                throw new Error('Caustic color must be Color, RGB hex or #hex'); const color = new THREE.Color(value); if (!color.toArray().every(Number.isFinite))
                throw new Error('Invalid caustic color'); if (!disposed)
                uniforms.uCausticColor.value.copy(color); },
            setIntensity(value) { finite('intensity', value); if (!disposed)
                uniforms.uCausticIntensity.value = value; },
            dispose() {
                if (disposed)
                    return;
                disposed = true;
                uniforms.uCausticIntensity.value = 0;
                if (material.onBeforeCompile === compile)
                    material.onBeforeCompile = previous;
                if (material.customProgramCacheKey === cache)
                    material.customProgramCacheKey = previousKey;
                if (material.userData.causticUniforms === uniforms) {
                    if (priorData === undefined)
                        delete material.userData.causticUniforms;
                    else
                        material.userData.causticUniforms = priorData;
                }
                patched.delete(material);
                material.needsUpdate = true;
            }
        });
        patched.set(material, time);
        return time;
    }
    const bubbleVertex = /* glsl */ `
 uniform float uBubbleSize,uBubbleViewportHeight,uBubbleMaxPointSize;
 void main(){
  vec4 mvPosition=modelViewMatrix*vec4(position,1.0);
  gl_Position=projectionMatrix*mvPosition;
  float pixels=uBubbleSize*uBubbleViewportHeight*projectionMatrix[1][1]*0.5;
  if(isPerspectiveMatrix(projectionMatrix))pixels/=max(-mvPosition.z,0.0001);
  gl_PointSize=clamp(pixels,1.0,uBubbleMaxPointSize);
 }
 `;
    const bubbleFragment = /* glsl */ `
 uniform vec3 uBubbleColor;
 uniform float uBubbleOpacity;
 void main(){
  vec2 p=gl_PointCoord*2.0-1.0;float radius=length(p);if(radius>=1.0)discard;
  float rim=smoothstep(0.35,0.83,radius)*(1.0-smoothstep(0.85,1.0,radius));
  float highlight=exp(-dot(p-vec2(-0.28,0.32),p-vec2(-0.28,0.32))*38.0);
  float alpha=(0.06*(1.0-radius)+rim*0.65+highlight*0.7)*uBubbleOpacity;
  gl_FragColor=vec4(uBubbleColor,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }
 `;
    class InteractiveBubbleSystem {
        scene;
        count;
        bounds;
        geometry;
        material;
        points;
        positions;
        speeds;
        wobbleAmps;
        phases;
        stats = { subSteps: 0, neighborChecks: 0, respawns: 0, droppedTime: 0 };
        radius;
        pushStrength;
        fixedDelta;
        maxSubSteps;
        maxFrameDelta;
        accumulator = 0;
        simulationTime = 0;
        initialized = false;
        lastElapsed = 0;
        disposed = false;
        riseSpeedMultiplier = 1;
        random;
        grid = new Map();
        viewport;
        minRise;
        maxRise;
        constructor(scene, count = 300, boundsBox, options = {}) {
            if (!scene?.isObject3D)
                throw new Error('Bubble system requires a scene/group');
            if (!Number.isInteger(count) || count < 0 || count > 100000)
                throw new Error('Bubble count must be 0..100000');
            scene.updateWorldMatrix(true, false);
            const determinant = scene.matrixWorld.determinant();
            if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12)
                throw new Error('Bubble parent world transform must be invertible');
            this.scene = scene;
            this.count = count;
            this.bounds = (boundsBox || new THREE.Box3(new THREE.Vector3(-4, 0, -3), new THREE.Vector3(4, 4, 3))).clone();
            if (this.bounds.isEmpty() || !this.bounds.min.toArray().concat(this.bounds.max.toArray()).every(Number.isFinite) || ['x', 'y', 'z'].some(a => this.bounds.min[a] >= this.bounds.max[a]))
                throw new Error('Bubble bounds must be finite with positive dimensions');
            this.radius = finite('interactionRadius', options.interactionRadius ?? .8, .000001);
            this.pushStrength = finite('pushStrength', options.pushStrength ?? .8);
            this.fixedDelta = finite('fixedDelta', options.fixedDelta ?? 1 / 60, .000001);
            this.maxSubSteps = finite('maxSubSteps', options.maxSubSteps ?? 12, 1);
            if (!Number.isInteger(this.maxSubSteps))
                throw new Error('maxSubSteps must be integer');
            this.maxFrameDelta = finite('maxFrameDelta', options.maxFrameDelta ?? .2, .000001);
            this.minRise = finite('minRiseSpeed', options.minRiseSpeed ?? .6);
            this.maxRise = finite('maxRiseSpeed', options.maxRiseSpeed ?? 1.8);
            if (this.maxRise < this.minRise)
                throw new Error('maxRiseSpeed must be >= minRiseSpeed');
            if (options.seed !== undefined && !Number.isSafeInteger(options.seed))
                throw new Error('seed must be a safe integer');
            let seed = (options.seed ?? 89173) >>> 0;
            this.random = options.random || (() => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
            if (typeof this.random !== 'function')
                throw new Error('random must be a function');
            const bubbleUniforms = { uBubbleColor: { value: new THREE.Color(options.color ?? 0x99ddff) }, uBubbleOpacity: { value: finite('opacity', options.opacity ?? .65) }, uBubbleSize: { value: finite('size', options.size ?? .08, .000001) }, uBubbleViewportHeight: { value: 1 }, uBubbleMaxPointSize: { value: finite('maxPointSize', options.maxPointSize ?? 64, 1) } };
            if (!bubbleUniforms.uBubbleColor.value.toArray().every(Number.isFinite))
                throw new Error('Invalid bubble color');
            this.positions = new Float32Array(count * 3);
            this.speeds = new Float32Array(count);
            this.wobbleAmps = new Float32Array(count);
            this.phases = new Float32Array(count);
            for (let i = 0; i < count; i++)
                this.resetParticle(i, true);
            this.geometry = new THREE.BufferGeometry();
            this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
            this.geometry.boundingBox = this.bounds.clone();
            this.geometry.boundingSphere = this.bounds.getBoundingSphere(new THREE.Sphere());
            this.material = new THREE.ShaderMaterial({ uniforms: bubbleUniforms, vertexShader: '#include <common>\n' + bubbleVertex, fragmentShader: bubbleFragment, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
            this.points = new THREE.Points(this.geometry, this.material);
            this.points.name = 'InteractiveBubbles';
            this.points.matrixAutoUpdate = false;
            this.points.frustumCulled = false;
            this.viewport = new THREE.Vector2();
            this.points.onBeforeRender = (renderer) => { this.syncWorld(); renderer.getDrawingBufferSize(this.viewport); this.material.uniforms.uBubbleViewportHeight.value = this.viewport.y; };
            scene.add(this.points);
            this.syncWorld();
        }
        setRiseSpeed(value) { if (this.disposed)
            throw new Error('Bubble system is disposed'); finite('rise multiplier', value); this.riseSpeedMultiplier = value; }
        setOpacity(value) { if (this.disposed)
            throw new Error('Bubble system is disposed'); finite('opacity', value); this.material.uniforms.uBubbleOpacity.value = value; }
        rand() { const value = this.random(); if (!Number.isFinite(value) || value < 0 || value >= 1)
            throw new Error('random() must return finite [0,1)'); return value; }
        resetParticle(index, randomY = false) {
            if (this.disposed)
                throw new Error('Bubble system is disposed');
            if (!Number.isInteger(index) || index < 0 || index >= this.count)
                throw new Error('Invalid particle index');
            const i = index * 3;
            this.positions[i] = this.bounds.min.x + this.rand() * (this.bounds.max.x - this.bounds.min.x);
            this.positions[i + 1] = randomY ? this.bounds.min.y + this.rand() * (this.bounds.max.y - this.bounds.min.y) : this.bounds.min.y;
            this.positions[i + 2] = this.bounds.min.z + this.rand() * (this.bounds.max.z - this.bounds.min.z);
            this.speeds[index] = this.minRise + this.rand() * (this.maxRise - this.minRise);
            this.wobbleAmps[index] = .01 + this.rand() * .03;
            this.phases[index] = this.rand() * Math.PI * 2;
            if (this.geometry)
                this.geometry.attributes.position.needsUpdate = true;
        }
        syncWorld() {
            const parent = this.points.parent;
            if (!parent)
                return;
            parent.updateWorldMatrix(true, false);
            if (!Number.isFinite(parent.matrixWorld.determinant()) || Math.abs(parent.matrixWorld.determinant()) < 1e-12)
                throw new Error('Bubble parent world transform must be invertible');
            this.points.matrix.copy(parent.matrixWorld).invert();
            this.points.matrixWorldNeedsUpdate = true;
            this.points.updateMatrixWorld(true);
        }
        key(x, y, z) { return `${x},${y},${z}`; }
        hash(fishPositions) {
            this.grid.clear();
            for (const entry of fishPositions) {
                const p = entry?.isVector3 ? entry : entry?.position;
                if (!p?.isVector3 || !p.toArray().every(Number.isFinite))
                    throw new Error('Fish inputs must be world Vector3 positions or boids records with world position');
                const key = this.key(Math.floor(p.x / this.radius), Math.floor(p.y / this.radius), Math.floor(p.z / this.radius));
                let bucket = this.grid.get(key);
                if (!bucket) {
                    bucket = [];
                    this.grid.set(key, bucket);
                }
                bucket.push(p);
            }
        }
        step() {
            const dt = this.fixedDelta, t0 = this.simulationTime, t1 = t0 + dt, r2 = this.radius * this.radius;
            for (let i = 0; i < this.count; i++) {
                const base = i * 3, phase = this.phases[i], amp = this.wobbleAmps[i];
                let x = this.positions[base] + (Math.sin(t1 * 3 + phase) - Math.sin(t0 * 3 + phase)) * amp;
                let y = this.positions[base + 1] + this.speeds[i] * this.riseSpeedMultiplier * dt;
                let z = this.positions[base + 2] + (Math.cos(t1 * 2.4 + phase) - Math.cos(t0 * 2.4 + phase)) * amp * .7;
                const cx = Math.floor(x / this.radius), cy = Math.floor(y / this.radius), cz = Math.floor(z / this.radius);
                let pushX = 0, pushZ = 0;
                for (let a = -1; a <= 1; a++)
                    for (let b = -1; b <= 1; b++)
                        for (let c = -1; c <= 1; c++)
                            for (const fish of this.grid.get(this.key(cx + a, cy + b, cz + c)) || []) {
                                this.stats.neighborChecks++;
                                let dx = x - fish.x, dz = z - fish.z;
                                const dy = y - fish.y, d2 = dx * dx + dy * dy + dz * dz;
                                if (d2 < r2) {
                                    let horizontal = Math.sqrt(dx * dx + dz * dz);
                                    if (horizontal < 1e-8) {
                                        dx = Math.cos(phase);
                                        dz = Math.sin(phase);
                                        horizontal = 1;
                                    }
                                    const strength = (1 - Math.sqrt(d2) / this.radius) * this.pushStrength;
                                    pushX += dx / horizontal * strength;
                                    pushZ += dz / horizontal * strength;
                                }
                            }
                const pushLength = Math.sqrt(pushX * pushX + pushZ * pushZ);
                if (pushLength > this.pushStrength && pushLength > 0) {
                    pushX *= this.pushStrength / pushLength;
                    pushZ *= this.pushStrength / pushLength;
                }
                x += pushX * dt;
                z += pushZ * dt;
                if (y > this.bounds.max.y) {
                    this.resetParticle(i, false);
                    this.stats.respawns++;
                }
                else {
                    this.positions[base] = Math.max(this.bounds.min.x, Math.min(this.bounds.max.x, x));
                    this.positions[base + 1] = y;
                    this.positions[base + 2] = Math.max(this.bounds.min.z, Math.min(this.bounds.max.z, z));
                }
            }
            this.simulationTime = t1;
        }
        update(delta, elapsed, fishPositions = []) {
            if (this.disposed)
                throw new Error('Bubble system is disposed');
            finite('delta seconds', delta);
            finite('elapsed seconds', elapsed);
            if (elapsed + 1e-9 < this.lastElapsed)
                throw new Error('Bubble elapsed time must be monotonic');
            if (!Array.isArray(fishPositions))
                throw new Error('Fish positions must be an array');
            this.hash(fishPositions);
            this.syncWorld();
            if (!this.initialized) {
                this.simulationTime = Math.max(0, elapsed - delta);
                this.initialized = true;
            }
            this.lastElapsed = elapsed;
            this.stats.subSteps = 0;
            this.stats.neighborChecks = 0;
            const accepted = Math.min(delta, this.maxFrameDelta);
            this.stats.droppedTime += delta - accepted;
            this.accumulator += accepted;
            while (this.accumulator + 1e-10 >= this.fixedDelta && this.stats.subSteps < this.maxSubSteps) {
                this.step();
                this.accumulator = Math.max(0, this.accumulator - this.fixedDelta);
                this.stats.subSteps++;
            }
            if (this.accumulator >= this.fixedDelta) {
                const retained = this.accumulator % this.fixedDelta;
                this.stats.droppedTime += this.accumulator - retained;
                this.accumulator = retained;
            }
            if (this.stats.subSteps)
                this.geometry.attributes.position.needsUpdate = true;
            return this.stats;
        }
        dispose() { if (this.disposed)
            return; this.disposed = true; this.points.removeFromParent(); this.points.onBeforeRender = () => { }; this.geometry.dispose(); this.material.dispose(); this.grid.clear(); }
    }
    return { injectWaterCaustics, InteractiveBubbleSystem };
}
const fx = createUnderwaterFX(THREE);
export const injectWaterCaustics = fx.injectWaterCaustics;
export const InteractiveBubbleSystem = fx.InteractiveBubbleSystem;
