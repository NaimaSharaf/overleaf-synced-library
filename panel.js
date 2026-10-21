const $=id=>document.getElementById(id);
let mode='overleaf',dir=null,data=null,pending=new Map(),current=null,dirty=false,busy=false,foregroundBusy=false,actionWaiting=false,previewURL=null,previewGeneration=0,remembered=null,sync=null,syncTimer=null,boundTab=null,editGeneration=0;
const isWeb=()=>mode==='websurfing';
const tell=text=>$('status').textContent=text;
function setDirty(){editGeneration++;dirty=true;tell('Syncing shortly…');clearTimeout(syncTimer);syncTimer=setTimeout(tick,900);}
// The entry added most recently: highest "added" time; entries saved before this existed count as older, newest = lowest in the list.
function newestRow(){let best=null;for(const r of data?.rows||[]){if(r.kind==='section')continue;if(!best||(r.added||0)>=(best.added||0))best=r;}return best;}
function currentRow(){return data?.rows.find(r=>r.id===current&&r.kind!=='section');}
// Every screenshot of the current entry is shown in order. Click one to enlarge; ↑ ↓ reorder, ✕ removes just that one.
let previewURLs=[];
function shotLabel(row){const n=Library.shots(row).length;return n>1?' ('+n+')':'';}
function closeImage(){previewGeneration++;$('show').textContent='Show screenshots'+shotLabel(currentRow());for(const u of previewURLs)URL.revokeObjectURL(u);previewURLs=[];previewURL=null;$('preview').replaceChildren();$('preview').hidden=true;}
async function openImage(){
 const row=currentRow(),paths=Library.shots(row);if(!paths.length)return;
 const generation=++previewGeneration,folder=dir,key=paths.join('|');
 try{
  const blobs=await Promise.all(paths.map(path=>Library.image(folder,path,pending).catch(error=>error)));
  if(generation!==previewGeneration||currentRow()?.id!==row.id||Library.shots(currentRow()).join('|')!==key||dir!==folder)return;
  for(const u of previewURLs)URL.revokeObjectURL(u);previewURLs=[];
  const urls=[],figures=paths.map((path,i)=>{
   const figure=document.createElement('figure');figure.className='shot';const blob=blobs[i];
   if(blob instanceof Error){const note=document.createElement('p');note.className='small';note.textContent='Screenshot '+(i+1)+' could not be loaded: '+blob.message;figure.append(note);}
   else{const url=URL.createObjectURL(blob);previewURLs.push(url);urls.push(url);const img=document.createElement('img');img.src=url;img.alt='Screenshot '+(i+1)+' for '+row.keyword;img.title='Click to enlarge';
    img.onclick=()=>Library.enlarge(urls,urls.indexOf(url),'Screenshot for '+row.keyword);
    img.onerror=()=>{if(generation===previewGeneration)tell('Screenshot '+(i+1)+' could not be displayed. Try removing and re-adding it.');};figure.append(img);}
   const bar=document.createElement('figcaption');bar.className='shot-bar';const count=document.createElement('span');count.textContent=(i+1)+' of '+paths.length;bar.append(count);
   for(const [text,title,act] of [['↑','Move earlier',()=>moveShot(i,-1)],['↓','Move later',()=>moveShot(i,1)],['✕','Remove this screenshot',()=>removeShot(i)]]){
    if((text==='↑'&&i===0)||(text==='↓'&&i===paths.length-1))continue;
    const b=document.createElement('button');b.type='button';b.className='shot-btn';b.textContent=text;b.title=title;b.setAttribute('aria-label',title+' ('+(i+1)+')');b.onclick=act;bar.append(b);}
   figure.append(bar);return figure;});
  $('preview').replaceChildren(...figures);$('preview').hidden=false;$('show').textContent='Hide screenshots'+shotLabel(row);
 }catch(error){if(generation===previewGeneration)tell('Screenshots could not be loaded: '+error.message);}
}
function moveShot(i,step){const row=currentRow();if(!row)return;const list=Library.shots(row),j=i+step;if(j<0||j>=list.length)return;[list[i],list[j]]=[list[j],list[i]];Library.setShots(row,list);draw();setDirty();}
function removeShot(i){const row=currentRow();if(!row)return;const list=Library.shots(row),[gone]=list.splice(i,1);pending.delete(gone);Library.setShots(row,list);draw();setDirty();tell('Screenshot removed.');}
function commit(){const row=currentRow();if(row){if(isWeb()){row.keyword=$('web-title').value.trim()||'Untitled entry';row.year=$('year').value.trim();}else row.sentence=$('sentence').value;row.link=$('link').value.trim();if($('notes').dataset.id===row.id&&$('notes').value!==(row.notes||''))row.notes=$('notes').value;}}
function draw(){
 $('mode').value=mode;
 for(const id of ['capture','keyword-find','keyword','sentence','sentence-label','refresh','find','import-section'])$(id).hidden=isWeb();
 for(const id of ['add-web','web-title','web-title-label','year','year-label'])$(id).hidden=!isWeb();
 closeImage();$('results').replaceChildren();$('entry').replaceChildren();
 let group=null;
 for(const row of data?.rows||[]){
  if(row.kind==='section'){
   group=document.createElement('optgroup');group.label=row.title?.trim()||'Untitled section';group.dataset.id=row.id;$('entry').append(group);continue;
  }
  if(!group){group=document.createElement('optgroup');group.label='Unsectioned';$('entry').append(group);}
  const option=document.createElement('option');option.value=row.id;option.textContent=row.keyword;group.append(option);
 }
 if(!currentRow())current=newestRow()?.id||null;
 $('entry').value=current||'';const row=currentRow();$('editor').hidden=!row;
 if(row){$('year').value=row.year||'';$('web-title').value=row.keyword;$('keyword').textContent=row.keyword;$('sentence').value=row.sentence;$('link').value=row.link;if(document.activeElement!==$('notes')||$('notes').dataset.id!==row.id)$('notes').value=row.notes||'';$('notes').dataset.id=row.id;$('show').disabled=$('remove').disabled=!row.screenshot;}
 $('paste').textContent=Library.shots(row).length?'Paste another screenshot':'Paste screenshot';
 if(Library.shots(row).length)void openImage();
 drawHeading();
 drawBib(row);
 $('location').textContent=dir?dir.name+' · '+(data?.name||'New library')+' · '+(data?.rows.length||0)+' rows':'Choose a library folder.';
}
async function active(ignoreLibrary=false){
 const [activeTab]=await chrome.tabs.query({active:true,currentWindow:true});
 const activeProject=activeTab?.url?.match(/^https:\/\/(?:www\.)?overleaf\.com\/project\/([a-f\d]+)/i)?.[1];
 let tab=activeTab,project=activeProject;
 if(data&&!ignoreLibrary&&activeProject!==data.project){
  const tabs=await chrome.tabs.query({url:['https://www.overleaf.com/project/*','https://overleaf.com/project/*']});
  const matches=tabs.filter(t=>t.url?.match(/\/project\/([a-f\d]+)/i)?.[1]===data.project);
  tab=matches.find(t=>t.id===boundTab)||(matches.length===1?matches[0]:null);project=data.project;
  if(!tab)throw Error('Open this library’s Overleaf project in a single tab, then try again.');
 }
 if(!project)throw Error('Open your Overleaf project tab first.');boundTab=tab.id;
 return {tab,project,name:(tab.title||'Overleaf').replace(/\s*[-–—|]\s*Overleaf.*$/i,'')};
}
async function editor(type,keyword){if(isWeb())throw Error('Overleaf actions are unavailable in Websurfing mode.');const info=await active();if(data&&data.project!==info.project)throw Error('This library belongs to another Overleaf project. Choose its folder first.');try{const result=await chrome.tabs.sendMessage(info.tab.id,{type,keyword});if(!result?.ok)throw Error(result?.error||'Could not read selection.');return result;}catch(e){if(/Receiving end|establish connection/.test(e.message))throw Error('Reload the Overleaf tab after updating the extension.');throw e;}}
function run(fn,waitForSync=false){return async()=>{
 if(foregroundBusy||actionWaiting){tell('An action is already in progress. Please wait.');return;}
 if(busy){
  if(!waitForSync){tell('Sync is in progress. Please try again in a moment.');return;}
  actionWaiting=true;tell('Finishing sync, then running your action…');
  const started=Date.now();
  while(busy&&Date.now()-started<15000)await new Promise(resolve=>setTimeout(resolve,30));
  actionWaiting=false;
  if(busy){tell('Sync is taking longer than expected. Try again when it finishes.');return;}
 }
 if(waitForSync&&sync?.conflicts.length){tell('Resolve the conflicting entries first.');return;}
 busy=true;foregroundBusy=true;document.querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=true);try{await fn();if(dirty&&sync)await flush();}catch(e){tell(e.name==='AbortError'?'Cancelled.':e.message);}finally{busy=false;foregroundBusy=false;document.querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=false);const row=currentRow();$('show').disabled=$('remove').disabled=!row?.screenshot;lockConflicts();}};}
