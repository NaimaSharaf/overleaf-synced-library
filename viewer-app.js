const $=id=>document.getElementById(id);let dir=null,data=null,dirty=false,busy=false,foregroundBusy=false,actionWaiting=false,page=0,dragged=null,sync=null,syncTimer=null,editGeneration=0;const pending=new Map(),urls=new Set(),pageSize=30;
const tell=text=>$('status').textContent=text;
function release(){for(const url of urls)URL.revokeObjectURL(url);urls.clear();}
function edited(){editGeneration++;dirty=true;tell('Syncing shortly…');clearTimeout(syncTimer);syncTimer=setTimeout(tick,900);}
function canDiscard(){return !dirty||confirm('Discard unsaved changes and reload?');}
function control(fn,waitForSync=false){return async()=>{
 if(foregroundBusy||actionWaiting){tell('An action is already in progress. Please wait.');return;}
 if(busy){
  if(!waitForSync){tell('Sync is in progress. Please try again in a moment.');return;}
  actionWaiting=true;tell('Finishing sync, then capturing your selection…');
  const started=Date.now();
  while(busy&&Date.now()-started<15000)await new Promise(resolve=>setTimeout(resolve,30));
  actionWaiting=false;
  if(busy){tell('Sync is taking longer than expected. Try Capture selection again when it finishes.');return;}
 }
 if(waitForSync&&sync?.conflicts.length){tell('Resolve the conflicting entries before capturing.');return;}
 busy=true;foregroundBusy=true;document.querySelectorAll('button,input,textarea,select').forEach(el=>el.disabled=true);try{await fn();if(dirty&&sync)await flush();}catch(e){tell(e.name==='AbortError'?'Cancelled.':e.message);}finally{busy=false;foregroundBusy=false;render();}};}
