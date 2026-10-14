'use strict';
// Shooting stars: click the button and a shower of shooting stars crosses the sky; every resident stops to look.
// Loaded before city.js; runs only after city.js has loaded.
const shower={until:0,stars:[],last:null};
const WOW=['Wow!','Look!','Make a wish!','Ooh!','✨','So pretty!','Did you see that?','A shooting star!'];
function startShower(){
 const now=performance.now()/1000,r=canvas.getBoundingClientRect(),n=14+Math.floor(Math.random()*10);
 shower.until=Math.max(shower.until,now+7.5);
 for(let i=0;i<n;i++){const big=Math.random()<.18,sp=600+Math.random()*500;
  shower.stars.push({x:r.width*(.15+Math.random()*1.0),y:r.height*Math.random()*.45,vx:-sp,vy:sp*(.35+Math.random()*.3),born:now+Math.random()*5.5,life:.8+Math.random()*.7,len:big?260:120+Math.random()*100,w:big?3.2:1.6+Math.random(),hue:Math.random()<.3?'#ffd6f3':Math.random()<.5?'#bdf6ff':'#ffffff'});}
 tell('Shooting stars! Everyone is looking up.');
}
const showering=()=>performance.now()/1000<shower.until;
function lookUp(p){ // called from step(); returns true while the resident is busy watching
 if(!showering()){if(p.looking){p.looking=false;p.path=null;p.arrived=false;p.sitting=false;}return false;}
 if(!p.looking){p.looking=true;p.wow=WOW[(hash(p.id)+Math.floor(Math.random()*WOW.length))%WOW.length];p.wowAt=Math.random()*1.5;
  if(p.lying&&p.goal?.bed){p.lying=false;p.x=p.goal.bed.foot[0]+.5;p.y=p.goal.bed.foot[1]+.5;}p.sitting=false;}
 const s=shower.last;if(s){const r=canvas.getBoundingClientRect(),f=iso(p.x,p.y),px=(f.X-cam.x)*cam.z;p.face=s.x>px?1:-1;}
 return true;
}
function drawShootingStars(W,H){
 const now=performance.now()/1000;shower.stars=shower.stars.filter(s=>now<s.born+s.life);if(!shower.stars.length)return;
 ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';
 for(const s of shower.stars){const t=now-s.born;if(t<0)continue;const k=t/s.life,x=s.x+s.vx*t,y=s.y+s.vy*t,sp=Math.hypot(s.vx,s.vy),tx=x-s.vx/sp*s.len,ty=y-s.vy/sp*s.len,a=Math.sin(Math.PI*Math.min(1,k));
  const g=ctx.createLinearGradient(x,y,tx,ty);g.addColorStop(0,s.hue);g.addColorStop(1,'#ffffff00');ctx.globalAlpha=a;ctx.strokeStyle=g;ctx.lineWidth=s.w;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(tx,ty);ctx.stroke();
  const h=ctx.createRadialGradient(x,y,0,x,y,s.w*5);h.addColorStop(0,'#ffffff');h.addColorStop(1,'#ffffff00');ctx.fillStyle=h;ctx.beginPath();ctx.arc(x,y,s.w*5,0,7);ctx.fill();
  if(!shower.last||shower.last.born<=s.born)shower.last={x,y,born:s.born};}
 ctx.restore();
}
function drawWow(p,now){ // little exclamation above each watcher
 if(!p.looking||cam.z<.45)return;const t=shower.until-now;if(7.5-t<p.wowAt)return;
 const f=iso(p.x,p.y),x=f.X,y=f.Y-58;ctx.save();ctx.font='bold 11px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
 const w=ctx.measureText(p.wow).width+12;ctx.globalAlpha=Math.min(1,t);ctx.fillStyle='#fff7d6ee';ctx.strokeStyle='#ffd166';ctx.lineWidth=1;
 ctx.beginPath();ctx.roundRect(x-w/2,y-9,w,18,9);ctx.fill();ctx.stroke();ctx.fillStyle='#5a3e00';ctx.fillText(p.wow,x,y+.5);ctx.restore();
}