async function connect(handle){
 const loaded=await Library.read(handle);let next=loaded;
 if(!next){if(isWeb())next=Library.empty('websurfing:'+Library.uuid(),handle.name);else{const info=await active(true);next=Library.empty(info.project,info.name);}}
 const connection=new SyncLibrary(handle,'Capture extension');
 const result=await connection.initialize(next);
 mode=result.data.project.startsWith('websurfing:')?'websurfing':'overleaf';dir=handle;sync=connection;data=result.data;pending=new Map();current=null;dirty=false;draw();showConflicts(result);
 const response=await fetch(chrome.runtime.getURL('viewer.html'));if(!response.ok)throw Error('Viewer unavailable.');await Library.write(dir,'viewer.html',await response.text());
 await sync.snapshot(data);tell('Connected to '+dir.name+'. Automatic sync is on. Open viewer.html and choose this folder.');remembered=handle;await remember(handle);
}
function discard(){return !dirty||confirm('Discard unsaved changes and open another library?');}
$('folder').onclick=run(async()=>{if(!discard())return;const handle=await showDirectoryPicker({mode:'readwrite',id:'overleaf-library',...((dir||remembered)?{startIn:dir||remembered}:{})});await connect(handle);});
$('reconnect').onclick=run(async()=>{if(!discard())return;if(await remembered.requestPermission({mode:'readwrite'})!=='granted')throw Error('Folder access was not granted.');await connect(remembered);});
$('reload').onclick=run(async()=>{if(!dir)throw Error('Choose a folder first.');if(!discard())return;await connect(dir);});
$('entry').onchange=()=>{commit();current=$('entry').value;draw();};
$('year').oninput=$('web-title').oninput=$('sentence').oninput=$('link').oninput=$('notes').oninput=()=>{commit();if(isWeb()){const option=Array.from($('entry').options).find(o=>o.value===current);if(option)option.textContent=currentRow()?.keyword||'';}setDirty();};
$('capture').onclick=run(async()=>{if(!dir)throw Error('Choose a library folder first.');commit();const found=await editor('captureSelection');let row=data.rows.find(r=>r.kind!=='section'&&r.keyword.toLowerCase()===found.keyword.toLowerCase());if(!row){row={id:Library.uuid(),keyword:found.keyword,sentence:found.sentence||'',link:'',screenshot:'',incomplete:!!found.incomplete,added:Date.now()};data.rows.push(row);dirty=true;}current=row.id;draw();tell(found.incomplete?'Captured keyword. Paste its sentence; source context was unavailable.':dirty?'Entry ready. Save to folder to write it.':'Existing entry selected.');},true);
$('refresh').onclick=run(async()=>{commit();const row=currentRow();if(!row)return;const result=await editor('findInstances',[row.keyword]),match=result.matches[0];if(!match?.count)throw Error('Keyword not found; sentence kept.');row.sentence=match.sentence;row.incomplete=false;draw();setDirty();});
const findCurrentInstances=run(async()=>{const row=currentRow();if(!row)return;tell('Finding instances of '+row.keyword+'…');const result=await editor('findInstances',row.keyword);$('results').replaceChildren();for(const match of result.matches){const section=document.createElement('section'),title=document.createElement('strong'),text=document.createElement('p');title.textContent='Line '+match.line;text.textContent=match.sentence+'\n'+match.before+match.match+match.after;section.append(title,text);$('results').append(section);}tell(result.matches.length+' matches in the open source file.');},true);
$('find').onclick=findCurrentInstances;
function keywordInstances(){
 const row=currentRow();if(!row)return;
 // Copy immediately while the click has clipboard activation; finding also works if copying is denied.
 navigator.clipboard.writeText(row.keyword).catch(()=>{});
 return findCurrentInstances();
}
$('keyword').onclick=keywordInstances;
$('keyword-find').onclick=run(async()=>{
 if(!sync)throw Error('Choose a library folder first.');
 const found=await editor('captureSelection');
 let copied=true;try{await navigator.clipboard.writeText(found.keyword);}catch{copied=false;}
 commit();if(dirty)await flush();
 if(dirty)throw Error('Finish saving your edits, then try the search again.');
 applyResult(await sync.read());
 const matches=data.rows.filter(row=>row.kind!=='section'&&row.keyword.trim().toLowerCase()===found.keyword.trim().toLowerCase());
 if(matches.length){current=matches[0].id;draw();}else $('results').replaceChildren();
 if(matches.length>1){
  for(const match of matches){
   const button=document.createElement('button');button.textContent=match.keyword+' — '+match.sentence;
   button.onclick=()=>{commit();current=match.id;draw();};$('results').append(button);
  }
 }
 tell((copied?'Copied “'+found.keyword+'”. ':'Could not copy to clipboard. ')+(matches.length?matches.length+' matching '+(matches.length===1?'entry':'entries')+' found in this session.':'No matching entry in this session.'));
},true);