function move(id,target,after){const index=data.rows.findIndex(r=>r.id===id);if(index<0||id===target)return;const [row]=data.rows.splice(index,1);const to=data.rows.findIndex(r=>r.id===target);data.rows.splice(to+(after?1:0),0,row);edited();render();}
function render(){
 const web=!!data?.project.startsWith('websurfing:');$('context-heading').textContent=web?'Screenshot':'Sentence / enlarged screenshot';
 release();$('rows').replaceChildren();$('title').textContent=data?.name||'Your evidence library';$('search').disabled=!data;
 $('save').disabled=!dir||!data;$('section').disabled=!dir||!data;$('reload').disabled=!dir;
 $('folder').disabled=$('json').disabled=false;
 const query=$('search').value.toLowerCase();const filtered=(data?.rows||[]).filter(r=>(r.kind==='section'?r.title:[r.keyword,r.year||'',r.notes||'',r.bibtex||'',r.sentence,r.link].join(' ')).toLowerCase().includes(query));
 const pages=Math.max(1,Math.ceil(filtered.length/pageSize));page=Math.min(page,pages-1);$('count').textContent=filtered.length+' rows · Page '+(page+1)+' of '+pages;$('prev').disabled=page===0;$('next').disabled=page>=pages-1;
 $('empty').hidden=!!data;$('table').hidden=!data;
 for(const row of filtered.slice(page*pageSize,(page+1)*pageSize)){
  const tr=document.createElement('tr');
  if(dir){tr.addEventListener('dragover',e=>{if(dragged){e.preventDefault();tr.classList.add('drop');}});tr.addEventListener('dragleave',()=>tr.classList.remove('drop'));tr.addEventListener('drop',e=>{e.preventDefault();const id=dragged;dragged=null;if(id)move(id,row.id,e.clientY>tr.getBoundingClientRect().top+tr.getBoundingClientRect().height/2);});}
  const tools=document.createElement('div');tools.className='row';
  const handle=document.createElement('button');handle.textContent='⠿';handle.className='drag';handle.title='Drag to reorder';handle.draggable=!!dir;handle.disabled=!dir;handle.setAttribute('aria-label','Move '+(row.title||row.keyword));handle.ondragstart=e=>{dragged=row.id;e.dataTransfer.setData('text/plain',row.id);};handle.ondragend=()=>{dragged=null;document.querySelectorAll('.drop').forEach(el=>el.classList.remove('drop'));};tools.append(handle);
  for(const [label,offset] of [['↑',-1],['↓',1]]){const b=document.createElement('button');b.textContent=label;b.title=offset<0?'Move up':'Move down';b.disabled=!dir;b.onclick=()=>{const index=data.rows.indexOf(row),other=data.rows[index+offset];if(other)move(row.id,other.id,offset>0);};tools.append(b);}
  const remove=document.createElement('button');remove.textContent='Remove';remove.disabled=!dir;remove.onclick=()=>{if(confirm('Remove '+(row.title||row.keyword)+'?')){data.rows=data.rows.filter(r=>r!==row);edited();render();}};tools.append(remove);
  if(row.kind==='section'){
   tr.className='heading';const td=document.createElement('td');td.colSpan=4;const title=document.createElement('input');title.value=row.title;title.setAttribute('aria-label','Section heading');title.disabled=!dir;title.oninput=()=>{row.title=title.value;edited();};td.append(title,tools);tr.append(td);
  }else{
   const cells=Array.from({length:4},()=>tr.appendChild(document.createElement('td')));
   const keyword=document.createElement('button');keyword.textContent=row.keyword;keyword.title='Copy keyword';keyword.onclick=async()=>{try{await navigator.clipboard.writeText(row.keyword);tell('Keyword copied.');}catch{tell('Clipboard unavailable. Select and copy the keyword manually.');}};cells[0].append(keyword,tools);if(web&&dir){const title=document.createElement('input');title.value=row.keyword;title.setAttribute('aria-label','Entry title');title.oninput=()=>{row.keyword=title.value.trim()||'Untitled entry';keyword.textContent=row.keyword;edited();};cells[0].prepend(title);keyword.remove();}if(web){const label=document.createElement('label');label.textContent='Year';const year=document.createElement('input');year.value=row.year||'';year.inputMode='numeric';year.maxLength=4;year.placeholder='e.g. 2026';year.disabled=!dir;year.oninput=()=>{row.year=year.value.trim();edited();};label.append(year);cells[0].append(label);}
   const sentence=document.createElement('textarea');sentence.value=row.sentence;sentence.setAttribute('aria-label','Sentence for '+row.keyword);sentence.disabled=!dir;sentence.oninput=()=>{row.sentence=sentence.value;edited();};sentence.hidden=web;cells[1].append(sentence);
   const link=document.createElement('input');link.type='url';link.value=row.link;link.disabled=!dir;link.setAttribute('aria-label','Weblink for '+row.keyword);link.oninput=()=>{row.link=link.value.trim();edited();};cells[2].append(link);
   if(/^https?:\/\//i.test(row.link)){const a=document.createElement('a');a.href=row.link;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Open link ↗';cells[2].append(a);}
   const actions=document.createElement('div');actions.className='row';
   for(const [label,type] of [['Refresh sentence','refresh'],['Find instances','find']]){const b=document.createElement('button');b.textContent=label;b.disabled=!sync;b.onclick=control(()=>sendRequest(type,row.id));actions.append(b);}actions.hidden=web;cells[1].append(actions);
   const notesLabel=document.createElement('label');notesLabel.textContent='Notes';const notes=document.createElement('textarea');notes.value=row.notes||'';notes.placeholder='Add your notes…';notes.setAttribute('aria-label','Notes for '+row.keyword);notes.disabled=!dir;notes.oninput=()=>{row.notes=notes.value;edited();};notesLabel.append(notes);cells[1].append(notesLabel);cells[1].append(Bib.field(row,{disabled:!dir,onEdit:()=>edited(),tell}));
   if(dir){
    const upload=document.createElement('input');upload.type='file';upload.accept='image/png,image/jpeg,image/webp';upload.setAttribute('aria-label','Screenshot for '+row.keyword);upload.onchange=control(async()=>{if(upload.files[0])await attachImage(row,upload.files[0]);});cells[3].append(upload);
    const paste=document.createElement('button');paste.textContent='Paste screenshot';paste.onclick=control(async()=>{for(const item of await navigator.clipboard.read()){const type=item.types.find(t=>['image/png','image/jpeg','image/webp'].includes(t));if(type){await attachImage(row,await item.getType(type));return;}}throw Error('No image in the clipboard.');});
    paste.addEventListener('paste',event=>{event.preventDefault();const file=Array.from(event.clipboardData.items).find(i=>i.kind==='file'&&i.type.startsWith('image/'))?.getAsFile();if(file)control(()=>attachImage(row,file))();else tell('No image in the clipboard.');});cells[3].append(paste);
    if(row.screenshot){const removeImage=document.createElement('button');removeImage.textContent='Remove screenshot';removeImage.onclick=()=>{pending.delete(row.screenshot);row.screenshot='';edited();render();};cells[3].append(removeImage);}
   }
   if(row.screenshot){
    const button=document.createElement('button');button.textContent='Show screenshot';const preview=document.createElement('div');preview.className='image-cell';sentence.after(preview);cells[3].append(button);let opened=false,token=0,url=null;
    button.onclick=async()=>{token++;const request=token;if(opened){preview.replaceChildren();if(url){URL.revokeObjectURL(url);urls.delete(url);}url=null;opened=false;button.textContent='Show screenshot';return;}
     button.disabled=true;try{const img=document.createElement('img');img.loading='lazy';img.decoding='async';img.alt='Screenshot for '+row.keyword;
      if(dir){const blob=await Library.image(dir,row.screenshot,pending);if(!tr.isConnected||request!==token)return;url=URL.createObjectURL(blob);urls.add(url);img.src=url;}
      else img.src=row.screenshot;
      img.onerror=()=>{tell('Screenshot could not be loaded. Open viewer.html from the library folder, or use Open library folder.');};preview.append(img);opened=true;button.textContent='Hide screenshot';
     }catch(e){tell(e.message);}finally{button.disabled=false;}
    };
    queueMicrotask(()=>{if(tr.isConnected)button.onclick();});
   }else cells[3].append(document.createTextNode('No screenshot'));
  }
  $('rows').append(tr);
 }
 lockConflicts();
}
$('folder').onclick=control(async()=>{if(!canDiscard())return;const chosen=await showDirectoryPicker({mode:'readwrite',id:'evidence-viewer',...((dir||viewerFolder)?{startIn:dir||viewerFolder}:{})});const loaded=await Library.read(chosen);if(!loaded)throw Error('Choose a library folder containing session.json.');const connection=new SyncLibrary(chosen,'HTML viewer');const result=await connection.open();dir=chosen;sync=connection;data=result.data;dirty=false;pending.clear();page=0;showConflicts(result);tell('Connected. Changes sync automatically while the capture panel is open.');rememberViewerFolder(chosen);});
$('json').onchange=control(async()=>{if(!canDiscard())return;const file=$('json').files[0];if(!file)return;const loaded=Library.validate(JSON.parse(await file.text()));dir=null;sync=null;data=loaded;dirty=false;page=0;tell('Read-only view. Use Open library folder to edit. Screenshot paths are relative to viewer.html.');});
$('reload').onclick=control(async()=>{if(!canDiscard())return;applyResult(await sync.read());tell('Loaded synchronized data.');});
$('save').onclick=control(async()=>{await flush();tell('Folder is up to date.');});
$('section').onclick=()=>{const title=prompt('Section heading');if(title?.trim()){data.rows.push({id:Library.uuid(),kind:'section',title:title.trim()});edited();page=Math.floor((data.rows.length-1)/pageSize);render();}};
$('search').oninput=()=>{page=0;render();};$('prev').onclick=()=>{page--;render();};$('next').onclick=()=>{page++;render();};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});render();

