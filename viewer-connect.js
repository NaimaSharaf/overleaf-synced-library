// Runs only in the extension viewer; standalone viewer.html remains portable.
(async()=>{
 try{
  const token=new URL(location.href).searchParams.get('folder');
  if(!token)throw Error('Use Open viewer in the capture panel to connect your library.');
  const folder=await new Promise((resolve,reject)=>{
   const request=indexedDB.open('overleaf-local-folders',1);
   request.onerror=()=>reject(request.error);
   request.onsuccess=()=>{const database=request.result;
    const read=database.transaction('settings').objectStore('settings').get('viewer:'+token);
    read.onsuccess=()=>{database.close();resolve(read.result);};
    read.onerror=()=>{database.close();reject(read.error);};
   };
  });
  if(!folder)throw Error('Folder connection expired. Open the viewer again from the capture panel.');
  rememberViewerFolder(folder);
  if(await folder.queryPermission({mode:'readwrite'})!=='granted'){
   tell('Click Reconnect saved folder to allow access to '+folder.name+'.');return;
  }
  await control(async()=>{
   const connection=new SyncLibrary(folder,'HTML viewer'),result=await connection.open();
   dir=folder;sync=connection;data=result.data;dirty=false;pending.clear();page=0;
   showConflicts(result);tell('Connected to '+folder.name+'. Automatic sync is on.');
  })();
 }catch(error){tell(error.message);}
})();
