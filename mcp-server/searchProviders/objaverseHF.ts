import {request,requestHuggingFace,keywordScore,type Candidate} from './polyhaven.js';
import {isCC0} from './openPbr.js';
const allowedLicenses=new Set(['cc0','cc0-1.0','cc-by-4.0','mit','apache-2.0']);
const safePath=(s:unknown):s is string=>typeof s==='string'&&s.length>0&&!s.startsWith('/')&&!s.includes('\\')&&!s.split('/').some(p=>p==='.'||p==='..'||!p)&&!/[?#%:\x00-\x1f]/.test(s);
const encodePath=(p:string)=>p.split('/').map(encodeURIComponent).join('/');
export interface HFSearchOptions {animated?:boolean;allowNonCC0?:boolean;warnings?:string[];}
/** Bounded Hub discovery, not a semantic search index over all Objaverse objects.
 * Requires asset-metadata.json per-file licensing; a dataset card license is insufficient.
 */
export async function searchObjaverseHF(query:string,options:HFSearchOptions={}):Promise<Candidate[]> {
 const output:Candidate[]=[];const warnings=options.warnings||[];
 for(const kind of ['datasets','models'] as const){
  try{
   const repos=await(await request(`https://huggingface.co/api/${kind}?search=${encodeURIComponent(query+' glb')}&limit=4`)).json();
   if(!Array.isArray(repos))throw new Error('Invalid Hub search response');
   for(const repo of repos.slice(0,4)){
    const id=repo.id;
    if(typeof id!=='string'||!safePath(id)||!/^[-\w.]+\/[-\w.]+$/.test(id))continue;
    try{
     const details=await(await request(`https://huggingface.co/api/${kind}/${id}`)).json();
     const revision=details.sha;if(typeof revision!=='string'||!/^[a-f0-9]{7,64}$/i.test(revision))throw new Error('Missing immutable revision');
     const tree=await(await request(`https://huggingface.co/api/${kind}/${id}/tree/${revision}?recursive=true&limit=100`)).json();
     if(!Array.isArray(tree)||!tree.some(f=>f.path==='asset-metadata.json')){warnings.push(`HF ${id}: skipped; no per-asset asset-metadata.json licensing`);continue;}
     const root=`https://huggingface.co/${kind==='datasets'?'datasets/':''}${id}/resolve/${revision}/`;
     const response=await requestHuggingFace(root+'asset-metadata.json');
     // Cap metadata before parsing, even if upstream ignores Content-Length.
     if(Number(response.headers.get('content-length'))>1024*1024)throw new Error('HF metadata exceeds 1 MiB');
     const reader=response.body!.getReader();const chunks:Uint8Array[]=[];let length=0;
     try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>1024*1024)throw new Error('HF metadata exceeds 1 MiB');chunks.push(value);}}finally{await reader.cancel();}
     const body=Buffer.concat(chunks);const metadata=JSON.parse(body.toString('utf8'));
     if(!Array.isArray(metadata.assets))throw new Error('Invalid asset-metadata.json schema');
     for(const asset of metadata.assets.slice(0,100)){
      if(!safePath(asset.path)||!asset.path.toLowerCase().endsWith('.glb'))continue;
      const file=tree.find(f=>f.path===asset.path&&f.type==='file');
      if(!file||!Number.isFinite(file.size)||file.size<=0||file.size>35_000_000)continue;
      const license=typeof asset.license==='string'?asset.license.toLowerCase():'';
      if(!allowedLicenses.has(license)||(!options.allowNonCC0&&!isCC0(license)))continue;
      if(typeof asset.licenseUrl!=='string'||!asset.licenseUrl.startsWith('https://')||typeof asset.source!=='string'||!asset.source.startsWith('https://'))continue;
      if(!isCC0(license)&&(!asset.attribution||typeof asset.attribution!=='string'))continue;
      if(options.animated&&asset.animated!==true)continue;
      const tags=Array.isArray(asset.tags)?asset.tags.filter((t:unknown)=>typeof t==='string'):[];
      const name=typeof asset.name==='string'?asset.name:asset.path;
      const score=keywordScore(query,asset.path,{name,tags});if(score<=0)continue;
      output.push({id:`${id}:${asset.path}`,name,provider:'objaverse-hf',score,source:asset.source,license,licenseEvidence:root+'asset-metadata.json',revision,legal:[{license,licenseUrl:asset.licenseUrl,attribution:asset.attribution||''}],glbUrl:root+encodePath(asset.path),animated:typeof asset.animated==='boolean'?asset.animated:undefined,canDirectDownload:true});
     }
    }catch(e){warnings.push(`HF ${id}: ${String(e)}`);}
   }
  }catch(e){warnings.push(`HF ${kind}: ${String(e)}`);}
 }
 return output.sort((a,b)=>b.score-a.score);
}
