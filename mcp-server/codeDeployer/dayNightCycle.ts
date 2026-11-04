/** Serializable r180 PBR emission/optical cycle. No renderer, timer or frame loop is owned. */
export function createDayNightAquariumCycle(THREE:any){
 const ownership=Symbol.for('threejs-instant-deployer.day-night-glow');
 const colors=['fogColor','waterTint','causticColor','hemiSky','hemiGround','sunColor'];
 const numbers=['sunIntensity','hemiIntensity','godRayIntensity','bloomStrength','bloomThreshold','bioluminescence'];
 const rows=[
  [0,0x010610,0x020b1a,0x00f5d4,0x0a244d,0x010308,0x3b6998,.35,.3,.03,.88,.28,1],
  [6,0x0d1b2a,0x1b263b,0xff9e6d,0xffb5a7,0x07111e,0xff9f68,1.6,.65,.22,.52,.58,.15],
  [12,0x041b2d,0x06283d,0x4ee4e8,0x66e0ff,0x051824,0xe0fcff,3,.95,.20,.36,.74,0],
  [17.5,0x1a1215,0x2b191d,0xffaa5a,0xff758f,0x0d090a,0xff7b47,2.1,.6,.26,.55,.55,.25],
  [21,0x020814,0x030e21,0x00e5ff,0x0e2a5c,0x01040a,0x4878a8,.45,.35,.05,.82,.32,.95],
  [24,0x010610,0x020b1a,0x00f5d4,0x0a244d,0x010308,0x3b6998,.35,.3,.03,.88,.28,1]
 ];
 const frames=rows.map(row=>{const frame:any={hour:row[0]};colors.forEach((k,i)=>frame[k]=new THREE.Color(row[i+1]));numbers.forEach((k,i)=>frame[k]=row[i+7]);return frame;});
 const finite=(name:string,v:any,min=-Infinity,max=Infinity)=>{if(!Number.isFinite(v)||v<min||v>max)throw new Error(`Invalid cycle ${name}`);return v;};
 return class DayNightAquariumCycle {
  scene:any;sunLight:any;hemiLight:any;postFX:any;camera:any;caustics:any[];orbitRadius:number;orbitCenter:any;bioUniforms:any;disposed=false;
  _hour=12;_auto=true;_duration=90;_elapsed=0;_records=new Map<any,any>();_work:any={};_sun:any;_local:any;_projected:any;_screen:any;_patch:any;
  constructor(options:any){
   if(!options?.scene?.isScene)throw new Error('Cycle requires a Scene');this.scene=options.scene;this.sunLight=options.sunLight;this.hemiLight=options.hemiLight;this.postFX=options.postFX;this.camera=options.camera;
   if(this.sunLight&&!this.sunLight.isDirectionalLight)throw new Error('sunLight must be DirectionalLight');if(this.hemiLight&&!this.hemiLight.isHemisphereLight)throw new Error('hemiLight must be HemisphereLight');if(this.postFX&&!this.postFX.setConfig)throw new Error('Supply aquarium post controller');if(this.camera&&!this.camera.isCamera)throw new Error('camera must be Camera');
   this.orbitRadius=finite('orbitRadius',options.orbitRadius??9,.0001);this.orbitCenter=(options.orbitCenter??new THREE.Vector3()).clone();if(!this.orbitCenter.isVector3||!this.orbitCenter.toArray().every(Number.isFinite))throw new Error('Finite world orbitCenter required');
   this.caustics=[...(options.causticControllers??[])];if(options.causticsFloor){for(const m of Array.isArray(options.causticsFloor.material)?options.causticsFloor.material:[options.causticsFloor.material]){const uniforms=m?.userData?.causticUniforms;if(!uniforms?.uCausticColor)throw new Error('Floor requires injected caustic material');this.caustics.push({uniforms});}}
   if(this.caustics.some(c=>!c?.setColor&&!c?.uniforms?.uCausticColor))throw new Error('Supply caustic controllers or patched floor');
   for(const k of colors)this._work[k]=new THREE.Color();this._sun=new THREE.Vector3();this._local=new THREE.Vector3();this._projected=new THREE.Vector3();this._screen=new THREE.Vector2(.5,1.15);this._patch={waterTint:this._work.waterTint,sunScreenPosition:this._screen,bloomStrength:0,bloomThreshold:0,godRayIntensity:0};
   this.bioUniforms={uBioGlowStrength:{value:0},uBioPulseTime:{value:0},uBioPrimaryColor:{value:new THREE.Color(0x00f7ff)},uBioSecondaryColor:{value:new THREE.Color(0x7b2cbf)}};
   if(options.autoCycle!==undefined)this.autoCycle=options.autoCycle;if(options.dayDurationSeconds!==undefined)this.dayDurationSeconds=options.dayDurationSeconds;this.applyTimeOfDay(options.timeOfDay??12);
  }
  _live(){if(this.disposed)throw new Error('Day-night cycle is disposed');}
  get timeOfDay(){return this._hour;}set timeOfDay(v:number){this.applyTimeOfDay(v);}
  get autoCycle(){return this._auto;}set autoCycle(v:boolean){this._live();if(typeof v!=='boolean')throw new Error('autoCycle must be boolean');this._auto=v;}
  get dayDurationSeconds(){return this._duration;}set dayDurationSeconds(v:number){this._live();this._duration=finite('dayDurationSeconds',v,5,86400);}
  setGlowColor(value:any,secondary=false){this._live();if(!(value?.isColor||(Number.isInteger(value)&&value>=0&&value<=0xffffff)||(typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value))))throw new Error('Supply Color or RGB hex');const c=new THREE.Color(value);if(!c.toArray().every(Number.isFinite))throw new Error('Finite glow color required');this.bioUniforms[secondary?'uBioSecondaryColor':'uBioPrimaryColor'].value.copy(c);}
  registerBioluminescentMaterial(material:any,type='fish',options:any={}){
   this._live();if(!material?.isMeshStandardMaterial)throw new Error('Glow requires MeshStandard/PhysicalMaterial; clone shared materials before registration');if(!['fish','plant'].includes(type))throw new Error('Glow type must be fish or plant');
   const bounds=options.bounds;if(!bounds?.isBox3||bounds.isEmpty()||!bounds.min.toArray().concat(bounds.max.toArray()).every(Number.isFinite))throw new Error('Audited local/pattern bounds required');
   const size=bounds.getSize(new THREE.Vector3());size.set(Math.max(size.x,1e-6),Math.max(size.y,1e-6),Math.max(size.z,1e-6));const axis=options.axis??'z',up=options.upAxis??'y';if(!['x','y','z'].includes(axis)||!['x','y','z'].includes(up)||axis===up)throw new Error('Distinct pattern axis/upAxis required');
   const toPattern=(options.toPattern??new THREE.Matrix4()).clone();if(!toPattern.isMatrix4||!toPattern.elements.every(Number.isFinite)||Math.abs(toPattern.determinant())<1e-12)throw new Error('Invertible finite toPattern matrix required');
   const existing=this._records.get(material);if(existing){if(existing.type!==type||existing.axis!==axis||existing.up!==up||!existing.bounds.equals(bounds)||!existing.toPattern.equals(toPattern))throw new Error('Conflicting glow pattern on shared material; clone it or supply a common frame');return existing.handle;}if(material[ownership])throw new Error('Material is already owned by another cycle or retained wrapper');
   const prior=material.onBeforeCompile,priorCache=material.customProgramCacheKey,key=priorCache.call(material),enabled={value:1};
   const uniforms={...this.bioUniforms,uCycleEnabled:enabled,uCycleMin:{value:bounds.min.clone()},uCycleSize:{value:size},uCycleToPattern:{value:toPattern}};
   const compile=(shader:any,renderer:any)=>{
    prior?.call(material,shader,renderer);if(!shader.vertexShader.includes('#include <begin_vertex>')||!shader.fragmentShader.includes('#include <emissivemap_fragment>'))throw new Error('Unsupported PBR shader chunks for bioluminescence');Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vCycleRest;\nuniform mat4 uCycleToPattern;').replace('#include <begin_vertex>','#include <begin_vertex>\nvCycleRest=(uCycleToPattern*vec4(position,1.0)).xyz;');
    const pars='\nvarying vec3 vCycleRest;\nuniform float uBioGlowStrength,uBioPulseTime,uCycleEnabled;\nuniform vec3 uBioPrimaryColor,uBioSecondaryColor,uCycleMin,uCycleSize;\n';
    const pattern=type==='fish'?`float pulse=0.55+0.45*sin(q.${axis}*14.0-uBioPulseTime*3.8);float stripe=exp(-abs(q.${up}-.5)*18.0);float spots=smoothstep(.65,.95,sin(q.${axis}*28.0)*cos(q.${up}*24.0));float mask=clamp(stripe*pulse+spots*.6,0.0,1.0);vec3 emission=mix(uBioSecondaryColor,uBioPrimaryColor,pulse)*mask*2.4;`:`float pulse=.5+.5*sin(q.${up}*10.0-uBioPulseTime*2.2+q.${axis}*6.0);float mask=smoothstep(.15,.9,q.${up});vec3 emission=mix(uBioPrimaryColor,uBioSecondaryColor,pulse)*mask*pulse*1.8;`;
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>'+pars).replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>\n{vec3 q=(vCycleRest-uCycleMin)/uCycleSize;${pattern}totalEmissiveRadiance+=emission*uBioGlowStrength*uCycleEnabled;}\n`);
   };
   const cache=()=>`${key}|aquarium-glow-v1-${type}-${axis}-${up}`;let released=false;const handle={dispose:()=>{if(released)return;released=true;enabled.value=0;const removable=material.onBeforeCompile===compile;if(material.onBeforeCompile===compile)material.onBeforeCompile=prior;if(material.customProgramCacheKey===cache)material.customProgramCacheKey=priorCache;material.needsUpdate=true;this._records.delete(material);if(removable)delete material[ownership];else material[ownership]=true;}};
   this._records.set(material,{handle,type,axis,up,bounds:bounds.clone(),toPattern});material[ownership]=true;material.onBeforeCompile=compile;material.customProgramCacheKey=cache;material.needsUpdate=true;return handle;
  }
  registerMesh(mesh:any,type='fish',options:any={}){
   this._live();if(!mesh?.isMesh)throw new Error('Mesh required');if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();const registered:any[]=[],before=new Set(this._records.keys());
   try{for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])registered.push(this.registerBioluminescentMaterial(material,type,{...options,bounds:options.bounds??mesh.geometry.boundingBox}));}catch(error){for(const [mat,record]of this._records)if(!before.has(mat))record.handle.dispose();throw error;}return registered;
  }
  update(delta:number,elapsedTime?:number){this._live();finite('delta',delta,0);const elapsed=elapsedTime??this._elapsed+delta;finite('elapsedTime',elapsed,this._elapsed);this._elapsed=elapsed;this.bioUniforms.uBioPulseTime.value=elapsed;if(this._auto)this._hour=(this._hour+(delta%this._duration)/this._duration*24)%24;this.applyTimeOfDay(this._hour);}
  applyTimeOfDay(hour:number){
   this._live();finite('timeOfDay',hour);this._hour=((hour%24)+24)%24;const h=this._hour;let i=0;while(i<frames.length-2&&h>frames[i+1].hour)i++;const a=frames[i],b=frames[i+1],raw=(h-a.hour)/(b.hour-a.hour),t=raw*raw*(3-2*raw);
   for(const k of colors)this._work[k].lerpColors(a[k],b[k],t);for(const k of numbers)this._work[k]=THREE.MathUtils.lerp(a[k],b[k],t);
   if(this.scene.background?.isColor)this.scene.background.copy(this._work.fogColor);if(this.scene.fog?.color)this.scene.fog.color.copy(this._work.fogColor);
   const angle=(h-6)*Math.PI/12;this._sun.set(-Math.cos(angle)*this.orbitRadius*.65,Math.max(this.orbitRadius*.245,Math.abs(Math.sin(angle))*this.orbitRadius),Math.sin(angle)*this.orbitRadius*.3).add(this.orbitCenter);
   if(this.sunLight){this._local.copy(this._sun);if(this.sunLight.parent){this.sunLight.parent.updateWorldMatrix(true,false);const determinant=this.sunLight.parent.matrixWorld.determinant();if(!Number.isFinite(determinant)||Math.abs(determinant)<1e-12)throw new Error('Sun parent must be invertible');this.sunLight.parent.worldToLocal(this._local);}this.sunLight.position.copy(this._local);this.sunLight.color.copy(this._work.sunColor);this.sunLight.intensity=this._work.sunIntensity;}
   if(this.hemiLight){this.hemiLight.color.copy(this._work.hemiSky);this.hemiLight.groundColor.copy(this._work.hemiGround);this.hemiLight.intensity=this._work.hemiIntensity;}
   for(const c of this.caustics)if(!c.disposed){if(c.setColor)c.setColor(this._work.causticColor);else c.uniforms.uCausticColor.value.copy(this._work.causticColor);}
   let ray=this._work.godRayIntensity;this._screen.set(THREE.MathUtils.clamp(.5-Math.cos(angle)*.2275,.15,.85),1.15);
   if(this.camera){this.camera.updateWorldMatrix(true,false);this._projected.copy(this._sun).project(this.camera);if(!this._projected.toArray().every(Number.isFinite)||Math.abs(this._projected.z)>1)ray=0;else this._screen.set(THREE.MathUtils.clamp(this._projected.x*.5+.5,.15,.85),THREE.MathUtils.clamp(this._projected.y*.5+.5,.15,1.15));}
   if(this.postFX&&!this.postFX.disposed){this._patch.bloomStrength=this._work.bloomStrength;this._patch.bloomThreshold=this._work.bloomThreshold;this._patch.godRayIntensity=ray;this.postFX.setConfig(this._patch);}
   this.bioUniforms.uBioGlowStrength.value=this._work.bioluminescence;
  }
  dispose(){if(this.disposed)return;for(const record of [...this._records.values()])record.handle.dispose();this.bioUniforms.uBioGlowStrength.value=0;this.disposed=true;}
 };
}
