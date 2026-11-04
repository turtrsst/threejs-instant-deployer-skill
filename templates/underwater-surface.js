// Generated from mcp-server/codeDeployer/underwaterSurface.ts by npm run build.
import * as THREE from 'three';
export function createUnderwaterSurfaceFactory(THREE) {
    const MAX_RIPPLES = 8, PERIOD = 20 * Math.PI;
    const finite = (name, v, min = -Infinity, max = Infinity) => { if (!Number.isFinite(v) || v < min || v > max)
        throw new Error(`Invalid surface ${name}`); return v; };
    function dielectricFresnel(cosIncident, eta) { finite('cosIncident', cosIncident, 0, 1); finite('eta', eta, .0001, 10); if (Math.abs(eta - 1) < 1e-6)
        return 0; const sin2 = eta * eta * (1 - cosIncident * cosIncident); if (sin2 >= 1)
        return 1; const ct = Math.sqrt(1 - sin2), a = (eta * cosIncident - ct) / (eta * cosIncident + ct), b = (cosIncident - eta * ct) / (cosIncident + eta * ct); return Math.min(1, Math.max(0, (a * a + b * b) * .5)); }
    const vertexShader = /* glsl */ `
 #include <common>
 #include <fog_pars_vertex>
 uniform float uTime,uWaveHeight,uWaveFrequency;
 uniform vec4 uRipples[8]; // xy=world XZ, z=age seconds, w=active strength
 varying vec3 vWaterWorld,vWaterNormal;
 vec3 waterSample(vec2 p){
  float k=uWaveFrequency,a=p.x*k+uTime*1.4,b=p.y*k*.85+uTime*1.1,c=(p.x*.7-p.y*.9)*k*2.1-uTime*2.2,d=(p.x*1.3+p.y*.6)*k*3.4+uTime*1.7;
  float h=sin(a)*cos(b)+.45*sin(c)+.2*cos(d);
  vec2 slope=vec2(k*cos(a)*cos(b)+.45*.7*k*2.1*cos(c)-.2*1.3*k*3.4*sin(d),-.85*k*sin(a)*sin(b)-.45*.9*k*2.1*cos(c)-.2*.6*k*3.4*sin(d));
  for(int i=0;i<8;i++){vec4 r=uRipples[i];if(r.w>0.0&&r.z>=0.0&&r.z<4.5){vec2 q=p-r.xy;float dist=sqrt(dot(q,q)+.0004),front=dist-r.z*2.4,envelope=exp(-abs(front)*3.2-r.z*1.15)*r.w*2.2;h+=sin(front*18.0)*envelope;slope+=(q/dist)*envelope*(18.0*cos(front*18.0)-3.2*sign(front)*sin(front*18.0));}}
  return vec3(h,slope)*uWaveHeight;
 }
 void main(){vec4 world=modelMatrix*vec4(position,1.0);vec3 sampleValue=waterSample(world.xz);world.y+=sampleValue.x;vWaterWorld=world.xyz;vWaterNormal=normalize(vec3(-sampleValue.y,1.0,-sampleValue.z));vec4 mvPosition=viewMatrix*world;gl_Position=projectionMatrix*mvPosition;
 #include <fog_vertex>
 }
 `;
    const fragmentShader = /* glsl */ `
 #include <common>
 #include <fog_pars_fragment>
 uniform float uTime,uSurfaceY,uIorRatio,uMirrorOpacity,uWindowOpacity;
 uniform vec3 uSunDirection,uSkyLightColor,uDeepMirrorColor,uCausticRimColor;
 varying vec3 vWaterWorld,vWaterNormal;
 float snellFresnel(float ci,float eta){if(abs(eta-1.0)<.000001)return 0.0;float st2=eta*eta*max(0.0,1.0-ci*ci);if(st2>=1.0)return 1.0;float ct=sqrt(max(0.0,1.0-st2));float a=(eta*ci-ct)/max(.000001,eta*ci+ct),b=(ci-eta*ct)/max(.000001,ci+eta*ct);return clamp(.5*(a*a+b*b),0.0,1.0);}
 float mirrorPattern(vec2 p){p*=.65;float a=sin(p.x*3.1+uTime*.9)+cos(p.y*2.7-uTime*1.1),b=sin((p.x+p.y)*4.2-uTime*1.4);return smoothstep(.4,1.8,abs(a+b*.5));}
 vec3 sky(vec3 direction){float sun=pow(max(dot(direction,uSunDirection),0.0),64.0);return uSkyLightColor*(.75+.4*max(direction.y,0.0)+1.8*sun);}
 void main(){vec3 V=normalize(cameraPosition-vWaterWorld),N=normalize(vWaterNormal);bool underwater=cameraPosition.y<uSurfaceY;if(underwater)N=-N;if(dot(V,N)<0.0)N=-N;float eta=underwater?uIorRatio:1.0/uIorRatio;float R=snellFresnel(clamp(dot(V,N),0.0,1.0),eta);vec3 reflected=reflect(-V,N),transmitted=refract(-V,N,eta);float pattern=mirrorPattern(vWaterWorld.xz+reflected.xz*2.5);vec3 deep=mix(uDeepMirrorColor,uCausticRimColor*.55,pattern*.45);vec3 transmission=underwater?sky(transmitted):deep;vec3 reflection=underwater?deep:sky(reflected);float rim=smoothstep(.55,.96,R)*(1.0-smoothstep(.96,1.0,R));vec3 H=V+uSunDirection;float spec=pow(max(dot(N,H/max(length(H),.000001)),0.0),48.0)*.35;vec3 color=mix(transmission,reflection,R)+uCausticRimColor*rim*1.35+vec3(spec);gl_FragColor=vec4(color,mix(uWindowOpacity,uMirrorOpacity,R));
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 #include <fog_fragment>
 }
 `;
    function createUnderwaterSurface(options = {}) {
        const width = finite('width', options.width ?? 25, .001, 1e6), depth = finite('depth', options.depth ?? 25, .001, 1e6), surfaceY = finite('surfaceY', options.surfaceY ?? 4.2), centerX = finite('centerX', options.centerX ?? 0), centerZ = finite('centerZ', options.centerZ ?? 0), segments = options.segments ?? 128;
        if (!Number.isInteger(segments) || segments < 2 || segments > 256)
            throw new Error('Surface segments must be integer 2..256');
        const reserve = finite('maxWaveHeight', options.maxWaveHeight ?? .2, 0, 2), wave = finite('waveHeight', options.waveHeight ?? Math.min(.045, reserve), 0, reserve), frequency = finite('waveFrequency', options.waveFrequency ?? 1.6, .05, 8), ior = finite('iorRatio', options.iorRatio ?? 1.333, 1, 2), mirror = finite('mirrorOpacity', options.mirrorOpacity ?? .92, 0, 1), window = finite('windowOpacity', options.windowOpacity ?? .38, 0, 1);
        const color = (name, value) => { if (!(value?.isColor || (Number.isInteger(value) && value >= 0 && value <= 0xffffff) || (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value))))
            throw new Error(`Invalid surface ${name}`); const c = new THREE.Color(value); if (!c.toArray().every(Number.isFinite))
            throw new Error(`Invalid surface ${name}`); return c; };
        const skyBase = color('skyLightColor', options.skyLightColor ?? 0xb8f6ff), deep = color('deepMirrorColor', options.deepMirrorColor ?? 0x05263b), rim = color('causticRimColor', options.causticRimColor ?? 0x4ee4e8);
        const ripples = Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, 0, 0)), records = Array.from({ length: MAX_RIPPLES }, () => ({ start: -Infinity, strength: 0 })), uniforms = { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 }, uSurfaceY: { value: surfaceY }, uWaveHeight: { value: wave }, uWaveFrequency: { value: frequency }, uRipples: { value: ripples }, uSunDirection: { value: new THREE.Vector3(.2, 1, .3).normalize() }, uSkyLightColor: { value: skyBase.clone() }, uDeepMirrorColor: { value: deep }, uCausticRimColor: { value: rim }, uIorRatio: { value: ior }, uMirrorOpacity: { value: mirror }, uWindowOpacity: { value: window } };
        const geometry = new THREE.PlaneGeometry(width, depth, segments, segments).rotateX(-Math.PI / 2), heightBound = reserve * (1.65 + MAX_RIPPLES * 2.2 * 2);
        geometry.boundingBox = new THREE.Box3(new THREE.Vector3(-width / 2, -heightBound, -depth / 2), new THREE.Vector3(width / 2, heightBound, depth / 2));
        geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.hypot(width / 2, depth / 2, heightBound));
        const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: true, toneMapped: true, forceSinglePass: true }), mesh = new THREE.Mesh(geometry, material);
        mesh.name = 'AquariumWaterSurface';
        mesh.matrixAutoUpdate = false;
        mesh.matrix.makeTranslation(centerX, surfaceY, centerZ);
        mesh.raycast = () => { };
        mesh.userData.excludeFromFocus = true;
        const world = new THREE.Matrix4().makeTranslation(centerX, surfaceY, centerZ), inverse = new THREE.Matrix4(), sunPosition = new THREE.Vector3(), targetPosition = new THREE.Vector3(), bindings = new Map();
        let disposed = false, elapsed = 0, cursor = 0;
        const stats = { activeRipples: 0, triggered: 0, recycled: 0, expired: 0 };
        const live = () => { if (disposed)
            throw new Error('Water surface is disposed'); };
        function syncParent() { if (mesh.parent) {
            mesh.parent.updateWorldMatrix(true, false);
            const determinant = mesh.parent.matrixWorld.determinant();
            if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12)
                throw new Error('Surface parent must be invertible');
            inverse.copy(mesh.parent.matrixWorld).invert();
            mesh.matrix.multiplyMatrices(inverse, world);
        }
        else
            mesh.matrix.copy(world); mesh.matrixWorldNeedsUpdate = true; }
        const api = { mesh, uniforms, stats, maxWaveHeight: reserve, width, depth, surfaceY, centerX, centerZ, get disposed() { return disposed; },
            get waveHeight() { return uniforms.uWaveHeight.value; }, get waveFrequency() { return uniforms.uWaveFrequency.value; }, get iorRatio() { return uniforms.uIorRatio.value; }, get mirrorOpacity() { return uniforms.uMirrorOpacity.value; },
            setWaveHeight(value) { live(); uniforms.uWaveHeight.value = finite('waveHeight', value, 0, reserve); }, setWaveFrequency(value) { live(); uniforms.uWaveFrequency.value = finite('waveFrequency', value, .05, 8); }, setIorRatio(value) { live(); uniforms.uIorRatio.value = finite('iorRatio', value, 1, 2); }, setMirrorOpacity(value) { live(); uniforms.uMirrorOpacity.value = finite('mirrorOpacity', value, 0, 1); },
            setSkyLightColor(value) { live(); skyBase.copy(color('skyLightColor', value)); uniforms.uSkyLightColor.value.copy(skyBase); },
            triggerRipple(x, z, strength = 1) { live(); finite('ripple X', x); finite('ripple Z', z); finite('ripple strength', strength, 0, 2); if (strength === 0 || x < centerX - width / 2 || x > centerX + width / 2 || z < centerZ - depth / 2 || z > centerZ + depth / 2)
                return false; const index = cursor++ % MAX_RIPPLES; if (records[index].strength > 0)
                stats.recycled++;
            else
                stats.activeRipples++; records[index].start = elapsed; records[index].strength = strength; ripples[index].set(x, z, 0, strength); stats.triggered++; return true; },
            clearRipples() { live(); for (let i = 0; i < MAX_RIPPLES; i++) {
                records[i].strength = 0;
                ripples[i].w = 0;
            } stats.activeRipples = 0; },
            bindFeeder(feeder) { live(); if (feeder?.disposed || !feeder?.onFoodSpawn || !Number.isFinite(feeder.waterSurfaceY) || Math.abs(feeder.waterSurfaceY - surfaceY) > 1e-6)
                throw new Error('Live feeder with matching world surface plane required'); for (const [source, binding] of bindings)
                if (source.disposed)
                    binding.dispose(); if (bindings.has(feeder))
                return bindings.get(feeder); if (bindings.size >= 16)
                throw new Error('Surface feeder binding cap is 16'); const detach = feeder.onFoodSpawn((event) => { if (!disposed)
                api.triggerRipple(event.x, event.z); }); let released = false; const binding = { dispose() { if (released)
                    return; released = true; detach(); bindings.delete(feeder); } }; bindings.set(feeder, binding); return binding; },
            update(time, sunLight) {
                live();
                finite('elapsedTime', time, elapsed);
                if (sunLight && (!sunLight.isDirectionalLight || !Number.isFinite(sunLight.intensity) || sunLight.intensity < 0))
                    throw new Error('Valid DirectionalLight required');
                syncParent();
                elapsed = time;
                uniforms.uTime.value = time % PERIOD;
                let active = 0;
                for (let i = 0; i < MAX_RIPPLES; i++) {
                    const record = records[i];
                    if (record.strength > 0) {
                        const age = time - record.start;
                        if (age >= 4.5) {
                            record.strength = 0;
                            ripples[i].w = 0;
                            stats.expired++;
                        }
                        else {
                            ripples[i].z = age;
                            active++;
                        }
                    }
                }
                stats.activeRipples = active;
                if (sunLight) {
                    sunLight.getWorldPosition(sunPosition);
                    sunLight.target.getWorldPosition(targetPosition);
                    sunPosition.sub(targetPosition);
                    if (!sunPosition.toArray().every(Number.isFinite) || sunPosition.lengthSq() < 1e-12)
                        throw new Error('Finite nonzero sun-target direction required');
                    uniforms.uSunDirection.value.copy(sunPosition).normalize();
                    uniforms.uSkyLightColor.value.copy(sunLight.color).multiplyScalar(THREE.MathUtils.clamp(sunLight.intensity / 2.8, .12, 1.2) * 1.15);
                }
                else
                    uniforms.uSkyLightColor.value.copy(skyBase);
            },
            dispose() { if (disposed)
                return; for (const binding of [...bindings.values()])
                binding.dispose(); disposed = true; mesh.removeFromParent(); geometry.dispose(); material.dispose(); stats.activeRipples = 0; } };
        return api;
    }
    return { createUnderwaterSurface, dielectricFresnel, MAX_RIPPLES };
}
const api=createUnderwaterSurfaceFactory(THREE);
export const createUnderwaterSurface=api.createUnderwaterSurface;
export const dielectricFresnel=api.dielectricFresnel;
export const MAX_RIPPLES=api.MAX_RIPPLES;
