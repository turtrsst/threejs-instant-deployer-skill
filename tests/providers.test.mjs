import {test} from 'node:test';
import assert from 'node:assert/strict';
import {searchPolyHaven,downloadPolyHaven,searchSketchfab,downloadSketchfab,visualRank,scoutAndProcess} from '../dist/index.js';
const json=data=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
test('provider contract: CC0, relevant matching, bundled includes and unsafe paths',async()=>{
 const original=global.fetch;const urls=[];
 try{global.fetch=async(url,opts)=>{urls.push(String(url));if(String(url).includes('/assets?'))return json({rock:{name:'Weathered Rock',categories:['nature'],tags:['stone']},chair:{name:'Chair'}});if(String(url).includes('/files/'))return json({gltf:{'1k':{gltf:{url:'https://cdn.test/model.gltf',include:{'textures/base.png':{url:'https://cdn.test/base.png'}}}}}});if(String(url).endsWith('model.gltf'))return json({asset:{version:'2.0'}});return new Response(new Uint8Array([1,2,3]));};
  const results=await searchPolyHaven('rock');assert.equal(results.length,1);assert.equal(results[0].license,'CC0');const file=await downloadPolyHaven('rock');assert.deepEqual([...file.resources['textures/base.png']],[1,2,3]);assert.equal(file.json.asset.version,'2.0');
  global.fetch=async()=>json({gltf:{'1k':{gltf:{url:'https://cdn.test/model.gltf',include:{'../evil':{url:'https://cdn.test/evil'}}}}}});await assert.rejects(downloadPolyHaven('rock'),/Unsafe resource/);
 }finally{global.fetch=original;}
});
test('Sketchfab uses filters and rejects non-CC0 direct IDs',async()=>{
 const original=global.fetch;const old=process.env.SKETCHFAB_TOKEN;process.env.SKETCHFAB_TOKEN='test-only';
 try{global.fetch=async(url,opts)=>{assert.equal(opts.headers.Authorization,'Token test-only');if(String(url).includes('/search')){const u=new URL(url);assert.equal(u.searchParams.get('license'),'cc0');assert.equal(u.searchParams.get('downloadable'),'true');return json({results:[{uid:'a',name:'Rock',license:{slug:'cc0'},tags:[],viewerUrl:'https://sketchfab.com/a'},{uid:'b',name:'Rock',license:{slug:'by'}}]});}return json({license:{slug:'by'}});};
 assert.equal((await searchSketchfab('rock')).length,1);await assert.rejects(downloadSketchfab('bad'),/not CC0/);
 }finally{global.fetch=original;if(old===undefined)delete process.env.SKETCHFAB_TOKEN;else process.env.SKETCHFAB_TOKEN=old;}
});
test('visual ranking validates IDs, provider failures are surfaced, zero relevance never downloads',async()=>{
 const original=global.fetch;const old={...process.env};
 try{process.env.VISION_API_URL='https://vision.test/chat';process.env.VISION_API_KEY='test-only';process.env.VISION_MODEL='test';global.fetch=async()=>json({choices:[{message:{content:'{"ids":["invented"]}'}}]});await assert.rejects(visualRank('rock',[{id:'rock',name:'Rock',provider:'polyhaven',score:1,source:'x',license:'CC0'}]),/Invalid vision/);
 delete process.env.SKETCHFAB_TOKEN;global.fetch=async()=>json({chair:{name:'Chair',tags:['furniture']}});await assert.rejects(scoutAndProcess({query:'spaceship'}),/No relevant/);
 global.fetch=async()=>{throw new Error('Network unavailable');};const result=await scoutAndProcess({dryRun:true});assert.equal(result.candidates.length,0);assert.ok(result.warnings.some(w=>w.includes('Network unavailable')));
 }finally{global.fetch=original;for(const k of ['VISION_API_URL','VISION_API_KEY','VISION_MODEL','SKETCHFAB_TOKEN'])if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}
});