// Each new screenshot is added to the entry; earlier ones are kept.
async function attach(blob){const row=currentRow();if(!row)throw Error('Capture or select an entry first.');const image=await Library.picture(blob),path='images/'+Library.uuid()+'.png';pending.set(path,image);Library.setShots(row,[...Library.shots(row),path]);draw();setDirty();tell('Screenshot added ('+Library.shots(row).length+' for this entry).');}
$('image').onchange=run(async()=>{for(const file of $('image').files)await attach(file);$('image').value='';});
$('paste').onclick=run(async()=>{if(!currentRow())throw Error('Select an entry first.');if(!await chrome.permissions.request({permissions:['clipboardRead']}))throw Error('Use ⌘V / Ctrl+V on the Paste screenshot button instead.');for(const item of await navigator.clipboard.read()){const type=item.types.find(t=>['image/png','image/jpeg','image/webp'].includes(t));if(type){await attach(await item.getType(type));return;}}throw Error('No screenshot found in the clipboard.');});
$('paste').addEventListener('paste',event=>{event.preventDefault();const files=Array.from(event.clipboardData.items).filter(i=>i.kind==='file'&&i.type.startsWith('image/')).map(i=>i.getAsFile()).filter(Boolean);if(files.length)run(async()=>{for(const file of files)await attach(file);})();else tell('No image in clipboard.');});
$('show').onclick=run(async()=>{if(!$('preview').hidden){closeImage();return;}await openImage();});
$('remove').onclick=()=>{const row=currentRow();if(!row)return;const list=Library.shots(row);if(list.length>1&&!confirm('Remove all '+list.length+' screenshots from '+row.keyword+'?'))return;for(const path of list)pending.delete(path);Library.setShots(row,[]);draw();setDirty();};
$('save').onclick=run(async()=>{if(!sync)throw Error('Choose a library folder first.');commit();await flush();tell('Folder is up to date.');});
async function importOld(old){if(!dir||!data)throw Error('Choose an empty library folder first.');if(data.rows.length)throw Error('Use an empty library folder to import; existing entries are protected.');const migrated=await Library.migrate(old);if(data.project!==migrated.data.project)throw Error('Open the matching Overleaf project and choose a new folder for this session.');migrated.data.name=data.name;migrated.data.revision=data.revision;data=migrated.data;pending=migrated.pending;current=null;dirty=true;draw();tell('Imported '+data.rows.length+' rows, including '+pending.size+' screenshots. Click Save to folder.');}
$('import').onchange=run(async()=>{const file=$('import').files[0];if(!file)return;if(file.size>100*1024*1024)throw Error('Import limit is 100 MB.');await importOld(JSON.parse(await file.text()));$('import').value='';});
$('legacy').onclick=run(async()=>{if(!data)throw Error('Choose an empty library folder first.');const key='project:'+data.project,stored=await chrome.storage.local.get(key);if(!stored[key])throw Error('No old working table found. Import your exported JSON instead.');await importOld({version:1,project:data.project,...stored[key]});});
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
let db;const ready=new Promise(resolve=>{const request=indexedDB.open('overleaf-local-folders',1);request.onupgradeneeded=()=>request.result.createObjectStore('settings');request.onerror=resolve;request.onsuccess=()=>{db=request.result;const get=db.transaction('settings').objectStore('settings').get('lastFolder');get.onsuccess=()=>{remembered=get.result;$('reconnect').hidden=!remembered;resolve();};get.onerror=resolve;};});
async function remember(handle){await ready;if(!db)return;const tx=db.transaction('settings','readwrite');tx.objectStore('settings').put(handle,'lastFolder');$('reconnect').hidden=false;}
draw();

