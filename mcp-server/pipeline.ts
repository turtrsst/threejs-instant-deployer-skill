import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {Logger,type Document} from '@gltf-transform/core';
import {searchPolyHaven,downloadPolyHaven,bytes,type Candidate} from './searchProviders/polyhaven.js';
import {searchSketchfab,downloadSketchfab} from './searchProviders/sketchfabCC0.js';
import {searchOpenPBR,isCC0} from './searchProviders/openPbr.js';
import {searchObjaverseHF} from './searchProviders/objaverseHF.js';
import {visualRank} from './searchProviders/visualRanker.js';
import {createIO,optimizeWeb} from './glbSurgeon/optimizeWeb.js';
import {dimensions,normalizeBBox} from './glbSurgeon/normalizeBBox.js';
import {inferBioMotionPreset} from './codeDeployer/bioMotion.js';
import {assertXRayManifest} from './glbSurgeon/manifestSchema.js';
import {xrayIntrospect} from './glbSurgeon/xrayIntrospect.js';
export type ProviderRouting = 'auto'|'all'|'polyhaven'|'sketchfab'|'objaverse'|'openpbr'|'objaverse-hf';
export interface ScoutOptions {
 query?:string; input?:string; assetId?:string; provider?:ProviderRouting;
 animated?:boolean; allowNonCC0?:boolean;
 targetHeight?:number; targetSize?:[number,number,number]; outputDir?:string;
 mode?:'file'|'datauri'; maxMB?:number; allowOverBudget?:boolean;
 dryRun?:boolean; limit?:number; visualRank?:boolean; resolution?:string;
}
export async function scoutAndProcess(options:ScoutOptions) {
 const warnings:string[]=[];
 const query=(options.query||'rock').trim();
 const provider=options.provider||'auto';
 const auto=provider==='auto'||provider==='all';
 if(!['auto','all','polyhaven','sketchfab','objaverse','openpbr','objaverse-hf'].includes(provider))throw new Error('Invalid provider');
 if(!query)throw new Error('Query must not be empty');
 if(options.mode&&!['file','datauri'].includes(options.mode))throw new Error('mode must be file or datauri');
 if(options.maxMB!==undefined&&(!Number.isFinite(options.maxMB)||options.maxMB<=0))throw new Error('maxMB must be positive');
 const targetSize=options.targetSize||[0,options.targetHeight??1,0];
 if(targetSize.length!==3||targetSize.some(v=>!Number.isFinite(v)||v<0)||targetSize.every(v=>v===0))throw new Error('Target size must contain positive finite dimensions (0 means unconstrained)');
 if(options.limit!==undefined&&(!Number.isInteger(options.limit)||options.limit<1||options.limit>100))throw new Error('limit must be an integer between 1 and 100');
 let candidates:Candidate[]=[];
 const searchOptions={animated:options.animated,allowNonCC0:options.allowNonCC0};
 if(!options.input){
  if(options.assetId){
   if(auto||provider==='objaverse'||provider==='objaverse-hf')throw new Error('--asset-id requires explicit polyhaven, sketchfab or openpbr provider; HF assets must be discovered with per-asset license metadata');
   if(!/^[a-zA-Z0-9_-]+$/.test(options.assetId))throw new Error('Invalid asset id');
   if(provider==='openpbr'){
    candidates=searchOpenPBR(options.assetId,searchOptions).filter(c=>c.id===options.assetId);
    if(!candidates.length)throw new Error('Unknown, non-CC0, or non-animated registry ID; review --allow-non-cc0 if applicable');
   }else{
    if(provider==='polyhaven'&&options.animated)throw new Error('Poly Haven contains static models; cannot satisfy --animated');
    candidates=[{id:options.assetId,name:options.assetId,provider,score:1,source:provider==='sketchfab'?`https://sketchfab.com/3d-models/${options.assetId}`:`https://polyhaven.com/a/${options.assetId}`,license:'CC0',canDirectDownload:true}];
   }
  }else{
   const jobs:{name:string;run:()=>Promise<Candidate[]>}[]=[];
   if((auto||provider==='polyhaven')&&!options.animated)jobs.push({name:'polyhaven',run:()=>searchPolyHaven(query)});
   if(provider==='polyhaven'&&options.animated)warnings.push('Poly Haven contains static models; excluded by --animated');
   if(auto||provider==='sketchfab'){
    if(!process.env.SKETCHFAB_TOKEN)warnings.push('Sketchfab skipped: SKETCHFAB_TOKEN required for direct download');
    jobs.push({name:'sketchfab',run:()=>searchSketchfab(query,process.env.SKETCHFAB_TOKEN,options.animated)});
   }
   if(auto||provider==='objaverse'||provider==='openpbr')jobs.push({name:'openpbr',run:async()=>searchOpenPBR(query,searchOptions)});
   if(auto||provider==='objaverse'||provider==='objaverse-hf')jobs.push({name:'objaverse-hf',run:()=>searchObjaverseHF(query,{...searchOptions,warnings})});
   const results=await Promise.allSettled(jobs.map(j=>j.run()));
   results.forEach((result,i)=>{if(result.status==='fulfilled')candidates.push(...result.value);else warnings.push(`${jobs[i]!.name}: ${String(result.reason)}`);});
   // Common lexical score across providers; a small static-property preference, never an irrelevant base score.
   const staticProperty=/\b(rock|stone|mossy|wood|driftwood|plant|furniture)\b/i.test(query);
   if(auto&&staticProperty)for(const c of candidates)if(c.provider==='polyhaven')c.score+=0.5;
   candidates=candidates.filter(c=>c.score>0&&c.canDirectDownload!==false&&(!options.animated||c.animated===true));
   candidates.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
   if(options.visualRank)try{candidates=await visualRank(query,candidates);}catch(e){warnings.push(`Visual rank fallback: ${String(e)}`);}
  }
  if(options.dryRun)return {status:'search',query,routing:provider,requireAnimated:!!options.animated,candidates:candidates.slice(0,options.limit||10),warnings};
  if(!candidates.length)throw new Error(`No relevant ${options.animated?'animated ':''}${options.allowNonCC0?'licensed':'CC0'} model found for ${query}. ${warnings.join('; ')}${options.animated&&!options.allowNonCC0?' Registry Fox requires --allow-non-cc0 because its rig/animation is CC-BY-4.0.':''}`);
 }else if(options.dryRun)throw new Error('--dry-run is search-only; do not combine it with --input');
 const io=await createIO();
 async function processDocument(document:Document){
  document.setLogger(new Logger(Logger.Verbosity.SILENT));
  if(options.animated&&!document.getRoot().listAnimations().some(a=>a.listChannels().length>0))throw new Error('Downloaded asset contains no animation channels; --animated cannot be satisfied');
  const originalDimensions=dimensions(document);
  await optimizeWeb(document);
  if(options.animated&&!document.getRoot().listAnimations().some(a=>a.listChannels().length>0))throw new Error('No animation channels remain after optimization');
  const bounds=await normalizeBBox(document,targetSize as [number,number,number]);
  const binary=await io.writeBinary(document);
  const budgetMet=binary.length<=(options.maxMB??1)*1024*1024;
  if(!budgetMet&&!options.allowOverBudget)throw new Error(`Optimized asset ${(binary.length/1024/1024).toFixed(2)} MiB exceeds budget ${options.maxMB??1} MiB; use --allow-over-budget or increase --max-mb`);
  return {document,originalDimensions,bounds,binary,budgetMet};
 }
 let selected:Candidate|undefined;
 let processed:Awaited<ReturnType<typeof processDocument>>|undefined;
 if(options.input)processed=await processDocument(await io.read(path.resolve(options.input)));
 else{
  for(const candidate of candidates.slice(0,5)){
   try{
    let document:Document;
    if(candidate.provider==='polyhaven')document=await io.readJSON(await downloadPolyHaven(candidate.id,options.resolution));
    else if(candidate.provider==='sketchfab')document=await io.readBinary(await downloadSketchfab(candidate.id));
    else{
     if(!candidate.glbUrl)throw new Error('Provider returned no direct GLB URL');
     const binary=await bytes(candidate.glbUrl,candidate.provider==='objaverse-hf');
     if(binary.length<12||new DataView(binary.buffer,binary.byteOffset,12).getUint32(0,true)!==0x46546c67)throw new Error('Download is not a binary GLB (HTML, archive, or LFS pointer rejected)');
     document=await io.readBinary(binary);
    }
    processed=await processDocument(document);selected=candidate;break;
   }catch(e){warnings.push(`${candidate.provider}/${candidate.id}: ${String(e)}`);}
  }
 }
 if(!processed)throw new Error(`No candidate could be downloaded and processed (up to 5 attempts). ${warnings.join('; ')}`);
 const {document,originalDimensions,bounds,binary,budgetMet}=processed;
 if(!budgetMet)warnings.push('Asset exceeds requested byte budget');
 if(document.getRoot().listAnimations().length||document.getRoot().listSkins().length)warnings.push('Bounds measured in rest pose; animated/skinned extents may differ');
 if(selected&&!isCC0(selected.license))warnings.push('Non-CC0 asset: preserve legal notices and review all license obligations before redistribution');
 const assetId=selected?.id||path.basename(options.input!,path.extname(options.input!)).replace(/[^a-zA-Z0-9_-]/g,'_');
 const filename=selected?.provider==='objaverse-hf'?`${assetId.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,120)}_${createHash('sha256').update(assetId).digest('hex').slice(0,10)}`:assetId;
 let savedPath:string|null=null;
 if(options.mode!=='datauri'){
  await fs.mkdir(options.outputDir||'public/models',{recursive:true});
  savedPath=path.resolve(options.outputDir||'public/models',`${filename}.glb`);

 }
 const requiredExtensions=document.getRoot().listExtensionsRequired().map(e=>e.extensionName);
 if(requiredExtensions.includes('KHR_texture_basisu'))warnings.push('KTX2 textures retained: configure KTX2Loader with a compatible transcoder in the target project');
 const xray=xrayIntrospect(document);
 const bioPreset=xray.animations.length?null:inferBioMotionPreset(selected?.name||(options.input?assetId:query));
 const bioMotion={preset:bioPreset,source:'name-heuristic',requiresRuntimeInjection:!!bioPreset,note:'Procedural deformation suggestion only; no animation clip was generated. Override or disable after visual review.'};
 const manifest={status:'success',assetId,matchedAssetId:assetId,selectedProvider:selected?.provider||'local',requiredExtensions,bioMotion,query,routing:provider,requireAnimated:!!options.animated,assetName:selected?.name||assetId,source:selected?.source||'local input',license:selected?.license||'User-supplied; verify license',legal:selected?.legal||[],licenseEvidence:selected?.licenseEvidence??null,revision:selected?.revision??null,savedPath,...bounds,originalDimensions,...xray,xray:{hasAnimations:xray.animations.length>0,hasSkeletalRig:xray.skins.length>0,...xray},alternativeCandidates:candidates.filter(c=>c!==selected).slice(0,3).map(c=>({provider:c.provider,id:c.id,name:c.name,animated:c.animated??null,license:c.license,source:c.source})),fileSizeKB:binary.length/1024,budgetMet,warnings,...(options.mode==='datauri'?{dataUri:`data:model/gltf-binary;base64,${Buffer.from(binary).toString('base64')}`}:{})};
 assertXRayManifest(manifest);if(savedPath)await fs.writeFile(savedPath,binary);return manifest;
}