async function attachImage(row,file){
 const blob=await Library.picture(file);if(row.screenshot)pending.delete(row.screenshot);
 row.screenshot='images/'+Library.uuid()+'.png';pending.set(row.screenshot,blob);edited();
}
function lockConflicts(){
 const blocked=!!sync?.conflicts.length;
 document.querySelectorAll('#table input,#table textarea').forEach(el=>el.disabled=foregroundBusy||blocked||!dir);
 if(dir)document.querySelectorAll('#table button').forEach(el=>el.disabled=foregroundBusy||blocked);
 $('save').disabled=$('section').disabled=foregroundBusy||blocked||!sync;
}
function showConflicts(result){renderSyncConflicts($('conflicts'),result.conflicts,data,(key,value)=>control(async()=>{applyResult(await sync.resolve(key,value));tell(sync.conflicts.length?'Resolve the remaining versions.':'Conflict resolved.');})(),dir);lockConflicts();}
function applyResult(result){const changed=JSON.stringify(data?.rows)!==JSON.stringify(result.data.rows);
 // Keep the on-screen rows when nothing changed, so buttons and boxes still edit the rows in the library
 // (replacing them silently made Remove and some edits do nothing).
 if(changed||!data)data=result.data;else{data.revision=result.data.revision;data.name=result.data.name;}dirty=false;if(changed)render();showConflicts(result);if(result.conflicts.length)tell('Conflicting edits found. Choose a version below.');else if(result.snapshotError)tell(result.snapshotError);}
