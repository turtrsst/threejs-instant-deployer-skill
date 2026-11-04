import fs from 'node:fs/promises';
import {Document,NodeIO} from '@gltf-transform/core';
import {BoxGeometry} from 'three';
export async function makeFixture(output='examples/input.glb',animated=true){
 const doc=new Document();const buffer=doc.createBuffer();const geo=new BoxGeometry(2,4,6);
 const accessor=(name,array,type)=>doc.createAccessor(name).setArray(array).setType(type).setBuffer(buffer);
 const mat=doc.createMaterial('Copper').setBaseColorFactor([0.4,0.19,0.08,1]).setMetallicFactor(0.7).setRoughnessFactor(0.35);
 const primitive=doc.createPrimitive().setAttribute('POSITION',accessor('position',geo.attributes.position.array,'VEC3')).setAttribute('NORMAL',accessor('normal',geo.attributes.normal.array,'VEC3')).setAttribute('TEXCOORD_0',accessor('uv',geo.attributes.uv.array,'VEC2')).setIndices(accessor('indices',geo.index.array,'SCALAR')).setMaterial(mat);
 const mesh=doc.createMesh('FixtureMesh').addPrimitive(primitive);const node=doc.createNode('Lantern').setMesh(mesh).setTranslation([3,5,-2]);const scene=doc.createScene('FixtureScene').addChild(node);doc.getRoot().setDefaultScene(scene);
 if(animated){const input=accessor('time',new Float32Array([0,1,2]),'SCALAR');const output=accessor('rotation',new Float32Array([0,0,0,1,0,Math.sin(.2),0,Math.cos(.2),0,0,0,1]),'VEC4');const sampler=doc.createAnimationSampler().setInput(input).setOutput(output).setInterpolation('LINEAR');const channel=doc.createAnimationChannel().setTargetNode(node).setTargetPath('rotation').setSampler(sampler);doc.createAnimation('Sway').addSampler(sampler).addChannel(channel);}
 await fs.mkdir(new URL('../examples/',import.meta.url),{recursive:true});await new NodeIO().write(output,doc);return output;
}
if(process.argv[1]===new URL(import.meta.url).pathname)await makeFixture();
