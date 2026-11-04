/** Serializable camera owner; follows CPU cluster proxies, never individual GPU fish. */
export function createCinematicCameraDirector(THREE:any){
 const CAMERA_MODES=Object.freeze({ORBIT:'Orbit View',MACRO_DRIFT:'Macro Drift',FISH_FOLLOW:'Cluster Follow (Wide Angle)'});
 const modes:string[]=Object.values(CAMERA_MODES),owner=Symbol.for('threejs-instant-deployer.camera-director');
 const finite=(name:string,v:any,min=-Infinity,max=Infinity)=>{if(!Number.isFinite(v)||v<min||v>max)throw new Error(`Invalid camera ${name}`);return v;};
 const vector=(v:any)=>v?.isVector3&&Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.z);
 class CinematicCameraDirector {
  camera:any;controls:any;postFX:any;fishAquarium:any;disposed=false;floorY:number;clearance:number;macroCycleSpeed:number;maxFrameDelta:number;
  _mode:string=CAMERA_MODES.ORBIT;_index=-1;_distance=.85;_height=.22;_stiffness=4.5;_auto=false;_interval=18;_rotate=false;_rotateSpeed=.45;_switchTimer=0;_elapsed=0;_returning=false;_bank=0;_hasDirection=false;_record:any=null;_waypoints:any[]=[];
  _pos:any;_look:any;_desiredPos:any;_desiredLook:any;_baseUp:any;_dir:any;_rawDir:any;_cross:any;_up:any;_forward:any;_focus:any;_local:any;_parentQuat:any;_worldQuat:any;_scale:any;_scratch:any;_matrix:any;_saved:any;_savedFocus:any=null;_ownsFocus=false;_targetFov=45;_targetAperture=.0012;_lastAperture:any=null;_lensTransition=true;_keyboard:any=null;_keyHandler:any=null;_random:()=>number;_swayX:number;_swayY:number;
  stats={droppedTime:0,controlsUpdates:0,trackedClusterIndex:-1,status:'Orbit',modeSwitches:0};
  constructor(options:any){
   const {camera,controls,postFX,fishAquarium}=options??{};
   if(!camera?.isPerspectiveCamera)throw new Error('PerspectiveCamera required');if(camera[owner])throw new Error('Camera already has a director');finite('fov',camera.fov,1,179);finite('near',camera.near,.000001);finite('far',camera.far,camera.near+.000001);
   if(controls&&(!controls.update||!vector(controls.target)||(controls.object&&controls.object!==camera)))throw new Error('Supply matching OrbitControls');if(postFX&&(!postFX.setFocusTarget||!postFX.setFocusDistance||!postFX.setConfig||postFX.disposed))throw new Error('Supply live aquarium post controller');if(fishAquarium&&!fishAquarium.getInteractionSources)throw new Error('Supply clustered manager, not fishData');
   this.camera=camera;this.controls=controls;this.postFX=postFX;this.fishAquarium=fishAquarium;
   const bounds=options.bounds??fishAquarium?.bounds;if(bounds&&(!bounds.isBox3||bounds.isEmpty()||!vector(bounds.min)||!vector(bounds.max)))throw new Error('Finite audited bounds required');
   this.floorY=finite('floorY',options.floorY??bounds?.min.y??0);this.clearance=finite('clearance',options.clearance??Math.max(camera.near*2,.1),.000001);this.maxFrameDelta=finite('maxFrameDelta',options.maxFrameDelta??.1,.000001,1);this.macroCycleSpeed=finite('macroCycleSpeed',options.macroCycleSpeed??.08,.000001,10);
   const size=bounds?.getSize(new THREE.Vector3())??new THREE.Vector3(8,4,6),center=bounds?.getCenter(new THREE.Vector3())??new THREE.Vector3(0,2,0);
   this._swayX=finite('macroSwayX',options.macroSwayX??size.x*.02,0);this._swayY=finite('macroSwayY',options.macroSwayY??size.y*.024,0);
   const waypoints=options.macroWaypoints??[[-.22,.25,.4], [.22,.38,.35], [.02,.2,.46],[-.16,.65,-.4]].map(([x,y,z])=>({pos:new THREE.Vector3(center.x+x!*size.x,(bounds?.min.y??0)+y!*size.y,center.z+z!*size.z),look:center.clone()}));this.setMacroWaypoints(waypoints);
   this._pos=new THREE.Vector3();this._look=new THREE.Vector3();this._desiredPos=new THREE.Vector3();this._desiredLook=new THREE.Vector3();this._baseUp=camera.up.clone().normalize();this._dir=new THREE.Vector3(0,0,1);this._rawDir=new THREE.Vector3();this._cross=new THREE.Vector3();this._up=new THREE.Vector3();this._forward=new THREE.Vector3();this._focus=new THREE.Vector3();this._local=new THREE.Vector3();this._parentQuat=new THREE.Quaternion();this._worldQuat=new THREE.Quaternion();this._scale=new THREE.Vector3();this._scratch=new THREE.Vector3();this._matrix=new THREE.Matrix4();
   if(!vector(camera.up)||camera.up.lengthSq()<1e-12||!camera.quaternion.toArray().every(Number.isFinite)||camera.quaternion.lengthSq()<1e-12)throw new Error('Finite nonzero camera up required');this._checkParent();camera.getWorldPosition(this._pos);if(!vector(this._pos))throw new Error('Finite camera position required');
   if(controls)this._look.copy(controls.target);else this._look.copy(this._pos).add(camera.getWorldDirection(this._forward).multiplyScalar(Math.max(1,camera.near*10)));if(this._look.distanceToSquared(this._pos)<1e-12)this._look.copy(this._pos).add(camera.getWorldDirection(this._forward));
   this._saved={position:camera.position.clone(),quaternion:camera.quaternion.clone(),up:camera.up.clone(),fov:camera.fov,enabled:controls?.enabled,autoRotate:controls?.autoRotate,autoRotateSpeed:controls?.autoRotateSpeed,enableDamping:controls?.enableDamping,target:controls?.target.clone(),aperture:postFX?.passes?.bokehPass?.uniforms?.aperture?.value};
   const seedValue=finite('seed',options.seed??8129,0,0xffffffff);if(!Number.isInteger(seedValue))throw new Error('Camera seed must be uint32 integer');let seed=seedValue>>>0;this._random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
   this.followDistance=options.followDistance??.85;this.followHeightOffset=options.followHeightOffset??.22;this.cameraStiffness=options.cameraStiffness??4.5;this.autoSwitchEnabled=options.autoSwitchEnabled??false;this.autoSwitchInterval=options.autoSwitchInterval??18;this.orbitAutoRotate=options.orbitAutoRotate??controls?.autoRotate??false;this.orbitAutoRotateSpeed=options.orbitAutoRotateSpeed??.45;
   camera[owner]=this;try{this.setMode(options.mode??CAMERA_MODES.ORBIT);if(options.keyboardTarget)this.bindKeyboard(options.keyboardTarget);}catch(error){this.dispose();throw error;}
  }
  _live(){if(this.disposed)throw new Error('Camera director is disposed');}
  get availableModes(){return CAMERA_MODES;}
  get mode(){return this._mode;}set mode(v:string){this.setMode(v);}
  get trackedClusterIndex(){return this._index;}get trackedFishIndex(){return this._index;}
  get followDistance(){return this._distance;}set followDistance(v:number){this._live();this._distance=finite('followDistance',v,.001,1e6);}
  get followHeightOffset(){return this._height;}set followHeightOffset(v:number){this._live();this._height=finite('followHeightOffset',v,-1e6,1e6);}
  get cameraStiffness(){return this._stiffness;}set cameraStiffness(v:number){this._live();this._stiffness=finite('cameraStiffness',v,.01,100);}
  get autoSwitchEnabled(){return this._auto;}set autoSwitchEnabled(v:boolean){this._live();if(typeof v!=='boolean')throw new Error('autoSwitchEnabled must be boolean');this._auto=v;this._switchTimer=0;}
  get autoSwitchInterval(){return this._interval;}set autoSwitchInterval(v:number){this._live();this._interval=finite('autoSwitchInterval',v,1,86400);}
  get orbitAutoRotate(){return this._rotate;}set orbitAutoRotate(v:boolean){this._live();if(typeof v!=='boolean')throw new Error('orbitAutoRotate must be boolean');this._rotate=v;}
  get orbitAutoRotateSpeed(){return this._rotateSpeed;}set orbitAutoRotateSpeed(v:number){this._live();this._rotateSpeed=finite('orbitAutoRotateSpeed',v,-20,20);}
  get macroWaypoints(){return this._waypoints.map(w=>({pos:w.pos.clone(),look:w.look.clone()}));}
  setMacroWaypoints(value:any){this._live();if(!Array.isArray(value)||value.length<2||value.length>64||value.some(w=>!vector(w?.pos)||!vector(w?.look)||w.pos.distanceToSquared(w.look)<1e-10))throw new Error('Supply 2..64 finite distinct world pos/look waypoints');this._waypoints=value.map(w=>({pos:w.pos.clone(),look:w.look.clone()}));}
  _checkParent(){
   const parent=this.camera.parent;if(!parent)return;parent.updateWorldMatrix(true,false);const m=parent.matrixWorld.elements;
   if(this.controls){for(let i=0;i<16;i++)if(Math.abs(m[i]-(i%5===0?1:0))>1e-8)throw new Error('OrbitControls requires identity camera parent transform');}
   parent.matrixWorld.decompose(this._scratch,this._parentQuat,this._scale);const s=this._scale;
   if(!vector(s)||s.x<=0||s.y<=0||s.z<=0||Math.abs(s.x-s.y)>1e-8*Math.max(1,s.x)||Math.abs(s.x-s.z)>1e-8*Math.max(1,s.x)||parent.matrixWorld.determinant()<=0)throw new Error('Camera parent must have positive uniform scale');
   const x=this._scratch,y=this._local;x.set(m[0],m[1],m[2]);y.set(m[4],m[5],m[6]);if(Math.max(Math.abs(x.dot(y)),Math.abs(m[0]*m[8]+m[1]*m[9]+m[2]*m[10]),Math.abs(m[4]*m[8]+m[5]*m[9]+m[6]*m[10]))>1e-8*s.x*s.x)throw new Error('Sheared camera parent unsupported');
  }
  _sources(){return this.fishAquarium?.disposed?[]:this.fishAquarium?.getInteractionSources()??[];}
  pickRandomCluster(){this._live();const list=this._sources();if(!list.length)return this._select(-1);return this._select(Math.floor(this._random()*list.length));}
  pickNextCluster(){this._live();const list=this._sources();return this._select(list.length?(this._index+1)%list.length:-1);}
  pickRandomFish(){return this.pickRandomCluster();}pickNextFish(){return this.pickNextCluster();}
  _select(index:number){this._index=index;this.stats.trackedClusterIndex=index;this._record=null;this._hasDirection=false;return index;}
  _takeFocus(){if(!this.postFX||this.postFX.disposed||this._ownsFocus)return;this._savedFocus={target:this.postFX.focusTarget??null,distance:this.postFX.state?.targetFocusDistance??this.postFX.state?.focusDistance??1};this._ownsFocus=true;}
  _releaseFocus(){if(this._ownsFocus&&this.postFX&&!this.postFX.disposed&&this.postFX.focusTarget===this._focus){if(this._savedFocus.target)this.postFX.setFocusTarget(this._savedFocus.target);else this.postFX.setFocusDistance(this._savedFocus.distance);}this._ownsFocus=false;}
  setPostFX(value:any){
   this._live();if(value===this.postFX)return;if(value&&(!value.setFocusTarget||!value.setFocusDistance||!value.setConfig||value.disposed))throw new Error('Supply live aquarium post controller');
   this._releaseFocus();this._restoreAperture();this.postFX=value;this._saved.aperture=value?.passes?.bokehPass?.uniforms?.aperture?.value;this._lastAperture=null;this._lensTransition=true;if(this._mode!==CAMERA_MODES.ORBIT)this._takeFocus();
  }
  _restoreAperture(){if(this.postFX&&!this.postFX.disposed&&this._lastAperture!==null&&this.postFX.passes?.bokehPass?.uniforms?.aperture?.value===this._lastAperture&&Number.isFinite(this._saved.aperture))this.postFX.setConfig({aperture:this._saved.aperture});}
  setMode(value:string){
   this._live();if(!modes.includes(value))throw new Error('Unknown camera mode');if(value===CAMERA_MODES.FISH_FOLLOW&&!this._sources().length){if(this._mode!==CAMERA_MODES.ORBIT)this.setMode(CAMERA_MODES.ORBIT);this.stats.status='No visible clusters; Orbit fallback';return false;}
   if(value===this._mode)return true;
   const previous=this._mode;this.camera.getWorldPosition(this._pos);if(previous===CAMERA_MODES.ORBIT&&this.controls)this._look.copy(this.controls.target);
   this._mode=value;this._switchTimer=0;this.stats.modeSwitches++;this._targetFov=value===CAMERA_MODES.ORBIT?45:value===CAMERA_MODES.MACRO_DRIFT?32:68;this._targetAperture=value===CAMERA_MODES.ORBIT?.0012:value===CAMERA_MODES.MACRO_DRIFT?.0024:.0016;this._lensTransition=true;
   if(value===CAMERA_MODES.ORBIT){this._returning=previous!==CAMERA_MODES.ORBIT;this._releaseFocus();}else{this._returning=false;this._takeFocus();if(this.controls)this.controls.enabled=false;if(value===CAMERA_MODES.FISH_FOLLOW&&this._index<0)this.pickRandomCluster();}
   this.stats.status=value;return true;
  }
  nextMode(){this._live();return this.setMode(modes[(modes.indexOf(this._mode)+1)%modes.length]!);}
  followNextCluster(){this._live();const index=this.pickNextCluster();if(index<0){this.setMode(CAMERA_MODES.ORBIT);this.stats.status='No visible clusters; Orbit fallback';return -1;}if(this._mode!==CAMERA_MODES.FISH_FOLLOW)this.setMode(CAMERA_MODES.FISH_FOLLOW);return index;}
  _pose(){
   this._pos.y=Math.max(this._pos.y,this.floorY+this.clearance);this._forward.copy(this._look).sub(this._pos);if(this._forward.lengthSq()<1e-12)this._forward.set(0,0,-1);this._forward.normalize();this._up.copy(this._baseUp).applyAxisAngle(this._forward,this._bank);this._matrix.lookAt(this._pos,this._look,this._up);this._worldQuat.setFromRotationMatrix(this._matrix);this._local.copy(this._pos);
   if(this.camera.parent){this.camera.parent.worldToLocal(this._local);this.camera.parent.getWorldQuaternion(this._parentQuat);this._worldQuat.premultiply(this._parentQuat.invert());}this.camera.position.copy(this._local);this.camera.quaternion.copy(this._worldQuat);this.camera.up.copy(this._up);this.camera.updateWorldMatrix(true,false);
  }
  _orbit(dt:number){
   if(!this.controls){if(this._returning){this._bank*=Math.exp(-4*dt);this._pose();if(Math.abs(this._bank)<.0001)this._returning=false;}return;}
   if(this._returning){this._bank*=Math.exp(-4*dt);this._pose();this.controls.target.copy(this._look);if(Math.abs(this._bank)>.0001)return;this._bank=0;
    // Public-API flush of stale OrbitControls damping. Reapply pose before rendering;
    // no private spherical fields and no second controls.update in this frame.
    const damping=this.controls.enableDamping;this.controls.enableDamping=false;this.controls.autoRotate=false;try{this.controls.update(0);this.stats.controlsUpdates++;}finally{this.controls.enableDamping=damping;this._pose();}this._returning=false;
   }else{this.controls.autoRotate=this._rotate;this.controls.autoRotateSpeed=this._rotateSpeed;this.controls.update(dt);this.stats.controlsUpdates++;this.camera.getWorldPosition(this._pos);this._look.copy(this.controls.target);}
   this.controls.enabled=this._saved.enabled;
  }
  update(delta:number,elapsedTime?:number){
   this._live();finite('delta',delta,0);const elapsed=elapsedTime??this._elapsed+delta;finite('elapsedTime',elapsed,this._elapsed);this._checkParent();this._elapsed=elapsed;const dt=Math.min(delta,this.maxFrameDelta);this.stats.droppedTime+=delta-dt;
   if(this._auto){this._switchTimer+=dt;if(this._switchTimer>=this._interval)this.nextMode();}
   const fov=this.camera.fov+(this._targetFov-this.camera.fov)*(1-Math.exp(-3.5*dt));if(fov!==this.camera.fov){this.camera.fov=Math.abs(fov-this._targetFov)<1e-7?this._targetFov:fov;this.camera.updateProjectionMatrix();}
   if(this.postFX&&!this.postFX.disposed&&(this._lensTransition||this._mode!==CAMERA_MODES.ORBIT)){
    const current=this.postFX.passes?.bokehPass?.uniforms?.aperture?.value??this._targetAperture;if(this._mode===CAMERA_MODES.ORBIT&&this._lastAperture!==null&&Math.abs(current-this._lastAperture)>1e-10)this._lensTransition=false;
    else{let aperture=current+(this._targetAperture-current)*(1-Math.exp(-3.5*dt));if(Math.abs(aperture-this._targetAperture)<1e-8){aperture=this._targetAperture;this._lensTransition=false;}if(aperture!==current)this.postFX.setConfig({aperture});this._lastAperture=aperture;}
   }
   if(this._mode===CAMERA_MODES.ORBIT){this._orbit(dt);return;}
   if(this.controls)this.controls.enabled=false;
   if(this._mode===CAMERA_MODES.MACRO_DRIFT){const t=(elapsed%(this._waypoints.length/this.macroCycleSpeed))*this.macroCycleSpeed,index=Math.floor(t)%this._waypoints.length,raw=t-Math.floor(t),s=raw*raw*(3-2*raw),a=this._waypoints[index],b=this._waypoints[(index+1)%this._waypoints.length];this._desiredPos.lerpVectors(a.pos,b.pos,s);this._desiredPos.x+=Math.sin(elapsed*.6)*this._swayX;this._desiredPos.y+=Math.cos(elapsed*.45)*this._swayY;this._desiredLook.lerpVectors(a.look,b.look,s);this._bank*=Math.exp(-4*dt);}
   else{const list=this._sources();if(!list.length){this.setMode(CAMERA_MODES.ORBIT);this.stats.status='No visible clusters; Orbit fallback';this._orbit(dt);return;}this._index=((this._index%list.length)+list.length)%list.length;const record=list[this._index];if(!vector(record?.position)||!vector(record?.velocity))throw new Error('Finite CPU cluster position/velocity required');this.stats.trackedClusterIndex=this._index;
    this._rawDir.copy(record.velocity);if(this._rawDir.lengthSq()<1e-12)this._rawDir.copy(this._hasDirection?this._dir:this.camera.getWorldDirection(this._forward));this._rawDir.normalize();
    if(record!==this._record||!this._hasDirection){this._dir.copy(this._rawDir);this._record=record;this._hasDirection=true;}
    this._cross.crossVectors(this._dir,this._rawDir);const turn=Math.atan2(this._cross.dot(this._baseUp),THREE.MathUtils.clamp(this._dir.dot(this._rawDir),-1,1));this._bank+=(THREE.MathUtils.clamp(turn*2.2,-.35,.35)-this._bank)*(1-Math.exp(-4*dt));this._dir.lerp(this._rawDir,1-Math.exp(-6*dt));if(this._dir.lengthSq()<1e-12)this._dir.copy(this._rawDir);this._dir.normalize();
    const radius=Number.isFinite(record.radius)?Math.max(0,record.radius):0,distance=Math.max(this._distance,radius+this.clearance+Math.abs(this._height));this._desiredPos.copy(record.position).addScaledVector(this._dir,-distance).addScaledVector(this._baseUp,this._height);this._desiredLook.copy(record.position).addScaledVector(this._dir,Math.max(.1,radius*.5));this._focus.copy(record.position);
   }
   this._desiredPos.y=Math.max(this._desiredPos.y,this.floorY+this.clearance);const lambda=this._mode===CAMERA_MODES.MACRO_DRIFT?2.2:this._stiffness;this._pos.lerp(this._desiredPos,1-Math.exp(-lambda*dt));this._look.lerp(this._desiredLook,1-Math.exp(-lambda*(this._mode===CAMERA_MODES.FISH_FOLLOW?1.3:1)*dt));this._pose();if(this.controls)this.controls.target.copy(this._look);
   if(this._mode===CAMERA_MODES.MACRO_DRIFT)this._focus.copy(this._look);if(this.postFX&&!this.postFX.disposed){this._takeFocus();if(this.postFX.focusTarget!==this._focus)this.postFX.setFocusTarget(this._focus);}
  }
  bindKeyboard(target:any){this._live();if(!target?.addEventListener||!target?.removeEventListener)throw new Error('Keyboard EventTarget required');this.unbindKeyboard();const handler=(event:any)=>{if(event.defaultPrevented||event.repeat||event.ctrlKey||event.metaKey||event.altKey)return;const path=event.composedPath?.()??[event.target];if(path.some((node:any)=>node?.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(node?.tagName??'')||node?.getAttribute?.('role')==='textbox'))return;const key=event.key?.toLowerCase();if(key==='c'){this.nextMode();event.preventDefault();}else if(key==='n'){this.followNextCluster();event.preventDefault();}};this._keyboard=target;this._keyHandler=handler;target.addEventListener('keydown',handler);return{dispose:()=>{if(this._keyHandler===handler)this.unbindKeyboard();}};}
  unbindKeyboard(){if(this._keyboard)this._keyboard.removeEventListener('keydown',this._keyHandler);this._keyboard=null;this._keyHandler=null;}
  dispose(){if(this.disposed)return;this.unbindKeyboard();this._releaseFocus();this.camera.position.copy(this._saved.position);this.camera.quaternion.copy(this._saved.quaternion);this.camera.up.copy(this._saved.up);this.camera.fov=this._saved.fov;this.camera.updateProjectionMatrix();if(this.controls){for(const k of ['enabled','autoRotate','autoRotateSpeed','enableDamping'])this.controls[k]=this._saved[k];this.controls.target.copy(this._saved.target);}this._restoreAperture();if(this.camera[owner]===this)delete this.camera[owner];this.disposed=true;}
 }
 return {CinematicCameraDirector,CAMERA_MODES};
}
