import type {Candidate} from './polyhaven.js';
export async function visualRank(query:string, candidates:Candidate[]):Promise<Candidate[]> {
  const endpoint=process.env.VISION_API_URL, key=process.env.VISION_API_KEY, model=process.env.VISION_MODEL;
  if(!endpoint || !key || !model) throw new Error('Visual ranking requires VISION_API_URL, VISION_API_KEY, VISION_MODEL');
  if(new URL(endpoint).protocol!=='https:') throw new Error('Vision endpoint must use HTTPS');
  const shortlist=candidates.slice(0,8);
  const content:any[]=[{type:'text',text:`Rank these CC0 model thumbnails by relevance to ${JSON.stringify(query)} and photographic realism. Return JSON only: {"ids":[...]} using each supplied id once.`}];
  for(const c of shortlist) if(c.thumbnail) content.push({type:'text',text:c.id},{type:'image_url',image_url:{url:c.thumbnail}});
  const res=await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,messages:[{role:'user',content}],response_format:{type:'json_object'}}),signal:AbortSignal.timeout(60000)});
  if(!res.ok) throw new Error(`Vision HTTP ${res.status}`);
  const result:any=await res.json(); const ids=JSON.parse(result.choices[0].message.content).ids;
  if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some(id=>!shortlist.some(c=>c.id===id))) throw new Error('Invalid vision ranking');
  return [...ids.map(id=>shortlist.find(c=>c.id===id)!),...candidates.filter(c=>!ids.includes(c.id))];
}