async function flush(){
 if(!sync)return;if(sync.conflicts.length)throw Error('Resolve the conflicting versions first.');
 const generation=editGeneration,sent=structuredClone(data),images=new Map(pending);
 const result=await sync.save(sent,images);
 for(const [path] of pending)if(sent.rows.some(r=>r.screenshot===path))pending.delete(path);
 if(generation!==editGeneration){Object.assign(sync,result.localContext);dirty=true;return;}
 applyResult(result);if(!result.conflicts.length&&!result.snapshotError)tell('Synchronized with the capture extension.');
}
async function tick(){
 if(!sync||busy||actionWaiting)return;busy=true;
 try{
  if(dirty)await flush();else{
   const generation=editGeneration,context={loaded:sync.loaded,heads:sync.heads,conflicts:sync.conflicts};
   const result=await sync.read();if(generation!==editGeneration){Object.assign(sync,context);return;}
   const changed=result.data.revision!==data.revision;applyResult(result);if(changed&&!result.conflicts.length)tell('Updated from the capture extension.');
  }
 }catch(error){tell('Sync needs attention: '+error.message);}finally{busy=false;lockConflicts();}
}
async function sendRequest(type,rowId){
 if(!sync||!dir)throw Error('Open the shared library folder first.');if(dirty)await flush();if(sync.conflicts.length)throw Error('Resolve conflicts first.');
 const id=Library.uuid(),name=id+'.json',requests=await dir.getDirectoryHandle('requests',{create:true}),responses=await dir.getDirectoryHandle('responses',{create:true});
 await Library.write(requests,name,JSON.stringify({id,project:data.project,type,rowId,at:Date.now()}));
 tell('Waiting for the capture extension. Keep its panel open and your Overleaf project loaded.');
 const started=Date.now();let result;
 while(Date.now()-started<35000){
  try{const file=await (await responses.getFileHandle(name)).getFile();const text=await file.text();if(text){result=JSON.parse(text);break;}}catch(error){if(error.name!=='NotFoundError')throw error;}
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 if(!result)throw Error('No response confirmed. Keep the capture panel open, check Overleaf, and try again after this request expires.');
 if(!result.ok)throw Error(result.error);
 applyResult(await sync.read());
 $('find-results').replaceChildren();
 if(result.matches)for(const match of result.matches){const section=document.createElement('section');section.textContent='Line '+match.line+' — '+match.sentence+'\n'+match.before+match.match+match.after;$('find-results').append(section);}
 tell(result.message);
}
setInterval(tick,2500);

let viewerDB=null,viewerFolder=null;
try{
 const request=indexedDB.open('evidence-synced-viewer',1);
 request.onupgradeneeded=()=>request.result.createObjectStore('settings');
 request.onsuccess=()=>{viewerDB=request.result;const read=viewerDB.transaction('settings').objectStore('settings').get('folder');read.onsuccess=()=>{if(!new URL(location.href).searchParams.has('folder')){viewerFolder=read.result;$('reconnect').hidden=!viewerFolder;}};};
}catch{}
function rememberViewerFolder(folder){viewerFolder=folder;$('reconnect').hidden=false;if(viewerDB){const tx=viewerDB.transaction('settings','readwrite');tx.objectStore('settings').put(folder,'folder');}}
$('reconnect').onclick=control(async()=>{
 if(!canDiscard())return;if(await viewerFolder.requestPermission({mode:'readwrite'})!=='granted')throw Error('Folder access was not granted.');
 const connection=new SyncLibrary(viewerFolder,'HTML viewer'),result=await connection.open();dir=viewerFolder;sync=connection;data=result.data;dirty=false;pending.clear();page=0;showConflicts(result);tell('Reconnected. Automatic sync is on.');
});
