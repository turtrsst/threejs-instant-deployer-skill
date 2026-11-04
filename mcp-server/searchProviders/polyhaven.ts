export type Provider = 'polyhaven' | 'sketchfab' | 'openpbr' | 'objaverse-hf';
export interface LegalNotice { license: string; licenseUrl: string; attribution: string; }
export interface Candidate { id: string; name: string; provider: Provider; score: number; thumbnail?: string; source: string; license: string; animated?: boolean; animationCount?: number; glbUrl?: string; canDirectDownload?: boolean; legal?: LegalNotice[]; licenseEvidence?: string; revision?: string; }
export async function request(url: string, headers: Record<string,string> = {}): Promise<any> {
  const u = new URL(url);
  if (u.protocol !== 'https:') throw new Error('Only HTTPS downloads are allowed');
  const response = await fetch(u, { headers, signal: AbortSignal.timeout(60000), redirect: 'error' });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${u.host}`);
  return response;
}
export async function bytes(url: string, huggingFaceRedirects=false): Promise<Uint8Array<ArrayBuffer>> {
  const res = huggingFaceRedirects ? await requestHuggingFace(url) : await request(url);
  const limit = 128 * 1024 * 1024;
  if (Number(res.headers.get('content-length')) > limit) throw new Error('Download exceeds 128 MiB');
  const reader = res.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try { for (;;) { const {done,value} = await reader.read(); if(done) break; size += value.length; if(size > limit) throw new Error('Download exceeds 128 MiB'); chunks.push(value); } }
  finally { await reader.cancel(); }
  const output = new Uint8Array(size); let offset=0; for(const c of chunks){output.set(c,offset);offset+=c.length;} return output;
}
export function keywordScore(query: string, id: string, meta: any): number {
  const tokens = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(Boolean);
  const fields = tokens([id,meta.name,...(meta.categories||[]),...(meta.tags||[])].join(' '));
  const keys = tokens(query); if(!keys.length) return 0;
  let score=0;
  for(const k of keys) { if(fields.includes(k)) score+=5; else if(fields.some(t => t.startsWith(k) || k.startsWith(t) && t.length>3)) score+=2; }
  return score/keys.length;
}
export async function searchPolyHaven(query: string): Promise<Candidate[]> {
  const data = await (await request('https://api.polyhaven.com/assets?t=models')).json();
  return Object.entries(data).map(([id,meta]: [string,any]) => ({id,name:meta.name,provider:'polyhaven' as const,score:keywordScore(query,id,meta),thumbnail:`https://cdn.polyhaven.com/asset_img/thumbs/${id}.png?width=256`,source:`https://polyhaven.com/a/${id}`,license:'CC0',animated:false,canDirectDownload:true})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
}
export async function downloadPolyHaven(id: string, resolution='1k') {
  const files = await (await request(`https://api.polyhaven.com/files/${encodeURIComponent(id)}`)).json();
  const group = files.gltf?.[resolution]?.gltf;
  if(!group?.url) throw new Error(`No glTF at resolution ${resolution} for ${id}`);
  const resources: Record<string,Uint8Array<ArrayBuffer>> = {};
  async function include(items: any) { for(const [key,value] of Object.entries(items||{}) as [string,any][]) {
    if(key.includes('..') || key.startsWith('/') || key.includes('\\') || /^[a-z]+:/i.test(key)) throw new Error('Unsafe resource path');
    if(value.url) resources[key]=await bytes(value.url);
    if(value.include) await include(value.include);
  }}
  await include(group.include);
  const json = JSON.parse(new TextDecoder().decode(await bytes(group.url)));
  return {json,resources};
}

/** HF resolve URLs redirect to signed CDN URLs. Never forward auth or follow arbitrary hosts. */
export async function requestHuggingFace(url:string):Promise<Response> {
 let current=new URL(url);
 if(current.hostname!=='huggingface.co')throw new Error('HF download must begin at huggingface.co');
 for(let i=0;i<6;i++){
  if(current.protocol!=='https:'||current.username||current.password||current.port||!['huggingface.co','hf.co','cloudfront.net'].some(host=>current.hostname===host||current.hostname.endsWith('.'+host)))throw new Error('Unsafe Hugging Face redirect');
  const res=await fetch(current,{redirect:'manual',signal:AbortSignal.timeout(60000)});
  if([301,302,303,307,308].includes(res.status)){const location=res.headers.get('location');await res.body?.cancel();if(!location)throw new Error('Missing redirect location');current=new URL(location,current);continue;}
  if(!res.ok)throw new Error(`HF HTTP ${res.status}`);return res;
 }
 throw new Error('Too many HF redirects');
}
