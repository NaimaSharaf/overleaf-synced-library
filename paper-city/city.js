'use strict';
// Paper City — joins your library's sync as a third window ("Paper City").
// Town names = section headings; moving a resident = moving the paper under that heading;
// each town's layout, colour and walls are stored on its section row (field "city"),
// so they live in the same library (session.json + changes/) as everything else.
const $=id=>document.getElementById(id);
const canvas=$('map'),ctx=canvas.getContext('2d');
const COLORS=['#e9c46a','#8ecae6','#f4a261','#b5e48c','#cdb4db','#ffafcc','#a3c4f3','#f6bd60','#90dbf4','#c9ada7'];
const SHIRTS=['#d1495b','#00798c','#edae49','#30638e','#6a4c93','#2a9d8f','#e76f51','#457b9d','#8d6a9f','#3d5a80'];
const OUT='__outskirts';
let dir=null,sync=null,library=null,readOnly=false,legacy=null;
let local={version:2,outskirts:null,walls:[]}; // city.json: only things with no section row to live on
let prev=new Map(),towns=[],walls=new Set(),people=new Map();
let bubbleMode='turns',hoverP=null,cam={x:0,y:0,z:1},tool='select',selected=null,hover=null,drag=null,spaceDown=false,cardURL=null;

const tell=m=>$('status').textContent=m;
const key=(x,y)=>x+','+y;
const hash=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
const nameOf=r=>(r.keyword||r.title||'Untitled').trim()||'Untitled';
const townAt=(x,y)=>towns.find(t=>x>=t.x&&x<t.x+t.w&&y>=t.y&&y<t.y+t.h);

// ---------- storage ----------
const idb=new Promise(res=>{const r=indexedDB.open('paper-city',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>res(null);});
async function kv(k,v){const db=await idb;if(!db)return;return new Promise(res=>{try{const tx=db.transaction('kv',v===undefined?'readonly':'readwrite'),s=tx.objectStore('kv'),q=v===undefined?s.get(k):s.put(v,k);q.onsuccess=()=>res(q.result);q.onerror=()=>res();}catch{res();}});}
async function readJSON(name){try{const f=await (await dir.getFileHandle(name)).getFile();return JSON.parse(await f.text());}catch(e){if(e.name==='NotFoundError')return null;throw e;}}
// All library reads/writes run one at a time.
let queue=Promise.resolve(),busy=0;
function enqueue(fn){busy++;const run=queue.then(fn).catch(e=>tell(/conflict/i.test(e.message)?'Your viewer has conflicting edits. Choose a version there, then Paper City can save again.':e.message)).finally(()=>busy--);queue=run;return run;}
// Read the latest library right before writing, so Paper City never saves on top of an old copy
// (e.g. a heading you just renamed in the viewer).
async function fresh(){const r=await sync.read();if(r.conflicts.length)throw Error('conflict');if(r.data.revision!==library.revision){library=r.data;reconcile(false);}}
function editLibrary(mutate,message){
 if(readOnly||!sync){tell('Read-only city: open the library folder to save changes.');return;}
 return enqueue(async()=>{await fresh();const next=structuredClone(library);if(mutate(next)===false)return;const r=await sync.save(next);library=r.data;reconcile(false);if(r.snapshotError)tell(r.snapshotError);else if(message)tell(message);});
}
let layoutTimer=0,layoutDirty=false,layoutGen=0;
function save(){ // layout, colours and walls
 if(readOnly||!sync)return;layoutDirty=true;clearTimeout(layoutTimer);const my=++layoutGen;
 layoutTimer=setTimeout(()=>enqueue(async()=>{
  const mine=new Map(towns.map(t=>[t.id,[]])),loose=[];
  for(const k of walls){const [x,y]=k.split(',').map(Number),o=owner(x,y);(o&&o.id!==OUT?mine.get(o.id):loose).push(o&&o.id!==OUT?[x-o.x,y-o.y]:k);}
  await fresh();const next=structuredClone(library);let changed=false;
  for(const row of next.rows){if(row.kind!=='section')continue;const t=towns.find(t=>t.id===row.id);if(!t)continue;
   const c={x:t.x,y:t.y,w:t.w,h:t.h,color:t.color,walls:mine.get(t.id),...(t.shift!=null?{shift:t.shift}:{})};if(JSON.stringify(row.city)!==JSON.stringify(c)){row.city=c;changed=true;}}
  if(changed){const r=await sync.save(next);library=r.data;}
  const o=towns.find(t=>t.id===OUT);local={version:2,outskirts:o?{x:o.x,y:o.y,w:o.w,h:o.h,color:o.color}:local.outskirts,walls:loose,hub:hub?{x:hub.x,y:hub.y,w:hub.w,h:hub.h}:local.hub};
  const h=await dir.getFileHandle('city.json',{create:true}),w=await h.createWritable();await w.write(JSON.stringify(local,null,1));await w.close();
  legacy=null;if(my===layoutGen)layoutDirty=false;reconcile(false);
 }),1200);
}
function owner(x,y){if(hub&&x>=hub.x-2&&x<hub.x+hub.w+2&&y>=hub.y-2&&y<hub.y+hub.h+2)return null;return towns.find(t=>x>=t.x-2&&x<t.x+t.w+2&&y>=t.y-2&&y<t.y+t.h+2)||towns.reduce((b,t)=>{const d=Math.hypot(x-(t.x+t.w/2),y-(t.y+t.h/2));return !b||d<b.d?{t,d}:b;},null)?.t;}

async function connect(handle){
 if(await handle.queryPermission({mode:'readwrite'})!=='granted'&&await handle.requestPermission({mode:'readwrite'})!=='granted')throw Error('Folder access was not granted.');
 const s=new SyncLibrary(handle,'Paper City');let result;
 try{result=await s.open();}catch(e){throw Error(handle.name+' is not a synced library folder. Choose the folder your capture extension uses. ('+e.message+')');}
 dir=handle;sync=s;readOnly=false;
 const saved=await readJSON('city.json').catch(()=>null);
 legacy=saved?.version===1?saved:null;local=saved?.version===2?saved:{version:2,outskirts:legacy?.towns?.[OUT]||null,walls:[]};
 towns=[];hub=null;people.clear();library=result.data;reconcile(true);fit();
 if(legacy||library.rows.some(r=>r.kind==='section'&&!r.city))save();
 await kv('folder',handle);$('reconnect').hidden=true;
 tell(result.conflicts.length?'Connected, but your viewer has conflicting edits to resolve before Paper City can save.':'Connected to '+handle.name+'. Town names, moves and walls sync with your viewer.');
}
$('open').onclick=async()=>{try{await connect(await showDirectoryPicker({mode:'readwrite',id:'paper-city'}));}catch(e){if(e.name!=='AbortError')tell(e.message);}};
$('reconnect').onclick=async()=>{try{await connect(await kv('folder'));}catch(e){tell(e.message);}};
$('json').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{library=JSON.parse(await f.text());dir=null;sync=null;readOnly=true;local={version:2,outskirts:null,walls:[]};legacy=null;towns=[];hub=null;people.clear();reconcile(true);fit();tell('Read-only city. Open the folder to save town names and walls.');}catch(err){tell('Not a valid session.json: '+err.message);}};
// Paper City runs inside the Overleaf Synced Library extension. It connects to the folder the capture panel
// handed over ("Open Paper City"), else the folder it used last, else the panel's last library folder.
function panelSetting(key){return new Promise(res=>{const r=indexedDB.open('overleaf-local-folders',1);r.onupgradeneeded=()=>r.result.createObjectStore('settings');r.onerror=()=>res(null);
 r.onsuccess=()=>{const d=r.result;try{const q=d.transaction('settings').objectStore('settings').get(key);q.onsuccess=()=>{d.close();res(q.result||null);};q.onerror=()=>{d.close();res(null);};}catch{d.close();res(null);}};});}
async function handedFolder(){const token=new URL(location.href).searchParams.get('folder');return token?panelSetting('viewer:'+token):null;}
(async()=>{const given=await handedFolder();if(given)await kv('folder',given);const h=given||await kv('folder')||await panelSetting('lastFolder');if(!h)return;if(await h.queryPermission({mode:'readwrite'})==='granted'){try{await connect(h);}catch(e){tell(e.message);}}else{$('reconnect').hidden=false;$('reconnect').textContent='Reconnect '+h.name;}})();
setInterval(()=>{if(!sync||busy||document.hidden)return;enqueue(async()=>{const r=await sync.read();if(r.data.revision!==library.revision){library=r.data;reconcile(!layoutDirty);}});},3000);

// ---------- city model ----------
function reconcile(fromDisk){
 computeFriends(library.rows||[]);
 const groups=[{id:OUT,section:'Outskirts',row:null,rows:[]}];
 {const all=[groups[0]];for(const r of library.rows||[]){if(r.kind==='section')all.push({id:r.id,section:r.title||'Untitled town',row:r,rows:[]});else all.at(-1).rows.push(r);}
  // headings with the same name (ignoring case and spaces) are one house; the first one holds its layout
  const byName=new Map();groups.length=0;
  for(const g of all){g.ids=[g.id];if(g.id===OUT){groups.push(g);continue;}const k=g.section.trim().replace(/\s+/g,' ').toLowerCase(),m=byName.get(k);
   if(m){m.rows.push(...g.rows);m.ids.push(g.id);}else{byName.set(k,g);groups.push(g);}}}
 prev=new Map(towns.map(t=>[t.id,t]));towns=[];let grew=false;
 if(fromDisk)walls=new Set(local.walls||[]);
 groups.forEach((g,i)=>{
  if(g.id===OUT&&!g.rows.length)return;
  const old=prev.get(g.id),stored=g.id===OUT?local.outskirts:g.row.city,leg=legacy?.towns?.[g.id];
  const s=(!fromDisk&&old)||(stored?.w&&stored)||(leg?.w&&leg)||old||{};
  const t={id:g.id,sectionIds:g.ids,section:g.section,name:g.section,members:g.rows.map(r=>r.id),color:s.color||COLORS[i%COLORS.length],shift:s.shift??null};
  if(s.w){Object.assign(t,{x:s.x,y:s.y,w:s.w,h:s.h});if(fitHouse(t)){grew=true;t._resized=true;}}else{Object.assign(t,{x:0,y:0,w:14,h:13});fitHouse(t);Object.assign(t,place(t.w,t.h));grew=true;}
  if(fromDisk&&g.row?.city?.walls)for(const [dx,dy] of g.row.city.walls)walls.add(key(t.x+dx,t.y+dy));
  towns.push(t);
 });
 for(const t of towns)if(t._resized){delete t._resized;unOverlap(t);}
 if(fromDisk&&legacy&&!walls.size)for(const k of legacy.walls||[])walls.add(k);
 const home=new Map();for(const t of towns)for(const id of t.members)home.set(id,t.id);
 const rows=new Map((library.rows||[]).filter(r=>r.kind!=='section').map(r=>[r.id,r]));
 for(const id of [...people.keys()])if(!rows.has(id))people.delete(id);
 for(const [id,r] of rows){const t=towns.find(t=>t.id===home.get(id));let p=people.get(id);
  if(!p){p={id,row:r,wait:Math.random()*2};const s=spot(t);p.x=s.x;p.y=s.y;p.tx=p.x;p.ty=p.y;people.set(id,p);}
  p.row=r;if(p.town!==t.id&&!inside(t,p.x,p.y)){const s=spot(t);p.x=s.x;p.y=s.y;p.tx=p.x;p.ty=p.y;}p.town=t.id;}
 if(selected&&!people.has(selected))closeCard();
 syncCardNotes();
 if(ensureHub())grew=true;
 renderTowns();if(grew&&!readOnly)setTimeout(save,0);
}
function unOverlap(t){ // a house that grew moves to free space (with its walls) instead of overlapping a neighbour
 const others=[...towns,...(hub?[hub]:[])].filter(o=>o!==t&&o.w),hit=(x,y)=>others.some(o=>x<o.x+o.w+3&&x+t.w+3>o.x&&y<o.y+o.h+3&&y+t.h+3>o.y);
 if(!hit(t.x,t.y))return;
 for(let r=1;r<200;r++)for(let dx=-r;dx<=r;dx++)for(const dy of [-r,r])for(const [a,b] of [[dx,dy],[dy,dx]])if(!hit(t.x+a,t.y+b)){
  const mv=[...walls].filter(k=>{const [x,y]=k.split(',').map(Number);return x>=t.x-1&&x<=t.x+t.w&&y>=t.y-1&&y<=t.y+t.h;});
  for(const k of mv)walls.delete(k);for(const k of mv){const [x,y]=k.split(',').map(Number);walls.add(key(x+a,y+b));}
  for(const p of people.values())if(p.town===t.id){p.x+=a;p.y+=b;p.path=null;}t.x+=a;t.y+=b;return;}
}
function place(w,h){
 const taken=[...towns,...prev.values(),...(hub?[hub]:[])].filter(s=>s.w);
 for(let y=2;;y++)for(let x=2;x<=Math.max(100,y);x++)if(!taken.some(o=>x<o.x+o.w+4&&x+w+4>o.x&&y<o.y+o.h+4&&y+h+4>o.y))return {x,y,w,h};
}
const inside=(t,x,y)=>x>=t.x+1&&x<t.x+t.w-1&&y>=t.y+2&&y<t.y+t.h-1;
function spot(t){for(let i=0;i<40;i++){const x=t.x+1+Math.floor(Math.random()*(t.w-2)),y=t.y+2+Math.floor(Math.random()*(t.h-3));if(!blocked(x,y))return {x:x+.5,y:y+.5};}return {x:t.x+t.w/2,y:t.y+t.h/2};}
function moveResident(p,t){
 p.town=t.id;
 editLibrary(next=>{const i=next.rows.findIndex(r=>r.id===p.id);if(i<0)return false;const [row]=next.rows.splice(i,1);let at;
  if(t.id===OUT){at=next.rows.findIndex(r=>r.kind==='section');if(at<0)at=next.rows.length;}
  else{at=next.rows.findIndex(r=>r.id===t.id)+1;if(!at)return false;while(at<next.rows.length&&next.rows[at].kind!=='section')at++;}
  next.rows.splice(at,0,row);},nameOf(p.row)+' moved to '+t.name+'. It is now under that heading in your viewer.');
}
const renameTimers={};
function renameTown(t,value){
 value=value.trim();if(!value||value===t.section)return;
 if(t.id===OUT)return editLibrary(next=>{next.rows.unshift({id:Library.uuid(),kind:'section',title:value,city:{x:t.x,y:t.y,w:t.w,h:t.h,color:t.color,walls:[]}});},'Outskirts is now the section "'+value+'" in your viewer.').then(()=>{local.outskirts=null;save();});
 const ids=t.sectionIds||[t.id];return editLibrary(next=>{const rs=next.rows.filter(r=>ids.includes(r.id));if(!rs.length)return false;for(const r of rs)r.title=value;},(ids.length>1?'Renamed all '+ids.length+' headings called "'+t.section+'".':'Renamed.')+' The section heading in your viewer is now "'+value+'".');
}

