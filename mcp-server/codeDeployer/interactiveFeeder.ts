/** Bounded world-space food/ripple pools. Cluster feeding is an approximation, not GPU mouth collision. */
export function createInteractiveFishFeeder(THREE:any){
 return class InteractiveFishFeeder {
  scene:any;camera:any;domElement:any;audioSynth:any;bounds:any;waterSurfaceY:number;floorY:number;maxPellets:number;maxRipples:number;eatRadius:number;senseRadius:number;speedBoost:number;attractionStrength:number;pelletRadius:number;
  _spawnListeners=new Set<any>();
  records:any[]=[];ripples:any[]=[];pelletMesh:any;pelletGeometry:any;pelletMaterial:any;rippleGeometry:any;disposed=false;enabled=true;boundManager:any=null;
  stats={activePellets:0,activeRipples:0,spawned:0,consumed:0,expired:0,recycled:0,candidateChecks:0,audioErrors:0,spawnListenerErrors:0,droppedTime:0};
  _time=0;_elapsed=0;_accumulator=0;_sequence=0;_rippleCursor=0;_fixedDelta:number;_maxSubSteps:number;_maxFrameDelta:number;_ttl:number;_interaction:string;_random:()=>number;_handlers:any[]=[];_onAudioError:any;
  _ray:any;_plane:any;_pointer:any;_hit:any;_projection:any;_goal:any;_steer:any;_segment:any;_closest:any;_dummy:any;_inverse:any;_center:any;
  constructor(scene:any,camera:any,domElement:any,options:any={}){
   if(!scene?.isObject3D||(!camera?.isPerspectiveCamera&&!camera?.isOrthographicCamera)||!domElement?.addEventListener||!domElement?.getBoundingClientRect)throw new Error('Scene/group, camera and canvas required');
   const finite=(name:string,v:any,min=0)=>{if(!Number.isFinite(v)||v<min)throw new Error(`Invalid feeder ${name}`);return v;};
   this.scene=scene;this.camera=camera;this.domElement=domElement;this.audioSynth=options.audioSynth;this._onAudioError=options.onAudioError;
   if(this.audioSynth&&(!this.audioSynth.triggerWaterPlop||!this.audioSynth.triggerFishSnap))throw new Error('Supply synthesizer with budgeted feeding accents');
   this.bounds=(options.bounds??new THREE.Box3(new THREE.Vector3(-6,.2,-5),new THREE.Vector3(6,4.5,5))).clone();
   if(!this.bounds.isBox3||this.bounds.isEmpty()||!this.bounds.min.toArray().concat(this.bounds.max.toArray()).every(Number.isFinite)||['x','y','z'].some(a=>this.bounds.max[a]<=this.bounds.min[a]))throw new Error('Finite positive feeder bounds required');
   this.waterSurfaceY=finite('waterSurfaceY',options.waterSurfaceY??this.bounds.max.y,-Infinity);this.floorY=finite('floorY',options.floorY??this.bounds.min.y,-Infinity);
   this.pelletRadius=finite('pelletRadius',options.pelletRadius??.055,.00001);
   if(this.floorY<this.bounds.min.y||this.waterSurfaceY>this.bounds.max.y||this.waterSurfaceY-this.floorY<=2.5*this.pelletRadius||['x','z'].some(a=>this.bounds.max[a]-this.bounds.min[a]<=2.5*this.pelletRadius))throw new Error('Feeding volume must fit surface/floor and pellet radius');
   this.maxPellets=options.maxPellets??120;this.maxRipples=options.maxRipples??16;
   if(!Number.isInteger(this.maxPellets)||this.maxPellets<1||this.maxPellets>1024||!Number.isInteger(this.maxRipples)||this.maxRipples<1||this.maxRipples>64)throw new Error('Pool sizes: pellets 1..1024, ripples 1..64');
   this.eatRadius=finite('eatRadius',options.eatRadius??.32,.00001);this.senseRadius=finite('senseRadius',options.senseRadius??7,.00001);this.speedBoost=finite('speedBoost',options.speedBoost??1.65,1);if(this.speedBoost>2.5)throw new Error('speedBoost must be 1..2.5');
   this.attractionStrength=finite('attractionStrength',options.attractionStrength??2.8);if(this.attractionStrength>10)throw new Error('attractionStrength must be <=10');
   this._ttl=finite('pelletLifetime',options.pelletLifetime??18,.001);this._fixedDelta=finite('fixedDelta',options.fixedDelta??1/60,.0001);this._maxFrameDelta=finite('maxFrameDelta',options.maxFrameDelta??.2,.0001);this._maxSubSteps=options.maxSubSteps??12;if(!Number.isInteger(this._maxSubSteps)||this._maxSubSteps<1||this._maxSubSteps>120)throw new Error('maxSubSteps must be 1..120');
   this._interaction=options.interaction??'shift';if(!['shift','click','disabled'].includes(this._interaction))throw new Error('interaction must be shift, click or disabled');
   if(options.seed!==undefined&&!Number.isSafeInteger(options.seed))throw new Error('Feeder seed must be safe integer');let seed=(options.seed??7291)>>>0;this._random=()=>{seed=(seed+0x6d2b79f5)>>>0;let t=seed;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};
   this._ray=new THREE.Raycaster();this._plane=new THREE.Plane(new THREE.Vector3(0,1,0),-this.waterSurfaceY);this._pointer=new THREE.Vector2();this._hit=new THREE.Vector3();this._projection=new THREE.Vector3();this._goal=new THREE.Vector3();this._steer=new THREE.Vector3();this._segment=new THREE.Vector3();this._closest=new THREE.Vector3();this._dummy=new THREE.Object3D();this._inverse=new THREE.Matrix4();this._center=this.bounds.getCenter(new THREE.Vector3());this._center.y=this.waterSurfaceY;
   try{
    const geometry=new THREE.DodecahedronGeometry(this.pelletRadius,1),material=new THREE.MeshStandardMaterial({color:0xd97724,roughness:.75,metalness:.05,emissive:0x3a1800,emissiveIntensity:.4});
    this.pelletGeometry=geometry;this.pelletMaterial=material;this.pelletMesh=new THREE.InstancedMesh(geometry,material,this.maxPellets);this.pelletMesh.count=0;this.pelletMesh.name='Feeder pellets';this.pelletMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.pelletMesh.castShadow=options.castShadow??false;this.pelletMesh.frustumCulled=false;this.pelletMesh.matrixAutoUpdate=false;this.pelletMesh.raycast=()=>{};this.pelletMesh.userData.excludeFromFocus=true;scene.add(this.pelletMesh);
    for(let i=0;i<this.maxPellets;i++)this.records.push({active:false,position:new THREE.Vector3(),velocity:new THREE.Vector3(),rotation:new THREE.Euler(),scale:1,phase:0,age:0,id:0});
    this.rippleGeometry=new THREE.RingGeometry(this.pelletRadius*1.4,this.pelletRadius*2.5,32).rotateX(-Math.PI/2);
    for(let i=0;i<this.maxRipples;i++){const material=new THREE.MeshBasicMaterial({color:0x88f4ff,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}),mesh=new THREE.Mesh(this.rippleGeometry,material);mesh.matrixAutoUpdate=false;mesh.frustumCulled=false;mesh.visible=false;mesh.raycast=()=>{};mesh.userData.excludeFromFocus=true;scene.add(mesh);this.ripples.push({mesh,age:0,active:false,x:0,z:0});}
    this.syncVisuals();this._bindEvents();
   }catch(error){this.dispose();throw error;}
  }
  _live(){if(this.disposed)throw new Error('Fish feeder is disposed');}
  get pellets(){return this.records.filter(p=>p.active);}
  setEnabled(value:boolean){this._live();if(typeof value!=='boolean')throw new Error('enabled must be boolean');this.enabled=value;}
  _sound(method:string,position:any){if(!this.audioSynth||this.audioSynth.disposed)return;this.camera.updateWorldMatrix(true,false);const x=this._projection.copy(position).project(this.camera).x,pan=Number.isFinite(x)?THREE.MathUtils.clamp(x,-1,1):0;try{this.audioSynth[method](pan);}catch(error){this.stats.audioErrors++;this._onAudioError?.(error);}}
  onFoodSpawn(listener:any){this._live();if(typeof listener!=='function')throw new Error('Food spawn listener must be function');if(!this._spawnListeners.has(listener)&&this._spawnListeners.size>=16)throw new Error('Food spawn listener cap is 16');this._spawnListeners.add(listener);return()=>this._spawnListeners.delete(listener);}
  spawnFoodCluster(worldPoint:any,count=10){
   this._live();if(!worldPoint?.isVector3||!worldPoint.toArray().every(Number.isFinite)||!Number.isInteger(count)||count<0||count>64)throw new Error('Finite world Vector3 and count 0..64 required');
   if(worldPoint.x<this.bounds.min.x||worldPoint.x>this.bounds.max.x||worldPoint.z<this.bounds.min.z||worldPoint.z>this.bounds.max.z)throw new Error('Food point outside audited tank XZ bounds');if(!count)return 0;
   for(let i=0;i<count;i++){
    let p=this.records.find(p=>!p.active);if(!p){p=this.records.reduce((a,b)=>a.id<b.id?a:b);this.stats.recycled++;}
    const radius=.15+this._random()*.45,angle=this._random()*Math.PI*2;p.scale=.75+this._random()*.5;const r=this.pelletRadius*p.scale;
    p.position.set(THREE.MathUtils.clamp(worldPoint.x+Math.cos(angle)*radius,this.bounds.min.x+r,this.bounds.max.x-r),this.waterSurfaceY-r,THREE.MathUtils.clamp(worldPoint.z+Math.sin(angle)*radius,this.bounds.min.z+r,this.bounds.max.z-r));p.velocity.set((this._random()-.5)*.25,-(.45+this._random()*.35),(this._random()-.5)*.25);p.rotation.set(this._random()*Math.PI,this._random()*Math.PI,this._random()*Math.PI);p.phase=this._random()*Math.PI*2;p.age=0;p.id=++this._sequence;p.active=true;this.stats.spawned++;
   }
   const ripple=this.ripples[this._rippleCursor++%this.maxRipples];ripple.active=true;ripple.age=0;ripple.x=worldPoint.x;ripple.z=worldPoint.z;
   this._goal.set(worldPoint.x,this.waterSurfaceY,worldPoint.z);this.syncVisuals();const event=Object.freeze({x:worldPoint.x,y:this.waterSurfaceY,z:worldPoint.z,count,time:this._time});for(const listener of [...this._spawnListeners])if(this._spawnListeners.has(listener)){try{const result=listener(event);if(result?.then)Promise.resolve(result).catch(()=>{this.stats.spawnListenerErrors++;});}catch{this.stats.spawnListenerErrors++;}}this._sound('triggerWaterPlop',this._goal);return count;
  }
  feedAtCenter(count=15){return this.spawnFoodCluster(this._center,count);}
  clear(){this._live();for(const p of this.records)p.active=false;for(const r of this.ripples)r.active=false;this.boundManager?.resetFeeding();this.syncVisuals();}
  _step(dt:number){
   const t0=this._time,t1=t0+dt;this._time=t1;
   for(const r of this.ripples)if(r.active){r.age+=dt;if(r.age>=1.35)r.active=false;}
   for(const p of this.records)if(p.active){p.age+=dt;if(p.age>=this._ttl){p.active=false;this.stats.expired++;continue;}const radius=this.pelletRadius*p.scale;if(p.position.y>this.floorY+radius){
    p.position.x+=(Math.cos(t0*2.2+p.phase)-Math.cos(t1*2.2+p.phase))*.18/2.2+p.velocity.x*dt;p.position.z+=(Math.sin(t1*1.9+p.phase)-Math.sin(t0*1.9+p.phase))*.18/1.9+p.velocity.z*dt;p.position.y=Math.max(this.floorY+radius,p.position.y+p.velocity.y*dt);p.rotation.x+=dt*1.5;p.rotation.y+=dt*2.1;
    p.position.x=THREE.MathUtils.clamp(p.position.x,this.bounds.min.x+radius,this.bounds.max.x-radius);p.position.z=THREE.MathUtils.clamp(p.position.z,this.bounds.min.z+radius,this.bounds.max.z-radius);
   }}
  }
  computeFoodAttractionForce(fish:any,maxSpeed=2.2,maxForce=1.8,senseRadius=this.senseRadius){
   this._live();if(!fish?.position?.isVector3||!fish?.velocity?.isVector3||![maxSpeed,maxForce,senseRadius].every(v=>Number.isFinite(v)&&v>=0))throw new Error('Fish record and nonnegative finite steering parameters required');
   let closest:any=null,distance=senseRadius*senseRadius;for(const p of this.records)if(p.active){this.stats.candidateChecks++;const d=fish.position.distanceToSquared(p.position);if(d<distance){distance=d;closest=p;}}
   fish.isFeeding=!!closest;fish.motionSpeedBoost=closest?this.speedBoost:1;if(!closest)return null;
   this._goal.copy(closest.position);if(fish.inner)this._goal.clamp(fish.inner.min,fish.inner.max);
   return this._steer.copy(this._goal).sub(fish.position).normalize().multiplyScalar(maxSpeed*this.speedBoost).sub(fish.velocity).clampLength(0,maxForce*this.attractionStrength);
  }
  _consume(records:any[],swept=false){
   for(const p of this.records)if(p.active)for(const fish of records){if(fish.blocked)continue;this.stats.candidateChecks++;let distance=fish.position.distanceToSquared(p.position);
    if(swept&&fish.foodPreviousPosition){this._segment.copy(fish.position).sub(fish.foodPreviousPosition);const length=this._segment.lengthSq();const t=length?THREE.MathUtils.clamp(this._closest.copy(p.position).sub(fish.foodPreviousPosition).dot(this._segment)/length,0,1):0;this._closest.copy(fish.foodPreviousPosition).addScaledVector(this._segment,t);distance=this._closest.distanceToSquared(p.position);}
    if(distance<=this.eatRadius*this.eatRadius){p.active=false;this.stats.consumed++;this._sound('triggerFishSnap',p.position);break;}
   }
  }
  syncVisuals(){
   if(this.disposed)return;this.scene.updateWorldMatrix(true,false);const determinant=this.scene.matrixWorld.determinant();if(!Number.isFinite(determinant)||Math.abs(determinant)<1e-12)throw new Error('Feeder scene parent must be invertible');this._inverse.copy(this.scene.matrixWorld).invert();this.pelletMesh.matrix.copy(this._inverse);this.pelletMesh.matrixWorldNeedsUpdate=true;
   let count=0;for(const p of this.records)if(p.active){this._dummy.position.copy(p.position);this._dummy.rotation.copy(p.rotation);this._dummy.scale.setScalar(p.scale);this._dummy.updateMatrix();this.pelletMesh.setMatrixAt(count++,this._dummy.matrix);}this.pelletMesh.count=count;if(count)this.pelletMesh.instanceMatrix.needsUpdate=true;this.stats.activePellets=count;
   let rings=0;for(const r of this.ripples){r.mesh.visible=r.active;if(r.active){rings++;const t=r.age/1.35;this._dummy.position.set(r.x,this.waterSurfaceY-.005,r.z);this._dummy.rotation.set(0,0,0);this._dummy.scale.set(1+t*12,1,1+t*12);this._dummy.updateMatrix();r.mesh.matrix.multiplyMatrices(this._inverse,this._dummy.matrix);r.mesh.matrixWorldNeedsUpdate=true;r.mesh.material.opacity=(1-t)*.7;}}this.stats.activeRipples=rings;
  }
  update(delta:number,elapsedTime?:number,fishRecords:any[]=[]){
   this._live();if(this.boundManager)throw new Error('Attached feeder is stepped by the manager; do not double-update');const time=elapsedTime??this._elapsed+delta;if(!Number.isFinite(delta)||delta<0||!Number.isFinite(time)||time<this._elapsed||!Array.isArray(fishRecords)||fishRecords.some(f=>!f?.position?.isVector3||!f.position.toArray().every(Number.isFinite)))throw new Error('Valid delta/monotonic elapsed/CPU records required');this._elapsed=time;
   const accepted=Math.min(delta,this._maxFrameDelta);this.stats.droppedTime+=delta-accepted;this._accumulator+=accepted;let n=0;while(this._accumulator+1e-10>=this._fixedDelta&&n<this._maxSubSteps){this._step(this._fixedDelta);this._consume(fishRecords);this._accumulator=Math.max(0,this._accumulator-this._fixedDelta);n++;}if(this._accumulator>=this._fixedDelta){const retained=this._accumulator%this._fixedDelta;this.stats.droppedTime+=this._accumulator-retained;this._accumulator=retained;}this.syncVisuals();return this.stats;
  }
  _bindEvents(){
   if(this._interaction==='disabled')return;let press:any=null;
   const down=(event:any)=>{press=null;if(!this.enabled||(event.button??0)!==0||event.isPrimary===false||(this._interaction==='shift'&&!event.shiftKey))return;press={x:event.clientX,y:event.clientY,id:event.pointerId};};
   const up=(event:any)=>{const start=press;press=null;if(!this.enabled||!start||event.pointerId!==start.id||Math.hypot(event.clientX-start.x,event.clientY-start.y)>4||(this._interaction==='shift'&&!event.shiftKey))return;const rect=this.domElement.getBoundingClientRect();if(!rect.width||!rect.height)return;const x=(event.clientX-rect.left)/rect.width,y=(event.clientY-rect.top)/rect.height;if(x<0||x>1||y<0||y>1)return;this._pointer.set(x*2-1,1-y*2);this.camera.updateWorldMatrix(true,false);this._ray.setFromCamera(this._pointer,this.camera);if(!this._ray.ray.intersectPlane(this._plane,this._hit))return;this._projection.copy(this._hit).project(this.camera);if(Math.abs(this._projection.z)>1||this._hit.x<this.bounds.min.x||this._hit.x>this.bounds.max.x||this._hit.z<this.bounds.min.z||this._hit.z>this.bounds.max.z)return;this.spawnFoodCluster(this._hit,8+Math.floor(this._random()*8));};
   const cancel=()=>{press=null;};for(const [name,fn]of [['pointerdown',down],['pointerup',up],['pointercancel',cancel]]){this._handlers.push([name,fn]);this.domElement.addEventListener(name,fn);}
  }
  dispose(){if(this.disposed)return;if(this.boundManager&&!this.boundManager.disposed)this.boundManager.setFeeder(null);this.disposed=true;this._spawnListeners.clear();for(const [name,fn]of this._handlers)this.domElement.removeEventListener(name,fn);this._handlers.length=0;this.pelletMesh?.removeFromParent();this.pelletMesh?.dispose();this.pelletGeometry?.dispose();this.pelletMaterial?.dispose();for(const r of this.ripples){r.mesh.removeFromParent();r.mesh.material.dispose();}this.rippleGeometry?.dispose();this.records.length=0;this.ripples.length=0;this.boundManager=null;this.stats.activePellets=0;this.stats.activeRipples=0;}
 };
}
