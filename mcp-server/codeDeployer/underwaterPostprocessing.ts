/** Three.js r180 WebGL2 factory. Addons are injected to keep server imports browser-free. */
export function createAquariumPostProcessingFactory(THREE:any,addons:any){
 const {EffectComposer,RenderPass,UnrealBloomPass,BokehPass,ShaderPass,OutputPass}=addons;
 const ownerKey=Symbol.for('threejs-instant-deployer.underwater-postprocessing.r180');
 const UnderwaterLensShader={name:'UnderwaterLens',uniforms:{tDiffuse:{value:null},uTime:{value:0},uResolution:{value:new THREE.Vector2(1,1)},uSunScreenPos:{value:new THREE.Vector2(.5,1.15)},uGodRayIntensity:{value:.16},uChromaticAberration:{value:.0028},uRippleStrength:{value:.0005},uWaterTint:{value:new THREE.Color(0x06283d)},uTintStrength:{value:.14},uVignetteOffset:{value:.95},uVignetteDarkness:{value:1.25},uVignetteStrength:{value:.55},uSnowIntensity:{value:.012}},vertexShader:/* glsl */`
 varying vec2 vUv;
 void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
 `,fragmentShader:/* glsl */`
 uniform sampler2D tDiffuse;
 uniform float uTime,uGodRayIntensity,uChromaticAberration,uRippleStrength,uTintStrength,uVignetteOffset,uVignetteDarkness,uVignetteStrength,uSnowIntensity;
 uniform vec2 uResolution,uSunScreenPos;
 uniform vec3 uWaterTint;
 varying vec2 vUv;
 vec2 snowHash(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}
 void main(){
  vec2 centered=vUv-.5;
  vec2 uv=vUv+vec2(sin(vUv.y*14.+uTime*1.1),cos(vUv.x*14.+uTime*.9))*uRippleStrength;
  vec2 offset=centered*uChromaticAberration*(1.+dot(centered,centered)*2.5);
  vec4 mid=texture2D(tDiffuse,clamp(uv,0.,1.));
  vec3 color=vec3(texture2D(tDiffuse,clamp(uv+offset,0.,1.)).r,mid.g,texture2D(tDiffuse,clamp(uv-offset,0.,1.)).b);
  float aspect=uResolution.x/max(uResolution.y,1.);
  vec2 toSun=(uSunScreenPos-uv)*vec2(aspect,1.);
  float angle=length(toSun)>0.00001?atan(toSun.x,toSun.y):0.;
  float wave=sin(angle*16.+uTime*.45)*.5+sin(angle*31.-uTime*.7)*.3+cos(angle*7.+uTime*.2)*.2;
  float rays=smoothstep(-.2,.9,wave)*smoothstep(.1,1.,uv.y)*exp(-length(toSun)*1.35);
  color+=vec3(.42,.88,.95)*rays*uGodRayIntensity;
  float luma=max(dot(color,vec3(.2126,.7152,.0722)),0.);
  color=mix(color,mix(uWaterTint,color*1.15,smoothstep(0.,.85,luma)),uTintStrength);
  float snow=0.;
  for(int i=0;i<3;i++){
   float layer=float(i)+1.;
   vec2 p=(vUv*vec2(aspect,1.)+vec2(uTime*.004/layer,-uTime*.012/layer))* (60.+layer*40.);
   vec2 id=floor(p),jitter=snowHash(id+layer*17.);
   vec2 d=fract(p)-(.15+.7*jitter);
   snow+=exp(-dot(d,d)*(650.+layer*250.))*(.5+.5*sin(uTime*.7+jitter.x*6.283))/layer;
  }
  color+=snow*uSnowIntensity*vec3(.7,.9,1.);
  float inner=max(0.,uVignetteOffset-.65);
  float vignette=smoothstep(inner,uVignetteOffset,length(centered)*uVignetteDarkness);
  color*=1.-uVignetteStrength*vignette;
  gl_FragColor=vec4(color,mid.a);
 }
 `};
 // BokehPass's stock scene-wide depth override discards GPU deformation. Use per-group
 // depth clones preserving customDepthMaterial hooks, without mutating borrowed shadows.
 class DeformationBokehPass extends BokehPass {
  constructor(...args:any[]){super(...args);}
  depthRecords=new Map<any,any>();
  getDepth(source:any,base:any){
   let record=this.depthRecords.get(source);
   if(!record){
    record={materials:new Map<any,any>(),dispose:()=>{for(const m of record.materials.values())m.dispose();source.removeEventListener('dispose',record.dispose);this.depthRecords.delete(source);}};
    this.depthRecords.set(source,record);source.addEventListener('dispose',record.dispose);
   }
   let depth=record.materials.get(base);
   if(!depth){
    depth=base.clone();const previous=base.onBeforeCompile,key=base.customProgramCacheKey.call(base),opacity={value:source.opacity};depth._dofOpacity=opacity;
    depth.onBeforeCompile=function(shader:any,renderer:any){
     previous.call(this,shader,renderer);
     if(!shader.fragmentShader.includes('#include <alphatest_fragment>'))throw new Error('DOF requires r180 depth shader chunks');
     shader.uniforms.uDofOpacity=opacity;
     shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float uDofOpacity;').replace('#include <alphatest_fragment>','diffuseColor.a *= uDofOpacity;\n#include <alphatest_fragment>');
     if(!shader.vertexShader.includes('#include <color_pars_vertex>')){
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\n#include <color_pars_vertex>').replace('#include <morphinstance_vertex>','#include <morphinstance_vertex>\n#include <color_vertex>\n#include <morphcolor_vertex>');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n#include <color_pars_fragment>').replace('#include <alphatest_fragment>','#include <color_fragment>\n#include <alphatest_fragment>');
     }
    };
    depth.customProgramCacheKey=()=>`${key}|dof-alpha-v1`;depth.depthPacking=THREE.RGBADepthPacking;depth.blending=THREE.NoBlending;record.materials.set(base,depth);
   }
   depth._dofOpacity.value=source.opacity;

   const keys=['vertexColors','map','alphaMap','alphaTest','alphaHash','alphaToCoverage','opacity','side','displacementMap','displacementScale','displacementBias','clippingPlanes','clipIntersection','clipShadows','polygonOffset','polygonOffsetFactor','polygonOffsetUnits'];
   for(const key of keys)if(depth[key]!==source[key]){depth[key]=source[key];depth.needsUpdate=true;}
   depth.visible=source.visible&&source.depthWrite!==false;depth.transparent=false;
   return depth;
  }
  render(renderer:any,writeBuffer:any,readBuffer:any){
   const scene=this.scene,camera=this.camera,changed:any[]=[];
   const override=scene.overrideMaterial,background=scene.background,autoClear=renderer.autoClear,clearColor=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha(),target=renderer.getRenderTarget();
   const shadows=renderer.shadowMap,shadowAuto=shadows?.autoUpdate,shadowNeeds=shadows?.needsUpdate;
   try{
    scene.overrideMaterial=null;scene.background=null;renderer.autoClear=false;if(shadows){shadows.autoUpdate=false;shadows.needsUpdate=false;}
    scene.traverse((node:any)=>{
     if(node.isMesh){
      const original=node.material;changed.push({node,material:original});
      const base=node.customDepthMaterial||this._materialDepth;
      node.material=Array.isArray(original)?original.map((m:any)=>this.getDepth(m,base)):this.getDepth(original,base);
     }else if(node.isPoints||node.isLine||node.isSprite){changed.push({node,layerMask:node.layers.mask});node.layers.mask=0;}
    });
    renderer.setClearColor(0xffffff,1);renderer.setRenderTarget(this._renderTargetDepth);renderer.clear();renderer.render(scene,camera);
    this.uniforms.tColor.value=readBuffer.texture;this.uniforms.nearClip.value=camera.near;this.uniforms.farClip.value=camera.far;
    renderer.setRenderTarget(this.renderToScreen?null:writeBuffer);renderer.clear();this._fsQuad.render(renderer);
   }finally{
    for(const entry of changed){if('material' in entry)entry.node.material=entry.material;else entry.node.layers.mask=entry.layerMask;}
    scene.overrideMaterial=override;scene.background=background;renderer.autoClear=autoClear;renderer.setClearColor(clearColor,alpha);renderer.setRenderTarget(target);
    if(shadows){shadows.autoUpdate=shadowAuto;shadows.needsUpdate=shadowNeeds;}
   }
  }
  dispose(){for(const record of [...this.depthRecords.values()])record.dispose();super.dispose();}
 }
 const defaults={exposure:1.05,focusDistance:4,focusDamping:4.5,aperture:.0012,maxBlur:.006,bloomStrength:.38,bloomRadius:.65,bloomThreshold:.72,godRayIntensity:.16,chromaticAberration:.0028,rippleStrength:.0005,tintStrength:.14,vignetteOffset:.95,vignetteDarkness:1.25,vignetteStrength:.55,snowIntensity:.012,bloomEnabled:true,bokehEnabled:true,underwaterEnabled:true,waterTint:0x06283d,sunScreenPosition:new THREE.Vector2(.5,1.15)};
 function validateConfig(config:any){
  for(const key of Object.keys(defaults)){
   const v=config[key];
   if(key.endsWith('Enabled')){if(typeof v!=='boolean')throw new Error(`${key} must be boolean`);}
   else if(key==='waterTint'){
    if(!(v?.isColor||(Number.isInteger(v)&&v>=0&&v<=0xffffff)||(typeof v==='string'&&/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v))))throw new Error('waterTint must be Color, RGB hex number or #hex');
    const c=new THREE.Color(v);if(![c.r,c.g,c.b].every(Number.isFinite))throw new Error('Invalid waterTint');
   }else if(key==='sunScreenPosition'){if(!Number.isFinite(v?.x)||!Number.isFinite(v?.y))throw new Error('sunScreenPosition must have finite x/y');}
   else if(!Number.isFinite(v)||v<0)throw new Error(`${key} must be finite and nonnegative`);
  }
  for(const key of ['bloomRadius','tintStrength','vignetteStrength'])if(config[key]>1)throw new Error(`${key} must be 0..1`);
  if(config.vignetteOffset<=0||config.focusDistance<=0)throw new Error('focusDistance and vignetteOffset must be positive');
 }
 function createAquariumPostProcessing(renderer:any,scene:any,camera:any,options:any={}){
  if(!renderer?.isWebGLRenderer||!renderer.capabilities?.isWebGL2)throw new Error('Three.js r180 WebGL2 WebGLRenderer required');
  if(!renderer.extensions?.has('EXT_color_buffer_float'))throw new Error('HDR post-processing requires EXT_color_buffer_float');
  if(renderer.capabilities.logarithmicDepthBuffer||renderer.capabilities.reversedDepthBuffer)throw new Error('Bokeh requires standard depth; logarithmic/reversed depth buffers are unsupported');
  if(!scene?.isScene||(!camera?.isPerspectiveCamera&&!camera?.isOrthographicCamera)||!Number.isFinite(camera.near)||camera.near<0||!Number.isFinite(camera.far)||camera.far<=camera.near)throw new Error('Scene and finite perspective/orthographic camera clip range required');
  if(renderer[ownerKey])throw new Error('Dispose the previous post-processing stack for this renderer first');
  let config:any={...defaults};for(const key of Object.keys(defaults))if(options[key]!==undefined)config[key]=options[key];validateConfig(config);
  const maxPixelRatio=options.maxPixelRatio??2;if(!Number.isFinite(maxPixelRatio)||maxPixelRatio<=0)throw new Error('maxPixelRatio must be positive');
  const requestedSamples=options.samples??4;if(!Number.isInteger(requestedSamples)||requestedSamples<0||requestedSamples>16)throw new Error('samples must be integer 0..16');
  const gl=renderer.getContext(),supported=Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,gl.RGBA16F,gl.SAMPLES)) as number[];
  const samples=Math.max(0,...supported.filter(n=>n<=requestedSamples&&n<=renderer.capabilities.maxSamples));
  if(options.focusObjects!==undefined&&!Array.isArray(options.focusObjects))throw new Error('focusObjects must be an array');
  const element=renderer.domElement,container=options.container??element.parentElement;
  const passes:any={},owned:any[]=[];let composer:any,renderTarget:any,observer:any,disposed=false,elapsed=0,tracked:any=null;
  const oldTone=renderer.toneMapping,oldExposure=renderer.toneMappingExposure,oldColorSpace=renderer.outputColorSpace;
  const state={samples,width:0,height:0,pixelRatio:1,focusDistance:config.focusDistance,targetFocusDistance:config.focusDistance,focusInFront:true};
  let ownedExposure=config.exposure;
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),point=new THREE.Vector3();let press:any=null;
  const live=()=>{if(disposed)throw new Error('Post-processing stack is disposed');};
  const clampFocus=(n:number)=>THREE.MathUtils.clamp(n,Math.max(camera.near,Math.min(1e-4,camera.far*.5)),camera.far);
  function setFocusDistance(distance:number,immediate=false){live();if(!Number.isFinite(distance)||distance<=0)throw new Error('Focus distance must be finite and positive');tracked=null;state.targetFocusDistance=clampFocus(distance);if(immediate)state.focusDistance=state.targetFocusDistance;}
  function setFocusTarget(target:any){live();if(target!==null&&!target?.isVector3&&!target?.isObject3D)throw new Error('Focus target must be Object3D, Vector3 or null');if(target?.isVector3&&![target.x,target.y,target.z].every(Number.isFinite))throw new Error('Invalid focus vector');tracked=target;}
  function applyConfig(){
   renderer.toneMappingExposure=config.exposure;ownedExposure=config.exposure;
   passes.bokehPass.enabled=config.bokehEnabled;passes.bloomPass.enabled=config.bloomEnabled;passes.underwaterPass.enabled=config.underwaterEnabled;
   passes.bokehPass.uniforms.aperture.value=config.aperture;passes.bokehPass.uniforms.maxblur.value=config.maxBlur;
   Object.assign(passes.bloomPass,{strength:config.bloomStrength,radius:config.bloomRadius,threshold:config.bloomThreshold});
   const u=passes.underwaterPass.uniforms;
   for(const [key,name] of Object.entries({godRayIntensity:'uGodRayIntensity',chromaticAberration:'uChromaticAberration',rippleStrength:'uRippleStrength',tintStrength:'uTintStrength',vignetteOffset:'uVignetteOffset',vignetteDarkness:'uVignetteDarkness',vignetteStrength:'uVignetteStrength',snowIntensity:'uSnowIntensity'}))u[name].value=config[key];
   u.uWaterTint.value.set(config.waterTint);u.uSunScreenPos.value.copy(config.sunScreenPosition);
  }
  function setConfig(patch:any){live();if(!patch||typeof patch!=='object')throw new Error('Config object required');for(const key of Object.keys(patch))if(!Object.hasOwn(defaults,key))throw new Error(`Unknown post-processing config: ${key}`);const next={...config,...patch};validateConfig(next);config=next;applyConfig();if('focusDistance' in patch)setFocusDistance(config.focusDistance);}
  function resize(width?:number,height?:number,pixelRatio?:number){
   live();const size=renderer.getSize(new THREE.Vector2());const w=width??container?.clientWidth??size.x,h=height??container?.clientHeight??size.y,ratio=pixelRatio??options.pixelRatio??renderer.getPixelRatio();
   if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0||!Number.isFinite(ratio)||ratio<=0)throw new Error('Positive finite size and pixelRatio required');
   const dpr=Math.min(ratio,maxPixelRatio),limit=renderer.capabilities.maxTextureSize;
   if(Math.floor(w*dpr)<1||Math.floor(h*dpr)<1)throw new Error('Size must cover at least one drawing-buffer pixel');
   if(w*dpr>limit||h*dpr>limit)throw new Error('Post-processing size exceeds maximum texture size');
   state.width=w;state.height=h;state.pixelRatio=dpr;
   if(options.resizeRenderer!==false){renderer.setPixelRatio(dpr);renderer.setSize(w,h,options.updateStyle!==false);}
   if(camera.isPerspectiveCamera)camera.aspect=w/h;camera.updateProjectionMatrix();
   composer.setPixelRatio(dpr);composer.setSize(w,h);passes.underwaterPass.uniforms.uResolution.value.set(Math.floor(w*dpr),Math.floor(h*dpr));
  }
  function visible(object:any){for(let node=object;node;node=node.parent)if(!node.visible||node.userData?.excludeFromFocus)return false;return true;}
  function click(event:any){
   if(event.shiftKey)return; // Reserved for opt-in feeding gestures.
   const rect=element.getBoundingClientRect();if(!rect.width||!rect.height)return;
   const x=(event.clientX-rect.left)/rect.width,y=(event.clientY-rect.top)/rect.height;if(x<0||x>1||y<0||y>1)return;
   pointer.set(x*2-1,1-y*2);camera.updateWorldMatrix(true,false);scene.updateMatrixWorld(true);raycaster.setFromCamera(pointer,camera);
   const hit=raycaster.intersectObjects(options.focusObjects??scene.children,true).find((h:any)=>{const m=Array.isArray(h.object.material)?h.object.material[h.face?.materialIndex??0]:h.object.material;return h.object.isMesh&&visible(h.object)&&m?.visible!==false;});
   if(hit){const depth=-point.copy(hit.point).applyMatrix4(camera.matrixWorldInverse).z;if(depth>0)setFocusDistance(depth);}
  }
  const down=(event:any)=>{if((event.button??0)===0&&event.isPrimary!==false)press={x:event.clientX,y:event.clientY,id:event.pointerId};};
  const up=(event:any)=>{const start=press;press=null;if(start&&event.pointerId===start.id&&Math.hypot(event.clientX-start.x,event.clientY-start.y)<=4)click(event);};
  const cancel=()=>{press=null;};
  function dispose(){
   if(disposed)return;disposed=true;observer?.disconnect();element.removeEventListener('pointerdown',down);element.removeEventListener('pointerup',up);element.removeEventListener('pointercancel',cancel);
   for(const pass of owned)pass.dispose?.();if(composer)composer.dispose();else renderTarget?.dispose();
   if(renderer.toneMapping===THREE.ACESFilmicToneMapping)renderer.toneMapping=oldTone;if(renderer.toneMappingExposure===ownedExposure)renderer.toneMappingExposure=oldExposure;if(renderer.outputColorSpace===THREE.SRGBColorSpace)renderer.outputColorSpace=oldColorSpace;
   if(renderer[ownerKey]===api)delete renderer[ownerKey];
  }
  const api={get disposed(){return disposed;},composer:null as any,passes,get state(){return {...state};},resize,setConfig,setFocusTarget,setFocusDistance,dispose,
   get focusTarget(){return tracked;},
   render(delta:number,elapsedTime?:number){
    live();const time=elapsedTime??elapsed+delta;if(!Number.isFinite(delta)||delta<0||!Number.isFinite(time)||time<elapsed)throw new Error('Finite nonnegative delta and monotonic elapsed required');
    elapsed=time;camera.updateWorldMatrix(true,false);
    if(tracked){if(tracked.isVector3)point.copy(tracked);else tracked.getWorldPosition(point);if(![point.x,point.y,point.z].every(Number.isFinite))throw new Error('Nonfinite focus target');const depth=-point.applyMatrix4(camera.matrixWorldInverse).z;state.focusInFront=depth>0;if(depth>0)state.targetFocusDistance=clampFocus(depth);}
    state.targetFocusDistance=clampFocus(state.targetFocusDistance);state.focusDistance=clampFocus(state.focusDistance+(state.targetFocusDistance-state.focusDistance)*(1-Math.exp(-config.focusDamping*delta)));
    passes.bokehPass.uniforms.focus.value=state.focusDistance;passes.underwaterPass.uniforms.uTime.value=elapsed;
    const target=renderer.getRenderTarget(),autoClear=renderer.autoClear,color=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha();
    try{composer.render(delta);}finally{renderer.setRenderTarget(target);renderer.autoClear=autoClear;renderer.setClearColor(color,alpha);}
   }
  };
  try{
   renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.outputColorSpace=THREE.SRGBColorSpace;
   renderTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples});composer=new EffectComposer(renderer,renderTarget);api.composer=composer;
   const add=(name:string,pass:any)=>{passes[name]=pass;owned.push(pass);composer.addPass(pass);};
   add('renderPass',new RenderPass(scene,camera));add('bokehPass',new DeformationBokehPass(scene,camera,{focus:clampFocus(config.focusDistance),aperture:config.aperture,maxblur:config.maxBlur}));
   passes.bokehPass.materialBokeh.defines.PERSPECTIVE_CAMERA=camera.isPerspectiveCamera?1:0;
   add('bloomPass',new UnrealBloomPass(new THREE.Vector2(1,1),config.bloomStrength,config.bloomRadius,config.bloomThreshold));add('underwaterPass',new ShaderPass(UnderwaterLensShader));add('outputPass',new OutputPass());
   applyConfig();state.focusDistance=state.targetFocusDistance=clampFocus(config.focusDistance);resize(options.width,options.height,options.pixelRatio);
   if(options.autoFocusTarget!==undefined)setFocusTarget(options.autoFocusTarget);
   if(options.enableClickToFocus!==false){element.addEventListener('pointerdown',down);element.addEventListener('pointerup',up);element.addEventListener('pointercancel',cancel);}
   if(options.observeResize!==false&&container&&typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(()=>{if(container.clientWidth>0&&container.clientHeight>0)resize();});observer.observe(container);}
   renderer[ownerKey]=api;return api;
  }catch(error){dispose();throw error;}
 }
 return {createAquariumPostProcessing,UnderwaterLensShader};
}
