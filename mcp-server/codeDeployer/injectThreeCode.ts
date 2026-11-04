import {parse} from '@babel/parser';
import traverseModule from '@babel/traverse';
import generateModule from '@babel/generator';
import * as t from '@babel/types';
import {parse as parseHTML} from 'parse5';
import {auditThreeCode} from './auditThreeCode.js';
import {createBioMotionInjector,inferBioMotionPreset} from './bioMotion.js';
import {createAssetDeployer} from './runtime.js';
const traverse:any=(traverseModule as any).default||traverseModule;
const generate:any=(generateModule as any).default||generateModule;
export interface InjectOptions {target:string;manifest:any;url?:string;renderer?:string;scene?:string;html?:boolean;threeVersion?:string;bioPreset?:'auto'|'none'|'fish_swim'|'aquatic_plant'|'soft_coral';}
function injectJS(source:string,options:InjectOptions) {
 for(const id of [options.target,options.renderer||'renderer',options.scene||'scene'])if(!/^[A-Za-z_$][\w$]*$/.test(id))throw new Error('Invalid identifier');
 const audit=auditThreeCode(source);
 if(!audit.targets.some(t=>t.target===options.target))throw new Error('Target requires a top-level Mesh and statically measurable geometry; use the runtime API for dynamic targets');
 const ast=parse(source,{sourceType:'module',plugins:['typescript','jsx']});
 const aliases=new Map<string,string>(); const namespaces=new Set<string>();
 for(const node of ast.program.body)if(t.isImportDeclaration(node)&&node.source.value==='three')for(const s of node.specifiers){if(t.isImportNamespaceSpecifier(s))namespaces.add(s.local.name);if(t.isImportSpecifier(s))aliases.set(s.local.name,t.isIdentifier(s.imported)?s.imported.name:s.imported.value);}
 let target:any;let loop:any;let collision=false;
 traverse(ast,{Identifier(p:any){if(p.node.name==='__instantAssets')collision=true;},VariableDeclarator(p:any){if(t.isIdentifier(p.node.id,{name:options.target}))target=p.node;},Function(p:any){if(p.node.id?.name==='animate'||(p.parent.type==='VariableDeclarator'&&p.parent.id?.name==='animate'))loop=p;},CallExpression(p:any){const c=p.node.callee;if(t.isMemberExpression(c)&&t.isIdentifier(c.property,{name:'setAnimationLoop'})&&t.isFunction(p.node.arguments[0]))loop=p.get('arguments.0');}});
 if(collision)throw new Error('File already contains an injected deployment; edit existing integration instead');
 if(!target||!t.isNewExpression(target.init))throw new Error('Target must be a statically declared Mesh');
 function constructorName(n:any){if(t.isIdentifier(n))return aliases.get(n.name);if(t.isMemberExpression(n)&&t.isIdentifier(n.object)&&namespaces.has(n.object.name)&&t.isIdentifier(n.property))return n.property.name;return undefined;}
 if(constructorName(target.init.callee)!=='Mesh')throw new Error('Target constructor is not an imported Three.js Mesh');
 const geometry=target.init.arguments[0];
 if(!t.isNewExpression(geometry)||!['BoxGeometry','CylinderGeometry','SphereGeometry','ConeGeometry'].includes(constructorName(geometry.callee)||''))throw new Error('Target needs inline Box/Cylinder/Sphere/Cone geometry; indirect geometry requires manual integration');
 if(!loop||!t.isBlockStatement(loop.node.body))throw new Error('No supported animate() / setAnimationLoop callback found; use runtime API and call update() in your loop');
 if(!options.manifest?.recommendedScale||!Number.isFinite(options.manifest.recommendedScale))throw new Error('Invalid manifest recommendedScale');
 const url=options.url||options.manifest.dataUri;
 if(!url)throw new Error('Provide --url (public URL), or a datauri manifest');
 if(/^(file:|https?:\/\/(localhost|127\.0\.0\.1))/i.test(url))throw new Error('Use a browser-reachable URL, not a filesystem/localhost URL');
 if(options.bioPreset&&!['auto','none','fish_swim','aquatic_plant','soft_coral'].includes(options.bioPreset))throw new Error('Invalid bio preset');
 const injected=`import * as __assetTHREE from 'three';\nimport { GLTFLoader as __AssetLoader } from 'three/addons/loaders/GLTFLoader.js';\nimport { MeshoptDecoder as __AssetDecoder } from 'three/addons/libs/meshopt_decoder.module.js';\nimport { RoomEnvironment as __AssetRoom } from 'three/addons/environments/RoomEnvironment.js';\nconst __instantAssets = (createBioMotionInjector => (${createAssetDeployer.toString()})(__assetTHREE, __AssetLoader, __AssetDecoder, __AssetRoom, createBioMotionInjector))((${createBioMotionInjector.toString()}));`;
 const setup=parse(injected,{sourceType:'module'}).program.body;
 ast.program.body.unshift(...setup);
 loop.node.body.body.unshift(t.expressionStatement(t.callExpression(t.memberExpression(t.identifier('__instantAssets'),t.identifier('update')),[])));
 const requested=options.bioPreset??options.manifest.bioMotion?.preset;
 const preset=requested==='none'||requested===null?null:requested&&requested!=='auto'?requested:inferBioMotionPreset(options.manifest.assetName||options.manifest.query||options.target);
 if(preset&&!['fish_swim','aquatic_plant','soft_coral'].includes(preset))throw new Error('Invalid manifest bio preset');
 const small={recommendedScale:options.manifest.recommendedScale,bioMotion:{preset}};
 ast.program.body.push(...parse(`const __instantHandle = __instantAssets.deploy(${options.target}, ${JSON.stringify(small)}, ${JSON.stringify(url)}, ${options.renderer||'renderer'}, ${options.scene||'scene'});\n__instantHandle.ready.catch(error => console.error('3D asset load failed; primitive retained', error));`,{sourceType:'module'}).program.body);
 return generate(ast,{comments:true},source).code+'\n';
}
export function injectThreeCode(source:string,options:InjectOptions):string {
 if(!options.html)return injectJS(source,options);
 const document:any=parseHTML(source,{sourceCodeLocationInfo:true});const scripts:any[]=[];
 function walk(n:any){if(n.tagName==='script')scripts.push(n);for(const c of n.childNodes||[])walk(c);}walk(document);
 const attr=(n:any,name:string)=>n.attrs.find((a:any)=>a.name===name)?.value;
 const modules=scripts.filter(n=>attr(n,'type')==='module'&&!attr(n,'src'));
 const eligible=modules.filter(n=>(n.childNodes||[]).map((c:any)=>c.value||'').join('').includes(options.target));
 if(eligible.length!==1)throw new Error('HTML must contain exactly one inline module containing target');
 const script=eligible[0],loc=script.sourceCodeLocation;
 const inner=source.slice(loc.startTag.endOffset,loc.endTag.startOffset);
 const code=injectJS(inner,options);
 const patches=[{start:loc.startTag.endOffset,end:loc.endTag.startOffset,text:'\n'+code.replace(/<\/script/gi,'<\\/script') }];
 const map=scripts.find(n=>attr(n,'type')==='importmap');
 let imports:any={};let mapJSON:any={};
 if(map){const l=map.sourceCodeLocation;mapJSON=JSON.parse(source.slice(l.startTag.endOffset,l.endTag.startOffset));imports=mapJSON.imports||{};}
 if(!imports.three){const version=options.threeVersion||'0.180.0';if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('Invalid Three.js version');imports.three=`https://cdn.jsdelivr.net/npm/three@${version}/build/three.module.js`;}
 if(!imports['three/addons/']){const match=imports.three.match(/^(https:\/\/[^\s]+\/three@[^/]+)\/build\//);if(!match)throw new Error('Existing importmap needs a version-matched three/ addons mapping');imports['three/addons/']=match[1]+'/examples/jsm/';}
 const text=JSON.stringify({...mapJSON,imports}).replace(/</g,'\\u003c');
 if(map){const l=map.sourceCodeLocation;patches.push({start:l.startTag.endOffset,end:l.endTag.startOffset,text});}
 else patches.push({start:loc.startOffset,end:loc.startOffset,text:`<script type="importmap">${text}</script>\n`});
 for(const p of patches.sort((a,b)=>b.start-a.start))source=source.slice(0,p.start)+p.text+source.slice(p.end);
 return source;
}
