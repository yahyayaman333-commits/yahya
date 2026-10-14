export const RACE_TRACKS=Object.freeze([
 {id:'historic-loop',name:['Historic street circuit','Tarihî sokak turu'],start:{x:53,z:70},heading:Math.PI,points:[[53,110],[146,110],[146,0],[146,-110],[53,-110],[53,70]],radius:10,corridor:15},
 {id:'marmara-sprint',name:['Marmara highway sprint','Marmara otoyol yarışı'],start:{x:900,z:0},heading:-Math.PI/2,points:[[1100,0],[1400,0],[1700,0],[2020,0]],radius:12,corridor:15}
].map(t=>Object.freeze({...t,start:Object.freeze(t.start),points:Object.freeze(t.points.map(([x,z])=>Object.freeze({x,z})))})));
export const RACE_INVITE_TTL=30000,RACE_COUNTDOWN=3000,RACE_TIMEOUT=300000;
export function pointSegmentDistance(p,a,b){const dx=b.x-a.x,dz=b.z-a.z,length=dx*dx+dz*dz,t=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/length)):0;return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz);}
export class RaceAuthority{
 constructor({now=()=>Date.now(),players=()=>[],award=()=>{},emit=()=>{},id=()=>globalThis.crypto.randomUUID()}={}){Object.assign(this,{now,players,award,emit,id});this.race=null;this.invitation=null;}
 player(id){return this.players().find(p=>p.id===id);}
 invite(from,targets,trackId){
  this.tick();const track=RACE_TRACKS.find(t=>t.id===trackId),owner=this.player(from);
  if(!owner||!track||this.race&&this.race.status!=='finished'||this.invitation||!Array.isArray(targets)||targets.length<1||targets.length>=this.players().length||new Set(targets).size!==targets.length)return false;
  const guests=targets.map(id=>this.player(id));if(guests.some(p=>!p||p.id===from||p.preferences?.raceInvites===false))return false;
  this.invitation={id:this.id(),owner:from,track:track.id,targets:[...targets],accepted:[from],declined:[],expires:this.now()+RACE_INVITE_TTL};return true;
 }
 reply(id,inviteId,accepted){const q=this.invitation;this.tick();if(!q||this.invitation!==q||q.id!==inviteId||!q.targets.includes(id)||q.accepted.includes(id)||q.declined.includes(id)||typeof accepted!=='boolean')return false;(accepted?q.accepted:q.declined).push(id);if(accepted)q.expires=this.now()+120000;return true;}
 start(id){
  this.tick();const q=this.invitation;if(!q||q.owner!==id||q.accepted.length<2)return false;const track=RACE_TRACKS.find(t=>t.id===q.track),players=q.accepted.map(id=>this.player(id));
  if(players.some(p=>!p||p.hp===0||p.pose?.location!=='outside'||!['drive','pause'].includes(p.pose.mode)||!p.pose.vehicle||Math.abs(p.pose.speed)>1.5||Math.hypot(p.pose.x-track.start.x,p.pose.z-track.start.z)>25))return false;
  this.race={id:q.id,track:track.id,status:'countdown',startAt:this.now()+RACE_COUNTDOWN,expires:this.now()+RACE_COUNTDOWN+RACE_TIMEOUT,participants:players.map(p=>({id:p.id,name:p.name,next:0,travel:0,status:'racing',last:{x:p.pose.x,z:p.pose.z},finishAt:null})),results:[]};this.invitation=null;return true;
 }
 active(id){return this.race&&['countdown','racing'].includes(this.race.status)&&this.race.participants.some(p=>p.id===id&&p.status==='racing');}
 movement(id,pose,previous){
  const r=this.race,p=r?.participants.find(p=>p.id===id&&p.status==='racing');if(!p||r.status==='finished')return true;
  if(r.status==='countdown')return Math.hypot(pose.x-previous.x,pose.z-previous.z)<.35;
  if(pose.location!=='outside'||!['drive','pause'].includes(pose.mode)||!pose.vehicle){this.withdraw(id);return true;}
  const track=RACE_TRACKS.find(t=>t.id===r.track),a=p.next?track.points[p.next-1]:track.start,b=track.points[p.next],delta=Math.hypot(pose.x-previous.x,pose.z-previous.z);
  if(pointSegmentDistance(pose,a,b)>track.corridor)return false;
  p.travel+=delta;p.last={x:pose.x,z:pose.z};
  if(pointSegmentDistance(b,previous,pose)<=track.radius&&p.travel>=Math.max(0,Math.hypot(b.x-a.x,b.z-a.z)-track.radius*2)){
   p.next++;p.travel=0;if(p.next===track.points.length){p.status='finished';p.finishAt=this.now();const place=r.results.length+1,reward=[500,250,100][place-1]||0;r.results.push({id:p.id,name:p.name,place,timeMs:p.finishAt-r.startAt,reward});if(reward)this.award(p.id,`${r.id}:${p.id}`,reward);}
  }
  this.finishIfDone();return true;
 }
 withdraw(id){const r=this.race,p=r?.participants.find(p=>p.id===id);if(p?.status==='racing'){p.status='dnf';this.finishIfDone();}const q=this.invitation;if(q){if(q.owner===id)this.invitation=null;else{q.targets=q.targets.filter(v=>v!==id);q.accepted=q.accepted.filter(v=>v!==id);if(!q.targets.length)this.invitation=null;}}}
 finishIfDone(){const r=this.race;if(r&&!r.participants.some(p=>p.status==='racing')){r.status='finished';r.finishedAt=this.now();this.emit({type:'race-finished',race:r.id});}}
 tick(){const now=this.now();if(this.invitation?.expires<=now)this.invitation=null;const r=this.race;if(!r)return;if(r.status==='countdown'&&now>=r.startAt)r.status='racing';if(r.status==='racing'&&now>=r.expires){for(const p of r.participants)if(p.status==='racing')p.status='dnf';this.finishIfDone();}if(r.status==='finished'&&now-r.finishedAt>20000)this.race=null;}
 snapshot(){this.tick();const r=this.race;let race=null;if(r){const track=RACE_TRACKS.find(t=>t.id===r.track),positions=r.participants.map(p=>{const a=p.next?track.points[p.next-1]:track.start,b=track.points[Math.min(p.next,track.points.length-1)],length=Math.hypot(b.x-a.x,b.z-a.z);return {id:p.id,name:p.name,next:p.next,status:p.status,score:p.status==='finished'?1e6-r.results.find(v=>v.id===p.id).place:p.status==='dnf'?-1:p.next+Math.max(0,Math.min(.999,1-Math.hypot(b.x-p.last.x,b.z-p.last.z)/Math.max(1,length)))};}).sort((a,b)=>b.score-a.score).map((p,i)=>({...p,place:i+1}));race={id:r.id,track:r.track,status:r.status,startAt:r.startAt,positions,results:r.results.map(p=>({...p}))};}return {serverTime:this.now(),invitation:this.invitation?{...this.invitation,targets:[...this.invitation.targets],accepted:[...this.invitation.accepted],declined:[...this.invitation.declined]}:null,race};}
}
