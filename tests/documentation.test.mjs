import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {parse} from '@babel/parser';
import traverseModule from '@babel/traverse';
const traverse=traverseModule.default||traverseModule;
const readme=await fs.readFile('README.md','utf8');
test('bilingual entry points and shared measured-scale example remain present',()=>{
 for(const anchor of ['english-documentation','dokumentasi-bahasa-indonesia','living-scene-example'])assert.ok(readme.includes(`id="${anchor}"`));
 assert.match(readme,/\[🇺🇸 English Documentation\]\(#english-documentation\)/);assert.match(readme,/\[🇮🇩 Dokumentasi Bahasa Indonesia\]\(#dokumentasi-bahasa-indonesia\)/);
 const code=[...readme.matchAll(/```js\n([\s\S]*?)```/g)].map(m=>m[1]);assert.equal(code.length,1);
 const ast=parse(code[0],{sourceType:'module'});let deploys=0,clockReads=0,updaterImported=false;
 traverse(ast,{ImportSpecifier(p){if(p.node.imported.name==='updateAllDeployedModels')updaterImported=true;},CallExpression(p){const n=p.node;if(n.callee.type==='MemberExpression'&&n.callee.property.name==='getDelta')clockReads++;if(n.callee.type==='MemberExpression'&&n.callee.property.name==='getElapsedTime')assert.fail('Do not advance THREE.Clock twice per frame');if(n.callee.type==='Identifier'&&n.callee.name==='deploySmart3DModel'){deploys++;const options=n.arguments[1];assert.equal(options.type,'ObjectExpression');assert.ok(options.properties.some(p=>p.key?.name==='manifest'));assert.ok(!options.properties.some(p=>p.key?.name==='recommendedScale'&&p.value?.type==='NumericLiteral'));}}});
 assert.equal(deploys,1);assert.equal(clockReads,1);assert.ok(updaterImported);assert.match(code[0],/randomizePosition: true/);assert.match(code[0],/export function disposeAquarium/);
});
test('README and relocated reference links resolve to repository files',async()=>{
 for(const filename of ['README.md','docs/reference-id.md']){
  const text=(await fs.readFile(filename,'utf8')).replace(/```[\s\S]*?```/g,'');
  for(const match of text.matchAll(/\[[^\]]*\]\(([^\s)]+)\)/g)){
   const link=match[1];if(/^(https?:|mailto:)/.test(link))continue;const [file,anchor]=link.split('#');const target=path.resolve(path.dirname(filename),file||path.basename(filename));
   // A hash-only link stays in the current document, not dirname/filename/filename.
   const resolved=file?target:path.resolve(filename);await fs.access(resolved);
   if(!file&&anchor){const ids=[...text.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);const headings=[...text.matchAll(/^#{1,6} (.+)$/gm)].map(m=>m[1].toLowerCase().replace(/[^\p{L}\p{N}_\-\s]/gu,'').replace(/ /g,'-'));assert.ok([...ids,...headings].includes(anchor),`${filename}: missing #${anchor}`);}
  }
 }
});
