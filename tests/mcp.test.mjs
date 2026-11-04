import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
test('MCP stdio initializes, lists tools and returns reviewable source',async()=>{
 const client=new Client({name:'offline-test',version:'1.0.0'});const transport=new StdioClientTransport({command:process.execPath,args:['scripts/mcp-server.mjs'],stderr:'pipe'});
 try{await client.connect(transport);const tools=await client.listTools();assert.deepEqual(tools.tools.map(t=>t.name).sort(),['inject_three_code','scout_and_process']);const result=await client.callTool({name:'inject_three_code',arguments:{source:`import * as THREE from 'three';const rock=new THREE.Mesh(new THREE.BoxGeometry(1,2,3));function animate(){}`,target:'rock',manifest:{recommendedScale:1},url:'/models/rock.glb'}});assert.equal(result.isError,undefined);assert.match(result.content[0].text,/__instantAssets.deploy/);
 const search=await client.callTool({name:'scout_and_process',arguments:{query:'fox',provider:'openpbr',animated:true,allowNonCC0:true,dryRun:true}});assert.equal(search.isError,undefined);const found=JSON.parse(search.content[0].text);assert.equal(found.candidates[0].id,'Fox');assert.equal(found.candidates[0].animated,true);
 const invalid=await client.callTool({name:'inject_three_code',arguments:{source:'const x=1;',target:'rock',manifest:{recommendedScale:1},url:'/a.glb'}});assert.equal(invalid.isError,true);
 }finally{await client.close();}
});
