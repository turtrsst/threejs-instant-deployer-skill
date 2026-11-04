#!/usr/bin/env node
import {parseArgs} from 'node:util';
import fs from 'node:fs/promises';
import {loadModule} from './build-support.mjs';
try {
 const {values:v}=parseArgs({options:{query:{type:'string'},input:{type:'string'},'asset-id':{type:'string'},provider:{type:'string'},animated:{type:'boolean'},'allow-non-cc0':{type:'boolean'},'target-height':{type:'string'},'target-size':{type:'string'},'output-dir':{type:'string'},mode:{type:'string'},resolution:{type:'string'},'max-mb':{type:'string'},'allow-over-budget':{type:'boolean'},'dry-run':{type:'boolean'},limit:{type:'string'},'visual-rank':{type:'boolean'},manifest:{type:'string'},help:{type:'boolean'}}});
 if(v.help){console.log('threejs-deploy-3d --query rock | --input local.glb [--target-height 1 | --target-size w,h,d] [--output-dir public/models] [--mode file|datauri] [--manifest manifest.json] [--dry-run] [--provider auto|all|polyhaven|sketchfab|objaverse|openpbr|objaverse-hf] [--animated] [--allow-non-cc0] [--max-mb 1] [--allow-over-budget]');process.exit(0);}
 if(v.provider&&!['auto','all','polyhaven','sketchfab','objaverse','openpbr','objaverse-hf'].includes(v.provider))throw new Error('Invalid provider');
 const target=v['target-size']?.split(',').map(Number);if(target&&target.length!==3)throw new Error('--target-size requires w,h,d');
 const {scoutAndProcess}=await loadModule('pipeline.js');
 const result=await scoutAndProcess({query:v.query,input:v.input,assetId:v['asset-id'],provider:v.provider,animated:v.animated,allowNonCC0:v['allow-non-cc0'],targetHeight:v['target-height']===undefined?undefined:Number(v['target-height']),targetSize:target,outputDir:v['output-dir'],mode:v.mode,resolution:v.resolution,maxMB:v['max-mb']===undefined?undefined:Number(v['max-mb']),allowOverBudget:v['allow-over-budget'],dryRun:v['dry-run'],limit:v.limit?Number(v.limit):undefined,visualRank:v['visual-rank']});
 const json=JSON.stringify(result,null,2);if(v.manifest)await fs.writeFile(v.manifest,json+'\n');process.stdout.write(json+'\n');
}catch(error){process.stderr.write(JSON.stringify({status:'error',message:error.message})+'\n');process.exitCode=1;}
