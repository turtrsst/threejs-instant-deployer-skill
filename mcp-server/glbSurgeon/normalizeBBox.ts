import {getBounds,type Document} from '@gltf-transform/core';
import {center} from '@gltf-transform/functions';
export function dimensions(document:Document): [number,number,number] {
  const scene=document.getRoot().getDefaultScene()||document.getRoot().listScenes()[0];
  if(!scene) throw new Error('GLB contains no scene');
  const bounds=getBounds(scene);
  const size=bounds.max.map((v,i)=>v-bounds.min[i]!) as [number,number,number];
  if(size.some(v=>!Number.isFinite(v))||size.every(v=>v<=0)) throw new Error('GLB has no measurable geometry');
  return size;
}
export async function normalizeBBox(document:Document,targetSize:[number,number,number]) {
  if(!Array.isArray(targetSize)||targetSize.length!==3||Array.from(targetSize).some(v=>!Number.isFinite(v)||v<0)||targetSize.every(v=>v===0)) throw new Error('Target size must contain positive finite dimensions (0 means unconstrained)');
  const originalDimensions=dimensions(document);
  await document.transform(center({pivot:'below'}));
  const normalizedDimensions=dimensions(document);
  const ratios=targetSize.flatMap((v,i)=>v>0&&normalizedDimensions[i]!>0?[v/normalizedDimensions[i]!]:[]);
  const recommendedScale=Math.min(...ratios);
  if(!Number.isFinite(recommendedScale)||recommendedScale<=0) throw new Error('Cannot fit target bounds');
  return {originalDimensions,normalizedDimensions,targetSize,recommendedScale,recommendedScaleVector:[recommendedScale,recommendedScale,recommendedScale],scaledDimensions:normalizedDimensions.map(v=>v*recommendedScale),fitMode:'contain',pivotMode:'bottom-center'};
}
