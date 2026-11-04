import fs from 'node:fs/promises';
import {scoutAndProcess} from '../dist/index.js';
const manifest=await scoutAndProcess({input:'examples/input.glb',mode:'datauri',targetHeight:2});
await fs.mkdir('demo/public',{recursive:true});await fs.writeFile('demo/public/manifest.json',JSON.stringify(manifest));
