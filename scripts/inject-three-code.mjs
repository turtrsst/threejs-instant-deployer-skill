#!/usr/bin/env node
import {parseArgs} from 'node:util';
import fs from 'node:fs/promises';
import {loadModule} from './build-support.mjs';
try{
 const {values:v}=parseArgs({options:{file:{type:'string'},target:{type:'string'},manifest:{type:'string'},url:{type:'string'},output:{type:'string'},renderer:{type:'string'},scene:{type:'string'},'three-version':{type:'string'},'bio-preset':{type:'string'},write:{type:'boolean'},help:{type:'boolean'}}});
 if(v.help){console.log('threejs-inject-3d --file scene.js --target rock --manifest manifest.json --url /models/rock.glb [--output scene.new.js | --write] [--bio-preset auto|none|fish_swim|aquatic_plant|soft_coral]');process.exit(0);}
 if(!v.file||!v.target||!v.manifest)throw new Error('--file, --target, --manifest required');
 for(const key of ['target','renderer','scene'])if(v[key]&&!/^[A-Za-z_$][\w$]*$/.test(v[key]))throw new Error(`Invalid ${key} identifier`);
 const {injectThreeCode}=await loadModule('codeDeployer/injectThreeCode.js');
 const source=await fs.readFile(v.file,'utf8');const manifest=JSON.parse(await fs.readFile(v.manifest,'utf8'));
 const output=injectThreeCode(source,{target:v.target,manifest,url:v.url,renderer:v.renderer,scene:v.scene,html:/\.html?$/i.test(v.file),threeVersion:v['three-version'],bioPreset:v['bio-preset']});
 if(v.write){await fs.copyFile(v.file,v.file+'.bak');await fs.writeFile(v.file,output);}
 else if(v.output)await fs.writeFile(v.output,output);else process.stdout.write(output);
}catch(error){console.error(JSON.stringify({status:'error',message:error.message}));process.exitCode=1;}
