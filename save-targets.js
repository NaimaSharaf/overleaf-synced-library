const sessionSaveTargets=new Map();
let saveTargetDB;
const saveTargetsReady=new Promise(resolve=>{
 const request=indexedDB.open('evidence-file-targets',1);
 request.onupgradeneeded=()=>request.result.createObjectStore('targets',{keyPath:'project'});
 request.onerror=()=>resolve();
 request.onsuccess=()=>{saveTargetDB=request.result;const read=saveTargetDB.transaction('targets').objectStore('targets').getAll();read.onsuccess=()=>{for(const record of read.result)sessionSaveTargets.set(record.project,record);resolve();};read.onerror=()=>resolve();};
});
async function rememberSaveTarget(record){
 sessionSaveTargets.set(record.project,record);
 if(!saveTargetDB)return;
 await new Promise((resolve,reject)=>{const tx=saveTargetDB.transaction('targets','readwrite');tx.objectStore('targets').put(record);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
}
async function chooseSessionFile(project,typedName,defaultName){
 await saveTargetsReady;
 const prior=sessionSaveTargets.get(project);
 const name=typedName||prior?.name||defaultName;
 if(prior&&name===prior.name){
  let permission=await prior.handle.queryPermission({mode:'readwrite'});
  if(permission!=='granted')permission=await prior.handle.requestPermission({mode:'readwrite'});
  if(permission!=='granted')throw Error('Allow file access to update the saved JSON.');
  return {handle:prior.handle,name};
 }
 if(typeof window.showSaveFilePicker!=='function')throw Error('This browser cannot overwrite a chosen file. Use Download session to save a new copy.');
 const filename=name.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').replace(/\.json$/i,'')+'.json';
 const handle=await window.showSaveFilePicker({suggestedName:filename,types:[{description:'Evidence session JSON',accept:{'application/json':['.json']}}]});
 return {handle,name};
}
