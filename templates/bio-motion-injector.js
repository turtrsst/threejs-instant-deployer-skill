// Generated from mcp-server/codeDeployer/bioMotion.ts by npm run build. Do not edit by hand.
import * as THREE from 'three';
export function createBioMotionInjector(THREE) {
    const presets = {
        fish_swim: { mode: 1, speed: 6.5, frequency: 4.2, amplitude: 0.14, bodyRoll: 0.12, verticalBob: 0.025, headStiffness: 1.85 },
        aquatic_plant: { mode: 2, speed: 1.8, frequency: 2.5, amplitude: 0.18, flutterStrength: 0.035, stiffnessExponent: 1.6 },
        soft_coral: { mode: 3, speed: 2.2, frequency: 3, amplitude: 0.1, flutterStrength: 0.05, stiffnessExponent: 1.3 }
    };
    const pars = /* glsl */ `
 uniform float uBioTime, uBioPhase, uBioSpeed, uBioFreq, uBioAmp, uBioRoll, uBioBob, uBioStiffness;
 uniform int uBioMode, uSpineAxis;
 uniform float uSpineDir;
 uniform vec3 uBBoxMin, uBBoxSize;
 uniform mat4 uBioToRoot, uBioFromRoot;
 uniform mat3 uBioNormalToRoot, uBioNormalFromRoot;
 // Returns root-space position and exact analytic Jacobian, columns dF/dx,dF/dy,dF/dz.
 vec3 bioDeform(vec3 p, out mat3 J) {
  vec3 size=max(uBBoxSize,vec3(0.0001));
  vec3 q=clamp((p-uBBoxMin)/size,0.0,1.0);
  float t=uBioTime*uBioSpeed+uBioPhase;
  J=mat3(1.0);
  if(uBioMode==1){
   float lengthSpine=uSpineAxis==0?size.x:size.z;
   float raw=uSpineAxis==0?q.x:q.z;
   float s=uSpineDir>0.0?raw:1.0-raw;
   float ds=uSpineDir/lengthSpine;
   float k=uBioFreq*6.28318530718;
   float angle=s*k-t;
   float sn=sin(angle), cs=cos(angle);
   float env=0.04+0.96*pow(s,uBioStiffness);
   float dEnv=0.96*uBioStiffness*pow(s,uBioStiffness-1.0);
   float yc=p.y-(uBBoxMin.y+size.y*0.5);
   float offset=sn*uBioAmp*lengthSpine*env+cs*yc*uBioRoll*s;
   float slope=(uBioAmp*lengthSpine*(cs*k*env+sn*dEnv)+yc*uBioRoll*(cs-sn*k*s))*ds;
   float rollSlope=cs*uBioRoll*s;
   if(uSpineAxis==0){p.z+=offset;J[0].z+=slope;J[1].z+=rollSlope;}
   else{p.x+=offset;J[2].x+=slope;J[1].x+=rollSlope;}
   p.y+=sin(t*0.45+uBioPhase)*size.y*uBioBob;
  }else if(uBioMode==2){
   float h=pow(q.y,uBioStiffness);
   float dh=uBioStiffness*pow(q.y,uBioStiffness-1.0)/size.y;
   float a=t+q.y*uBioFreq*3.0, b=t*0.75+q.y*uBioFreq*2.4;
   float sx=sin(a)*uBioAmp*size.y, sz=cos(b)*uBioAmp*size.y*0.7;
   float dx=cos(a)*uBioAmp*uBioFreq*3.0, dz=-sin(b)*uBioAmp*0.7*uBioFreq*2.4;
   vec3 v=q*4.0;float nt=t*1.8;
   float nx=v.x*2.1+nt,nz=v.z*1.9+nt*0.8,ny=v.y*3.7-nt*1.4;
   float flutter=(sin(nx)*cos(nz)*0.5+sin(ny)*0.25)*size.y*uBioRoll;
   vec3 grad=vec3(4.2*cos(nx)*cos(nz),3.7*cos(ny),-3.8*sin(nx)*sin(nz))/size*size.y*uBioRoll;
   p.x+=(sx+flutter)*h;p.z+=(sz+flutter)*h;p.y-=abs(sx)*0.12*h;
   J[0].x+=grad.x*h;J[2].x+=grad.z*h;J[1].x+=(dx+grad.y)*h+(sx+flutter)*dh;
   J[0].z+=grad.x*h;J[2].z+=grad.z*h;J[1].z+=(dz+grad.y)*h+(sz+flutter)*dh;
   J[1].y-=0.12*(sign(sx)*dx*h+abs(sx)*dh);
  }else if(uBioMode==3){
   float h=pow(q.y,uBioStiffness);
   float dh=uBioStiffness*pow(q.y,uBioStiffness-1.0)/size.y;
   float a=t-q.y*uBioFreq*3.14159265359;
   float pulse=sin(a)*uBioAmp*h;
   float dp=uBioAmp*(-cos(a)*uBioFreq*3.14159265359/size.y*h+sin(a)*dh);
   vec2 radial=p.xz-(uBBoxMin.xz+size.xz*0.5);
   p.xz+=radial*pulse;p.y+=cos(t)*size.y*0.04*h;
   J[0].x+=pulse;J[2].z+=pulse;J[1].x+=radial.x*dp;J[1].z+=radial.y*dp;J[1].y+=cos(t)*size.y*0.04*dh;
  }
  return p;
 }
 vec3 bioNormal(vec3 n,mat3 J){
  vec3 a=cross(J[1],J[2]), b=cross(J[2],J[0]), c=cross(J[0],J[1]);
  float det=dot(J[0],a);
  if(abs(det)<0.000001)return n;
  return normalize(mat3(a,b,c)*n/det);
 }
 `;
    const position = /* glsl */ `
 mat3 bioPositionJ;
 vec3 bioRootPosition=(uBioToRoot*vec4(transformed,1.0)).xyz;
 transformed=(uBioFromRoot*vec4(bioDeform(bioRootPosition,bioPositionJ),1.0)).xyz;
 `;
    const normal = /* glsl */ `
 mat3 bioNormalJ;
 vec3 bioUnused=bioDeform((uBioToRoot*vec4(position,1.0)).xyz,bioNormalJ);
 objectNormal=normalize(uBioNormalFromRoot*bioNormal(uBioNormalToRoot*objectNormal,bioNormalJ));
 #ifdef USE_TANGENT
  objectTangent=normalize(mat3(uBioFromRoot)*bioNormalJ*mat3(uBioToRoot)*objectTangent);
 #endif
 `;
    function inferPresetFromName(name) {
        const value = String(name).toLowerCase();
        if (/\b(rock|stone|lamp|lantern|statue|sculpture|furniture|driftwood)\b/.test(value))
            return null;
        if (/fish|shark|koi|betta|whale|dolphin|eel|barramundi|salmon|tuna/.test(value))
            return 'fish_swim';
        if (/coral|anemone|jellyfish|sponge/.test(value))
            return 'soft_coral';
        if (/plant|kelp|anubias|vallisneria|seaweed|seagrass|moss|grass|tree|fern/.test(value))
            return 'aquatic_plant';
        return null;
    }
    function injectBioMotion(root, options = {}) {
        if (root.userData.bioMotion)
            throw new Error('Bio-motion already attached; dispose it before reinjection');
        const presetName = options.preset || inferPresetFromName(root.name || '');
        if (!presetName || !presets[presetName])
            throw new Error('Choose fish_swim, aquatic_plant, or soft_coral; unknown/inanimate names are not animated');
        const config = { ...presets[presetName], ...options, mode: presets[presetName].mode };
        const roll = config.bodyRoll ?? config.flutterStrength ?? 0.05;
        const stiffness = config.headStiffness ?? config.stiffnessExponent ?? 1.7;
        for (const [name, value] of Object.entries({ speed: config.speed, frequency: config.frequency, amplitude: config.amplitude, roll, bob: config.verticalBob ?? 0, stiffness }))
            if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
                throw new Error(`Invalid bio-motion ${name}`);
        const amplitudeLimit = options.maxAmplitude ?? Infinity;
        if (options.maxAmplitude !== undefined && (!Number.isFinite(amplitudeLimit) || amplitudeLimit < config.amplitude))
            throw new Error('maxAmplitude must be finite and >= initial amplitude');
        if (stiffness <= 1)
            throw new Error('Bio-motion stiffness must be > 1 for stable root derivatives');
        if (options.spineAxis !== undefined && ![0, 2].includes(options.spineAxis))
            throw new Error('spineAxis must be 0 (X) or 2 (Z)');
        if (options.spineDirection !== undefined && ![1, -1].includes(options.spineDirection))
            throw new Error('spineDirection must be 1 or -1; head direction cannot be inferred from bounds');
        if (options.phaseOffset !== undefined && !Number.isFinite(options.phaseOffset))
            throw new Error('phaseOffset must be finite');
        root.updateWorldMatrix(true, true);
        const inverseRoot = root.matrixWorld.clone().invert();
        const bounds = new THREE.Box3();
        const entries = [];
        const warnings = [];
        root.traverse((mesh) => {
            if (!mesh.isMesh || !mesh.geometry)
                return;
            if (mesh.isSkinnedMesh || mesh.isInstancedMesh || mesh.isBatchedMesh || Object.keys(mesh.geometry.morphAttributes).length) {
                warnings.push(`Skipped ${mesh.name || 'mesh'}: skin/instance/batch/morph geometry requires a dedicated deformation path`);
                return;
            }
            const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            if (!source.length || source.some((m) => !m || m.isShaderMaterial || m.isRawShaderMaterial)) {
                warnings.push(`Skipped ${mesh.name || 'mesh'}: unsupported material`);
                return;
            }
            mesh.geometry.computeBoundingBox();
            const box = mesh.geometry.boundingBox;
            if (!box || box.isEmpty())
                return;
            const toRoot = new THREE.Matrix4().multiplyMatrices(inverseRoot, mesh.matrixWorld);
            if (Math.abs(toRoot.determinant()) < 1e-12) {
                warnings.push('Skipped singular mesh transform');
                return;
            }
            bounds.union(box.clone().applyMatrix4(toRoot));
            entries.push({ mesh, source, toRoot });
        });
        if (!entries.length || bounds.isEmpty())
            throw new Error('No supported static geometry for bio-motion');
        const size = bounds.getSize(new THREE.Vector3());
        if (![...size.toArray(), ...bounds.min.toArray()].every(Number.isFinite))
            throw new Error('Bio-motion bounds must be finite');
        const time = { value: 0 }, speed = { value: config.speed };
        const shared = { uBioTime: time, uBioPhase: { value: options.phaseOffset ?? Math.random() * Math.PI * 2 }, uBioMode: { value: config.mode }, uSpineAxis: { value: options.spineAxis ?? (size.x > size.z ? 0 : 2) }, uSpineDir: { value: options.spineDirection ?? 1 }, uBBoxMin: { value: bounds.min.clone() }, uBBoxSize: { value: size.clone() }, uBioSpeed: speed, uBioFreq: { value: config.frequency }, uBioAmp: { value: config.amplitude }, uBioRoll: { value: roll }, uBioBob: { value: config.verticalBob ?? 0 }, uBioStiffness: { value: stiffness } };
        function patch(material, uniforms, normals) {
            const previous = material.onBeforeCompile;
            const previousKey = material.customProgramCacheKey.call(material);
            material.customProgramCacheKey = () => `${previousKey}|bio-motion-v1:${presetName}:${normals ? 'surface' : 'shadow'}`;
            material.onBeforeCompile = function (shader, renderer) {
                previous.call(this, shader, renderer);
                for (const chunk of ['#include <common>', '#include <project_vertex>', ...(normals ? ['#include <defaultnormal_vertex>'] : [])])
                    if (!shader.vertexShader.includes(chunk))
                        throw new Error(`Bio-motion: unsupported shader chunks (${chunk}); WebGLRenderer r180 expected`);
                Object.assign(shader.uniforms, uniforms);
                shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${pars}`).replace('#include <project_vertex>', `${position}\n#include <project_vertex>`);
                if (normals)
                    shader.vertexShader = shader.vertexShader.replace('#include <defaultnormal_vertex>', `${normal}\n#include <defaultnormal_vertex>`);
            };
            material.needsUpdate = true;
        }
        const originals = [];
        for (const { mesh, source, toRoot } of entries) {
            const fromRoot = toRoot.clone().invert();
            const uniforms = { ...shared, uBioToRoot: { value: toRoot }, uBioFromRoot: { value: fromRoot }, uBioNormalToRoot: { value: new THREE.Matrix3().getNormalMatrix(toRoot) }, uBioNormalFromRoot: { value: new THREE.Matrix3().getNormalMatrix(fromRoot) } };
            const materials = source.map((m) => {
                const clone = m.clone();
                // Material.clone does not copy onBeforeCompile/custom cache hooks in Three.js.
                clone.onBeforeCompile = m.onBeforeCompile;
                clone.customProgramCacheKey = m.customProgramCacheKey;
                patch(clone, uniforms, !m.isMeshBasicMaterial);
                return clone;
            });
            const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
            const distance = new THREE.MeshDistanceMaterial();
            // WebGLShadowMap mirrors map/alpha/displacement from each source group per draw.
            for (const shadow of [depth, distance])
                patch(shadow, uniforms, false);
            originals.push({ mesh, material: mesh.material, depth: mesh.customDepthMaterial, distance: mesh.customDistanceMaterial, frustumCulled: mesh.frustumCulled, materials, ownedDepth: depth, ownedDistance: distance });
            mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
            mesh.customDepthMaterial = depth;
            mesh.customDistanceMaterial = distance;
            mesh.frustumCulled = false; // GPU displacement is not reflected in CPU culling bounds.
        }
        let disposed = false;
        const controller = { get disposed() { return disposed; }, amplitudeLimit, preset: presetName, timeUniform: time, uniforms: shared, warnings, bounds: bounds.clone(),
            update(elapsed) { if (!Number.isFinite(elapsed) || elapsed < 0)
                throw new Error('Bio-motion elapsed time must be finite and nonnegative'); if (!disposed)
                time.value = elapsed; },
            setSpeed(value) { if (!Number.isFinite(value) || value < 0)
                throw new Error('Bio-motion speed must be finite and nonnegative'); if (!disposed)
                speed.value = value; },
            setAmplitude(value) { if (!Number.isFinite(value) || value < 0 || value > amplitudeLimit)
                throw new Error('Bio-motion amplitude exceeds finite nonnegative reserved range'); if (!disposed)
                shared.uBioAmp.value = value; },
            setFrequency(value) { if (!Number.isFinite(value) || value < 0)
                throw new Error('Bio-motion frequency must be finite and nonnegative'); if (!disposed)
                shared.uBioFreq.value = value; },
            dispose() { if (disposed)
                return; disposed = true; for (const record of originals) {
                record.mesh.material = record.material;
                record.mesh.customDepthMaterial = record.depth;
                record.mesh.customDistanceMaterial = record.distance;
                record.mesh.frustumCulled = record.frustumCulled;
                for (const m of record.materials)
                    m.dispose();
                record.ownedDepth.dispose();
                record.ownedDistance.dispose();
            } if (root.userData.bioMotion === controller)
                delete root.userData.bioMotion; } };
        root.userData.bioMotion = controller;
        return controller;
    }
    return { injectBioMotion, BIO_MOTION_PRESETS: presets, inferPresetFromName };
}
const api = createBioMotionInjector(THREE);
export const BIO_MOTION_PRESETS = api.BIO_MOTION_PRESETS;
export const injectBioMotion = api.injectBioMotion;
export const inferPresetFromName = api.inferPresetFromName;
