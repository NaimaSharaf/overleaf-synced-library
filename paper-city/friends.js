'use strict';
// Paper City friends (1.7): papers that share distinctive words become friends.
// Friends chat in the lounge, visit each other's houses, and take coffee breaks at the Work Hub.
// Loaded before city.js; everything here runs only after city.js has loaded.
const STOP=new Set(`about above across after again against also although among analysis another approach approaches based because been before being below between both cannot could data decrease decreased different does doing down during each effect effects either even ever every first found from further given have having here high higher however increase increased into itself just large less like likely made main many may more most much must never next none note notes novel only onto other others over paper papers part per perhaps possible present previous rather result results same several shall should show showed shown shows significant significantly similar since some still studies study such than that their them then there therefore these they this those through thus together toward towards under until upon used useful uses using various very well were what when where whereas whether which while whose will with within without would year years your`.split(/\s+/));
const TURN=4,CHAT_TURNS=3;
let friends=new Map(),friendSig='',friendPairs=0,showLines=false,chatsOn=true,socialT=0;
const chats=new Set();

// ---------- who is friends with whom ----------
function termsOf(r){
 const out=new Map(),text=[r.keyword,r.title,r.sentence,r.notes].filter(s=>typeof s==='string').join(' ').toLowerCase();
 for(const w of text.match(/[a-z][a-z0-9-]{3,}/g)||[]){
  const clean=w.replace(/-+$/,'');let s=clean.replace(/ies$/,'y').replace(/([^s])s$/,'$1');
  if(s.length<4||STOP.has(s)||STOP.has(clean))continue;if(!out.has(s))out.set(s,clean);
 }
 return out;
}
function computeFriends(rows){
 const papers=rows.filter(r=>r.kind!=='section');
 const sig=papers.map(r=>r.id+':'+hash([r.keyword,r.title,r.sentence,r.notes].join('\u0001'))).join(',');
 if(sig===friendSig)return;friendSig=sig;
 const N=papers.length,T=papers.map(termsOf),df=new Map();
 for(const m of T)for(const s of m.keys())df.set(s,(df.get(s)||0)+1);
 const cap=Math.max(3,Math.ceil(N*.4)),idx=new Map(); // words in most papers are too common to count
 T.forEach((m,i)=>{for(const s of m.keys()){const d=df.get(s);if(d>=2&&d<=cap){if(!idx.has(s))idx.set(s,[]);idx.get(s).push(i);}}});
 const pairs=new Map();
 for(const [s,list] of idx){const w=Math.log(1+N/list.length)+(list.length===2?.5:0);
  for(let a=0;a<list.length;a++)for(let b=a+1;b<list.length;b++){const k=list[a]+','+list[b];let v=pairs.get(k);if(!v)pairs.set(k,v={score:0,terms:[]});v.score+=w;v.terms.push([s,w,list.length]);}}
 const cand=new Map(papers.map(r=>[r.id,[]]));let max=0;
 for(const [k,v] of pairs){
  if(v.terms.length<2&&!(v.terms.length===1&&v.terms[0][2]===2))continue; // two shared words, or one word only these two use
  const [a,b]=k.split(',').map(Number),topic=v.terms.sort((x,y)=>y[1]-x[1]).slice(0,3).map(([s])=>T[a].get(s)||s);
  const e={a:papers[a].id,b:papers[b].id,score:v.score,topic};cand.get(e.a).push(e);cand.get(e.b).push(e);max=Math.max(max,v.score);
 }
 const keep=new Set();for(const list of cand.values())list.sort((x,y)=>y.score-x.score).slice(0,3).forEach(e=>keep.add(e));
 friends=new Map(papers.map(r=>[r.id,[]]));
 for(const e of keep){const w=max?e.score/max:1;friends.get(e.a).push({id:e.b,w,topic:e.topic});friends.get(e.b).push({id:e.a,w,topic:e.topic});}
 for(const l of friends.values())l.sort((x,y)=>y.w-x.w);
 friendPairs=keep.size;
}
const friendship=(a,b)=>(friends.get(a)||[]).find(f=>f.id===b);

