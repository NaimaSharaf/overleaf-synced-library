'use strict';
// Alien pets: about 1 in 10 residents has a cute alien pet that floats after them,
// naps by their bed, sits with them, sends little hearts and watches shooting stars too.
const pets=new Map();let petSig='';
const PET_KINDS=[{kind:'blob',label:'moon blob'},{kind:'fuzz',label:'three-eyed fuzzball'},{kind:'squid',label:'sky squidlet'},{kind:'star',label:'star puff'}];
const PET_NAMES=['Zib','Blorp','Glim','Nubbin','Quix','Moopsy','Pip','Zorbo','Fizzle','Luma','Skree','Bobo','Twinkle','Gloop','Orbi','Nebby'];
const PET_COLORS=['#7CFC9A','#ff8fd8','#8ecae6','#ffd166','#c77dff','#5ef2ff','#ffafcc','#b5e48c'];
function syncPets(){
 const ids=[...people.keys()],sig=ids.join(',');if(sig===petSig)return;petSig=sig;
 const want=ids.length>=3?Math.max(1,Math.round(ids.length/10)):0;
 const owners=new Set(ids.slice().sort((a,b)=>hash('pet'+a)-hash('pet'+b)).slice(0,want));
 for(const id of [...pets.keys()])if(!owners.has(id))pets.delete(id);
 for(const id of owners)if(!pets.has(id)){const h=hash('pet'+id),o=people.get(id),k=PET_KINDS[h%PET_KINDS.length];
  pets.set(id,{owner:id,...k,name:PET_NAMES[(h>>>3)%PET_NAMES.length],color:PET_COLORS[(h>>>7)%PET_COLORS.length],x:o.x+.4,y:o.y+.4,hearts:[],heartT:3+Math.random()*6,side:h%2?1:-1});}
}
function stepPets(dt){
 syncPets();
 for(const pet of pets.values()){const o=people.get(pet.owner);if(!o)continue;
  const sleeping=o.lying,still=o.sitting||o.lying||o.looking||o.ready;
  let tx=o.x+.55*pet.side,ty=o.y+.45;if(!still){tx=o.x-.5*(o.face||1)*.7+.1;ty=o.y+.6;}
  if(sleeping&&o.goal?.bed){tx=o.goal.bed.foot[0]+.5;ty=o.goal.bed.foot[1]+.5;}
  const k=Math.min(1,dt*(still?2:3.5));pet.vx=(tx-pet.x)*k;pet.vy=(ty-pet.y)*k;pet.x+=pet.vx;pet.y+=pet.vy;
  pet.moving=Math.hypot(pet.vx,pet.vy)>.004;pet.asleep=sleeping;pet.looking=!!o.looking;if(pet.moving)pet.face=pet.vx-pet.vy<0?-1:1;else pet.face=(o.x-o.y)-(pet.x-pet.y)<0?-1:1;
  if(!sleeping&&still&&!pet.looking&&(pet.heartT-=dt)<=0){pet.heartT=4+Math.random()*7;pet.hearts.push({t:0});}
  for(const h of pet.hearts)h.t+=dt;pet.hearts=pet.hearts.filter(h=>h.t<1.6);
 }
}
function petItems(items){for(const pet of pets.values())items.push({z:pet.x+pet.y+.02,pet});}
function petLabel(p){const pet=pets.get(p.id);return pet?'🐾 Pet: '+pet.name+' the '+pet.label:'';}
function drawPet(pet,now){
 const f=iso(pet.x,pet.y),h=hash(pet.owner),bob=pet.asleep?0:Math.sin(now*(pet.moving?9:3)+h)*(pet.moving?3:1.5)+(pet.looking?Math.abs(Math.sin(now*6+h))*4:0);
 const x=f.X,y=f.Y-10-bob-(pet.asleep?-6:0),c=pet.color,face=pet.face||1,blink=pet.asleep||((now+h%5)%4<.12);
 ctx.save();
 ctx.fillStyle='#00000040';ctx.beginPath();ctx.ellipse(x,f.Y,6,2.5,0,0,7);ctx.fill();
 ctx.shadowColor=c;ctx.shadowBlur=pet.asleep?4:10;
 const eye=(ex,ey,r)=>{if(blink){ctx.strokeStyle='#14183a';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(ex-r,ey);ctx.quadraticCurveTo(ex,ey+r*.8,ex+r,ey);ctx.stroke();return;}
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ex,ey,r,0,7);ctx.fill();ctx.fillStyle='#14183a';ctx.beginPath();ctx.arc(ex+face*r*.3,ey-(pet.looking?r*.35:0),r*.55,0,7);ctx.fill();ctx.fillStyle='#fff';ctx.fillRect(ex+face*r*.3-r*.3,ey-r*.5,r*.35,r*.35);};
 const antenna=(ax,ay,bx,by)=>{ctx.shadowBlur=0;ctx.strokeStyle=c;ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(ax,ay);ctx.quadraticCurveTo((ax+bx)/2+face*2,(ay+by)/2-2,bx,by);ctx.stroke();ctx.fillStyle=Math.sin(now*4+h)>0?'#fff7b0':c;ctx.shadowColor='#fff7b0';ctx.shadowBlur=6;ctx.beginPath();ctx.arc(bx,by,1.8,0,7);ctx.fill();};
 if(pet.kind==='blob'){ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(x,y,8,6.5+Math.sin(now*3+h)*.6,0,0,7);ctx.fill();ctx.shadowBlur=0;eye(x+face*1.5,y-1,3.2);antenna(x-2,y-6,x-5,y-12);antenna(x+2,y-6,x+5,y-12);ctx.fillStyle='#ffffff55';ctx.beginPath();ctx.ellipse(x-3,y-3,2.5,1.5,-.5,0,7);ctx.fill();}
 else if(pet.kind==='fuzz'){ctx.fillStyle=c;for(let i=0;i<14;i++){const a=i/14*Math.PI*2;ctx.beginPath();ctx.arc(x+Math.cos(a)*6.5,y+Math.sin(a)*5.5,2.6,0,7);ctx.fill();}ctx.beginPath();ctx.arc(x,y,6.5,0,7);ctx.fill();ctx.shadowBlur=0;
  for(const s of [-1,1]){ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(x+s*3,y-6);ctx.lineTo(x+s*6.5,y-11);ctx.lineTo(x+s*7,y-5);ctx.fill();}eye(x-3+face,y-1,2);eye(x+3+face,y-1,2);eye(x+face,y-4.5,1.7);}
 else if(pet.kind==='squid'){ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y-2,6,Math.PI,0);ctx.lineTo(x+6,y+2);ctx.lineTo(x-6,y+2);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle=c;ctx.lineWidth=1.8;ctx.lineCap='round';
  for(let i=0;i<4;i++){const tx=x-4.5+i*3;ctx.beginPath();ctx.moveTo(tx,y+2);ctx.quadraticCurveTo(tx+Math.sin(now*5+i+h)*2.5,y+6,tx+Math.sin(now*5+i+1+h)*2,y+9);ctx.stroke();}eye(x-2.2+face,y-2,2);eye(x+2.2+face,y-2,2);}
 else{ctx.fillStyle=c;ctx.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?4:8.5;ctx.lineTo(x+Math.cos(a)*r,y+1+Math.sin(a)*r);}ctx.closePath();ctx.fill();ctx.shadowBlur=0;eye(x-2+face,y,1.8);eye(x+2+face,y,1.8);
  ctx.fillStyle='#ff6b9a88';ctx.beginPath();ctx.arc(x-4,y+2.5,1.3,0,7);ctx.arc(x+4,y+2.5,1.3,0,7);ctx.fill();}
 if(pet.asleep){ctx.fillStyle='#e0d4ff';ctx.font='bold 8px system-ui';ctx.textAlign='center';const k=(now*.6+h%7/7)%1;ctx.globalAlpha=1-k;ctx.fillText('z',x+7+k*6,y-8-k*10);ctx.globalAlpha=1;}
 for(const hh of pet.hearts){const k=hh.t/1.6;ctx.globalAlpha=1-k;ctx.fillStyle='#ff6b9a';const hx=x+Math.sin(hh.t*5)*3,hy=y-12-k*18,s=3;ctx.beginPath();ctx.moveTo(hx,hy+s);ctx.bezierCurveTo(hx-s*2,hy-s*.5,hx-s,hy-s*1.8,hx,hy-s*.6);ctx.bezierCurveTo(hx+s,hy-s*1.8,hx+s*2,hy-s*.5,hx,hy+s);ctx.fill();}
 ctx.restore();
 if(cam.z>=.8&&(hoverP?.id===pet.owner||selected===pet.owner)){ctx.save();ctx.font='10px system-ui';ctx.textAlign='center';ctx.fillStyle='#ffd6f3';ctx.fillText(pet.name,x,f.Y+12);ctx.restore();}
}
