import fs from 'node:fs/promises';
import {createInstancedBoidsAquariumManager} from '../dist/codeDeployer/instancedBoidsManager.js';
import {createUnderwaterFX} from '../dist/codeDeployer/underwaterFx.js';
import {createBoidsAquariumManager} from '../dist/codeDeployer/boidsManager.js';
import {createBioMotionInjector} from '../dist/codeDeployer/bioMotion.js';
const source=`// Generated from mcp-server/codeDeployer/bioMotion.ts by npm run build. Do not edit by hand.\nimport * as THREE from 'three';\nexport ${createBioMotionInjector.toString()}\nconst api = createBioMotionInjector(THREE);\nexport const BIO_MOTION_PRESETS = api.BIO_MOTION_PRESETS;\nexport const injectBioMotion = api.injectBioMotion;\nexport const inferPresetFromName = api.inferPresetFromName;\n`;
await fs.mkdir(new URL('../templates/',import.meta.url),{recursive:true});await fs.writeFile(new URL('../templates/bio-motion-injector.js',import.meta.url),source);

await fs.writeFile(new URL('../templates/boids-manager.js',import.meta.url),`// Generated from mcp-server/codeDeployer/boidsManager.ts by npm run build.\nimport * as THREE from 'three';\nexport ${createBoidsAquariumManager.toString()}\nexport const BoidsAquariumManager = createBoidsAquariumManager(THREE);\n`);

await fs.writeFile(new URL('../templates/underwater-fx.js',import.meta.url),`// Generated from mcp-server/codeDeployer/underwaterFx.ts by npm run build.\nimport * as THREE from 'three';\nexport ${createUnderwaterFX.toString()}\nconst fx = createUnderwaterFX(THREE);\nexport const injectWaterCaustics = fx.injectWaterCaustics;\nexport const InteractiveBubbleSystem = fx.InteractiveBubbleSystem;\n`);

await fs.writeFile(new URL('../templates/instanced-boids-manager.js',import.meta.url),`// Generated from mcp-server/codeDeployer/instancedBoidsManager.ts by npm run build.\nimport * as THREE from 'three';\nimport {createBioMotionInjector} from './bio-motion-injector.js';\nimport {createBoidsAquariumManager} from './boids-manager.js';\nexport ${createInstancedBoidsAquariumManager.toString()}\nexport const InstancedBoidsAquariumManager = createInstancedBoidsAquariumManager(THREE,createBioMotionInjector,createBoidsAquariumManager);\n`);

const {createAquariumPostProcessingFactory}=await import('../dist/codeDeployer/underwaterPostprocessing.js');
await fs.writeFile(new URL('../templates/underwater-postprocessing.js',import.meta.url),`// Generated from mcp-server/codeDeployer/underwaterPostprocessing.ts by npm run build.\nimport * as THREE from 'three';\n${['EffectComposer','RenderPass','UnrealBloomPass','BokehPass','ShaderPass','OutputPass'].map(name=>`import {${name}} from 'three/addons/postprocessing/${name}.js';`).join('\n')}\nexport ${createAquariumPostProcessingFactory.toString()}\nconst api=createAquariumPostProcessingFactory(THREE,{EffectComposer,RenderPass,UnrealBloomPass,BokehPass,ShaderPass,OutputPass});\nexport const createAquariumPostProcessing=api.createAquariumPostProcessing;\nexport const UnderwaterLensShader=api.UnderwaterLensShader;\n`);

const {createAquariumDirectorFactory}=await import('../dist/codeDeployer/aquariumDirectorGui.js');
await fs.writeFile(new URL('../templates/aquarium-director-gui.js',import.meta.url),`// Generated from mcp-server/codeDeployer/aquariumDirectorGui.ts by npm run build.\nimport * as THREE from 'three';\nimport GUI from 'three/addons/libs/lil-gui.module.min.js';\nexport ${createAquariumDirectorFactory.toString()}\nconst api=createAquariumDirectorFactory(THREE,GUI);\nexport const createAquariumDirectorGUI=api.createAquariumDirectorGUI;\nexport const ATMOSPHERE_PRESETS=api.ATMOSPHERE_PRESETS;\n`);

const {createUnderwaterAudioSynthesizer}=await import('../dist/codeDeployer/underwaterAudio.js');
await fs.writeFile(new URL('../templates/underwater-audio-synth.js',import.meta.url),`// Generated from mcp-server/codeDeployer/underwaterAudio.ts by npm run build.\nexport ${createUnderwaterAudioSynthesizer.toString()}\nconst api=createUnderwaterAudioSynthesizer();\nexport const UnderwaterAudioSynthesizer=api.UnderwaterAudioSynthesizer;\nexport const minnaertFrequency=api.minnaertFrequency;\nexport const bindUnderwaterAudioCanvas=api.bindUnderwaterAudioCanvas;\n`);

const {createInteractiveFishFeeder}=await import('../dist/codeDeployer/interactiveFeeder.js');
await fs.writeFile(new URL('../templates/interactive-feeder.js',import.meta.url),`// Generated from mcp-server/codeDeployer/interactiveFeeder.ts by npm run build.\nimport * as THREE from 'three';\nexport ${createInteractiveFishFeeder.toString()}\nexport const InteractiveFishFeeder=createInteractiveFishFeeder(THREE);\n`);

const {createDayNightAquariumCycle}=await import('../dist/codeDeployer/dayNightCycle.js');
await fs.writeFile(new URL('../templates/day-night-cycle.js',import.meta.url),`// Generated from mcp-server/codeDeployer/dayNightCycle.ts by npm run build.\nimport * as THREE from 'three';\nexport ${createDayNightAquariumCycle.toString()}\nexport const DayNightAquariumCycle=createDayNightAquariumCycle(THREE);\n`);

const {createCinematicCameraDirector}=await import('../dist/codeDeployer/cinematicCameraDirector.js');
await fs.writeFile(new URL('../templates/cinematic-camera-director.js',import.meta.url),`// Generated from mcp-server/codeDeployer/cinematicCameraDirector.ts by npm run build.\nimport * as THREE from 'three';\nexport ${createCinematicCameraDirector.toString()}\nconst api=createCinematicCameraDirector(THREE);\nexport const CinematicCameraDirector=api.CinematicCameraDirector;\nexport const CAMERA_MODES=api.CAMERA_MODES;\n`);

const {createUnderwaterSurfaceFactory}=await import('../dist/codeDeployer/underwaterSurface.js');
await fs.writeFile(new URL('../templates/underwater-surface.js',import.meta.url),`// Generated from mcp-server/codeDeployer/underwaterSurface.ts by npm run build.\nimport * as THREE from 'three';\nexport ${createUnderwaterSurfaceFactory.toString()}\nconst api=createUnderwaterSurfaceFactory(THREE);\nexport const createUnderwaterSurface=api.createUnderwaterSurface;\nexport const dielectricFresnel=api.dielectricFresnel;\nexport const MAX_RIPPLES=api.MAX_RIPPLES;\n`);
