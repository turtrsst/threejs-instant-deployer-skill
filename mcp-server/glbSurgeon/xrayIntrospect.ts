import type {Document} from '@gltf-transform/core';
export function xrayIntrospect(document:Document) {
 const r=document.getRoot();
 return {
 meshes:r.listMeshes().map((m,index)=>({index,name:m.getName(),primitives:m.listPrimitives().length})),
 materials:r.listMaterials().map((m,index)=>({index,name:m.getName(),roughness:m.getRoughnessFactor(),metalness:m.getMetallicFactor(),alphaMode:m.getAlphaMode(),doubleSided:m.getDoubleSided(),isTranslucentOrTransmission:Boolean(m.getExtension('KHR_materials_transmission')||m.getAlphaMode()==='BLEND')})),
 animations:r.listAnimations().map((a,index)=>({index,name:a.getName(),channels:a.listChannels().length,channelsCount:a.listChannels().length})),
 nodes:r.listNodes().map((n,index)=>({index,name:n.getName(),mesh:n.getMesh()?.getName()??null,children:n.listChildren().map(c=>c.getName())})),
 skins:r.listSkins().map((s,index)=>({index,name:s.getName(),jointsCount:s.listJoints().length,sampleBoneNames:s.listJoints().slice(0,8).map(n=>n.getName()),bones:s.listJoints().map(n=>n.getName())}))
 };
}
