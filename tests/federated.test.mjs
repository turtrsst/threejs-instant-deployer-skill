import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {makeFixture} from '../scripts/generate-fixtures.mjs';
import {searchOpenPBR,searchObjaverseHF,searchSketchfab,requestHuggingFace,scoutAndProcess} from '../dist/index.js';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'federated-'));
const animatedPath=await makeFixture(path.join(dir,'animated.glb'),true);
const staticPath=await makeFixture(path.join(dir,'static.glb'),false);
const animatedGLB=await fs.readFile(animatedPath),staticGLB=await fs.readFile(staticPath);
const json=data=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
async function mockFetch(mock,run){const original=global.fetch;global.fetch=mock;try{return await run();}finally{global.fetch=original;}}
test('registry is relevant, has accurate mixed licenses, and animation is a strict filter',()=>{
 assert.equal(searchOpenPBR('fish')[0].id,'BarramundiFish');assert.equal(searchOpenPBR('spaceship').length,0);assert.equal(searchOpenPBR('fish',{animated:true}).length,0);assert.equal(searchOpenPBR('fox',{animated:true}).length,0);
 const fox=searchOpenPBR('fox',{animated:true,allowNonCC0:true})[0];assert.equal(fox.id,'Fox');assert.match(fox.license,/CC-BY-4.0/);assert.equal(fox.legal.length,3);assert.ok(searchOpenPBR('barn lamp',{allowNonCC0:true}).some(c=>c.id==='AnisotropyBarnLamp'));
 const dragon=searchOpenPBR('dragon',{allowNonCC0:true})[0];assert.match(dragon.license,/LicenseRef-Stanford/);
});
test('Sketchfab sends animated and CC0 filters and rejects false/stale metadata',async()=>{
 await mockFetch(async url=>{const u=new URL(url);assert.equal(u.searchParams.get('animated'),'true');assert.equal(u.searchParams.get('license'),'cc0');return json({results:[{uid:'a',name:'Fish',animationCount:1,license:{slug:'cc0'}},{uid:'b',name:'Fish',animationCount:0,license:{slug:'cc0'}},{uid:'c',name:'Fish',animationCount:2,license:{slug:'by'}},{uid:'d',name:'Fish',animationCount:2,isAgeRestricted:true,license:{slug:'cc0'}}]});},async()=>{const c=await searchSketchfab('fish','test-only',true);assert.deepEqual(c.map(x=>x.id),['a']);});
});
test('animated registry download validates actual binary clips and preserves attribution in manifest',async()=>{
 await mockFetch(async()=>new Response(animatedGLB),async()=>{
 const m=await scoutAndProcess({query:'fox',provider:'openpbr',animated:true,allowNonCC0:true,mode:'datauri',targetHeight:.15});assert.equal(m.selectedProvider,'openpbr');assert.equal(m.xray.hasAnimations,true);assert.equal(m.animations[0].channelsCount,1);assert.equal(m.matchedAssetId,'Fox');assert.equal(m.legal.length,3);assert.equal(m.savedPath,null);assert.ok(Math.abs(m.scaledDimensions[1]-.15)<1e-8);assert.ok(m.warnings.some(w=>w.includes('Non-CC0')));
 });
 await mockFetch(async()=>new Response(staticGLB),async()=>{await assert.rejects(scoutAndProcess({query:'fox',provider:'openpbr',animated:true,allowNonCC0:true,mode:'datauri'}),/no animation channels/);});
});
test('GLB validation rejects HTML or LFS pointer in a purported direct download',async()=>{
 await mockFetch(async()=>new Response('version https://git-lfs.github.com/spec/v1'),async()=>{await assert.rejects(scoutAndProcess({query:'fish',provider:'openpbr',mode:'datauri'}),/not a binary GLB/);});
});
test('download failure falls through to next relevant candidate, retaining warnings',async()=>{
 await mockFetch(async url=>String(url).includes('AnisotropyBarnLamp')?new Response('unavailable',{status:503}):new Response(staticGLB),async()=>{
 const m=await scoutAndProcess({query:'lamp',provider:'openpbr',allowNonCC0:true,mode:'datauri'});assert.equal(m.assetId,'IridescenceLamp');assert.ok(m.warnings.some(w=>w.includes('AnisotropyBarnLamp')));assert.ok(m.alternativeCandidates.length>0);
 });
});
test('auto static-property preference and animated exclusion are observable in dry-run',async()=>{
 const old=process.env.SKETCHFAB_TOKEN;delete process.env.SKETCHFAB_TOKEN;
 try{await mockFetch(async url=>{if(String(url).includes('polyhaven'))return json({rock:{name:'Stone Rock',tags:['rock','stone']}});return json([]);},async()=>{
 const m=await scoutAndProcess({query:'stone',dryRun:true,allowNonCC0:true});assert.equal(m.candidates[0].provider,'polyhaven');
 const animated=await scoutAndProcess({query:'fox',dryRun:true,animated:true,allowNonCC0:true});assert.equal(animated.candidates[0].provider,'openpbr');assert.ok(animated.candidates.every(c=>c.animated===true));
 });}finally{if(old!==undefined)process.env.SKETCHFAB_TOKEN=old;}
});
const repo='author/objaverse-fish',sha='abcdef0123456789';
function hfMock({noMetadata=false,license='cc0-1.0',animated=true,path='objects/fish.glb',size=1024}={}){
 return async url=>{
  const u=new URL(url);assert.equal(u.hostname,'huggingface.co');
  if(u.pathname==='/api/models')return json([]);
  if(u.pathname==='/api/datasets')return json([{id:repo}]);
  if(u.pathname===`/api/datasets/${repo}`)return json({sha,cardData:{license:'cc0-1.0'}});
  if(u.pathname.includes('/tree/'))return json([{path,type:'file',size},...(!noMetadata?[{path:'asset-metadata.json',type:'file',size:500}]:[])]);
  if(u.pathname.endsWith('asset-metadata.json'))return json({assets:[{path,name:'Tropical Fish',tags:['fish','aquatic'],license,animated,licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',source:'https://sketchfab.com/fish',attribution:'Test author'}]});
  if(u.pathname.endsWith('.glb'))return new Response(animatedGLB);
  throw new Error(`Unexpected URL: ${url}`);
 };
}
test('HF discovery uses datasets + models APIs, immutable revisions and per-asset provenance',async()=>{
 await mockFetch(hfMock(),async()=>{
 const candidates=await searchObjaverseHF('fish',{animated:true});assert.equal(candidates.length,1);assert.equal(candidates[0].provider,'objaverse-hf');assert.ok(candidates[0].glbUrl.includes(`/resolve/${sha}/`));
 const m=await scoutAndProcess({query:'fish',provider:'objaverse-hf',animated:true,outputDir:dir});assert.equal(m.selectedProvider,'objaverse-hf');assert.equal(m.revision,sha);assert.equal(m.license,'cc0-1.0');assert.ok(path.basename(m.savedPath).match(/_[a-f0-9]{10}\.glb$/));assert.equal(path.dirname(m.savedPath),dir);
 });
});
test('HF never infers object license from dataset card, rejects unsafe/large/unlicensed/static entries',async()=>{
 for(const fixture of [{noMetadata:true},{license:'unknown'},{license:'cc-by-4.0'},{path:'../fish.glb'},{size:36_000_000},{animated:false}])await mockFetch(hfMock(fixture),async()=>{assert.equal((await searchObjaverseHF('fish',{animated:true})).length,0);});
 await mockFetch(hfMock({license:'cc-by-4.0'}),async()=>assert.equal((await searchObjaverseHF('fish',{allowNonCC0:true})).length,1));
});
test('HF follows only bounded HTTPS CDN redirects and rejects offsite, local and downgrade targets',async()=>{
 for(const location of ['https://localhost/private','http://huggingface.co/plain','https://evil.test/file','https://user:pass@huggingface.co/file'])await mockFetch(async()=>new Response(null,{status:302,headers:{location}}),async()=>{await assert.rejects(requestHuggingFace('https://huggingface.co/repo/file'),/Unsafe/);});
 let calls=0;await mockFetch(async(url,opts)=>{calls++;assert.equal(opts.headers,undefined);return calls===1?new Response(null,{status:302,headers:{location:'https://cdn.hf.co/file'}}):new Response(animatedGLB);},async()=>{assert.ok((await requestHuggingFace('https://huggingface.co/repo/file')).ok);assert.equal(calls,2);});
});
test('local animated enforcement and invalid provider flags fail explicitly',async()=>{
 await assert.rejects(scoutAndProcess({input:staticPath,animated:true,mode:'datauri'}),/no animation channels/);await assert.rejects(scoutAndProcess({query:'fish',provider:'polyhaven',animated:true,assetId:'rock'}),/static/);await assert.rejects(scoutAndProcess({provider:'invented'}),/Invalid provider/);
});