// ---------- sidebar ----------
function renderTowns(){
 const box=$('towns'),a=document.activeElement,focus=a?.dataset?.town,sel=focus&&[a.selectionStart,a.selectionEnd,a.value];
 box.replaceChildren();
 for(const t of towns){
  const el=document.createElement('div');el.className='town';
  el.innerHTML='<div class="top"><span class="dot"></span><input aria-label="House name"></div><div class="small"></div><select class="shift" aria-label="Work shift"></select><div class="row"><button data-a="go">Visit</button><button data-a="home">Call home</button><button data-a="wall">Fence it in</button><button data-a="color">Recolor</button></div>';
  el.querySelector('.dot').style.background=t.color;
  const inp=el.querySelector('input');inp.value=focus===t.id?sel[2]:t.name;inp.placeholder=t.section;inp.dataset.town=t.id;
  if(t.id===OUT){inp.onchange=()=>renameTown(t,inp.value);inp.title='Press Enter to turn Outskirts into a section heading';}
  else inp.oninput=()=>{t.name=inp.value||t.section;clearTimeout(renameTimers[t.id]);renameTimers[t.id]=setTimeout(()=>renameTown(t,inp.value),900);};
  el.querySelector('.small').textContent=(t.id===OUT?'Papers above your first heading · rename to make it a section':((t.sectionIds?.length>1)?t.sectionIds.length+' headings with this name in your viewer':'Section heading in your viewer')+' · furnished for everyone')+' · '+t.members.length+' resident'+(t.members.length===1?'':'s');
  const hb=el.querySelector('[data-a=home]');hb.textContent=isRecalled(t)?'Back to schedule':'Call home';hb.classList.toggle('on',isRecalled(t));
  hb.onclick=()=>{if(isRecalled(t)){if(recalled.has('all')){recalled.delete('all');for(const o of towns)if(o!==t)recalled.add(o.id);}else recalled.delete(t.id);tell(t.name+' is back on its schedule.');}else{recalled.add(t.id);tell('Everyone in '+t.name+' is heading home.');}renderTowns();renderRecall();};
  el.querySelector('[data-a=go]').onclick=()=>focusTown(t);
  el.querySelector('[data-a=wall]').onclick=()=>{wallTown(t);save();};
  const sh=el.querySelector('.shift');SHIFTS.forEach((_,i)=>sh.add(new Option(shiftHours(i),i)));sh.value=shiftOf(t);
  sh.onchange=()=>{t.shift=+sh.value;save();tell(t.name+' now works the '+SHIFTS[t.shift].name.toLowerCase()+'.');};
  el.querySelector('[data-a=color]').onclick=()=>{t.color=COLORS[(COLORS.indexOf(t.color)+1)%COLORS.length];el.querySelector('.dot').style.background=t.color;save();};
  box.append(el);
  if(focus===t.id){inp.focus();inp.setSelectionRange(sel[0],sel[1]);}
 }
 if(!towns.length)box.innerHTML='<p class="small">No papers yet.</p>';
}
function wallTown(t){for(let x=t.x;x<t.x+t.w;x++)for(const y of [t.y,t.y+t.h-1]){if(y===t.y+t.h-1&&Math.abs(x+.5-(t.x+t.w/2))<1.5)continue;walls.add(key(x,y));}for(let y=t.y;y<t.y+t.h;y++)for(const x of [t.x,t.x+t.w-1])walls.add(key(x,y));}
// ---------- right-click: choose a new home ----------
function closeHomeMenu(){$('ctx').hidden=true;}
function openHomeMenu(p,cx,cy){
 const m=$('ctx');m.replaceChildren();
 const title=document.createElement('div');title.className='ctx-title';title.textContent='New home for '+nameOf(p.row);m.append(title);
 for(const t of towns){const b=document.createElement('button');b.className='ctx-item';const dot=document.createElement('span');dot.className='dot';dot.style.background=t.color;b.append(dot,document.createTextNode(t.name+(t.id===p.town?'  (current home)':'')));
  b.disabled=t.id===p.town;b.onclick=()=>{closeHomeMenu();moveResident(p,t);};m.append(b);}
 const form=document.createElement('form');form.className='ctx-new';form.innerHTML='<input placeholder="Or build a new house…" maxlength="80"><button class="primary">Move in</button>';
 form.onsubmit=e=>{e.preventDefault();const name=form.querySelector('input').value.trim();if(!name)return;if(!sync){tell('Open your library folder first.');return;}closeHomeMenu();
  const id=Library.uuid();editLibrary(next=>{const i=next.rows.findIndex(r=>r.id===p.id);if(i<0)return false;const [row]=next.rows.splice(i,1);next.rows.push({id,kind:'section',title:name},row);},nameOf(p.row)+' moved into the new house '+name+'. It is a new section heading in your viewer.');};
 m.append(form);m.hidden=false;
 const r=m.parentElement.getBoundingClientRect(),w=m.offsetWidth,h=m.offsetHeight;
 m.style.left=Math.max(8,Math.min(cx-r.left,r.width-w-8))+'px';m.style.top=Math.max(8,Math.min(cy-r.top,r.height-h-8))+'px';
}
// ---------- right-click a house: everyone who lives there ----------
function openOccupants(t,cx,cy){
 const m=$('ctx');m.replaceChildren();const isHub=t===hub;
 const residents=isHub?[...people.values()].filter(p=>inRect(hub,Math.floor(p.x),Math.floor(p.y))):t.members.map(id=>people.get(id)).filter(Boolean);
 const title=document.createElement('div');title.className='ctx-title';title.textContent=isHub?'At the Work Hub now ('+residents.length+')':'Who lives in '+t.name+' ('+residents.length+')';m.append(title);
 const status=p=>{if(p.chat)return chatLabel(p);const away=!isHub&&!inRect(t,Math.floor(p.x),Math.floor(p.y));const a=p.act?ACT_LABEL[p.act]:'';return away&&p.act!=='work'?'Out: '+(a||'walking'):a;};
 const item=p=>{const b=document.createElement('button');b.className='ctx-item';const dot=document.createElement('span');dot.className='dot';dot.style.background=SHIRTS[hash(p.id)%SHIRTS.length];
  const txt=document.createElement('span'),n=document.createElement('b');n.textContent=nameOf(p.row)+(p.row.year?' · '+p.row.year:'');const act=document.createElement('span');act.className='occ-act';act.textContent=status(p);
  if(isHub){const home=towns.find(h=>h.id===p.town);act.textContent=(home?'From '+home.name+' · ':'')+act.textContent;}
  txt.append(n,act);b.append(dot,txt);b.onclick=()=>{closeHomeMenu();focusPerson(p);openCard(p);};return b;};
 const sorted=residents.slice().sort((a,b)=>nameOf(a.row).localeCompare(nameOf(b.row)));
 if(!sorted.length){const e=document.createElement('div');e.className='occ-head';e.textContent=isHub?'Nobody is here right now.':'Nobody lives here yet.';m.append(e);}
 for(const p of sorted)m.append(item(p));
 if(!isHub){const stay=[...people.values()].filter(p=>p.stay?.host===t.id);if(stay.length){const h=document.createElement('div');h.className='occ-head';h.textContent='Staying over in the guest room';m.append(h);for(const p of stay)m.append(item(p));}
  const guests=[...people.values()].filter(p=>p.town!==t.id&&!p.stay&&p.chat?.kind==='visit'&&p.chat.host===t);
  if(guests.length){const h=document.createElement('div');h.className='occ-head';h.textContent='Visiting now';m.append(h);for(const p of guests)m.append(item(p));}}
 m.hidden=false;
 const r=m.parentElement.getBoundingClientRect(),w=m.offsetWidth,h=m.offsetHeight;
 m.style.left=Math.max(8,Math.min(cx-r.left,r.width-w-8))+'px';m.style.top=Math.max(8,Math.min(cy-r.top,r.height-h-8))+'px';
}
addEventListener('keydown',e=>{if(e.key==='Escape')closeHomeMenu();});
addEventListener('pointerdown',e=>{if(!$('ctx').hidden&&!$('ctx').contains(e.target)&&e.target!==canvas)closeHomeMenu();});
canvas.addEventListener('wheel',closeHomeMenu);
function renderRecall(){const all=towns.length&&towns.every(isRecalled),b=$('call-home');b.textContent=all?'Back to schedule':'🏠 Call everyone home';b.classList.toggle('on',!!all);}
$('call-home').onclick=()=>{const all=towns.length&&towns.every(isRecalled);recalled.clear();if(!all)recalled.add('all');tell(all?'Everyone is back on their shift schedule.':'Calling everyone home. They will stay in their lounges until you send them back.');renderTowns();renderRecall();};
$('visit-hub').onclick=()=>{if(hub)focusTown(hub);};
$('new-town').onsubmit=async e=>{e.preventDefault();const inp=$('new-town-name'),name=inp.value.trim();if(!name)return inp.focus();
 if(!sync){tell('Open your library folder first; a new town is a new section heading.');return;}
 const id=Library.uuid();await editLibrary(next=>{next.rows.push({id,kind:'section',title:name});},name+' is built. It is a new section heading at the bottom of your viewer.');
 const t=towns.find(t=>t.id===id);if(t){inp.value='';focusTown(t);save();}};
