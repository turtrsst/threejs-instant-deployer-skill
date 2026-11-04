import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createUnderwaterAudioSynthesizer} from '../dist/index.js';
import {UnderwaterAudioSynthesizer as TemplateSynth,minnaertFrequency as templateFrequency} from '../templates/underwater-audio-synth.js';
class Param{
 value=0;events=[];
 setValueAtTime(v,t){assert.ok(Number.isFinite(v)&&Number.isFinite(t));this.value=v;this.events.push(['set',v,t]);return this;}
 linearRampToValueAtTime(v,t){this.setValueAtTime(v,t);this.events.at(-1)[0]='linear';return this;}
 exponentialRampToValueAtTime(v,t){assert.ok(v>0);this.setValueAtTime(v,t);this.events.at(-1)[0]='exponential';return this;}
 setTargetAtTime(v,t,c){assert.ok(c>0);this.setValueAtTime(v,t);this.events.at(-1)[0]='target';return this;}
 cancelScheduledValues(t){assert.ok(Number.isFinite(t));return this;}
}
class Node{
 connections=[];stops=[];starts=[];onended=null;disconnected=false;
 constructor(type){this.type=type;for(const key of ['gain','frequency','Q','pan','threshold','knee','ratio','attack','release'])this[key]=new Param();if(type==='Gain')this.gain.value=1;if(type==='Oscillator')this.frequency.value=440;}
 connect(target){this.connections.push(target);return target;}disconnect(){this.connections=[];this.disconnected=true;}start(...args){this.starts.push(args);}stop(...args){this.stops.push(args);}finish(){if(this.finished)return;this.finished=true;this.onended?.();}
}
class Context{
 state='suspended';sampleRate=8000;currentTime=0;nodes=[];buffers=[];resumeCalls=0;closeCalls=0;destination=new Node('Destination');
 createBuffer(channels,length,rate){assert.ok(Number.isInteger(length)&&length>0);const data=Array.from({length:channels},()=>new Float32Array(length));const buffer={sampleRate:rate,length,duration:length/rate,getChannelData:c=>data[c]};this.buffers.push(buffer);return buffer;}
 resume(){this.resumeCalls++;if(this.failResume)return Promise.reject(new Error('Gesture denied'));this.state='running';return Promise.resolve();}close(){this.closeCalls++;this.state='closed';return Promise.resolve();}
}
for(const type of ['Gain','DynamicsCompressor','Convolver','BufferSource','BiquadFilter','Oscillator','StereoPanner'])Context.prototype['create'+type]=function(){const node=new Node(type);if(type==='Convolver'||type==='BufferSource')node.buffer=null;this.nodes.push(node);return node;};
function setup(options={}){const contexts=[],timers=new Map();let next=0;const platform={AudioContext:class extends Context{constructor(){super();contexts.push(this);}},setInterval(fn,ms){assert.equal(ms,250);timers.set(++next,fn);return next;},clearInterval(id){timers.delete(id);}};const api=createUnderwaterAudioSynthesizer(platform),audio=new api.UnderwaterAudioSynthesizer(options);return{...api,audio,contexts,timers,platform};}
function finishVoices(audio){for(const voice of [...audio._voices])for(const source of voice.sources)source.finish();}
test('lazy import/constructor/config never create audio or timers; init is explicit and shared',async()=>{
 const f=setup();f.audio.setCurrentSpeed(3);f.audio.setMasterVolume(.2);assert.equal(f.contexts.length,0);assert.equal(f.timers.size,0);const p=f.audio.init(),q=f.audio.init();assert.equal(p,q);await p;assert.equal(f.contexts.length,1);assert.equal(f.timers.size,1);const nodes=f.audio._allNodes.size;await f.audio.init();assert.equal(f.audio._allNodes.size,nodes);assert.equal(f.timers.size,1);await f.audio.dispose();assert.equal(f.timers.size,0);assert.equal(f.contexts[0].closeCalls,1);
});
test('all wet/dry/sub/chime audio paths share the final master gate; volume changes respect mute',async()=>{
 const f=setup({zenChimesEnabled:true});await f.audio.init();const n=f.audio.nodes;assert.deepEqual(n.dry.connections,[n.compressor]);assert.deepEqual(n.reverbConvolver.connections,[n.reverbMix]);assert.deepEqual(n.reverbMix.connections,[n.compressor]);assert.deepEqual(n.compressor.connections,[n.masterGain]);assert.deepEqual(n.masterGain.connections,[f.audio.ctx.destination]);f.audio.triggerZenHarmonicNote();f.audio.setMuted(true);assert.equal(n.masterGain.gain.events.at(-1)[1],0);f.audio.setMasterVolume(.8);assert.equal(n.masterGain.gain.events.at(-1)[1],0);assert.equal(f.audio.triggerBubbleCluster(),0);assert.equal(f.audio.triggerFishScatterWhoosh(),false);f.audio.toggleMute();assert.equal(n.masterGain.gain.events.at(-1)[1],.8);await f.audio.dispose();
});
test('Minnaert inverse radius physics and finite positive bounds, without claiming physical sweep',()=>{
 const {minnaertFrequency}=createUnderwaterAudioSynthesizer();assert.ok(Math.abs(minnaertFrequency(.003)/minnaertFrequency(.006)-2)<1e-12);assert.ok(minnaertFrequency(.003)>1000&&minnaertFrequency(.003)<1200);assert.equal(minnaertFrequency(.003),templateFrequency(.003));assert.throws(()=>minnaertFrequency(0),/Positive/);assert.throws(()=>minnaertFrequency(1e-320),/finite/);
});
test('seeded generated noise/reverb are finite and seam bridged; buffers cache across whooshes',async()=>{
 const a=setup(),b=setup();await Promise.all([a.audio.init(),b.audio.init()]);for(const key of ['drone','whoosh']){const x=a.audio.buffers[key].getChannelData(0),y=b.audio.buffers[key].getChannelData(0);assert.deepEqual(x,y);assert.ok([...x].every(Number.isFinite));assert.ok(Math.abs(x[0]-x.at(-1))<1e-7);}const count=a.audio.ctx.buffers.length,buffer=a.audio.buffers.whoosh;a.audio.triggerFishScatterWhoosh();finishVoices(a.audio);a.audio.triggerFishScatterWhoosh();assert.equal(a.audio.ctx.buffers.length,count);assert.equal(a.audio.buffers.whoosh,buffer);await Promise.all([a.audio.dispose(),b.audio.dispose()]);
});
test('bounded voices clean up oscillator/filter/panner nodes on ended, including both FM sources',async()=>{
 const f=setup({maxVoices:2,zenChimesEnabled:true});await f.audio.init();const baseline=f.audio._allNodes.size;assert.equal(f.audio.triggerZenHarmonicNote(),true);assert.equal(f.audio.triggerZenHarmonicNote(),true);assert.equal(f.audio.triggerZenHarmonicNote(),false);assert.equal(f.audio.stats.activeVoices,2);assert.ok(f.audio.stats.droppedVoices>0);const voice=[...f.audio._voices][0],sources=[...voice.sources];sources[0].finish();assert.equal(f.audio.stats.activeVoices,2);sources[1].finish();assert.equal(f.audio.stats.activeVoices,1);finishVoices(f.audio);assert.equal(f.audio._allNodes.size,baseline);assert.equal(f.audio.stats.activeVoices,0);await f.audio.dispose();
});
test('bubble exponential pitch and stereo pan are bounded; no audio at zero intensity or suspension',async()=>{
 const f=setup();assert.equal(f.audio.triggerBubbleCluster(),0);await f.audio.init();assert.equal(f.audio.triggerBubbleCluster(0),0);const n=f.audio.triggerBubbleCluster(1,1);assert.ok(n>=2&&n<=8);for(const voice of f.audio._voices){const osc=[...voice.sources][0];assert.ok(osc.frequency.events.some(e=>e[0]==='exponential'));for(const node of voice.nodes)if(node.type==='StereoPanner')assert.ok(Math.abs(node.pan.value)<=1);}f.audio.ctx.state='suspended';assert.equal(f.audio.triggerBubbleCluster(),0);assert.throws(()=>f.audio.triggerBubbleCluster(3),/intensity/);assert.throws(()=>f.audio.triggerFishScatterWhoosh(2),/pan/);await f.audio.dispose();
});
test('scheduler uses audio time, caps catch-up, and never emits muted/suspended background bursts',async()=>{
 const f=setup({bubbleRate:8,zenChimesEnabled:true,chimeRate:1});await f.audio.init();let bubbles=0,chimes=0;f.audio.triggerBubbleCluster=()=>{bubbles++;};f.audio.triggerZenHarmonicNote=()=>{chimes++;};const tick=[...f.timers.values()][0];f.audio.ctx.currentTime=.2;f.audio._nextBubble=.01;tick();assert.ok(bubbles>0&&bubbles<=4);const before=bubbles;f.audio.ctx.currentTime=20;tick();assert.equal(bubbles,before);f.audio.setMuted(true);f.audio.ctx.currentTime=20.2;tick();assert.equal(bubbles,before);f.audio.setMuted(false);f.audio.setConfig({bubbleRate:0,zenChimesEnabled:false});f.audio.ctx.currentTime=20.4;tick();assert.equal(bubbles,before);assert.equal(f.audio._nextBubble,Infinity);assert.equal(f.audio._nextChime,Infinity);await f.audio.dispose();
});
test('configuration snapshots are immutable by alias, validated atomically, pre-init tuning retained',async()=>{
 const f=setup();const p=f.audio.params;p.masterVolume=1;assert.equal(f.audio.params.masterVolume,.35);assert.throws(()=>f.audio.setConfig({masterVolume:.8,bubbleRate:9}),/bubbleRate/);assert.equal(f.audio.params.masterVolume,.35);assert.throws(()=>f.audio.setConfig({unknown:1}),/Unknown/);f.audio.setConfig({currentVelocity:4,droneIntensity:.2,reverbMix:0});await f.audio.init();assert.equal(f.audio.nodes.deepFilter.frequency.value,110+4*48);assert.equal(f.audio.nodes.lfo.frequency.value,.08+4*.06);assert.equal(f.audio.nodes.lfo2.frequency.value,.05+4*.025);assert.equal(f.audio.nodes.reverbMix.gain.value,0);await f.audio.dispose();
});
test('borrowed contexts are disconnected but never closed; owned dispose is idempotent and complete',async()=>{
 const context=new Context(),foreign=context.createGain(),f=setup({context});await f.audio.init();f.audio.triggerFishScatterWhoosh();const sources=[...f.audio._sources],nodes=[...f.audio._allNodes];const p=f.audio.dispose();assert.equal(p,f.audio.dispose());await p;assert.equal(context.closeCalls,0);assert.equal(foreign.disconnected,false);assert.ok(sources.every(s=>s.stops.length>0));assert.ok(nodes.every(n=>n.disconnected));assert.equal(f.audio.stats.activeVoices,0);assert.equal(f.audio.ctx,null);assert.deepEqual(f.audio.buffers,{});assert.throws(()=>f.audio.setCurrentSpeed(1),/disposed/);await assert.rejects(f.audio.init(),/disposed/);
});
test('resume rejection can be retried without graph duplication and no dangling interval',async()=>{
 const ctx=new Context();ctx.failResume=true;const f=setup({context:ctx});await assert.rejects(f.audio.init(),/Gesture/);const count=ctx.nodes.length;assert.equal(f.timers.size,0);ctx.failResume=false;await f.audio.init();assert.equal(ctx.nodes.length,count);assert.equal(f.timers.size,1);await f.audio.dispose();
});
test('partial graph failure cleans created nodes/owned context and unsupported audio remains lazy',async()=>{
 const f=setup();f.platform.AudioContext=class extends Context{createConvolver(){throw new Error('allocation failed');}};await assert.rejects(f.audio.init(),/allocation/);assert.equal(f.audio.disposed,true);assert.equal(f.audio._allNodes.size,0);assert.equal(f.timers.size,0);const {UnderwaterAudioSynthesizer}=createUnderwaterAudioSynthesizer({});const a=new UnderwaterAudioSynthesizer();await assert.rejects(a.init(),/unavailable/);await a.dispose();assert.equal(new TemplateSynth().isInitialized,false);
});
test('canvas helper uses local pan, ignores orbit drags, removes listeners and does not own synth',async()=>{
 class Canvas extends EventTarget{getBoundingClientRect(){return{left:100,top:50,width:400,height:200};}}const canvas=new Canvas(),f=setup(),binding=f.bindUnderwaterAudioCanvas(f.audio,canvas);const emit=(type,x,y)=>{const e=new Event(type);Object.assign(e,{button:0,pointerId:1,clientX:x,clientY:y});canvas.dispatchEvent(e);};emit('pointerdown',200,150);emit('pointerup',230,150);assert.equal(f.contexts.length,0);emit('pointerdown',400,150);emit('pointerup',400,150);await binding.ready;assert.equal(f.contexts.length,1);assert.ok(f.audio.stats.bubbleVoices>0);binding.dispose();binding.dispose();const before=f.audio.stats.bubbleVoices;emit('pointerdown',300,150);emit('pointerup',300,150);await binding.ready;assert.equal(f.audio.stats.bubbleVoices,before);assert.equal(f.audio.disposed,false);await f.audio.dispose();
});
test('disposal during pending activation prevents timer startup and safely rejects init',async()=>{
 const f=setup();let release;f.platform.AudioContext=class extends Context{resume(){return new Promise(resolve=>{release=resolve;});}};const pending=f.audio.init(),rejection=assert.rejects(pending,/disposed/);await f.audio.dispose();release();await rejection;assert.equal(f.timers.size,0);assert.equal(f.audio._allNodes.size,0);assert.equal(f.audio._sources.size,0);
});
test('feeding accents share existing voice budget/master paths and ended cleanup without activation',async()=>{
 const f=setup({maxVoices:1});assert.equal(f.audio.triggerWaterPlop(),false);assert.equal(f.contexts.length,0);await f.audio.init();const baseline=f.audio._allNodes.size;assert.equal(f.audio.triggerWaterPlop(.4),true);assert.equal(f.audio.triggerFishSnap(),false);finishVoices(f.audio);assert.equal(f.audio._allNodes.size,baseline);assert.equal(f.audio.triggerFishSnap(-.5),true);f.audio.setMuted(true);assert.equal(f.audio.triggerWaterPlop(),false);await f.audio.dispose();
});
