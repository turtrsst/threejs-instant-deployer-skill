import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {getBounds} from '@gltf-transform/core';
import {makeFixture} from '../scripts/generate-fixtures.mjs';
import {scoutAndProcess,createIO,keywordScore,injectThreeCode} from '../dist/index.js';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'threejs-skill-'));const input=path.join(dir,'fixture.glb');await makeFixture(input);
test('real GLB round-trip, computed contain scale, meshopt, X-Ray and bottom pivot',async()=>{
 const m=await scoutAndProcess({input,targetSize:[1,2,3],outputDir:dir});
 assert.equal(m.status,'success');assert.ok(Math.abs(m.recommendedScale-.5)<.002);assert.equal(m.animations[0].name,'Sway');assert.equal(m.materials[0].name,'Copper');assert.ok(m.budgetMet);
 const io=await createIO();const doc=await io.read(m.savedPath);const b=getBounds(doc.getRoot().getDefaultScene());assert.ok(Math.abs(b.min[1])<.002);assert.ok(Math.abs((b.min[0]+b.max[0])/2)<.002);assert.ok(doc.getRoot().listExtensionsUsed().some(e=>e.extensionName==='EXT_meshopt_compression'));
});
test('data URI mode is self contained and writes no asset',async()=>{const m=await scoutAndProcess({input,mode:'datauri',targetHeight:3});assert.equal(m.savedPath,null);assert.ok(m.dataUri.startsWith('data:model/gltf-binary;base64,Z2xURg'));assert.ok(Math.abs(m.scaledDimensions[1]-3)<.001);});
test('invalid bounds and hard byte budgets fail',async()=>{await assert.rejects(scoutAndProcess({input,targetHeight:-2}),/Target size/);await assert.rejects(scoutAndProcess({input,maxMB:.00001}),/exceeds budget/);});
test('search rejects irrelevant keywords',()=>{assert.equal(keywordScore('spaceship','rock',{name:'Weathered Rock',tags:['stone']}),0);assert.ok(keywordScore('weathered rocks','rock',{name:'Weathered Rock',tags:['stone']})>0);});
const source=`import * as THREE from 'three'; const scene=new THREE.Scene(); const renderer=new THREE.WebGLRenderer(); const rock=new THREE.Mesh(new THREE.BoxGeometry(2,4,6)); rock.position.y=2; scene.add(rock); function animate(){requestAnimationFrame(animate);renderer.render(scene,new THREE.PerspectiveCamera());} animate();`;
test('AST injection wires loop, preserves primitive transforms and adds loaders',()=>{const out=injectThreeCode(source,{target:'rock',manifest:{recommendedScale:.5},url:'/models/rock.glb'});assert.match(out,/__instantAssets.update\(\)/);assert.match(out,/__instantAssets.deploy\(rock/);assert.match(out,/room.dispose\(\)/);assert.match(out,/rock.position.y = 2/);assert.throws(()=>injectThreeCode(out,{target:'rock',manifest:{recommendedScale:1},url:'x'}),/already contains/);});
test('named Three imports and HTML importmap survive transformation',()=>{const html=`<!doctype html><html><head></head><body><script type="module">${source.replace("import * as THREE from 'three';", "import { Mesh as M, BoxGeometry as B } from 'three'; import * as THREE from 'three';").replace('new THREE.Mesh(new THREE.BoxGeometry','new M(new B')}</script></body></html>`;const out=injectThreeCode(html,{target:'rock',manifest:{recommendedScale:1,dataUri:'data:model/gltf-binary;base64,AA=='},html:true});assert.match(out,/type="importmap"/);assert.match(out,/three@0.180.0/);assert.match(out,/__instantAssets.deploy/);});
test('CLI stdout is parseable JSON without chatter',()=>{const stdout=execFileSync(process.execPath,['scripts/scout-and-process.mjs','--input',input,'--mode','datauri','--target-height','2'],{cwd:process.cwd(),encoding:'utf8'});assert.equal(JSON.parse(stdout).status,'success');});
test('PBR PNG textures become embedded WebP with the extension declared',async()=>{
 const sharp=(await import('sharp')).default;const io=await createIO();const doc=await io.read(input);const pixels=Buffer.from(Array.from({length:8*8*3},(_,i)=>(i*47)%256));const png=await sharp(pixels,{raw:{width:8,height:8,channels:3}}).png().toBuffer();
 const tex=doc.createTexture('Albedo').setImage(png).setMimeType('image/png');doc.getRoot().listMaterials()[0].setBaseColorTexture(tex);const textured=path.join(dir,'textured.glb');await io.write(textured,doc);
 const m=await scoutAndProcess({input:textured,outputDir:path.join(dir,'optimized')});const output=await io.read(m.savedPath);assert.equal(output.getRoot().listTextures()[0].getMimeType(),'image/webp');assert.ok(output.getRoot().listExtensionsUsed().some(e=>e.extensionName==='EXT_texture_webp'));
});
