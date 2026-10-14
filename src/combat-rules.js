export const WEAPONS=Object.freeze({
 pistol:Object.freeze({damage:34,interval:280,range:90,magazine:12,reload:1100}),
 rifle:Object.freeze({damage:25,interval:140,range:140,magazine:30,reload:1500})
});
export const RESPAWN_DELAY=3000;
export const RESPAWN_PROTECTION=5000;
export const RESPAWN_POINT=Object.freeze({x:0,z:-32.6,yaw:0});
export function normalizeShot(s){
 if(!s||!WEAPONS[s.weapon]||!Number.isSafeInteger(s.seq)||s.seq<0||!Number.isSafeInteger(s.life)||s.life<0)return null;
 const o=s.origin,d=s.direction;
 if(!o||!d||![o.x,o.y,o.z,d.x,d.y,d.z].every(Number.isFinite)||Math.abs(o.x)>10000||Math.abs(o.z)>10000||Math.abs(o.y)>220)return null;
 const length=Math.hypot(d.x,d.y,d.z);if(length<.98||length>1.02)return null;
 return {...s,origin:{x:o.x,y:o.y,z:o.z},direction:{x:d.x/length,y:d.y/length,z:d.z/length}};
}
export function rayBox(origin,direction,box,limit=Infinity){
 let near=0,far=limit;
 for(const axis of ['x','y','z']){
  const lo=box[`min${axis.toUpperCase()}`],hi=box[`max${axis.toUpperCase()}`],v=direction[axis];
  if(Math.abs(v)<1e-8){if(origin[axis]<lo||origin[axis]>hi)return Infinity;continue;}
  let a=(lo-origin[axis])/v,b=(hi-origin[axis])/v;if(a>b)[a,b]=[b,a];
  near=Math.max(near,a);far=Math.min(far,b);if(near>far)return Infinity;
 }return near;
}
export function rayPerson(o,d,p,range){
 const r=p.radius??(p.vehicle?1:.36),height=p.height??(p.vehicle?1.7:1.8);
 return rayBox(o,d,{minX:p.x-r,maxX:p.x+r,minZ:p.z-r,maxZ:p.z+r,minY:p.y+.1,maxY:p.y+height},range);
}
export function rayObstacles(o,d,colliders,range){
 let nearest=range;
 for(const c of colliders){
  if(c.label==='interior visitor'||c.combatPassThrough)continue;
  const minY=c.minY??c.baseY??0,maxY=c.maxY??(minY+(c.height??100));
  let at=Infinity;
  if(c.obb){
   const cos=Math.cos(c.heading),sin=Math.sin(c.heading),dx=o.x-c.x,dz=o.z-c.z;
   at=rayBox({x:dx*cos-dz*sin,y:o.y,z:dx*sin+dz*cos},{x:d.x*cos-d.z*sin,y:d.y,z:d.x*sin+d.z*cos},{minX:-c.halfWidth,maxX:c.halfWidth,minZ:-c.halfLength,maxZ:c.halfLength,minY,maxY},nearest);
  }else if(c.circle){
   const dx=o.x-c.x,dz=o.z-c.z,a=d.x*d.x+d.z*d.z,b=2*(dx*d.x+dz*d.z),disc=b*b-4*a*(dx*dx+dz*dz-c.radius*c.radius);
   if(a>1e-8&&disc>=0){const t=(-b-Math.sqrt(disc))/(2*a),end=(-b+Math.sqrt(disc))/(2*a);const y=o.y+d.y*Math.max(0,t);if(end>=0&&y>=minY&&y<=maxY)at=Math.max(0,t);}
  }else at=rayBox(o,d,{minX:c.minX,maxX:c.maxX,minZ:c.minZ,maxZ:c.maxZ,minY,maxY},nearest);
  if(at<nearest)nearest=at;
 }return nearest;
}
// This state lives on the room host, or locally in solo mode. Clients request
// a shot; they never nominate a victim, health, a reward, or a respawn position.
export class CombatAuthority{
 constructor({now=()=>Date.now(),targets=()=>[],blocked=()=>Infinity,canDamagePlayer=()=>true,session=globalThis.crypto?.randomUUID?.()||`game-${Date.now()}-${Math.random().toString(36).slice(2)}`}={}){
  Object.assign(this,{now,targets,blocked,canDamagePlayer,session});this.players=new Map();this.npcs=new Map();this.events=[];this.eventSeq=0;this.panic=false;
 }
 emit(event){this.events.push({id:`${this.session}-${++this.eventSeq}`,...event});if(this.events.length>32)this.events.shift();}
 sync(roster,frames){
  const ids=new Set(roster.map(p=>p.id));for(const id of this.players.keys())if(!ids.has(id))this.players.delete(id);
  for(const p of roster){let a=this.players.get(p.id);if(!a){a={id:p.id,hp:100,life:0,until:0,protectedUntil:0,lastShot:-Infinity,lastSeq:-1};this.players.set(p.id,a);}const f=frames.find(f=>f.id===p.id);if(f)a.pose=f.pose;}
  const now=this.now();for(const a of this.players.values())if(a.hp===0&&now>=a.until){a.hp=100;a.life++;a.protectedUntil=now+RESPAWN_PROTECTION;a.pose={...a.pose,...RESPAWN_POINT,heading:RESPAWN_POINT.yaw,y:.04,location:'outside',vehicle:null,mode:'walk'};this.emit({type:'respawn',player:a.id,life:a.life});}
 }
 fire(id,request){
  const s=normalizeShot(request),a=this.players.get(id),p=a?.pose,now=this.now();
  if(!s||!p||a.hp<=0||s.life!==a.life||s.seq<=a.lastSeq||p.vehicle||p.mode!=='walk'||p.weapon!==s.weapon)return false;
  a.lastSeq=s.seq;const w=WEAPONS[s.weapon];if(now-a.lastShot<w.interval-12)return false;
  const eye=p.eyeHeight??1.7;
  if(Math.hypot(s.origin.x-p.x,s.origin.z-p.z)>1.25||Math.abs(s.origin.y-p.y-eye)>.6)return false;
  const pitch=p.pitch??0,expected={x:-Math.sin(p.heading)*Math.cos(pitch),y:Math.sin(pitch),z:-Math.cos(p.heading)*Math.cos(pitch)};
  if(expected.x*s.direction.x+expected.y*s.direction.y+expected.z*s.direction.z<.92)return false;
  a.lastShot=now;let distance=Math.min(w.range,this.blocked(p.location,s.origin,s.direction,w.range)),victim=null;
  for(const b of this.players.values()){
   if(b.id===id||b.hp<=0||b.protectedUntil>now||b.pose?.location!==p.location||!this.canDamagePlayer(id,b.id))continue;
   const t=rayPerson(s.origin,s.direction,b.pose,distance);if(t<distance){distance=t;victim={type:'player',value:b};}
  }
  for(const npc of this.targets()){
   if(npc.location!==p.location||npc.dead)continue;const health=this.npcs.get(npc.id)??100;if(health<=0)continue;
   const t=rayPerson(s.origin,s.direction,npc,distance);if(t<distance){distance=t;victim={type:'npc',value:npc,hp:health};}
  }
  this.emit({type:'shot',player:id,weapon:s.weapon,location:p.location,x:s.origin.x,y:s.origin.y,z:s.origin.z});
  if(!victim)return true;
  if(victim.type==='player'){
   const b=victim.value;b.hp=Math.max(0,b.hp-w.damage);if(!b.hp)b.until=now+RESPAWN_DELAY;
   this.emit({type:b.hp?'hit':'player-kill',player:id,target:b.id});
  }else{
   const b=victim.value,hp=Math.max(0,victim.hp-w.damage);this.npcs.set(b.id,hp);
   this.emit({type:hp?'hit':'npc-kill',player:id,target:b.id,location:b.location,x:b.x,z:b.z});if(!hp)this.panic=true;
  }return true;
 }
 snapshot(){
  const now=this.now();return {session:this.session,panic:this.panic,
   players:[...this.players.values()].map(p=>({id:p.id,hp:p.hp,life:p.life,remaining:p.hp?0:Math.max(0,p.until-now),protection:Math.max(0,p.protectedUntil-now)})),
   npcs:this.targets().slice(0,64).map(n=>({id:n.id,x:n.x,y:n.y,z:n.z,heading:n.heading,location:n.location,speed:n.speed||0,hp:this.npcs.get(n.id)??(n.dead?0:100),state:n.state})),events:this.events.map(e=>({...e}))};
 }
}
export function validCombatSnapshot(c,roster){
 if(!c||typeof c.session!=='string'||!/^[-a-zA-Z0-9_]{1,100}$/.test(c.session)||typeof c.panic!=='boolean'||!Array.isArray(c.players)||c.players.length>roster.length||!Array.isArray(c.npcs)||c.npcs.length>64||!Array.isArray(c.events)||c.events.length>32)return false;
 const integer=(x,max)=>Number.isInteger(x)&&x>=0&&x<=max,finite=(x,max)=>Number.isFinite(x)&&Math.abs(x)<=max;
 return new Set(c.players.map(p=>p.id)).size===c.players.length&&c.players.every(p=>roster.some(r=>r.id===p.id)&&integer(p.hp,100)&&integer(p.life,1000000)&&finite(p.remaining,RESPAWN_DELAY))&&
  new Set(c.npcs.map(p=>p.id)).size===c.npcs.length&&c.npcs.every(p=>typeof p.id==='string'&&/^[-a-zA-Z0-9_]{1,100}$/.test(p.id)&&finite(p.x,10000)&&finite(p.z,10000)&&finite(p.y,220)&&finite(p.heading,1000)&&finite(p.speed,5)&&integer(p.hp,100)&&typeof p.location==='string'&&/^[-a-z0-9]{1,64}$/.test(p.location)&&['walking','visiting','chatting','standing','photographing','seated','fleeing','dead'].includes(p.state))&&
  c.events.every(e=>typeof e.id==='string'&&/^[-a-zA-Z0-9_]{1,140}$/.test(e.id)&&['shot','hit','npc-kill','player-kill','respawn'].includes(e.type)&&typeof e.player==='string'&&(!e.weapon||!!WEAPONS[e.weapon]));
}