$('clear-walls').onclick=()=>{if(walls.size&&confirm('Demolish all '+walls.size+' wall blocks?')){walls.clear();save();}};
const HINTS={select:'Click a resident to read their paper. Right-click one, or drag it, to give it a new home. Right-click a house to list everyone who lives there. Drag empty ground to pan.',wall:'Click or drag to lay wall blocks. Residents cannot pass the force-field walls.',erase:'Click or drag over walls to remove them.',move:'Drag a house to relocate it, with its residents, furniture and walls.'};
function setTool(t){tool=t;document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('on',b.dataset.tool===t));$('hint').textContent=HINTS[t]+' Scroll to zoom; hold Space or right-drag to pan.';canvas.style.cursor=t==='select'?'default':t==='move'?'move':'crosshair';}
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));setTool('select');

// ---------- card ----------
async function openCard(p){
 selected=p.id;const r=p.row,t=towns.find(t=>t.id===p.town);
 $('card-name').textContent=nameOf(r);
 $('card-meta').textContent=[r.year,r.title&&r.title!==r.keyword?r.title:'','Lives in '+(t?.name||'?')+' ('+SHIFTS[shiftOf(t)].name+')',p.chat?chatLabel(p):p.act?ACT_LABEL[p.act]:'',stayLabel(p),petLabel(p)].filter(Boolean).join(' · ');
 flushNotes();$('card-text').textContent=r.sentence||'';drawCardBib(p);const ta=$('card-notes');ta.value=r.notes||'';ta.dataset.id=p.id;ta.disabled=readOnly||!sync;$('card-notes-status').textContent=ta.disabled?'Open your library folder to edit notes.':nameOf(r)+' says each line when it talks.';renderCardFriends(p);
 const a=$('card-link');a.hidden=!/^https?:\/\//i.test(r.link||'');a.href=a.hidden?'#':r.link;
 const img=$('card-img');img.hidden=true;if(cardURL){URL.revokeObjectURL(cardURL);cardURL=null;}
 $('card').hidden=false;
 if(dir&&/^images\/[a-zA-Z0-9_-]+\.(png|jpg|webp)$/.test(r.screenshot||'')){try{const f=await (await (await dir.getDirectoryHandle('images')).getFileHandle(r.screenshot.split('/')[1])).getFile();if(selected!==p.id)return;cardURL=URL.createObjectURL(f);img.src=cardURL;img.hidden=false;}catch{}}
}
function closeCard(){flushNotes();flushBib();selected=null;$('card').hidden=true;if(cardURL){URL.revokeObjectURL(cardURL);cardURL=null;}}
$('card-close').onclick=closeCard;
// Notes = this paper's sentence bank. Same field as Notes in your viewer, synced through the library.
let notesTimer=0,notesDirty=null;
function flushNotes(){clearTimeout(notesTimer);const d=notesDirty;notesDirty=null;if(!d)return;
 editLibrary(next=>{const row=next.rows.find(x=>x.id===d.id);if(!row||(row.notes||'')===d.value)return false;row.notes=d.value;},'Notes saved. They show in your viewer too.');}
$('card-notes').oninput=e=>{const ta=e.target;notesDirty={id:ta.dataset.id,value:ta.value};$('card-notes-status').textContent='Saving…';clearTimeout(notesTimer);notesTimer=setTimeout(()=>{flushNotes();$('card-notes-status').textContent='Saved · synced with your viewer';},900);};
$('card-notes').onblur=flushNotes;
// BibTeX = same field as in the viewer and the capture panel
let bibTimer=0,bibDirty=null,bibBox=null;
function flushBib(){clearTimeout(bibTimer);const d=bibDirty;bibDirty=null;if(!d)return;
 editLibrary(next=>{const row=next.rows.find(x=>x.id===d.id);if(!row||(row.bibtex||'')===d.value)return false;row.bibtex=d.value;},'BibTeX saved. It shows in your viewer and capture panel too.');}
function drawCardBib(p){flushBib();const row={...p.row};bibBox=Bib.field(row,{disabled:readOnly||!sync,tell,onEdit:v=>{bibDirty={id:p.id,value:v};clearTimeout(bibTimer);bibTimer=setTimeout(flushBib,900);}});bibBox.dataset.id=p.id;bibBox.querySelector('textarea').addEventListener('blur',flushBib);$('card-bib').replaceChildren(bibBox);}
function syncCardNotes(){
 if(bibBox&&selected===bibBox.dataset.id&&!bibDirty){const q=people.get(selected);if(q)bibBox.refresh(q.row.bibtex);} // show edits made in the viewer while the card is open
 const ta=$('card-notes');if(!selected||$('card').hidden||notesDirty||document.activeElement===ta)return;const p=people.get(selected);if(p&&ta.dataset.id===p.id&&ta.value!==(p.row.notes||''))ta.value=p.row.notes||'';}

// ---------- camera (isometric 3D) ----------
const TW=64,TH=32; // iso tile width/height in px
const iso=(x,y)=>({X:(x-y)*TW/2,Y:(x+y)*TH/2});
const unIso=(X,Y)=>({x:(X/(TW/2)+Y/(TH/2))/2,y:(Y/(TH/2)-X/(TW/2))/2});
function resize(){const d=devicePixelRatio||1,r=canvas.getBoundingClientRect();canvas.width=r.width*d;canvas.height=r.height*d;}
addEventListener('resize',resize);resize();
const toIso=(sx,sy)=>({X:sx/cam.z+cam.x,Y:sy/cam.z+cam.y});
const toWorld=(sx,sy)=>{const i=toIso(sx,sy);return unIso(i.X,i.Y);};
function zoomAt(f,sx,sy){const i=toIso(sx,sy);cam.z=Math.min(3,Math.max(.2,cam.z*f));cam.x=i.X-sx/cam.z;cam.y=i.Y-sy/cam.z;}
function frame(list,maxZ){if(!list.length)return;const r=canvas.getBoundingClientRect(),pts=list.flatMap(t=>[iso(t.x,t.y),iso(t.x+t.w,t.y),iso(t.x,t.y+t.h),iso(t.x+t.w,t.y+t.h)]),X0=Math.min(...pts.map(p=>p.X)),X1=Math.max(...pts.map(p=>p.X)),Y0=Math.min(...pts.map(p=>p.Y))-80,Y1=Math.max(...pts.map(p=>p.Y))+40;
 cam.z=Math.min(maxZ,Math.max(.2,Math.min(r.width/(X1-X0+120),r.height/(Y1-Y0+60))));cam.x=(X0+X1)/2-r.width/2/cam.z;cam.y=(Y0+Y1)/2-r.height/2/cam.z;}
const fit=()=>frame(hub?[...towns,hub]:towns,1.4),focusTown=t=>frame([t],1.8);
$('zin').onclick=()=>{const r=canvas.getBoundingClientRect();zoomAt(1.25,r.width/2,r.height/2);};
$('zout').onclick=()=>{const r=canvas.getBoundingClientRect();zoomAt(.8,r.width/2,r.height/2);};
$('fit').onclick=fit;

// ---------- input ----------
const pos=e=>{const r=canvas.getBoundingClientRect();return {sx:e.clientX-r.left,sy:e.clientY-r.top};};
function personAt(sx,sy){const i=toIso(sx,sy);let best=null,bz=-1e9;for(const p of people.values()){if(p.lying)continue;const f=iso(p.x,p.y);if(Math.abs(i.X-f.X)<12&&i.Y<f.Y+4&&i.Y>f.Y-40&&p.x+p.y>bz){bz=p.x+p.y;best=p;}}return best;}
function paint(from,to){const n=Math.max(Math.abs(to.x-from.x),Math.abs(to.y-from.y),1)*2;for(let i=0;i<=n;i++){const x=Math.floor(from.x+(to.x-from.x)*i/n),y=Math.floor(from.y+(to.y-from.y)*i/n),k=key(x,y);if(tool==='wall'){if(![...people.values()].some(p=>Math.floor(p.x)===x&&Math.floor(p.y)===y))walls.add(k);}else walls.delete(k);}}
canvas.onpointerdown=e=>{
 canvas.setPointerCapture(e.pointerId);const {sx,sy}=pos(e),w=toWorld(sx,sy);
 if(e.button===2&&!spaceDown){const p=personAt(sx,sy);if(p){openHomeMenu(p,e.clientX,e.clientY);return;}}
 closeHomeMenu();
 if(e.button!==0||spaceDown)return drag={kind:'pan',sx,sy,cx:cam.x,cy:cam.y,click:e.button===2&&!spaceDown,right:e.button===2};
 if(tool==='wall'||tool==='erase'){paint(w,w);return drag={kind:'paint',last:w};}
 if(tool==='move'){const t=townAt(Math.floor(w.x),Math.floor(w.y))||(hub&&inRect(hub,Math.floor(w.x),Math.floor(w.y))?hub:null);if(t)return drag={kind:'town',t,w0:w,dx:0,dy:0};}
 if(tool==='select'){const p=personAt(sx,sy);if(p)return drag={kind:'person',p,sx,sy,moved:false};}
 drag={kind:'pan',sx,sy,cx:cam.x,cy:cam.y,click:true};
};
canvas.onpointermove=e=>{
 const {sx,sy}=pos(e),w=toWorld(sx,sy);hover=w;hoverP=drag?null:personAt(sx,sy);if(!drag)return;
 if(drag.kind==='pan'){if(Math.hypot(sx-drag.sx,sy-drag.sy)>3)drag.click=false;cam.x=drag.cx-(sx-drag.sx)/cam.z;cam.y=drag.cy-(sy-drag.sy)/cam.z;}
 else if(drag.kind==='paint'){paint(drag.last,w);drag.last=w;}
 else if(drag.kind==='town'){drag.dx=Math.round(w.x-drag.w0.x);drag.dy=Math.round(w.y-drag.w0.y);}
 else if(drag.kind==='person'){if(Math.hypot(sx-drag.sx,sy-drag.sy)>4)drag.moved=true;if(drag.moved){const f=toWorld(sx,sy+22*cam.z);drag.p.x=f.x;drag.p.y=f.y;}}
};
canvas.onpointerup=e=>{
 const d=drag;drag=null;if(!d)return;
 if(d.kind==='paint')save();
 else if(d.kind==='pan'&&d.right){if(d.click){const {sx,sy}=pos(e),w=toWorld(sx,sy),x=Math.floor(w.x),y=Math.floor(w.y),t=hub&&inRect(hub,x,y)?hub:townAt(x,y);if(t)openOccupants(t,e.clientX,e.clientY);}}
 else if(d.kind==='pan'&&d.click&&tool==='select')closeCard();
 else if(d.kind==='town'&&(d.dx||d.dy)){const t=d.t,moved=new Set();
  for(const k of walls){const [x,y]=k.split(',').map(Number);if(x>=t.x-1&&x<=t.x+t.w&&y>=t.y-1&&y<=t.y+t.h)moved.add(k);}
  for(const k of moved)walls.delete(k);for(const k of moved){const [x,y]=k.split(',').map(Number);walls.add(key(x+d.dx,y+d.dy));}
  for(const p of people.values()){if(t===hub?inRect(hub,Math.floor(p.x),Math.floor(p.y)):p.town===t.id){p.x+=d.dx;p.y+=d.dy;}p.path=null;}
  t.x+=d.dx;t.y+=d.dy;endAllChats();save();}
 else if(d.kind==='person'){const p=d.p;
  if(!d.moved)return openCard(p);
  const t=townAt(Math.floor(p.x),Math.floor(p.y));
  if(t&&t.id!==p.town)moveResident(p,t);
  const home=towns.find(t=>t.id===p.town);if(!inside(home,p.x,p.y)||blocked(Math.floor(p.x),Math.floor(p.y))){const s=spot(home);p.x=s.x;p.y=s.y;}
  p.path=null;p.lying=p.sitting=false;p.wait=1.5;if(selected===p.id)openCard(p);}
};
canvas.onwheel=e=>{e.preventDefault();const {sx,sy}=pos(e);zoomAt(Math.exp(-e.deltaY*.0015),sx,sy);};
canvas.oncontextmenu=e=>e.preventDefault();
canvas.onpointerleave=()=>{hover=null;hoverP=null;};
$('bubbles').onchange=e=>{bubbleMode=e.target.value;try{localStorage.paperCityBubbles=bubbleMode;}catch{}};
try{if(localStorage.paperCityBubbles){bubbleMode=localStorage.paperCityBubbles;$('bubbles').value=bubbleMode;}}catch{}
addEventListener('keydown',e=>{if(e.target.matches('input,textarea'))return;
 if(e.code==='Space'){spaceDown=true;e.preventDefault();}
 const m={KeyV:'select',KeyW:'wall',KeyE:'erase',KeyM:'move'}[e.code];if(m)setTool(m);if(e.key==='Escape')closeCard();});
