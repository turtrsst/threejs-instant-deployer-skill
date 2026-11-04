import {NodeIO,Logger,type Document} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,weld,prune,resample,simplify,meshopt,textureCompress} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptDecoder,MeshoptSimplifier} from 'meshoptimizer';
import sharp from 'sharp';
export async function createIO() {
 const draco:any=await import('draco3dgltf');
 return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder,'draco3d.decoder':await draco.default.createDecoderModule(),'draco3d.encoder':await draco.default.createEncoderModule()}).setLogger(new Logger(Logger.Verbosity.WARN));
}
export async function optimizeWeb(document:Document) {
 await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready,MeshoptSimplifier.ready]);
 await document.transform(dedup(),weld(),simplify({simplifier:MeshoptSimplifier,ratio:0.8,error:0.001}),resample(),prune(),textureCompress({encoder:sharp,targetFormat:'webp',resize:[1024,1024],quality:80}),meshopt({encoder:MeshoptEncoder,level:'medium'}));
}