// ---------- meeting up ----------
const RATE={home:.12,visit:.05,hub:.04}; // chance per second for a free pair of friends
const canChat=p=>!p.chat&&!(p.chatCool>0)&&!p.lying&&drag?.p!==p&&!!p.act;
function chatKind(p,q){
 const a=p.act,b=q.act,off=x=>x==='free'||x==='home';
 if(off(a)&&off(b)){if(p.town===q.town)return 'home';if(a==='free'&&b==='free')return 'visit';return null;}
 const atHub=x=>x.sitting&&String(x.goal?.key||'').startsWith('hub');
 if(a==='work'&&b==='work'&&atHub(p)&&atHub(q))return 'hub';
 return null;
}
function takenSpots(){const s=new Set();for(const c of chats)for(const [x,y] of c.spots)s.add(key(x,y));return s;}
function houseSpots(t,taken){
 const f=furniture(t),seat=new Set([...f.sofa.map(s=>key(s[0],s[1])),...f.chairs.map(c=>key(c.seat[0],c.seat[1])),...f.beds.map(b=>key(b.foot[0],b.foot[1]))]);
 const ok=(x,y)=>walkable(x,y)&&!blocked(x,y)&&!seat.has(key(x,y))&&!taken.has(key(x,y));
 for(const n of ['lounge','garden','kitchen']){const r=f.rooms[n],c=[];
  for(let y=r.y;y<=r.y1;y++)for(let x=r.x;x<r.x1;x++)if(ok(x,y)&&ok(x+1,y))c.push([[x,y],[x+1,y]]);
  if(c.length)return c[Math.floor(Math.random()*c.length)];}
 return null;
}
function hubSpots(taken){ // in front of the Hub's coffee counter
 if(!hub)return null;const y=hub.y+2,ok=(x,y)=>walkable(x,y)&&!blocked(x,y)&&!taken.has(key(x,y));
 for(let x=hub.x+hub.w-5;x>hub.x+1;x--)if(ok(x,y)&&ok(x+1,y))return [[x,y],[x+1,y]];
 return null;
}
function startChat(p,q,kind){
 const taken=takenSpots(),host=kind==='hub'?hub:towns.find(t=>t.id===(kind==='visit'?q.town:p.town));if(!host)return false;
 const spots=kind==='hub'?hubSpots(taken):houseSpots(host,taken);if(!spots)return false;
 const c={a:p,b:q,kind,host,spots,acts:[activityAt(p),activityAt(q)],t:0,age:0,len:TURN*CHAT_TURNS+.8,topic:friendship(p.id,q.id)?.topic||[]};
 for(const m of [p,q]){m.chat=c;m.cpath=null;m.ready=false;m.sitting=m.lying=false;m.arrived=false;m.wait=0;m.path=[];}
 c.lines=bankLines(c);chats.add(c);return true;
}
function bankLines(c){ // each friend speaks from its own Notes (its sentence bank), chosen when the chat starts
 const used=new Set();
 return [c.a,c.b,c.a].map(sp=>{const o=sp===c.a?c.b:c.a,all=noteLines(sp.row),left=all.filter(l=>!used.has(sp.id+l));if(!left.length)return null;
  const l=left[Math.floor(Math.random()*left.length)];used.add(sp.id+l);
  return fillLine(l,{me:nameOf(sp.row),friend:nameOf(o.row),topic:c.topic.join(', '),year:sp.row.year,house:towns.find(t=>t.id===sp.town)?.name});});
}
function endChat(c){
 chats.delete(c);
 for(const m of [c.a,c.b])if(m.chat===c){m.chat=null;m.cpath=null;m.ready=false;m.path=null;m.arrived=false;m.chatCool=25+Math.random()*35;m.wait=.3;}
}
function endAllChats(){for(const c of [...chats])endChat(c);}
const chatOk=c=>chats.has(c)&&chatsOn&&people.get(c.a.id)===c.a&&people.get(c.b.id)===c.b&&drag?.p!==c.a&&drag?.p!==c.b&&activityAt(c.a)===c.acts[0]&&activityAt(c.b)===c.acts[1];
function chatStep(p,c,dt){ // walk to the meeting spot, then stand facing your friend
 const me=c.a===p?0:1,[sx,sy]=c.spots[me],[ox,oy]=c.spots[1-me];
 if(!p.cpath){p.cpath=route(null,p,[[sx,sy]]);if(!p.cpath){endChat(c);return;}p.ready=false;p.arrived=false;}
 if(p.cpath.length){
  const n=p.cpath[0];if(blocked(Math.floor(n.x),Math.floor(n.y))){p.cpath=null;return;}
  const dx=n.x-p.x,dy=n.y-p.y,d=Math.hypot(dx,dy),v=Math.min(d,1.6*dt*(clockMode==='fast'?2:1)*(1+Math.min(3,p.cpath.length/8)));
  if(d<.02){p.cpath.shift();return;}
  p.face=dx-dy<0?-1:1;p.x+=dx/d*v;p.y+=dy/d*v;p.walk=(p.walk||0)+dt;return;
 }
 p.x=sx+.5;p.y=sy+.5;p.face=(ox-oy)-(sx-sy)<0?-1:1;p.ready=true;p.arrived=true;
}
function social(dt){
 sleepovers(dt);
 for(const c of [...chats]){if(!chatOk(c)){endChat(c);continue;}c.age+=dt;if(c.a.ready&&c.b.ready){c.t+=dt;if(c.t>=c.len)endChat(c);}else if(c.age>45)endChat(c);}
 for(const p of people.values())if(p.chatCool>0)p.chatCool-=dt;
 if(!chatsOn||(socialT-=dt)>0)return;socialT=1;
 const max=Math.max(1,Math.floor(people.size/5));if(chats.size>=max)return;
 for(const p of [...people.values()].sort(()=>Math.random()-.5)){
  if(chats.size>=max)break;if(!canChat(p))continue;
  for(const f of [...(friends.get(p.id)||[])].sort(()=>Math.random()-.5)){
   const q=people.get(f.id);if(!q||!canChat(q))continue;const kind=chatKind(p,q);
   if(kind&&Math.random()<RATE[kind]&&startChat(p,q,kind))break;
  }
 }
}