function lockConflicts(){
 const blocked=!!sync?.conflicts.length;
 document.querySelectorAll('#editor button,#editor input,#editor textarea,#capture,#add-web,#keyword-find,#save,#import,#legacy').forEach(el=>{const disabled=blocked||foregroundBusy||(['show','remove'].includes(el.id)&&!currentRow()?.screenshot);if(el.disabled!==disabled)el.disabled=disabled;});
}
function showConflicts(result){
 renderSyncConflicts($('conflicts'),result.conflicts,data,(key,value)=>run(async()=>{applyResult(await sync.resolve(key,value));tell(sync.conflicts.length?'Resolve the remaining versions.':'Conflict resolved and synchronized.');})(),dir);lockConflicts();
}
function applyResult(result){
 const before=new Set((data?.rows||[]).map(r=>r.id)),fresh=result.data.rows.filter(r=>r.kind!=='section'&&!before.has(r.id));
 if(data&&fresh.length&&!$('editor').contains(document.activeElement)){const newest=fresh.reduce((a,b)=>(b.added||0)>=(a.added||0)?b:a);current=newest.id;}
 const changed=JSON.stringify(data?.rows)!==JSON.stringify(result.data.rows);data=result.data;dirty=false;
 if(changed)draw();showConflicts(result);
 if(result.conflicts.length)tell('Conflicting edits found. Choose the version to keep below.');
 else if(result.snapshotError)tell(result.snapshotError);
}
async function flush(){
 if(!sync)return;
 if(sync.conflicts.length)throw Error('Choose a version for each conflict first.');
 commit();Library.validate(data);
 const generation=editGeneration,sent=structuredClone(data),images=new Map(pending);
 const result=await sync.save(sent,images);
 for(const [path,blob] of pending)if(sent.rows.some(r=>Library.shots(r).includes(path)))pending.delete(path);
 if(generation!==editGeneration){Object.assign(sync,result.localContext);dirty=true;return;}
 applyResult(result);
 if(!result.conflicts.length&&!result.snapshotError)tell('Synchronized with the local folder.');
}
async function tick(){
 if(!sync||busy||actionWaiting)return;busy=true;
 try{
  if(dirty)await flush();else{
   const generation=editGeneration,context={loaded:sync.loaded,heads:sync.heads,conflicts:sync.conflicts};
   const result=await sync.read();if(generation!==editGeneration){Object.assign(sync,context);return;}
   const changed=result.data.revision!==data.revision;applyResult(result);if(changed&&!result.conflicts.length)tell('Updated from the viewer.');
  }
  if(!sync.conflicts.length&&!dirty)await handleViewerRequest();
 }catch(error){tell('Sync needs attention: '+error.message);}
 finally{busy=false;lockConflicts();}
}
let processingRequest=false;
async function handleViewerRequest(){
 if(processingRequest)return;
 const commands=await dir.getDirectoryHandle('requests',{create:true}),responses=await dir.getDirectoryHandle('responses',{create:true});
 for await(const [name,handle] of commands.entries()){
  if(handle.kind!=='file'||!name.endsWith('.json'))continue;
  try{await responses.getFileHandle(name);continue;}catch(error){if(error.name!=='NotFoundError')throw error;}
  const text=await (await handle.getFile()).text();if(!text)continue;
  let request;try{request=JSON.parse(text);}catch{continue;}
  processingRequest=true;
  try{
   if(request.project!==data.project||Date.now()-request.at>30000)throw Error('Capture request expired. Try again.');
   let result;
   if(request.type==='capture'){
    const found=await editor('captureSelection');let row=data.rows.find(r=>r.kind!=='section'&&r.keyword.toLowerCase()===found.keyword.toLowerCase());
    if(!row){row={id:request.id,keyword:found.keyword,sentence:found.sentence||'',link:'',screenshot:'',incomplete:!!found.incomplete,added:Date.now()};data.rows.push(row);dirty=true;}
    current=row.id;draw();await flush();result={ok:true,message:'Captured '+found.keyword};
   }else if(request.type==='refresh'||request.type==='find'){
    const row=data.rows.find(r=>r.id===request.rowId&&r.kind!=='section');if(!row)throw Error('Entry no longer exists.');
    const found=await editor('findInstances',request.type==='refresh'?[row.keyword]:row.keyword);
    if(request.type==='refresh'){const match=found.matches[0];if(!match?.count)throw Error('Keyword not found in the open source file.');row.sentence=match.sentence;dirty=true;draw();await flush();result={ok:true,message:'Sentence refreshed from the first occurrence.'};}
    else result={ok:true,matches:found.matches,message:'Found '+found.matches.length+' instances.'};
   }else throw Error('Unknown request.');
   await Library.write(responses,name,JSON.stringify(result));
  }catch(error){await Library.write(responses,name,JSON.stringify({ok:false,error:error.message}));}
  finally{processingRequest=false;}
  break;
 }
}
setInterval(tick,2500);

