'use strict';
// Lists the PDFs in the folder chosen with "Choose PDF folder" (stored by the capture panel).
const $=id=>document.getElementById(id),urls=[];let folder=null,files=[];
const tell=t=>$('status').textContent=t;
function stored(){return new Promise(res=>{const r=indexedDB.open('overleaf-local-folders',1);r.onupgradeneeded=()=>r.result.createObjectStore('settings');r.onerror=()=>res(null);
 r.onsuccess=()=>{const d=r.result;try{const q=d.transaction('settings').objectStore('settings').get('pdfFolder');q.onsuccess=()=>{d.close();res(q.result||null);};q.onerror=()=>{d.close();res(null);};}catch{d.close();res(null);}};});}
const size=b=>b>1048576?(b/1048576).toFixed(1)+' MB':Math.max(1,Math.round(b/1024))+' KB';
async function load(){
 if(!folder){tell('No PDF folder yet. In the capture panel, click “Choose PDF folder”.');return;}
 $('title').textContent='Saved PDFs · '+folder.name;$('where').textContent='Folder: '+folder.name;
 if(await folder.queryPermission({mode:'read'})!=='granted'){$('grant').hidden=false;tell('Click “Allow access” so this page can list '+folder.name+'.');return;}
 $('grant').hidden=true;files=[];
 for await(const [name,h] of folder.entries())if(h.kind==='file'&&/\.pdf$/i.test(name)){const f=await h.getFile();files.push(f);}
 files.sort((a,b)=>b.lastModified-a.lastModified);render();
}
function render(){
 const q=$('search').value.trim().toLowerCase(),list=$('list');list.replaceChildren();
 const shown=files.filter(f=>!q||f.name.toLowerCase().includes(q));
 tell(files.length?shown.length+' of '+files.length+' PDF'+(files.length===1?'':'s'):'No PDFs saved in '+folder.name+' yet.');
 for(const f of shown){const li=document.createElement('li'),n=document.createElement('span'),m=document.createElement('span'),b=document.createElement('button');
  n.className='name';n.textContent=f.name;m.className='meta';m.textContent=new Date(f.lastModified).toLocaleString()+' · '+size(f.size);
  b.textContent='Open';b.onclick=()=>{const u=URL.createObjectURL(f);urls.push(u);window.open(u,'_blank');};
  li.append(n,m,b);list.append(li);}
}
$('grant').onclick=async()=>{try{if(await folder.requestPermission({mode:'read'})==='granted')await load();}catch(e){tell(e.message);}};
$('refresh').onclick=()=>load().catch(e=>tell(e.message));
$('search').oninput=render;
addEventListener('focus',()=>load().catch(()=>{}));
(async()=>{folder=await stored();await load();})().catch(e=>tell(e.message));
