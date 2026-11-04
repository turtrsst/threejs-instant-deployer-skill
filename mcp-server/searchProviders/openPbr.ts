import {keywordScore,type Candidate,type LegalNotice} from './polyhaven.js';
const base='https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models';
const cc0='https://creativecommons.org/publicdomain/zero/1.0/legalcode';
const by='https://creativecommons.org/licenses/by/4.0/legalcode';
interface RegistryItem {id:string;name:string;tags:string[];animated:boolean;legal:LegalNotice[];}
/** Reviewed against upstream metadata.json, 2026-11-03. This is Khronos, not Objaverse. */
export const OPEN_PBR_REGISTRY:RegistryItem[]=[
 {id:'BarramundiFish',name:'Barramundi Fish',tags:['fish','aquatic','aquascape','animal','water','marine','ikan'],animated:false,legal:[{license:'CC0-1.0',licenseUrl:cc0,attribution:'Microsoft (2017), Everything'}]},
 {id:'Fox',name:'Fox (Survey, Walk, Run)',tags:['fox','animal','character','creature','pet','mammal','animated'],animated:true,legal:[{license:'CC0-1.0',licenseUrl:cc0,attribution:'PixelMannen (2014), Model'},{license:'CC-BY-4.0',licenseUrl:by,attribution:'tomkranis (2014), Rigging & Animation'},{license:'CC-BY-4.0',licenseUrl:by,attribution:'@AsoboStudio and @scurest (2017), Conversion to glTF'}]},
 {id:'DragonAttenuation',name:'Dragon Attenuation',tags:['dragon','statue','sculpture','ornament','zen','stone','crystal','aquascape'],animated:false,legal:[{license:'LicenseRef-Stanford-Graphics',licenseUrl:'https://github.com/KhronosGroup/glTF-Sample-Assets/blob/main/LICENSES/LicenseRef-Stanford-Graphics.txt',attribution:'Stanford University Computer Graphics Laboratory (1996), Original dragon; Morgan McGuire (2017), Conversion and clean up'},{license:'CC0-1.0',licenseUrl:cc0,attribution:'Adobe (2021), Cloth backdrop'}]},
 {id:'MosquitoInAmber',name:'Mosquito In Amber',tags:['amber','gem','stone','insect','resin','organic','crystal'],animated:false,legal:[{license:'CC-BY-4.0',licenseUrl:by,attribution:'Loic Norgeot (2018), Model; Sketchfab (2019), Real-time refraction'}]},
 {id:'IridescenceLamp',name:'Iridescence Lamp',tags:['lamp','light','lantern','interior','furniture'],animated:false,legal:[{license:'CC-BY-4.0',licenseUrl:by,attribution:'Eric Chadwick / Wayfair, LLC (2022), Everything'}]},
 {id:'AnisotropyBarnLamp',name:'Anisotropy Barn Lamp',tags:['lamp','light','lantern','barn','interior','furniture','anisotropy'],animated:false,legal:[{license:'CC-BY-4.0',licenseUrl:by,attribution:'Eric Chadwick / Copyright 2023 Wayfair, LLC, Everything'}]}
];
export function isCC0(license:string){return ['cc0','cc0-1.0'].includes(license.toLowerCase());}
export function searchOpenPBR(query:string,{animated=false,allowNonCC0=false}={}):Candidate[]{
 return OPEN_PBR_REGISTRY.filter(item=>(!animated||item.animated)&&(allowNonCC0||item.legal.every(l=>isCC0(l.license)))).map(item=>({id:item.id,name:item.name,provider:'openpbr' as const,score:keywordScore(query,item.id,item),source:`https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/${item.id}`,license:[...new Set(item.legal.map(l=>l.license))].join(' AND '),legal:item.legal,licenseEvidence:`${base}/${item.id}/metadata.json`,animated:item.animated,canDirectDownload:true,glbUrl:`${base}/${item.id}/glTF-Binary/${item.id}.glb`})).filter(c=>c.score>0).sort((a,b)=>b.score-a.score);
}
