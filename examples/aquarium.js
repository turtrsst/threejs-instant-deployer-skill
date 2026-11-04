import {deploySmart3DModel} from '../templates/smart-deploy.js';
import {BoidsAquariumManager} from '../templates/boids-manager.js';

/** Attach to an existing client-side Three.js scene; caller owns its single render loop. */
export function createAquariumSchool({scene,bounds,fishManifest,rockManifest,fishUrl,rockUrl,fishCount=8}){
 if(!bounds?.isBox3)throw new Error('Supply audited aquarium bounds in world coordinates');
 if(!Number.isInteger(fishCount)||fishCount<1||fishCount>500)throw new Error('fishCount must be 1..500');
 const aquarium=new BoidsAquariumManager(scene,{bounds,seed:42});
 const handles=[];let disposed=false;
 const ready=(async()=>{
  const rock=deploySmart3DModel(rockUrl,{scene,manifest:rockManifest,bioPreset:null});
  handles.push(rock);await rock.ready;if(disposed)return;
  aquarium.addObstacle(rock.model,{padding:.05});
  const fishHandles=[];
  for(let i=0;i<fishCount;i++){
   const handle=deploySmart3DModel(fishUrl,{scene,manifest:fishManifest,bioPreset:'fish_swim',onLoaded:({model,bioController})=>{
    aquarium.addFish(model,bioController,{randomizePosition:true,deformationMargin:.08});
   }});
   handles.push(handle);fishHandles.push(handle);
  }
  await Promise.all(fishHandles.map(handle=>handle.ready));
 })();
 return {aquarium,handles,ready,
  // Locomotion only: call updateAllDeployedModels(delta, elapsed) once in the app loop too.
  update(delta){if(!disposed)aquarium.update(delta);},
  dispose(){if(disposed)return;disposed=true;aquarium.dispose();for(const handle of handles)handle.dispose();}
 };
}