addEventListener('keyup',e=>{if(e.code==='Space')spaceDown=false;});

// ---------- houses: kitchen, office, bedroom and lounge, furnished for every resident ----------
const ROUTINE=[{from:6.5*60,act:'breakfast'},{from:9*60,act:'work'},{from:17.5*60,act:'free'},{from:22.5*60,act:'sleep'}];
const ACT_LABEL={home:'Called home: relaxing in the lounge',breakfast:'Eating breakfast at the kitchen table',work:'Working at the Work Hub',free:'Relaxing in the lounge',sleep:'Asleep in bed'};
const SPEEDS={pause:0,normal:4,fast:24}; // game minutes per real second (normal: a day takes 6 minutes)
let clock=7*60,clockMode='normal';
try{const c=localStorage.paperCityClock;if(c&&(c in SPEEDS||c==='real'))clockMode=c;}catch{}
const SHIFTS=[{name:'Day shift',off:0},{name:'Evening shift',off:8*60},{name:'Night shift',off:16*60}];
const shiftOf=t=>t&&t.shift!=null?t.shift:Math.max(0,towns.indexOf(t))%3;
const fmt=m=>{m=((m%1440)+1440)%1440;return String(Math.floor(m/60)).padStart(2,'0')+':'+String(Math.round(m%60)).padStart(2,'0');};
const shiftHours=i=>SHIFTS[i].name+' · work '+fmt(9*60+SHIFTS[i].off)+'–'+fmt(17.5*60+SHIFTS[i].off);
function townAct(t,personal=0){const m=((clock-SHIFTS[shiftOf(t)].off-personal)%1440+1440)%1440;let a='sleep';for(const r of ROUTINE)if(m>=r.from)a=r.act;return a;}
const recalled=new Set(); // house ids called home ('all' = every house)
const isRecalled=t=>t&&(recalled.has('all')||recalled.has(t.id));
function activityAt(p){const t=towns.find(t=>t.id===p.town);if(isRecalled(t))return 'home';return townAct(towns.find(t=>t.id===p.town),(hash(p.id)%61)-30);}
// Real floor plan: one bedroom (one bed) per resident, shared bathrooms, a hallway spine from the front door,
// and an open-plan living room + kitchen/dining at the front with exactly one dining chair per resident.
function housePlan(N){
 const B=Math.max(1,Math.ceil(N/4));let best=null;
 for(let R=1;R<=12;R++){
  let k=3;while(k+(2*R-1)*(k-1)<N+B+1)k+=2; // +1: guest bedroom
  const W=2*k-2,cols=Math.max(1,Math.floor((W+1)/3)),rows=Math.ceil(Math.ceil((N+1)/4)/cols),S=Math.ceil(N/Math.max(1,W-2));
  const D=Math.max(4*rows+1,2*S+2)+2,w=4*k+1,h=3+10*R+D,score=Math.max(w,h*1.15);
  if(!best||score<best.score)best={k,R,D,w,h,B,score};
 }
 return best;
}
const furnCache=new Map();
function furniture(t){
 const N=Math.max(1,t.members.length),ck=[t.id,t.x,t.y,t.w,t.h,N,t.color].join(',');let f=furnCache.get(ck);if(f)return f;
 if(furnCache.size>300)furnCache.clear();
 f={items:[],floors:[],block:new Set(),beds:[],desks:[],chairs:[],sofa:[],rooms:{},guestBed:null,guestChair:null};
 const add=(type,x,y,w,h,extra={},blocks=true)=>{const it={type,x,y,w,h,key:type+':'+x+','+y,town:t.id,...extra};f.items.push(it);if(blocks)for(let i=0;i<w;i++)for(let j=0;j<h;j++)f.block.add(key(x+i,y+j));return it;};
 const floor=(room,x,y,x1,y1,color)=>f.floors.push({room,x,y,w:x1-x+1,h:y1-y+1,color});
 const {k,R,D,B}=housePlan(N),IX0=t.x+1,IX1=IX0+4*k-2,IY0=t.y+2,c=(k-1)/2,SX0=IX0+4*c,F0=IY0+10*R,IY1=F0+D-1;
 const doors=new Set(),walls=new Set(),inSpine=x=>x>=SX0&&x<=SX0+2;
 // rooms off each corridor: row A behind it (door below), row B in front of it (door above)
 const slots=[];
 for(let r=0;r<R;r++){const Y=IY0+10*r;
  for(let j=0;j<k;j++){if(!(j===c&&r>0))slots.push({x:IX0+4*j,y:Y,front:false,door:[IX0+4*j+1,Y+3]});}
  for(let j=0;j<k;j++){if(j!==c)slots.push({x:IX0+4*j,y:Y+6,front:true,door:[IX0+4*j+1,Y+5]});}
  for(const wy of [Y+3,Y+5,Y+9])for(let x=IX0;x<=IX1;x++){if(inSpine(x)&&(wy!==Y+3||r>0))continue;walls.add(key(x,wy));}
  for(let j=0;j<k-1;j++)for(const yy of [Y,Y+1,Y+2,Y+6,Y+7,Y+8])walls.add(key(IX0+4*j+3,yy));
  floor('hall',IX0,Y+4,IX1,Y+4,'#c9cdd9');floor('hall',SX0,r?Y:Y+5,SX0+2,Y+9,'#c9cdd9');
 }
 // spread bathrooms through the house; then one bedroom per resident; spare rooms become studies / laundry
 const total=slots.length,type=Array(total).fill(null);
 for(let s=0;s<total;s++)if(Math.floor((s+1)*B/total)>Math.floor(s*B/total))type[s]='bath';
 let beds=0,spare=0,guest=false;for(let s=0;s<total;s++)if(!type[s])type[s]=beds<N?(beds++,'bed'):!guest?(guest=true,'guest'):(spare++%2?'laundry':'study');
 const COL={guest:'#ffd6a5',bed:'#b58fd6',bath:'#9fd8e6',study:'#a3c4f3',laundry:'#d7dbe8'};
 slots.forEach((s,i)=>{const {x,y,front}=s,ty=type[i],back=front?y+2:y,mid=y+1;doors.add(key(...s.door));floor(ty,x,y,x+2,y+2,COL[ty]);
  if(ty==='bed'){const by=front?y+1:y;f.beds.push(add('bed',x,by,1,2,{foot:[x+1,y+1],hue:SHIRTS[hash(t.id+i)%SHIRTS.length]}));add('nightstand',x+1,back,1,1);add('wardrobe',x+2,back,1,1);add('rug',x+1,front?y:y+1,2,2,{small:true},false);}
  else if(ty==='guest'){const by=front?y+1:y;f.guestBed=add('bed',x,by,1,2,{foot:[x+1,y+1],hue:'#ffd166',guest:true});add('nightstand',x+1,back,1,1);add('suitcase',x+2,back,1,1);add('plant',x+2,front?y:y+2,1,1);add('rug',x+1,front?y:y+1,2,2,{small:true},false);}
  else if(ty==='bath'){add('toilet',x,back,1,1);add('sink',x+1,back,1,1);add('shower',x+2,front?y+1:y,1,2);}
  else if(ty==='study'){const d=add('desk',x,back,1,1);d.seat=[x,mid];add('bookshelf',x+2,back,1,1);add('plant',x+2,front?y:y+2,1,1);}
  else{add('washer',x,back,1,1);add('washer',x+1,back,1,1);add('counter',x+2,back,1,1);}
 });
 for(const w of walls)if(!doors.has(w)){const [x,y]=w.split(',').map(Number);add('iwall',x,y,1,1,{color:t.color});}
 // front: living room (left), foyer (middle), kitchen + dining (right)
 const LX0=IX0,LX1=SX0-1,RX0=SX0+3,RX1=IX1,W=LX1-LX0+1,mid=LX0+Math.floor((W-2)/2),S=Math.ceil(N/Math.max(1,W-2));
 floor('lounge',LX0,F0,LX1,IY1,'#e7b98a');floor('kitchen',RX0,F0,RX1,IY1,'#e9edf7');floor('hall',SX0,F0,SX0+2,IY1,'#c9cdd9');
 add('rug',LX0+1,F0+1,W-2,2*S+1,{},false);add('bookshelf',LX0,F0,1,1);add('tv',mid,F0,2,1);add('plant',LX1,F0,1,1);add('coffeetable',mid,F0+2,2,1);
 for(let s=0;s<S;s++){const y=F0+3+2*s;add('sofa',LX0+1,y,W-2,1,{},false);for(let i=0;i<W-2;i++)f.sofa.push([LX0+1+i,y]);}
 add('lamp',LX0,F0+3,1,1);add('plant',SX0,F0,1,1);
 add('sink',RX0,F0,1,1);if(RX1-2>=RX0+1)add('counter',RX0+1,F0,RX1-RX0-2,1);add('stove',RX1-1,F0,1,1);add('fridge',RX1,F0,1,1);
 let seated=0;for(let y0=F0+2;seated<=N;y0+=4)for(let x=RX0;x+1<=RX1&&seated<=N;x+=3){add('table',x,y0+1,2,1);
  for(const [cx,cy,face] of [[x,y0,-1],[x+1,y0,-1],[x,y0+2,1],[x+1,y0+2,1]])if(seated<=N){const ch=add('chair',cx,cy,1,1,{face,seat:[cx,cy],guest:seated===N},false);if(seated===N)f.guestChair=ch;else f.chairs.push(ch);seated++;}}
 f.rooms={lounge:{x:LX0,y:F0+1,x1:LX1,y1:IY1},kitchen:{x:RX0,y:F0+1,x1:RX1,y1:IY1},garden:{x:SX0,y:F0+1,x1:SX0+2,y1:IY1}};
 for(const s of f.sofa)f.block.delete(key(s[0],s[1]));
 furnCache.set(ck,f);return f;
}
function fitHouse(t){const p=housePlan(Math.max(1,t.members.length)),g=t.w!==p.w||t.h!==p.h;t.w=p.w;t.h=p.h;return g;}
let blockedCache=null;
function blocked(x,y){
 if(walls.has(key(x,y)))return true;
 if(!blockedCache){blockedCache=new Set();for(const t of towns)for(const k of furniture(t).block)blockedCache.add(k);if(hub)for(const k of hubFurniture(hub).block)blockedCache.add(k);}
 return blockedCache.has(key(x,y));
}
function route(t,from,goals){ // breadth-first search over houses, walkways and the Work Hub
 const sx=Math.floor(from.x),sy=Math.floor(from.y),want=new Set(goals.map(g=>key(g[0],g[1])));
 const seen=new Map([[key(sx,sy),null]]),q=[[sx,sy]];
 for(let qi=0;qi<q.length;qi++){const [x,y]=q[qi],k=key(x,y);
  if(want.has(k)){const path=[];let c=k;while(c){const [a,b]=c.split(',').map(Number);path.unshift({x:a+.5,y:b+.5});c=seen.get(c);}return path.slice(1);}
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,nk=key(nx,ny);if(seen.has(nk)||!walkable(nx,ny)||blocked(nx,ny))continue;seen.set(nk,k);q.push([nx,ny]);}}
 return null;
}
function pickGoal(p,t){
 if(p.stay&&p.stay.host===t.id){const g=guestGoal(p,t);if(g)return g;}
 const f=furniture(t),i=Math.max(0,t.members.indexOf(p.id));
 if(p.act==='breakfast'&&f.chairs.length){const c=f.chairs[i%f.chairs.length];return {key:c.key,at:c.seat,sit:true,face:c.face};}
 if(p.act==='work'&&hub){const D=hubFurniture(hub).desks;if(D.length){const d=D[[...people.keys()].indexOf(p.id)%D.length];return {key:'hub'+d.key,at:d.seat,sit:true,face:1};}}
 if(p.act==='sleep'&&f.beds.length){const b=f.beds[i%f.beds.length];return {key:b.key,at:b.foot,lie:true,bed:b};}
 if(Math.random()<.5&&f.sofa.length){const s=f.sofa[Math.floor(Math.random()*f.sofa.length)];return {key:'sofa:'+s,at:s,sit:true,face:1,lounge:true};}
 const r=f.rooms.lounge,x=r.x1>=r.x?r.x+Math.floor(Math.random()*(r.x1-r.x+1)):Math.floor(spot(t).x),y=r.y1>=r.y?r.y+1+Math.floor(Math.random()*Math.max(1,r.y1-r.y)):Math.floor(spot(t).y);
 return blocked(x,y)?{key:'roam',at:[Math.floor(spot(t).x),Math.floor(spot(t).y)]}:{key:'roam',at:[x,y]};
}
function plan(p,t){p.goal=pickGoal(p,t);p.path=route(t,p,[p.goal.at])||route(t,p,[[Math.floor(spot(t).x),Math.floor(spot(t).y)]])||[];p.arrived=false;p.sitting=p.lying=false;p.planTown=t.id;}
function step(dt){
 if(clockMode==='real'){const d=new Date();clock=d.getHours()*60+d.getMinutes()+d.getSeconds()/60;}else clock=(clock+dt*SPEEDS[clockMode])%1440;
 blockedCache=null;
 for(const p of people.values()){
  if(drag?.p===p)continue;if(lookUp(p))continue;let t=towns.find(t=>t.id===p.town);if(!t)continue;
  const act=activityAt(p);t=stayHouse(p,t,act);
  if(p.chat){if(chatOk(p.chat)){p.act=act;chatStep(p,p.chat,dt);continue;}endChat(p.chat);}
  if(act!==p.act||p.planTown!==t.id||!p.path){if(p.lying&&p.goal?.bed){p.x=p.goal.bed.foot[0]+.5;p.y=p.goal.bed.foot[1]+.5;}p.act=act;p.wait=Math.random()*1.5;plan(p,t);}
  if(p.lying||p.sitting&&p.act!=='free'&&p.act!=='home')continue;
  if(p.wait>0){p.wait-=dt;continue;}
  if(p.sitting){p.sitting=false;plan(p,t);continue;} // done relaxing on the sofa
  if(!p.path.length){
   if(p.arrived)continue;p.arrived=true;const g=p.goal;
   if(g.lie){p.lying=true;continue;}
   if(g.sit){p.sitting=true;p.face=g.face;p.x=g.at[0]+.5;p.y=g.at[1]+.5;if(act==='free'||act==='home')p.wait=6+Math.random()*10;continue;}
   if(act==='free'||act==='home'){p.wait=1+Math.random()*4;p.arrived=false;p.goal=pickGoal(p,t);p.path=route(t,p,[p.goal.at])||[];}
   continue;}
  const n=p.path[0];if(blocked(Math.floor(n.x),Math.floor(n.y))){plan(p,t);continue;}
  const dx=n.x-p.x,dy=n.y-p.y,d=Math.hypot(dx,dy),v=Math.min(d,1.6*dt*(clockMode==='fast'?2:1)*(1+Math.min(3,p.path.length/8)));
  if(d<.02){p.path.shift();continue;}
  p.face=dx-dy<0?-1:1;p.x+=dx/d*v;p.y+=dy/d*v;p.walk=(p.walk||0)+dt;
 }
 social(dt);stepPets(dt);
 if(!step.t||performance.now()-step.t>500){step.t=performance.now();renderClock();}
}
function renderClock(){
 const h=Math.floor(clock/60),m=Math.floor(clock%60),working=SHIFTS.filter((_,i)=>townAct({shift:i})==='work').map(x=>x.name),phase=working.length?'Working now: '+working.join(', '):'Shift change';
 $('clock').textContent=String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');$('phase').textContent=phase;
 document.querySelectorAll('[data-clock]').forEach(b=>b.classList.toggle('on',b.dataset.clock===clockMode));
 renderFriendStats();
}
document.querySelectorAll('[data-clock]').forEach(b=>b.onclick=()=>{clockMode=b.dataset.clock;try{localStorage.paperCityClock=clockMode;}catch{}renderClock();});
$('skip').onclick=()=>{if(clockMode==='real')clockMode='normal';const next=ROUTINE.map(r=>r.from).find(f=>f>clock+1)??ROUTINE[0].from;clock=next;renderClock();};
const darkness=()=>{const h=clock/60;return h<5?.55:h<7.5?.55*(7.5-h)/2.5:h<18?0:h<21?.55*(h-18)/3:.55;};

