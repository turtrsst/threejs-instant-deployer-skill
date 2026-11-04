import {parse} from '@babel/parser';
import * as t from '@babel/types';
/** Conservative static evaluator: no eval(), function calls, or mutable bindings. */
export function auditThreeCode(source:string) {
 const ast=parse(source,{sourceType:'module',plugins:['typescript','jsx']});
 const aliases=new Map<string,string>();const spaces=new Set<string>();const constants=new Map<string,t.Expression>();
 const declarations:any[]=[];
 for(const n of ast.program.body){
  if(t.isImportDeclaration(n)&&n.source.value==='three')for(const s of n.specifiers){if(t.isImportNamespaceSpecifier(s))spaces.add(s.local.name);if(t.isImportSpecifier(s))aliases.set(s.local.name,t.isIdentifier(s.imported)?s.imported.name:s.imported.value);}
  if(t.isVariableDeclaration(n))for(const d of n.declarations){declarations.push(d);if(n.kind==='const'&&t.isIdentifier(d.id)&&t.isExpression(d.init))constants.set(d.id.name,d.init);}
 }
 function value(n:any,seen=new Set<string>()):number|undefined {
  if(t.isNumericLiteral(n))return n.value;
  if(t.isIdentifier(n)&&constants.has(n.name)&&!seen.has(n.name)){const next=new Set(seen);next.add(n.name);return value(constants.get(n.name),next);}
  if(t.isUnaryExpression(n)){const v=value(n.argument,seen);if(v!==undefined)return n.operator==='-'?-v:n.operator==='+'?v:undefined;}
  if(t.isBinaryExpression(n)){const a=value(n.left,seen),b=value(n.right,seen);if(a!==undefined&&b!==undefined){const result=({'+':()=>a+b,'-':()=>a-b,'*':()=>a*b,'/':()=>a/b,'**':()=>a**b} as any)[n.operator]?.();return Number.isFinite(result)?result:undefined;}}
  return undefined;
 }
 function name(n:any){if(t.isIdentifier(n))return aliases.get(n.name);if(t.isMemberExpression(n)&&t.isIdentifier(n.object)&&spaces.has(n.object.name)&&t.isIdentifier(n.property))return n.property.name;}
 const targets=[];
 for(const d of declarations){if(!t.isIdentifier(d.id)||!t.isNewExpression(d.init)||name(d.init.callee)!=='Mesh')continue;
  const g=d.init.arguments[0];if(!t.isNewExpression(g))continue;const type=name(g.callee);const args=g.arguments.map(a=>value(a));
  let size:number[]|undefined;
  if(type==='BoxGeometry')size=[args[0]??1,args[1]??1,args[2]??1];
  if(type==='SphereGeometry')size=[0,2*(args[0]??1),0];
  if(type==='CylinderGeometry')size=[0,args[2]??1,0];
  if(type==='ConeGeometry')size=[0,args[1]??1,0];
  // Do not substitute defaults for arguments that exist but cannot be evaluated.
  const required=type==='BoxGeometry'?[0,1,2]:type==='CylinderGeometry'?[2]:type==='ConeGeometry'?[1]:type==='SphereGeometry'?[0]:[];
  if(size&&required.every(i=>g.arguments[i]===undefined||args[i]!==undefined)&&size.every(v=>Number.isFinite(v)&&v>=0)&&size[1]!>0)targets.push({target:d.id.name,geometry:type,targetSize:size,baseYRule:`${d.id.name}.position.y - ${size[1]!/2} * ${d.id.name}.scale.y`});
 }
 return {targets,warnings:['Static audit supports top-level imported Mesh constructors and constant numeric geometry arguments. Runtime transform is preserved; rest-pose bounds do not include animated extents.']};
}
