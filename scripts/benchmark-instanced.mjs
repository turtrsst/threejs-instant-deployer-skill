#!/usr/bin/env node
import {parseArgs} from 'node:util';
import {performance} from 'node:perf_hooks';
import * as THREE from 'three';
import {loadModule} from './build-support.mjs';
try{
 const {values}=parseArgs({options:{count:{type:'string'},steps:{type:'string'},'cluster-size':{type:'string'}}});
 const count=Number(values.count??1000),steps=Number(values.steps??240),clusterSize=Number(values['cluster-size']??64);
 if(!Number.isInteger(steps)||steps<1||steps>100000)throw new Error('steps must be 1..100000');
 const {createInstancedBoidsAquariumManager}=await loadModule('codeDeployer/instancedBoidsManager.js');
 const Manager=createInstancedBoidsAquariumManager(THREE),scene=new THREE.Scene(),geometry=new THREE.BoxGeometry(2,.5,.3),material=new THREE.MeshStandardMaterial();
 const manager=new Manager(scene,geometry,material,count,{recommendedScale:.15,clusterSize,seed:42});
 try{
  for(let i=0;i<60;i++)manager.update(1/60);
  const samples=[];for(let i=0;i<steps;i++){const start=performance.now();manager.update(1/60);samples.push(performance.now()-start);}samples.sort((a,b)=>a-b);
  console.log(JSON.stringify({scope:'CPU update only; excludes rendering, GPU shader/texture uploads, shadows, and browser frame scheduling. Not an FPS guarantee.',node:process.version,count,clusterCount:manager.clusterCount,steps,medianMs:samples[Math.floor(samples.length*.5)],p95Ms:samples[Math.min(samples.length-1,Math.floor(samples.length*.95))],clusterMatrixWritesPerUpdate:manager.stats.clusterMatrixWrites,instanceMatrixWritesPerUpdate:manager.stats.instanceMatrixWrites,clusterUploadBytesPerUpdate:manager.stats.clusterUploadBytes,sourceVertices:geometry.attributes.position.count},null,2));
 }finally{manager.dispose();geometry.dispose();material.dispose();}
}catch(error){console.error(JSON.stringify({status:'error',message:error.message}));process.exitCode=1;}
