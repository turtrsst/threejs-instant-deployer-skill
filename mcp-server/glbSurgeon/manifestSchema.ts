import {z} from 'zod';

const count=z.number().finite().int().nonnegative();
const dimensions=z.tuple([z.number().finite().nonnegative(),z.number().finite().nonnegative(),z.number().finite().nonnegative()]).refine(v=>v.some(n=>n>0),'At least one dimension must be positive');
const mesh=z.object({index:count,name:z.string(),primitives:count}).passthrough();
const material=z.object({index:count,name:z.string(),roughness:z.number().finite().min(0).max(1),metalness:z.number().finite().min(0).max(1),alphaMode:z.enum(['OPAQUE','MASK','BLEND']),doubleSided:z.boolean(),isTranslucentOrTransmission:z.boolean()}).passthrough();
const animation=z.object({index:count,name:z.string(),channels:count,channelsCount:count.optional()}).passthrough();
const node=z.object({index:count,name:z.string(),mesh:z.string().nullable(),children:z.array(z.string())}).passthrough();
const skin=z.object({index:count,name:z.string(),jointsCount:count,sampleBoneNames:z.array(z.string()),bones:z.array(z.string())}).passthrough();

/** Success-output contract, not an error-response schema or full glTF/license verifier.
 * Extra pipeline/provider metadata is retained; core X-Ray records are checked structurally.
 */
export const XRayManifestSchema=z.object({
 status:z.literal('success'),matchedAssetId:z.string().min(1),recommendedScale:z.number().finite().positive(),
 originalDimensions:dimensions.optional(),normalizedDimensions:dimensions.optional(),scaledDimensions:dimensions.optional(),targetSize:dimensions.optional(),
 recommendedScaleVector:z.tuple([z.number().finite().positive(),z.number().finite().positive(),z.number().finite().positive()]).optional(),
 fitMode:z.literal('contain').optional(),pivotMode:z.literal('bottom-center').optional(),
 xray:z.object({hasAnimations:z.boolean(),hasSkeletalRig:z.boolean().optional(),meshes:z.array(mesh),materials:z.array(material),animations:z.array(animation),nodes:z.array(node).optional(),skins:z.array(skin).optional()}).passthrough()
}).passthrough().superRefine((m,ctx)=>{
 if(m.xray.hasAnimations!==(m.xray.animations.length>0))ctx.addIssue({code:z.ZodIssueCode.custom,path:['xray','hasAnimations'],message:'Must match animation record presence'});
 if(m.xray.hasSkeletalRig!==undefined&&m.xray.skins&&m.xray.hasSkeletalRig!==(m.xray.skins.length>0))ctx.addIssue({code:z.ZodIssueCode.custom,path:['xray','hasSkeletalRig'],message:'Must match skin record presence'});
 if(m.recommendedScaleVector?.some(v=>Math.abs(v-m.recommendedScale)>1e-8*Math.max(v,m.recommendedScale)))ctx.addIssue({code:z.ZodIssueCode.custom,path:['recommendedScaleVector'],message:'Must match uniform recommendedScale'});
 for(let i=0;i<m.xray.animations.length;i++){const a=m.xray.animations[i]!;if(a.channelsCount!==undefined&&a.channelsCount!==a.channels)ctx.addIssue({code:z.ZodIssueCode.custom,path:['xray','animations',i,'channelsCount'],message:'Must match channels'});}
});
export type XRaySuccessManifest=z.infer<typeof XRayManifestSchema>;
export function validateXRayManifest(manifest:unknown):{isValid:boolean;errors:string[]}{
 const result=XRayManifestSchema.safeParse(manifest);
 return result.success?{isValid:true,errors:[]}:{isValid:false,errors:result.error.issues.map(issue=>`${issue.path.join('.')||'manifest'}: ${issue.message}`)};
}
export function assertXRayManifest(manifest:unknown):asserts manifest is XRaySuccessManifest{
 const result=validateXRayManifest(manifest);if(!result.isValid)throw new Error(`Invalid X-Ray manifest: ${result.errors.join('; ')}`);
}