// Each viewer launch keeps its own folder handle, even if the panel changes libraries.
$('open-city').onclick=async()=>{ // Paper City ships inside this extension (paper-city/), connected to the same folder
 try{
  if(!dir)throw Error('Choose a library folder first.');
  const folder=dir;await ready;if(!db)throw Error('Folder connection could not be stored. Please reopen the extension.');
  const token=Library.uuid();
  await new Promise((resolve,reject)=>{const tx=db.transaction('settings','readwrite');tx.objectStore('settings').put(folder,'viewer:'+token);tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error||Error('Could not connect Paper City.'));});
  await chrome.tabs.create({url:chrome.runtime.getURL('paper-city/city.html')+'?folder='+encodeURIComponent(token)});
  tell('Paper City opened for '+folder.name+'. Changes sync automatically.');
 }catch(error){tell(error.message);}
};
$('open-viewer').onclick=async()=>{
 try{
  if(!dir)throw Error('Choose a library folder first.');
  const folder=dir;await ready;if(!db)throw Error('Folder connection could not be stored. Please reopen the extension.');
  const token=Library.uuid();
  await new Promise((resolve,reject)=>{const tx=db.transaction('settings','readwrite');tx.objectStore('settings').put(folder,'viewer:'+token);tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error||Error('Could not connect the viewer.'));});
  await chrome.tabs.create({url:chrome.runtime.getURL('viewer-tab.html')+'?folder='+encodeURIComponent(token)});
  tell('Viewer opened for '+folder.name+'. Changes sync automatically.');
 }catch(error){tell(error.message);}
};