// ---------- what they say ----------
const says=r=>(r.sentence||'').trim();
// Notes are the paper's sentence bank: one line each (a single paragraph is split into sentences).
const lineCache=new Map();
function noteLines(r){const t=String(r?.notes||'').trim();if(!t)return [];let l=lineCache.get(t);if(l)return l;
 l=t.split(/\n+/).map(s=>s.trim()).filter(Boolean);if(l.length===1)l=l[0].split(/(?<=[.!?])\s+(?=[A-Z0-9"'“(])/).map(s=>s.trim()).filter(Boolean);
 if(lineCache.size>2000)lineCache.clear();lineCache.set(t,l);return l;}
const fillLine=(text,ctx)=>text.replace(/\{(me|friend|topic|year|house)\}/gi,(m,k)=>String(ctx[k.toLowerCase()]??'').trim()||({topic:'our work',year:'a while ago'}[k.toLowerCase()]||'friend'));
function soloLine(p,now){ // whole Notes on hover/click, otherwise one line per turn
 const l=noteLines(p.row);if(selected===p.id||hoverP===p||l.length<2)return l.join('\n');
 return l[Math.floor((now+(hash(p.id)%1000)/50)/16+hash(p.id))%l.length];}
function chatLine(c,turn){
 if(c.lines?.[turn])return c.lines[turn];
 const r=(turn%2?c.b:c.a).row;
 if(turn===0)return says(r)||'Hi, I\'m '+nameOf(r)+'.';
 if(turn===1)return says(r)||'Nice to meet you, I\'m '+nameOf(r)+'.';
 return c.topic.length?'We both cover '+c.topic.join(', ')+'!':'Let\'s cite each other!';
}
function chatLabel(p){
 const c=p.chat;if(!c)return '';const o=c.a===p?c.b:c.a,n=nameOf(o.row);
 const what=c.kind==='hub'?'Coffee break with '+n:c.kind==='visit'?(c.a===p?'Visiting '+n+' in '+(c.host?.name||'?'):n+' is visiting'):'Chatting with '+n;
 return what+(c.topic.length?' about '+c.topic.join(', '):'');
}
function drawChat(p,now){
 const c=p.chat;if(!c||!(c.a.ready&&c.b.ready))return;
 if(cam.z<.45&&selected!==p.id)return;
 const turn=Math.floor(c.t/TURN),within=c.t-turn*TURN;
 if(p===c.a&&c.topic.length&&cam.z>=.55){ // what they're talking about, between them
  const A=iso(c.a.x,c.a.y),B=iso(c.b.x,c.b.y),x=(A.X+B.X)/2,y=(A.Y+B.Y)/2+28,label='talking about '+c.topic.join(' · ');
  ctx.save();ctx.font='11px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';const w=ctx.measureText(label).width+14;
  ctx.fillStyle='#2a0d33dd';ctx.strokeStyle='#ff8fd8';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(x-w/2,y,w,16,8);ctx.fill();ctx.stroke();
  ctx.fillStyle='#ffd6f3';ctx.fillText(label,x,y+8.5);ctx.restore();
 }
 if(turn>=CHAT_TURNS||(turn%2?c.b:c.a)!==p)return;
 const a=Math.min(1,within*4,(TURN-.4-within)*4);if(a>0)drawBubble(p,a,chatLine(c,turn),'#ff8fd8');
}
function drawFriendLines(now){
 const focus=selected;if(!showLines&&!focus)return;
 const done=new Set();ctx.save();ctx.setLineDash([6,7]);ctx.lineDashOffset=-now*18;ctx.lineCap='round';
 for(const [id,list] of friends){
  if(!showLines&&id!==focus)continue;const p=people.get(id);if(!p)continue;
  for(const f of list){
   const k=id<f.id?id+'|'+f.id:f.id+'|'+id;if(done.has(k))continue;done.add(k);const q=people.get(f.id);if(!q)continue;
   const A=iso(p.x,p.y),B=iso(q.x,q.y);A.Y-=22;B.Y-=22;const span=Math.hypot(B.X-A.X,B.Y-A.Y),mx=(A.X+B.X)/2,my=Math.min(A.Y,B.Y)-30-span*.18;
   const strong=focus&&(id===focus||f.id===focus);
   ctx.globalAlpha=strong?.95:.25+.45*f.w;ctx.strokeStyle=strong?'#5ef2ff':'#ff8fd8';ctx.lineWidth=strong?2.5:1+f.w*1.5;ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=strong?10:4;
   ctx.beginPath();ctx.moveTo(A.X,A.Y);ctx.quadraticCurveTo(mx,my,B.X,B.Y);ctx.stroke();
   if(strong&&f.topic.length&&cam.z>=.45){const tx=(A.X+2*mx+B.X)/4,ty=(A.Y+2*my+B.Y)/4,label=f.topic.join(' · ');
    ctx.save();ctx.setLineDash([]);ctx.shadowBlur=0;ctx.globalAlpha=1;ctx.font='11px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';const w=ctx.measureText(label).width+12;
    ctx.fillStyle='#0d1030ee';ctx.beginPath();ctx.roundRect(tx-w/2,ty-8,w,16,8);ctx.fill();ctx.strokeStyle='#5ef2ff';ctx.lineWidth=1;ctx.stroke();ctx.fillStyle='#dfe6ff';ctx.fillText(label,tx,ty+.5);ctx.restore();}
  }
 }
 ctx.restore();
}

// ---------- sidebar + card ----------
function renderFriendStats(){
 const el=$('friend-stats');if(!el)return;
 el.textContent=friendPairs?friendPairs+' friendship'+(friendPairs===1?'':'s')+' found from shared words · '+chats.size+' chat'+(chats.size===1?'':'s')+' happening now':'No friendships yet. Papers become friends when their keyword, title, sentence or notes share distinctive words.';
}
function focusPerson(q){const r=canvas.getBoundingClientRect(),f=iso(q.x,q.y);cam.x=f.X-r.width/2/cam.z;cam.y=f.Y-20-r.height/2/cam.z;}
function renderCardFriends(p){
 const box=$('card-friends');box.replaceChildren();const list=friends.get(p.id)||[];if(!list.length)return;
 const h=document.createElement('div');h.className='friends-title';h.textContent='Friends ('+list.length+')';box.append(h);
 for(const f of list){const q=people.get(f.id);if(!q)continue;const t=towns.find(t=>t.id===q.town);
  const b=document.createElement('button');b.className='friend';b.title='Open '+nameOf(q.row);
  const dot=document.createElement('span');dot.className='dot';dot.style.background=t?.color||'#fff';
  const name=document.createElement('b');name.textContent=nameOf(q.row);
  const topic=document.createElement('span');topic.className='small';topic.textContent=' · '+f.topic.join(', ')+(t&&t.id!==p.town?' · lives in '+t.name:'');
  b.append(dot,name,topic);b.onclick=()=>{focusPerson(q);openCard(q);};
  const home=towns.find(t=>t.id===p.town),inv=document.createElement('button');inv.className='invite';
  const here=q.stay?.host===p.town;inv.textContent=here?'Staying here':'Invite to stay over';inv.disabled=here||q.town===p.town;
  inv.title=q.town===p.town?'Already lives in the same house':'Stay in '+(home?.name||'this house')+"'s guest room tonight";
  inv.onclick=()=>{if(startStay(q,home,p)){tell(nameOf(q.row)+' is coming to stay in '+home.name+"'s guest room.");openCard(p);}};
  const row=document.createElement('div');row.className='friend-row';row.append(b);if(q.town!==p.town)row.append(inv);box.append(row);}
}
function initFriends(){
 try{showLines=localStorage.paperCityLines==='1';chatsOn=localStorage.paperCityChats!=='0';}catch{}
 const l=$('friend-lines'),c=$('chats');l.checked=showLines;c.checked=chatsOn;
 l.onchange=()=>{showLines=l.checked;try{localStorage.paperCityLines=showLines?'1':'0';}catch{}};
 const s=$('stays');try{staysOn=localStorage.paperCityStays!=='0';}catch{}s.checked=staysOn;
 s.onchange=()=>{staysOn=s.checked;try{localStorage.paperCityStays=staysOn?'1':'0';}catch{}if(!staysOn)for(const p of people.values())if(p.stay)endStay(p);};
 c.onchange=()=>{chatsOn=c.checked;try{localStorage.paperCityChats=chatsOn?'1':'0';}catch{}if(!chatsOn)endAllChats();renderFriendStats();};
 renderFriendStats();
}

// ---------- sleepovers: a friend stays in your guest room ----------
let staysOn=true,stayT=0;
const guestOf=h=>[...people.values()].find(o=>o.stay?.host===h.id);
function startStay(p,host,friend){
 if(!host||host.id===p.town)return false;const g=guestOf(host);if(g&&g!==p){tell(nameOf(g.row)+' is already in '+host.name+"'s guest room.");return false;}
 if(p.chat)endChat(p.chat);p.stay={host:host.id,friend:friend?.id||null,slept:false};p.path=null;
 if(friend&&p.act==='free'&&friend.act==='free'&&canChat(friend))startChat(p,friend,'visit');
 return true;
}
function endStay(p){p.stay=null;p.path=null;p.stayCool=90+Math.random()*90;}
function stayHouse(p,home,act){ // guests live in their host's house until they've slept there and gone to work
 if(!p.stay)return home;const h=towns.find(t=>t.id===p.stay.host);
 if(!h||h.id===p.town||act==='home'||(act==='work'&&p.stay.slept)){endStay(p);return home;}
 if(act==='sleep')p.stay.slept=true;return h;
}
function guestGoal(p,t){const f=furniture(t);
 if(p.act==='sleep'&&f.guestBed)return {key:f.guestBed.key,at:f.guestBed.foot,lie:true,bed:f.guestBed};
 if(p.act==='breakfast'&&f.guestChair)return {key:f.guestChair.key,at:f.guestChair.seat,sit:true,face:f.guestChair.face};
 return null;}
function stayLabel(p){if(!p.stay)return '';const h=towns.find(t=>t.id===p.stay.host),fr=people.get(p.stay.friend);return 'Staying over at '+(h?.name||'?')+(fr?' with '+nameOf(fr.row):'')+' (guest room)';}
function sleepovers(dt){
 for(const p of people.values())if(p.stayCool>0)p.stayCool-=dt;
 if(!staysOn||(stayT-=dt)>0)return;stayT=2;
 for(const p of [...people.values()].sort(()=>Math.random()-.5)){
  if(p.stay||p.stayCool>0||p.act!=='free'||p.chat)continue;
  for(const f of friends.get(p.id)||[]){const q=people.get(f.id);if(!q||q.town===p.town||q.act!=='free')continue;const h=towns.find(t=>t.id===q.town);
   if(h&&!guestOf(h)&&Math.random()<.04){startStay(p,h,q);break;}}
 }
}