// ---------- drawing: isometric space colony ----------
const stars=Array.from({length:420},(_,i)=>({x:Math.random(),y:Math.random(),d:.2+Math.random()*.8,r:Math.random()*1.4+.3,p:Math.random()*6}));
const PLANETS=[{x:.82,y:.18,r:90,c1:'#c77dff',c2:'#3c096c',ring:true,d:.04},{x:.12,y:.82,r:46,c1:'#4cc9f0',c2:'#14213d',d:.07}];
const shade=(hex,f)=>{const n=parseInt(hex.slice(1),16),c=[n>>16,n>>8&255,n&255].map(v=>Math.max(0,Math.min(255,Math.round(f<1?v*f:v+(255-v)*(f-1)))));return 'rgb('+c.join(',')+')';};
const SLAB=22,WALL=30;
function poly(pts,fill,stroke){ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.X,p.Y):ctx.moveTo(p.X,p.Y));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
const up=(p,h)=>({X:p.X,Y:p.Y-h});
function background(W,H,now){
 const g=ctx.createRadialGradient(W*.6,H*.35,0,W*.5,H*.5,Math.max(W,H));g.addColorStop(0,'#1b1740');g.addColorStop(.55,'#0b0b24');g.addColorStop(1,'#04040e');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 const n=ctx.createRadialGradient(W*.3,H*.3,0,W*.3,H*.3,W*.45);n.addColorStop(0,'#7b2cbf22');n.addColorStop(1,'#0000');ctx.fillStyle=n;ctx.fillRect(0,0,W,H);
 for(const s of stars){const x=((s.x*W-cam.x*s.d*.08)%W+W)%W,y=((s.y*H-cam.y*s.d*.08)%H+H)%H;ctx.globalAlpha=.45+.55*Math.abs(Math.sin(now*s.d*1.5+s.p));ctx.fillStyle='#fff';ctx.fillRect(x,y,s.r,s.r);}
 ctx.globalAlpha=1;
 for(const p of PLANETS){const x=p.x*W-cam.x*p.d,y=p.y*H-cam.y*p.d,gr=ctx.createRadialGradient(x-p.r*.4,y-p.r*.4,p.r*.1,x,y,p.r);gr.addColorStop(0,p.c1);gr.addColorStop(1,p.c2);
  if(p.ring){ctx.strokeStyle='#e0aaff55';ctx.lineWidth=6;ctx.beginPath();ctx.ellipse(x,y,p.r*1.7,p.r*.35,-.3,Math.PI,2*Math.PI);ctx.stroke();}
  ctx.fillStyle=gr;ctx.beginPath();ctx.arc(x,y,p.r,0,7);ctx.fill();
  if(p.ring){ctx.beginPath();ctx.ellipse(x,y,p.r*1.7,p.r*.35,-.3,0,Math.PI);ctx.stroke();}}
}
function drawPlatform(t,tx,ty,now){
 const N=iso(tx,ty),E=iso(tx+t.w,ty),S=iso(tx+t.w,ty+t.h),Wp=iso(tx,ty+t.h);
 // engines glow under the floating colony
 const c=iso(tx+t.w/2,ty+t.h/2),gl=ctx.createRadialGradient(c.X,c.Y+SLAB+30,0,c.X,c.Y+SLAB+30,t.w*TW*.35);gl.addColorStop(0,t.color+'55');gl.addColorStop(1,t.color+'00');ctx.fillStyle=gl;ctx.fillRect(c.X-t.w*TW*.4,c.Y,t.w*TW*.8,t.h*TH+120);
 poly([Wp,S,up(S,-SLAB),up(Wp,-SLAB)],shade('#3a3f5c',1));
 poly([S,E,up(E,-SLAB),up(S,-SLAB)],shade('#2a2e45',1));
 ctx.lineWidth=1;for(let i=1;i<6;i++){ctx.strokeStyle=i%2?'#ffffff12':t.color+'55';ctx.beginPath();ctx.moveTo(Wp.X,Wp.Y+i*SLAB/6);ctx.lineTo(S.X,S.Y+i*SLAB/6);ctx.lineTo(E.X,E.Y+i*SLAB/6);ctx.stroke();}
 for(let i=0;i<t.w;i+=3){const a=iso(tx+i+.5,ty+t.h);ctx.fillStyle=Math.sin(now*3+i)>0?t.color:'#ffffff55';ctx.fillRect(a.X-2,a.Y+SLAB/2-1,4,3);}
 const g=ctx.createLinearGradient(N.X,N.Y,S.X,S.Y);g.addColorStop(0,shade(t.color,.42));g.addColorStop(1,shade(t.color,.28));
 poly([N,E,S,Wp],g);
 ctx.strokeStyle='#ffffff14';ctx.lineWidth=1;ctx.beginPath();
 for(let i=1;i<t.w;i++){const a=iso(tx+i,ty),b=iso(tx+i,ty+t.h);ctx.moveTo(a.X,a.Y);ctx.lineTo(b.X,b.Y);}
 for(let j=1;j<t.h;j++){const a=iso(tx,ty+j),b=iso(tx+t.w,ty+j);ctx.moveTo(a.X,a.Y);ctx.lineTo(b.X,b.Y);}ctx.stroke();
 ctx.shadowColor=t.color;ctx.shadowBlur=12;ctx.lineWidth=2;poly([N,E,S,Wp],null,t.color);ctx.shadowBlur=0;
}
function drawWall(x,y,now){
 const N=iso(x,y),E=iso(x+1,y),S=iso(x+1,y+1),Wp=iso(x,y+1);
 poly([Wp,S,up(S,WALL),up(Wp,WALL)],'#4b5371');poly([S,E,up(E,WALL),up(S,WALL)],'#363c56');
 ctx.strokeStyle='#ffffff1c';ctx.lineWidth=1;ctx.beginPath();const m1=iso(x+.5,y+1),m2=iso(x+1,y+.5);ctx.moveTo(m1.X,m1.Y-4);ctx.lineTo(m1.X,m1.Y-WALL+4);ctx.moveTo(m2.X,m2.Y-4);ctx.lineTo(m2.X,m2.Y-WALL+4);ctx.stroke();
 poly([up(N,WALL),up(E,WALL),up(S,WALL),up(Wp,WALL)],'#8b93b8');
 const pulse=.55+.45*Math.sin(now*2.5+x*.7+y*.5);ctx.globalAlpha=pulse;ctx.shadowColor='#5ef2ff';ctx.shadowBlur=10;ctx.lineWidth=2;
 poly([up(N,WALL),up(E,WALL),up(S,WALL),up(Wp,WALL)],null,'#5ef2ff');ctx.shadowBlur=0;ctx.globalAlpha=1;
}
function drawSign(t,tx,ty,now){
 const b=iso(tx+t.w/2,ty+1),top=b.Y-70-Math.sin(now*1.5+t.x)*3;
 ctx.strokeStyle='#9aa3c7';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(b.X,b.Y);ctx.lineTo(b.X,top+26);ctx.stroke();
 ctx.font='bold 15px system-ui';const sw=ctx.measureText(t.name).width+26;
 ctx.fillStyle='#0d1030cc';ctx.shadowColor=t.color;ctx.shadowBlur=16;ctx.beginPath();ctx.roundRect(b.X-sw/2,top,sw,26,6);ctx.fill();ctx.shadowBlur=0;
 ctx.strokeStyle=t.color;ctx.lineWidth=1.5;ctx.stroke();
 ctx.fillStyle='#f1f4ff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(t.name,b.X,top+13.5);
}
// ---------- Work Hub + walkways ----------
let hub=null;
const inRect=(r,x,y)=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h;
const doorOf=t=>Math.floor(t.w/2);
const hubCache={};
function hubFurniture(h){
 const k=[h.x,h.y,h.w,h.h].join();if(hubCache.k===k)return hubCache.f;
 const f={items:[],block:new Set(),desks:[]};
 const add=(type,x,y,w,hh,extra={},blocks=true)=>{const it={type,x,y,w,h:hh,key:type+':'+x+','+y,...extra};f.items.push(it);if(blocks)for(let i=0;i<w;i++)for(let j=0;j<hh;j++)f.block.add(key(x+i,y+j));return it;};
 add('tv',h.x+2,h.y+1,Math.min(4,h.w-8),1,{work:true});add('counter',h.x+h.w-5,h.y+1,3,1);
 for(const [x,y] of [[h.x+1,h.y+1],[h.x+h.w-2,h.y+h.h-2],[h.x+1,h.y+h.h-2]])add('plant',x,y,1,1);
 for(let y=h.y+3;y+1<=h.y+h.h-3;y+=3)for(let x=h.x+2;x<=h.x+h.w-3;x++){if((x-h.x-2)%5===4)continue;const d=add('desk',x,y,1,1);d.seat=[x,y+1];f.desks.push(d);add('chair',x,y+1,1,1,{face:1,seat:[x,y+1]},false);}
 hubCache.k=k;hubCache.f=f;return f;
}
function ensureHub(){
 const total=Math.max(1,people.size);let grew=false;
 if(!hub){const s=local.hub;hub={id:'__hub',name:'Work Hub',color:'#5ef2ff',members:[],x:s?.x??0,y:s?.y??0,w:s?.w||16,h:s?.h||12};if(!s?.w){fitHub(total);Object.assign(hub,placeNear(hub.w,hub.h));grew=true;}}
 if(fitHub(total))grew=true;return grew;
}
function fitHub(total){let g=false;while(hub.w<90&&hubFurniture(hub).desks.length<total){hub.w+=2;hub.h+=2;g=true;}return g;}
function placeNear(w,h){ // the free spot closest to the middle of all houses
 if(!towns.length)return {x:2,y:2,w,h};
 const cx=towns.reduce((a,t)=>a+t.x+t.w/2,0)/towns.length,cy=towns.reduce((a,t)=>a+t.y+t.h/2,0)/towns.length;
 const free=(x,y)=>!towns.some(o=>x<o.x+o.w+5&&x+w+5>o.x&&y<o.y+o.h+5&&y+h+5>o.y);
 for(let r=0;r<150;r++)for(let dx=-r;dx<=r;dx++)for(const dy of [-r,r]){for(const [a,b] of [[dx,dy],[dy,dx]]){const x=Math.round(cx-w/2+a),y=Math.round(cy-h/2+b);if(free(x,y))return {x,y,w,h};}}
 return {x:2,y:2,w,h};
}
let wayCache={sig:'',set:new Set()};
function walkways(){
 if(!hub)return wayCache.set;
 const sig=towns.map(t=>[t.x,t.y,t.w,t.h].join()).join('|')+'#'+[hub.x,hub.y,hub.w,hub.h];
 if(wayCache.sig===sig)return wayCache.set;
 const set=new Set(),rects=[...towns,hub],X0=Math.min(...rects.map(r=>r.x))-6,Y0=Math.min(...rects.map(r=>r.y))-6,X1=Math.max(...rects.map(r=>r.x+r.w))+6,Y1=Math.max(...rects.map(r=>r.y+r.h))+6;
 const goal=new Set();for(let x=hub.x+1;x<hub.x+hub.w-1;x++){goal.add(key(x,hub.y-1));goal.add(key(x,hub.y+hub.h));}for(let y=hub.y+1;y<hub.y+hub.h-1;y++){goal.add(key(hub.x-1,y));goal.add(key(hub.x+hub.w,y));}
 const order=[...towns].sort((a,b)=>Math.hypot(a.x-hub.x,a.y-hub.y)-Math.hypot(b.x-hub.x,b.y-hub.y));
 for(const t of order){
  const sx=t.x+doorOf(t),sy=t.y+t.h;if(rects.some(r=>inRect(r,sx,sy)))continue;
  const seen=new Map([[key(sx,sy),null]]),q=[[sx,sy]];let end=null;
  for(let i=0;i<q.length;i++){const [x,y]=q[i],k=key(x,y);if(goal.has(k)||set.has(k)){end=k;break;}
   for(const [dx,dy] of [[0,1],[1,0],[-1,0],[0,-1]]){const nx=x+dx,ny=y+dy,nk=key(nx,ny);if(nx<X0||nx>X1||ny<Y0||ny>Y1||seen.has(nk)||rects.some(r=>inRect(r,nx,ny)))continue;seen.set(nk,k);q.push([nx,ny]);}}
  for(let c=end;c;c=seen.get(c))set.add(c);
 }
 wayCache={sig,set};return set;
}
function walkable(x,y){
 if(hub&&inRect(hub,x,y))return true;
 for(const t of towns){if(x>=t.x+1&&x<=t.x+t.w-2&&y>=t.y+2&&y<=t.y+t.h-2)return true;if(x===t.x+doorOf(t)&&y===t.y+t.h-1)return true;}
 return walkways().has(key(x,y));
}
function drawWalkway(x,y,now){
 const N=iso(x,y),E=iso(x+1,y),S=iso(x+1,y+1),Wp=iso(x,y+1);
 poly([Wp,S,up(S,-7),up(Wp,-7)],'#2a2e45');poly([S,E,up(E,-7),up(S,-7)],'#1f2238');
 ctx.lineWidth=1;poly([N,E,S,Wp],'#3d4466','#5ef2ff40');
 const c=iso(x+.5,y+.5);ctx.fillStyle=Math.sin(now*3-(x+y)*.8)>.5?'#5ef2ff':'#5ef2ff33';ctx.fillRect(c.X-3,c.Y-1,6,2);
}
// ---------- furniture drawing ----------
function box(x,y,w,h,z,H,top,left,right){
 const N=up(iso(x,y),z+H),E=up(iso(x+w,y),z+H),S=up(iso(x+w,y+h),z+H),Wp=up(iso(x,y+h),z+H),S0=up(iso(x+w,y+h),z),W0=up(iso(x,y+h),z),E0=up(iso(x+w,y),z);
 poly([W0,S0,S,Wp],left);poly([S0,E0,E,S],right);poly([N,E,S,Wp],top);
}
const flat=(x,y,w,h,z,fill,stroke)=>{ctx.lineWidth=1;poly([up(iso(x,y),z),up(iso(x+w,y),z),up(iso(x+w,y+h),z),up(iso(x,y+h),z)],fill,stroke);};
let lights=[];
function houseShell(t,tx,ty,back){ // back walls with portholes, or the low front walls with a door
 const H=46,x0=tx,y0=ty+1,x1=tx+t.w,y1=ty+t.h;
 if(back){
  poly([up(iso(x0,y1),0),up(iso(x0,y0),0),up(iso(x0,y0),H),up(iso(x0,y1),H)],'#3d4466ee');
  poly([up(iso(x0,y0),0),up(iso(x1,y0),0),up(iso(x1,y0),H),up(iso(x0,y0),H)],'#4b5371ee');
  ctx.strokeStyle=t.color;ctx.lineWidth=2;ctx.beginPath();const a=up(iso(x0,y1),H),b=up(iso(x0,y0),H),c=up(iso(x1,y0),H);ctx.moveTo(a.X,a.Y);ctx.lineTo(b.X,b.Y);ctx.lineTo(c.X,c.Y);ctx.stroke();
  for(let i=2;i<t.w-1;i+=3){const p=up(iso(x0+i,y0),H*.55);ctx.fillStyle='#0b0b24';ctx.beginPath();ctx.ellipse(p.X,p.Y,7,7,0,0,7);ctx.fill();ctx.fillStyle='#ffffffaa';ctx.fillRect(p.X-3,p.Y-3,1.5,1.5);ctx.strokeStyle='#9aa3c7';ctx.lineWidth=2;ctx.stroke();}
  for(let j=2;j<t.h-2;j+=3){const p=up(iso(x0,y0+j),H*.55);ctx.fillStyle='#0b0b24';ctx.beginPath();ctx.ellipse(p.X,p.Y,7,7,0,0,7);ctx.fill();ctx.strokeStyle='#9aa3c7';ctx.lineWidth=2;ctx.stroke();}
 }else{
  const L=8,door=Math.floor(t.w/2);
  for(let i=0;i<t.w;i++){if(i===door||i===door-1)continue;poly([up(iso(x0+i,y1),0),up(iso(x0+i+1,y1),0),up(iso(x0+i+1,y1),L),up(iso(x0+i,y1),L)],'#8b93b8');}
  poly([up(iso(x1,y1),0),up(iso(x1,y0),0),up(iso(x1,y0),L),up(iso(x1,y1),L)],'#6c7296');
  const dm=iso(x0+door,y1);ctx.fillStyle=t.color;ctx.fillRect(dm.X-3,dm.Y-3,6,3);
 }
}
function drawItem(it,occ,now){
 const {x,y,w,h}=it,who=occ.get(it.key);
 switch(it.type){
  case 'fridge':box(x+.1,y+.1,.8,.8,0,38,'#f4f6fb','#dfe3f3','#c3c9e0');{const p=up(iso(x+.75,y+.9),24);ctx.fillStyle='#9aa3c7';ctx.fillRect(p.X-1,p.Y-8,2,10);}break;
  case 'counter':box(x,y+.1,w,.8,0,16,'#aab2d6','#6c7296','#565b7c');{const s=up(iso(x+.5,y+.5),16);ctx.fillStyle='#3b4163';ctx.beginPath();ctx.ellipse(s.X,s.Y,8,4,0,0,7);ctx.fill();
   if(w>1){const k=up(iso(x+w-.5,y+.5),16);ctx.strokeStyle=townAct(towns.find(q=>q.id===it.town))==='breakfast'?'#ff7b54':'#3b4163';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(k.X,k.Y,7,3.5,0,0,7);ctx.stroke();}}break;
  case 'table':box(x+.08,y+.15,w-.16,.7,0,13,'#d49a6a','#a8754d','#8a5f3c');
   if(townAct(towns.find(q=>q.id===it.town))==='breakfast')for(let i=0;i<w;i++)for(const dy of [.32,.68]){const p=up(iso(x+i+.5,y+dy),13);ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(p.X,p.Y,5,2.5,0,0,7);ctx.fill();ctx.fillStyle='#f4a261';ctx.beginPath();ctx.ellipse(p.X,p.Y,2.5,1.2,0,0,7);ctx.fill();}break;
  case 'chair':box(x+.3,y+.3,.4,.4,0,7,'#6c7bd6','#4f5bb0','#3f4a93');
   if(it.face<0)box(x+.3,y+.25,.4,.08,7,10,'#6c7bd6','#4f5bb0','#3f4a93');break;
  case 'desk':{box(x+.05,y+.15,.9,.7,0,15,'#e3e7f3','#aeb4d1','#8d93b3');const on=occ.has(it.key);
   box(x+.25,y+.22,.5,.08,15,13,'#1b1f3a','#2a2e45','#1b1f3a');flat(x+.27,y+.31,.46,0,0,null);
   const a=up(iso(x+.27,y+.3),17),b=up(iso(x+.73,y+.3),17),c=up(iso(x+.73,y+.3),26),d=up(iso(x+.27,y+.3),26);poly([a,b,c,d],on?'#5ef2ff':'#2b3170');
   if(on){lights.push({...iso(x+.5,y+.3),Y:iso(x+.5,y+.3).Y-22,r:40,c:'#5ef2ff'});ctx.fillStyle='#0d1030';for(let i=0;i<3;i++)if(Math.sin(now*7+i*2+x)>0){const q=up(iso(x+.35+i*.1,y+.3),21);ctx.fillRect(q.X-2,q.Y,4,1);}}break;}
  case 'bed':{box(x+.08,y+.05,.84,1.9,0,8,'#8d93b3','#6c7296','#565b7c');box(x+.12,y+.1,.76,1.8,8,4,'#f4f6fb','#dfe3f3','#c3c9e0');box(x+.2,y+.15,.6,.35,12,3,'#ffffff','#e6e9f5','#d0d5e8');
   if(who){const p=up(iso(x+.5,y+.33),20),suit=SHIRTS[hash(who.id)%SHIRTS.length];ctx.fillStyle='#f4f6fb';ctx.beginPath();ctx.arc(p.X,p.Y,7,0,7);ctx.fill();ctx.strokeStyle='#b8bfd4';ctx.lineWidth=1;ctx.stroke();ctx.fillStyle='#1b2a6b';ctx.beginPath();ctx.ellipse(p.X+2,p.Y+1,4.5,3,0,0,7);ctx.fill();
    box(x+.12,y+.55,.76,1.35,12,4,suit,shade(suit,.8),shade(suit,.65));
    ctx.save();ctx.fillStyle='#e0d4ff';ctx.textAlign='center';for(let i=0;i<3;i++){const k=(now*.5+i/3+(hash(who.id)%10)/10)%1;ctx.globalAlpha=1-k;ctx.font='bold '+(8+k*8)+'px system-ui';ctx.fillText('z',p.X+8+k*12,p.Y-12-k*20);}ctx.restore();}
   else box(x+.12,y+.75,.76,1.15,12,3,it.hue,shade(it.hue,.8),shade(it.hue,.65));break;}
  case 'sofa':box(x+.02,y+.2,w-.04,.7,0,9,'#b388eb','#8d63c9','#7450a8');box(x+.02,y+.72,w-.04,.2,9,10,'#c9a7f2','#8d63c9','#7450a8');break;
  case 'tv':{box(x+.2,y+.35,w-.4,.35,0,8,'#3b4163','#2a2e45','#1b1f3a');const on=it.work?[...people.values()].some(p=>p.act==='work'&&p.sitting):['free','home'].includes(isRecalled(towns.find(q=>q.id===it.town))?'home':townAct(towns.find(q=>q.id===it.town))),a=up(iso(x+.1,y+.5),10),b=up(iso(x+w-.1,y+.5),10),c=up(iso(x+w-.1,y+.5),34),d=up(iso(x+.1,y+.5),34);
   poly([a,b,c,d],on?'hsl('+((now*40)%360)+',70%,60%)':'#1b1f3a','#0b0b24');if(on)lights.push({...iso(x+w/2,y+.5),Y:iso(x+w/2,y+.5).Y-22,r:60,c:'#c77dff'});break;}
  case 'plant':{box(x+.32,y+.32,.36,.36,0,10,'#c48a5a','#a8754d','#8a5f3c');const p=up(iso(x+.5,y+.5),20);ctx.fillStyle='#4caf50';for(const [ox,oy,r] of [[0,0,8],[-5,3,6],[5,3,6],[0,-6,6]]){ctx.beginPath();ctx.arc(p.X+ox,p.Y+oy,r,0,7);ctx.fill();}ctx.fillStyle='#7bd389';ctx.beginPath();ctx.arc(p.X-2,p.Y-3,3,0,7);ctx.fill();break;}
  case 'planter':{box(x+.12,y+.12,.76,.76,0,12,'#6b4f3a','#8a5f3c','#6e4a2f');const p=up(iso(x+.5,y+.5),14);ctx.fillStyle='#3f8f4a';ctx.beginPath();ctx.ellipse(p.X,p.Y,13,6,0,0,7);ctx.fill();ctx.fillStyle=it.hue;for(const [ox,oy] of [[-6,0],[5,-2],[0,3],[2,-5]]){ctx.beginPath();ctx.arc(p.X+ox,p.Y+oy-3,2.5,0,7);ctx.fill();}break;}
  case 'iwall':box(x,y,1,1,0,18,shade(it.color,.62),'#6c7296','#565b7c');break;
  case 'nightstand':{box(x+.2,y+.2,.6,.6,0,9,'#d49a6a','#a8754d','#8a5f3c');const p=up(iso(x+.5,y+.5),9);ctx.fillStyle='#ffd166';ctx.beginPath();ctx.moveTo(p.X-4,p.Y-2);ctx.lineTo(p.X+4,p.Y-2);ctx.lineTo(p.X+2,p.Y-9);ctx.lineTo(p.X-2,p.Y-9);ctx.fill();lights.push({X:p.X,Y:p.Y-6,r:26,c:'#ffd166'});break;}
  case 'wardrobe':{box(x+.1,y+.15,.8,.7,0,34,'#c9a27e','#a8754d','#8a5f3c');const a=up(iso(x+.5,y+.85),4),b=up(iso(x+.5,y+.85),30);ctx.strokeStyle='#6e4a2f';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(a.X,a.Y);ctx.lineTo(b.X,b.Y);ctx.stroke();break;}
  case 'toilet':box(x+.25,y+.3,.5,.5,0,8,'#ffffff','#dfe3f3','#c3c9e0');box(x+.25,y+.12,.5,.2,0,16,'#f4f6fb','#dfe3f3','#c3c9e0');break;
  case 'sink':{box(x+.15,y+.15,.7,.55,0,14,'#f4f6fb','#dfe3f3','#c3c9e0');const p=up(iso(x+.5,y+.42),14);ctx.fillStyle='#8ecae6';ctx.beginPath();ctx.ellipse(p.X,p.Y,7,3.5,0,0,7);ctx.fill();break;}
  case 'shower':{flat(x+.05,y+.05,.9,h-.1,1,'#bde7f2','#8ecae6');ctx.globalAlpha=.35;box(x+.05,y+.05,.9,h-.1,0,36,'#ffffff00','#bde7f2','#8ecae6');ctx.globalAlpha=1;const p=up(iso(x+.3,y+.3),34);ctx.fillStyle='#9aa3c7';ctx.beginPath();ctx.ellipse(p.X,p.Y,4,2,0,0,7);ctx.fill();break;}
  case 'washer':{box(x+.1,y+.1,.8,.8,0,16,'#f4f6fb','#dfe3f3','#c3c9e0');const p=up(iso(x+.5,y+.9),8);ctx.fillStyle='#5ef2ff88';ctx.beginPath();ctx.ellipse(p.X,p.Y,5,4,0,0,7);ctx.fill();ctx.strokeStyle='#9aa3c7';ctx.stroke();break;}
  case 'stove':{box(x+.05,y+.1,.9,.8,0,16,'#3b4163','#2a2e45','#1b1f3a');const on=townAct(towns.find(q=>q.id===it.town))==='breakfast';for(const [dx,dy] of [[.3,.3],[.7,.3],[.3,.7],[.7,.7]]){const p=up(iso(x+dx,y+dy),16);ctx.strokeStyle=on?'#ff7b54':'#6c7296';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(p.X,p.Y,4,2,0,0,7);ctx.stroke();}break;}
  case 'bookshelf':{box(x+.1,y+.2,.8,.6,0,32,'#a8754d','#8a5f3c','#6e4a2f');const BK=['#e76f51','#2a9d8f','#e9c46a','#8ecae6','#cdb4db'];for(let s=0;s<3;s++)for(let i=0;i<4;i++){const p=up(iso(x+.2+i*.17,y+.8),6+s*9);ctx.fillStyle=BK[(i+s+x)%5];ctx.fillRect(p.X-1.5,p.Y-7,3,7);}break;}
  case 'suitcase':{box(x+.25,y+.3,.5,.4,0,12,'#e76f51','#c4553a','#a3432c');const p=up(iso(x+.5,y+.5),12);ctx.strokeStyle='#3b4163';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.X-3,p.Y);ctx.lineTo(p.X-3,p.Y-4);ctx.lineTo(p.X+3,p.Y-4);ctx.lineTo(p.X+3,p.Y);ctx.stroke();break;}
  case 'coffeetable':box(x+.1,y+.25,w-.2,.5,0,7,'#d49a6a','#a8754d','#8a5f3c');break;
  case 'bench':box(x+.15,y+.3,.7,.4,0,6,'#d49a6a','#a8754d','#8a5f3c');break;
  case 'lamp':{box(x+.42,y+.42,.16,.16,0,26,'#9aa3c7','#6c7296','#565b7c');const p=up(iso(x+.5,y+.5),30);ctx.fillStyle='#ffd166';ctx.beginPath();ctx.moveTo(p.X-7,p.Y+4);ctx.lineTo(p.X+7,p.Y+4);ctx.lineTo(p.X+4,p.Y-6);ctx.lineTo(p.X-4,p.Y-6);ctx.fill();lights.push({X:p.X,Y:p.Y,r:70,c:'#ffd166'});break;}
 }
}
function drawProp(p,x,y,face,now){
 if(!p.sitting)return;
 if(p.act==='breakfast'){const lift=Math.sin(now*2+hash(p.id))>.6?5:0;ctx.fillStyle='#fff';ctx.fillRect(x+face*8-3,y-17-lift,6,6);ctx.fillStyle='#8b5a2b';ctx.fillRect(x+face*8-2,y-16-lift,4,2);
  ctx.strokeStyle='#ffffff88';ctx.lineWidth=1;ctx.beginPath();const s=(now*20)%6;ctx.moveTo(x+face*8,y-19-lift-s);ctx.lineTo(x+face*8+1,y-23-lift-s);ctx.stroke();}
 if(p.act==='free'){ctx.fillStyle='#ffd166';ctx.fillRect(x+face*7-3,y-18,6,4);} // snack
}
function drawGlow(dark){
 if(!dark)return;ctx.save();ctx.globalCompositeOperation='lighter';
 for(const l of lights){const g=ctx.createRadialGradient(l.X,l.Y,0,l.X,l.Y,l.r);g.addColorStop(0,l.c+'66');g.addColorStop(1,l.c+'00');ctx.globalAlpha=Math.min(1,dark*1.8);ctx.fillStyle=g;ctx.fillRect(l.X-l.r,l.Y-l.r,l.r*2,l.r*2);}
 ctx.restore();
}
function tileOutline(x,y,col){ctx.lineWidth=2;poly([iso(x,y),iso(x+1,y),iso(x+1,y+1),iso(x,y+1)],col+'33',col);}
function draw(){
 const d=devicePixelRatio||1,W=canvas.width/d,H=canvas.height/d,now=performance.now()/1000;
 ctx.setTransform(d,0,0,d,0,0);background(W,H,now);drawShootingStars(W,H);
 ctx.setTransform(cam.z*d,0,0,cam.z*d,-cam.x*cam.z*d,-cam.y*cam.z*d);
 const placed=towns.map(t=>{let tx=t.x,ty=t.y;if(drag?.kind==='town'&&drag.t===t){tx+=drag.dx;ty+=drag.dy;}return {t,tx,ty};});
 placed.sort((a,b)=>(a.tx+a.ty)-(b.tx+b.ty));
 lights=[];const occ=new Map();for(const p of people.values())if(p.arrived&&(p.sitting||p.lying)&&p.goal)occ.set(p.goal.key,p);
 for(const p of placed){drawPlatform(p.t,p.tx,p.ty,now);const f=furniture({...p.t,x:p.tx,y:p.ty});for(const fl of f.floors){flat(fl.x,fl.y,fl.w,fl.h,0,fl.color+'38',fl.color+'66');}
  for(const it of f.items)if(it.type==='rug'&&it.small){flat(it.x+.1,it.y+.1,it.w-.2,it.h-.2,.5,'#ffafcc55','#ffafcc');}else if(it.type==='rug'){flat(it.x+.1,it.y+.1,it.w-.2,it.h-.2,.5,'#e76f5155','#e76f51');flat(it.x+.4,it.y+.4,it.w-.8,it.h-.8,.6,null,'#f4a26188');}
  houseShell(p.t,p.tx,p.ty,true);}
 const hx=hub?hub.x+(drag?.kind==='town'&&drag.t===hub?drag.dx:0):0,hy=hub?hub.y+(drag?.kind==='town'&&drag.t===hub?drag.dy:0):0,HF=hub&&hubFurniture({...hub,x:hx,y:hy});
 if(hub){drawPlatform(hub,hx,hy,now);flat(hx+1,hy+2,hub.w-2,hub.h-3,.3,'#5ef2ff14','#5ef2ff55');}
 for(const k of walkways()){const [x,y]=k.split(',').map(Number);drawWalkway(x,y,now);}
 if(hover&&(tool==='wall'||tool==='erase'))tileOutline(Math.floor(hover.x),Math.floor(hover.y),tool==='wall'?'#5ef2ff':'#ff5d73');
 if(drag?.kind==='town'){const t=drag.t;for(const k of walls){const [x,y]=k.split(',').map(Number);if(x>=t.x-1&&x<=t.x+t.w&&y>=t.y-1&&y<=t.y+t.h)tileOutline(x+drag.dx,y+drag.dy,'#5ef2ff');}}
 const V=toIso(0,0),V2=toIso(W,H),items=[];
 for(const k of walls){const [x,y]=k.split(',').map(Number),c=iso(x+.5,y+.5);if(c.X<V.X-TW||c.X>V2.X+TW||c.Y<V.Y-TH||c.Y>V2.Y+TH*3)continue;items.push({z:x+y+1,w:[x,y]});}
 for(const {t,tx,ty} of placed)for(const it of furniture({...t,x:tx,y:ty}).items)if(it.type!=='rug')items.push({z:it.x+it.y+(it.w+it.h)/2-(it.type==='chair'?.02:0),it});
 if(HF)for(const it of HF.items)items.push({z:it.x+it.y+(it.w+it.h)/2-(it.type==='chair'?.02:0),it:{...it,key:'hub'+it.key}});
 for(const p of people.values())if(!p.lying)items.push({z:p.x+p.y+.01,p});petItems(items);
 for(const {t,tx,ty} of placed)items.push({z:tx+ty+t.w+t.h+.5,front:[t,tx,ty]});
 items.sort((a,b)=>a.z-b.z);
 for(const it of items)it.w?drawWall(it.w[0],it.w[1],now):it.it?drawItem(it.it,occ,now):it.front?houseShell(...it.front,false):it.pet?drawPet(it.pet,now):drawPerson(it.p,now);
 const dark=darkness();if(dark>0){ctx.save();ctx.setTransform(d,0,0,d,0,0);ctx.fillStyle='rgba(4,6,30,'+dark+')';ctx.fillRect(0,0,W,H);ctx.restore();drawGlow(dark);}
 drawFriendLines(now);
 for(const p of placed)drawSign(p.t,p.tx,p.ty,now);if(hub)drawSign(hub,hx,hy,now);
 const list=[...people.values()].filter(p=>!p.lying);
 if(cam.z>=.55){ctx.font='11px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
  for(const p of list){const n=nameOf(p.row),label=(n.length>20?n.slice(0,19)+'…':n)+(p.row.year?' · '+p.row.year:''),w=ctx.measureText(label).width+10,f=iso(p.x,p.y),x=f.X,y=f.Y+8;
   ctx.fillStyle=selected===p.id?'#5ef2ff':'#0d1030cc';ctx.beginPath();ctx.roundRect(x-w/2,y,w,15,4);ctx.fill();ctx.fillStyle=selected===p.id?'#0d1030':'#dfe6ff';ctx.fillText(label,x,y+8);}}
 for(const p of list){if(p.looking){drawWow(p,now);continue;}if(p.chat){drawChat(p,now);continue;}const a=bubbleAlpha(p,now);if(a>0)drawBubble(p,a,soloLine(p,now));}
}
// Speech bubbles: each resident says its Notes.
function bubbleAlpha(p,now){
 if(p.lying||!noteLines(p.row).length)return 0;
 if(selected===p.id||hoverP===p)return 1;
 if(bubbleMode==='off'||cam.z<.45)return 0;if(bubbleMode==='always')return 1;
 const c=(now+(hash(p.id)%1000)/50)%16;return c>6?0:Math.min(1,c*3,(6-c)*3);
}
function wrap(text,max,lines){
 const flat=text.replace(/\s+/g,' ').trim(),words=flat.split(' '),out=[];let line='';
 for(const w of words){const t=line?line+' '+w:w;if(ctx.measureText(t).width<=max||!line)line=t;else{out.push(line);line=w;if(out.length===lines)break;}}
 if(out.length<lines&&line)out.push(line);
 if(out.join(' ').length<flat.length){let l=out[out.length-1];while(l&&ctx.measureText(l+'…').width>max)l=l.slice(0,-1);out[out.length-1]=l+'…';}
 return out;
}
function drawBubble(p,a,text=p.row.notes,tint){
 const full=selected===p.id||hoverP===p;ctx.save();ctx.globalAlpha=a;ctx.font='12px system-ui';ctx.textAlign='left';ctx.textBaseline='top';
 const lines=wrap(text,170,full?8:tint?4:3),w=Math.max(...lines.map(l=>ctx.measureText(l).width))+16,h=lines.length*15+10;
 const f=iso(p.x,p.y),x=f.X,bx=x-w/2,by=f.Y-46-h;
 ctx.fillStyle='#f4f6ffee';ctx.strokeStyle=full?'#5ef2ff':tint||'#9aa3c7';ctx.lineWidth=1.5;ctx.shadowColor=tint||'#5ef2ff';ctx.shadowBlur=full||tint?12:0;
 ctx.beginPath();ctx.roundRect(bx,by,w,h,8);ctx.moveTo(x-6,by+h);ctx.lineTo(x,by+h+8);ctx.lineTo(x+6,by+h);ctx.fill();ctx.stroke();ctx.shadowBlur=0;
 ctx.fillRect(x-5,by+h-2,10,3);
 ctx.fillStyle='#14183a';lines.forEach((l,i)=>ctx.fillText(l,bx+8,by+6+i*15));ctx.restore();
}
// Astronaut resident
function drawPerson(p,now){
 const h=hash(p.id),f=iso(p.x,p.y),x=f.X,moving=p.wait<=0&&!p.sitting&&!p.arrived&&drag?.p!==p,bob=moving?0:Math.sin(now*2+h%7)*1.5,b=(moving?Math.abs(Math.sin((p.walk||0)*9))*2:0)+bob+(drag?.p===p?10:0),y=f.Y-b+(p.sitting?-4:0);
 const suit=SHIRTS[h%SHIRTS.length],face=p.face||1;
 if(selected===p.id){ctx.strokeStyle='#5ef2ff';ctx.lineWidth=2;ctx.shadowColor='#5ef2ff';ctx.shadowBlur=10;ctx.beginPath();ctx.ellipse(x,f.Y,15,7,0,0,7);ctx.stroke();ctx.shadowBlur=0;}
 ctx.fillStyle='#00000055';ctx.beginPath();ctx.ellipse(x,f.Y,9,4,0,0,7);ctx.fill();
 const s=moving?Math.sin((p.walk||0)*9)*2:0;ctx.fillStyle='#d9dde8';if(p.sitting){ctx.fillRect(x-6+face*2,y-8,4,5);ctx.fillRect(x+2+face*2,y-8,4,5);}else{ctx.fillRect(x-6+s,y-8,4,8);ctx.fillRect(x+2-s,y-8,4,8);}ctx.fillStyle='#8a90a6';ctx.fillRect(x-6+s,y-2,4,2);ctx.fillRect(x+2-s,y-2,4,2);
 ctx.fillStyle=suit;ctx.beginPath();ctx.roundRect(face>0?x-11:x+5,y-21,6,12,2);ctx.fill(); // backpack
 ctx.fillStyle='#eef1f7';ctx.beginPath();ctx.roundRect(x-7,y-22,14,15,5);ctx.fill();
 ctx.fillStyle=suit;ctx.fillRect(x-7,y-14,14,3);
 ctx.fillStyle=(Math.sin(now*4+h)>0)?'#7CFC9A':'#ff5d73';ctx.fillRect(x-2+face*2,y-19,3,3);
 ctx.fillStyle='#f4f6fb';ctx.beginPath();ctx.arc(x,y-29,9,0,7);ctx.fill();ctx.strokeStyle='#b8bfd4';ctx.lineWidth=1;ctx.stroke();
 const v=ctx.createLinearGradient(x-6,y-34,x+6,y-24);v.addColorStop(0,'#5ef2ff');v.addColorStop(.5,'#1b2a6b');v.addColorStop(1,'#0b1033');
 const lu=p.looking?3:0;ctx.fillStyle=v;ctx.beginPath();ctx.ellipse(x+face*(2+lu*.6),y-29-lu,6,4.5,0,0,7);ctx.fill();
 ctx.fillStyle='#ffffffaa';ctx.fillRect(x+face*2-3,y-31,2,1.5);
 ctx.strokeStyle='#b8bfd4';ctx.beginPath();ctx.moveTo(x-face*5,y-36);ctx.lineTo(x-face*7,y-42);ctx.stroke();ctx.fillStyle=suit;ctx.beginPath();ctx.arc(x-face*7,y-42,1.8,0,7);ctx.fill();
 drawProp(p,x,y,face,now);
 if(p.chat?.kind==='hub'&&p.ready){const mx=x+face*8;ctx.fillStyle='#f4f6fb';ctx.fillRect(mx-3,y-18,6,7);ctx.fillStyle='#6f4e37';ctx.fillRect(mx-2,y-17,4,2);ctx.strokeStyle='#ffffff88';ctx.lineWidth=1;ctx.beginPath();const s=(now*20)%6;ctx.moveTo(mx,y-20-s);ctx.lineTo(mx+1,y-24-s);ctx.stroke();} // coffee at the Hub
 if(p.row.screenshot){ctx.fillStyle='#5ef2ff';ctx.globalAlpha=.8;ctx.fillRect(x+8,y-20,7,9);ctx.globalAlpha=1;ctx.strokeStyle='#fff';ctx.strokeRect(x+8,y-20,7,9);}
}
initFriends();
$('stars').onclick=startShower;
let last=performance.now();
(function loop(t){step(Math.min(.1,(t-last)/1000));last=t;draw();requestAnimationFrame(loop);})(last);