$('open-link').onclick=async()=>{
 try{
  const value=$('link').value.trim();
  if(!value)throw Error('Add a weblink first.');
  let url;try{url=new URL(value);}catch{throw Error('Enter a complete web address starting with https:// or http://.');}
  if(!['https:','http:'].includes(url.protocol))throw Error('Use a web address starting with https:// or http://.');
  await chrome.windows.create({url:url.href,type:'normal',focused:true});
 }catch(error){tell(error.message);}
};

const changeMode=run(async()=>{
 const requested=$('mode').value;
 try{
  commit();if(dirty&&sync)await flush();
  if(dirty||sync?.conflicts.length)throw Error('Save changes and resolve conflicts before changing modes.');
  mode=requested;dir=null;data=null;sync=null;current=null;pending.clear();draw();
  tell('Choose a '+(isWeb()?'Websurfing':'Overleaf')+' library folder. Use an empty folder to start a new session.');
 }finally{$('mode').value=mode;}
});
$('add-web').onclick=run(async()=>{
 if(!sync||!isWeb())throw Error('Choose a Websurfing library folder first.');
 const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
 if(!tab?.url||!/^https?:\/\//i.test(tab.url))throw Error('Open a webpage and highlight a word first.');
 const origin=new URL(tab.url).origin+'/*';
 if(!await chrome.permissions.request({origins:[origin]}))throw Error('Allow access to this website to capture its highlighted text.');
 let results;
 try{results=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>{
  function selected(win){
   try{
    const el=win.document.activeElement;
    if(el?.tagName==='TEXTAREA'||(el?.tagName==='INPUT'&&['text','search','url','tel'].includes(el.type))){
     const text=el.value.slice(el.selectionStart||0,el.selectionEnd||0).trim();if(text)return text;
    }
    const text=win.getSelection()?.toString().trim();if(text)return text;
    for(let i=0;i<win.frames.length;i++){const text=selected(win.frames[i]);if(text)return text;}
   }catch{}return '';
  }
  return selected(window);
 }});}catch{throw Error('This page cannot be read. Try a regular webpage with selectable text.');}
 const keyword=results?.[0]?.result?.trim();
 if(!keyword)throw Error('Highlight a word on the webpage, then click Capture highlighted word.');
 commit();const row={id:Library.uuid(),keyword,year:'',sentence:'',link:'',screenshot:'',added:Date.now()};
 data.rows.push(row);current=row.id;setDirty();draw();$('year').focus();
});

