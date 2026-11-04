import {request,bytes,keywordScore,type Candidate} from './polyhaven.js';
export async function searchSketchfab(query: string, token=process.env.SKETCHFAB_TOKEN, animated=false): Promise<Candidate[]> {
  if(!token) return [];
  const url = new URL('https://api.sketchfab.com/v3/search');
  for(const [k,v] of Object.entries({type:'models',q:query,downloadable:'true',license:'cc0',count:'24'})) url.searchParams.set(k,v);
  if(animated)url.searchParams.set('animated','true');
  const data = await (await request(url.href,{Authorization:`Token ${token}`})).json();
  return (data.results||[]).filter((m:any)=>m.license?.slug==='cc0'&&!m.isAgeRestricted&&(!animated||m.animationCount>0)).map((m:any)=>({id:m.uid,name:m.name,provider:'sketchfab',score:keywordScore(query,m.uid,{name:m.name,tags:m.tags?.map((t:any)=>t.name),categories:m.categories?.map((c:any)=>c.name)}),thumbnail:m.thumbnails?.images?.[0]?.url,source:m.viewerUrl,license:'CC0',animated:m.animationCount>0,animationCount:m.animationCount||0,canDirectDownload:true})).filter((m:Candidate)=>m.score>0);
}
export async function downloadSketchfab(id:string) {
  const token=process.env.SKETCHFAB_TOKEN; if(!token) throw new Error('SKETCHFAB_TOKEN required');
  const meta=await(await request(`https://api.sketchfab.com/v3/models/${encodeURIComponent(id)}`,{Authorization:`Token ${token}`})).json();
  if(meta.license?.slug!=='cc0') throw new Error('Sketchfab asset is not CC0');
  const data=await(await request(`https://api.sketchfab.com/v3/models/${encodeURIComponent(id)}/download`,{Authorization:`Token ${token}`})).json();
  if(!data.glb?.url) throw new Error('Sketchfab asset has no GLB download; archive-only assets are unsupported');
  return bytes(data.glb.url);
}