$('mode').onchange=async()=>{await changeMode();$('mode').value=mode;};

// BibTeX box for the current entry (synced with the viewer and Paper City)
var bibBox=null;
function drawBib(row){
 const host=$('bib-box');if(!row){host.replaceChildren();bibBox=null;return;}
 if(bibBox&&bibBox.dataset.id===row.id&&host.contains(document.activeElement)){bibBox.refresh(row.bibtex);return;}
 bibBox=Bib.field(row,{disabled:!dir,onEdit:()=>setDirty(),tell});bibBox.dataset.id=row.id;host.replaceChildren(bibBox);
}

// Heading for this entry only: changing it moves just this entry under a heading with that name
// (an existing one, matched ignoring capitals and spaces, or a new heading at the end). Other entries stay put.
var headingMode='rename';
const headingKey=t=>String(t||'').trim().replace(/\s+/g,' ').toLowerCase();
function headingOf(id){let h=null;for(const r of data?.rows||[]){if(r.kind==='section')h=r;else if(r.id===id)return h;}return null;}
function drawHeading(){
 const input=$('heading'),h=headingOf(current);input.disabled=$('heading-apply').disabled=!dir||!current;
 if(document.activeElement!==input)input.value=h?.title||'';
 input.placeholder=h?'':'No heading yet: type one and press Enter';
 const names=[...new Map((data?.rows||[]).filter(r=>r.kind==='section').map(r=>[headingKey(r.title),r.title.trim()])).values()];
 $('heading-list').replaceChildren(...names.map(n=>new Option(n)));
 $('heading-note').textContent=!current?'':'Type a heading (or pick one) and press Enter. Only this entry moves; in Paper City it moves to that house. A new name adds a new heading at the end.';
}
function applyHeading(){
 const input=$('heading'),title=input.value.trim().replace(/\s+/g,' '),row=currentRow();if(!row)return;
 const h=headingOf(row.id);if(!title){input.value=h?.title||'';return;}
 if(h&&headingKey(h.title)===headingKey(title)){input.value=h.title;return;}
 if(!data||!dir){tell('Choose a library folder first.');return;}
 if(sync?.conflicts.length){tell('Resolve the conflicting versions first.');return;}
 commit();const rows=data.rows;rows.splice(rows.indexOf(row),1);
 let target=rows.find(r=>r.kind==='section'&&headingKey(r.title)===headingKey(title)),made=false;
 if(!target){target={id:Library.uuid(),kind:'section',title};rows.push(target);made=true;}
 let at=rows.indexOf(target)+1;while(at<rows.length&&rows[at].kind!=='section')at++;rows.splice(at,0,row);
 input.blur();draw();setDirty();
 tell(row.keyword+' moved under '+(made?'the new heading':'')+' "'+target.title+'".'+(made?' It is a new house in Paper City.':''));
}
$('heading-form').onsubmit=e=>{e.preventDefault();applyHeading();};
$('heading').onkeydown=e=>{if(e.key==='Escape'){$('heading').value=headingOf(current)?.title||'';$('heading').blur();}};
