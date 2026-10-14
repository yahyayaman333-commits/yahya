import {randomUUID} from 'node:crypto';
import {normalizePose,normalizePlayerName,normalizeWorld,nextPlayerSlot,roomNumber,ROOM_CAPACITY} from '../src/multiplayer-protocol.js';
import {normalizeCars,normalizeChat,seatRequest} from '../src/multiplayer-social.js';
import {CombatAuthority,WEAPONS,rayObstacles,normalizeShot} from '../src/combat-rules.js';
import {RaceAuthority,RACE_TRACKS} from '../src/race-rules.js';
import {createMissions} from '../src/missions.js';
import {MISSION_REWARDS} from '../src/mission-catalog.js';
import {SCHOOL_QUESTIONS,schoolGateInReach} from '../src/school-exam.js';
import {HOMES} from '../src/homes.js';
import {createNavigation,playableAt} from './navigation.mjs';
import {fleeNpc} from '../src/npc-motion.js';
import {pointSegmentDistance} from '../src/race-rules.js';
const spawn={x:0,y:.04,z:-32.6,heading:0,location:'outside',mode:'walk',weapon:'none',hp:100,speed:0,vx:0,vz:0,eyeHeight:1.7,pitch:0,vehicle:null};
const topSpeed={'bmw-m6':180,'audi-r8':220,'mercedes-amg':240,'koenigsegg-jesko':320,'vw-golf-r':250,'vw-passat':240};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const recordPose=p=>({...p,vehicle:p.vehicle?{...p.vehicle}:null});
export class RoomAuthority {
 constructor(number,{world,accounts,now=Date.now,pvp=true}={}){this.number=roomNumber(number);Object.assign(this,{world,accounts,now,pvp});this.navigation=createNavigation(world);this.players=new Map();this.seats=[];this.chat=[];this.eventsSeen=new Set();this.worldState={hour:14,weather:'clear'};this.npcs=world.npcs.map(n=>({...n,route:n.route?.map(p=>Array.isArray(p)?[...p]:{...p}),dead:false}));this.lastTick=now();this.sequence=0;
  this.combat=new CombatAuthority({now,session:`room-${number}-${randomUUID()}`,targets:()=>this.npcs,blocked:(location,o,d,r)=>rayObstacles(o,d,location==='outside'?world.colliders:world.rooms[location]?.colliders||[],r),canDamagePlayer:(a,b)=>this.pvp&&this.players.get(a)?.preferences.pvp===true&&this.players.get(b)?.preferences.pvp===true});
  this.races=new RaceAuthority({now,players:()=>[...this.players.values()].map(p=>({...p,hp:this.combat.players.get(p.id)?.hp??100})),award:(id,event,value)=>{const p=this.players.get(id);if(p)this.accounts.award(p.account,event,value);}});
 }
 roster(){return [...this.players.values()].map(p=>({id:p.id,slot:p.slot,name:p.name}));}
 join(account,name,send){if(this.players.size>=ROOM_CAPACITY)return {ok:false,error:'full'};if(this.players.has(account.id))return {ok:false,error:'already-connected'};name=normalizePlayerName(name);if(!name)return {ok:false,error:'invalid-name'};const slot=nextPlayerSlot(this.roster());const p={id:account.id,account,name,slot,send,pose:{...spawn,x:spawn.x+((slot-1)%5)*2},cars:[],preferences:{pvp:true,raceInvites:true,showNames:true},seq:-1,lastPose:this.now(),lastChat:-Infinity,tokens:60,tokenAt:this.now(),ammo:Object.fromEntries(Object.entries(WEAPONS).map(([id,w])=>[id,w.magazine])),reload:{},life:0,travel:null,driveRemainder:0,driveSerial:0,movementCredit:2,farAt:new Map()};
  account.completedMissions??=[];p.missions=createMissions({storage:null,garage:{snapshot:()=>({completedMissions:account.completedMissions}),awardMission:mission=>{if(account.completedMissions.includes(mission)||!MISSION_REWARDS[mission])return {ok:false};if(!this.accounts.award(account,`mission-${mission}`,MISSION_REWARDS[mission]))return {ok:false};account.completedMissions.push(mission);return {ok:true,reward:MISSION_REWARDS[mission]};}},onEvent:e=>{if(e.type==='completed')send({t:'notice',text:`+ $${e.reward} · ${e.id}`});}});
  this.players.set(p.id,p);this.sync();return {ok:true,player:p};}
 leave(id){this.races.withdraw(id);this.players.delete(id);this.seats=this.seats.filter(s=>s.player!==id&&s.owner!==id);this.sync();}
 sync(){this.combat.sync(this.roster(),[...this.players.values()].map(p=>({id:p.id,pose:p.pose})));}
 result(p,request,ok,reason){p.send({t:'result',request,ok,reason:ok?undefined:reason,account:this.accounts.snapshot(p.account)});return ok;}
 appearance(p,model){return {model,color:p.account.paints[model],plate:p.account.plates[model],steer:0,braking:false};}
 command(id,m){const p=this.players.get(id);if(!p||!m||typeof m!=='object'||Array.isArray(m)||typeof m.t!=='string')return false;const now=this.now();p.tokens=Math.min(60,p.tokens+(now-p.tokenAt)*.035);p.tokenAt=now;if(p.tokens<1)return false;p.tokens--;
  // Identity always comes from the authenticated connection, never a packet.
  if(Object.hasOwn(m,'player')||Object.hasOwn(m,'id')||Object.hasOwn(m,'damage')||Object.hasOwn(m,'money')||Object.hasOwn(m,'result')||Object.hasOwn(m,'hp'))return false;
  if(m.t==='pose')return this.pose(p,m);
  if(m.t==='preferences'){if(!m.preferences||Object.keys(m.preferences).some(k=>!['pvp','raceInvites','showNames'].includes(k))||Object.values(m.preferences).some(v=>typeof v!=='boolean'))return false;Object.assign(p.preferences,m.preferences,{showNames:true});return true;}
  if(m.t==='shot'){this.sync();const shot=normalizeShot(m.shot),w=shot&&WEAPONS[shot.weapon];if(!w||!p.ammo[shot.weapon]||p.reload[shot.weapon]>now)return false;if(!this.combat.fire(id,shot))return false;p.ammo[shot.weapon]--;this.resolveCombat();return true;}
  if(m.t==='reload'){const w=WEAPONS[m.weapon];if(!w||this.combat.players.get(id)?.hp===0||p.pose.mode!=='walk'||p.ammo[m.weapon]===w.magazine||p.reload[m.weapon]>now)return false;p.reload[m.weapon]=now+w.reload;return true;}
  if(m.t==='chat'){const text=normalizeChat(m.text);if(!text||now-p.lastChat<750)return false;p.lastChat=now;const message={id:`chat-${randomUUID()}`,player:id,name:p.name,text};this.chat.push(message);if(this.chat.length>30)this.chat.shift();for(const q of this.players.values())q.send({t:'chat',message});return true;}
  if(m.t==='seat'){if(m.owner===null){this.seats=this.seats.filter(s=>s.player!==id);return this.result(p,m.request,true);}const frames=new Map([...this.players.values()].map(q=>[q.id,{pose:{...q.pose,hp:this.combat.players.get(q.id)?.hp??100},cars:q.cars}])),r=seatRequest(id,m.owner,m.model,frames,this.seats);if(r.ok)this.seats.push(r.seat);return this.result(p,m.request,r.ok,r.reason);}
  if(m.t==='race-invite')return this.result(p,m.request,this.races.invite(id,m.targets,m.track),'race-unavailable');
  if(m.t==='race-reply')return this.result(p,m.request,this.races.reply(id,m.invitation,m.accept),'invitation-expired');
  if(m.t==='race-start')return this.result(p,m.request,this.races.start(id),'start-line');
  if(m.t==='race-withdraw'){this.races.withdraw(id);return this.result(p,m.request,true);}
  if(m.t==='account')return this.result(p,m.request,this.accounts.action(p.account,m),'funds-or-invalid');
  if(m.t==='mission-start')return this.result(p,m.request,p.missions.start(m.mission),'mission-unavailable');
  if(m.t==='mission-cancel'){p.missions.cancel();return this.result(p,m.request,true);}
  if(m.t==='exam-start'){if(!schoolGateInReach({...p.pose,mode:'walk'}))return this.result(p,m.request,false,'school-gate');p.exam={answers:[],at:now};return this.result(p,m.request,true);}
  if(m.t==='exam-answer'){if(!p.exam||!schoolGateInReach({...p.pose,mode:'walk'})||m.index!==p.exam.answers.length||!Number.isInteger(m.choice)||m.choice<0||m.choice>3||m.index>9)return this.result(p,m.request,false,'exam-answer');p.exam.answers.push(m.choice);return this.result(p,m.request,true);}
  if(m.t==='mission-complete'){let ok=false;
   if(m.mission==='lost-phone')ok=p.missions.collectPhone(p.pose);
   else if(m.mission==='hagia-photo')ok=p.missions.photo('ayasofya',{...p.pose,mode:'photo'});
   else if(m.mission==='fener-exam'&&p.exam?.answers.length===10){const score=p.exam.answers.reduce((n,a,i)=>n+(a===SCHOOL_QUESTIONS[i].answer?1:0),0);ok=p.missions.completeSchoolExam(score,{...p.pose,mode:'exam'}).ok;p.exam=null;}
   else ok=p.account.completedMissions.includes(m.mission);
   return this.result(p,m.request,ok,'mission-not-verified');
  }
  if(m.t==='travel')return this.travel(p,m);
  if(m.t==='ferry-start'){const docks={beach:{x:1475,z:138},island:{x:1674,z:304}},point=docks[m.dock];if(!point||this.races.active(id)||p.pose.location!=='outside'||distance(p.pose,point)>6||this.combat.players.get(id)?.hp===0)return false;p.ferry={from:m.dock,at:now,first:true};p.missions.fastTravel();return true;}
  return false;
 }
 travel(p,m){if(this.races.active(p.id)||this.combat.players.get(p.id)?.hp===0)return this.result(p,m.request,false,'race-active');let target;
  if(m.destination){const t=this.world.destinations.find(d=>d.id===m.destination);if(t?.spawn)target={...t.spawn,heading:t.spawn.yaw||0,location:'outside'};const track=RACE_TRACKS.find(t=>t.id===m.destination);if(track)target={x:track.start.x+((p.slot-1)%2?2.4:-2.4),z:track.start.z+Math.floor((p.slot-1)/2)*6,y:.04,heading:track.heading,location:'outside'};}
  else if(m.car){const c=p.cars.find(c=>c.model===m.car)||(this.world.cars||[]).find(c=>c.model===m.car);if(c)target={x:c.x+3,z:c.z,y:c.y,heading:c.heading,location:'outside'};}
  if(m.target){const catalogs=[...this.world.destinations.map(d=>d.spawn),...HOMES.map(h=>h.spawn),{x:-150,z:-198.8},{x:0,z:-32.6},{x:18,z:31},...(this.world.cars||[]),...p.cars];if(Number.isFinite(m.target.x)&&Number.isFinite(m.target.z)&&catalogs.some(t=>t&&distance(m.target,t)<6))target={x:m.target.x,z:m.target.z,y:Number.isFinite(m.target.y)?Math.max(0,Math.min(20,m.target.y)):.04,heading:m.target.heading||0,location:'outside'};}
  if(!target||!playableAt(target.x,target.z,this.world))return this.result(p,m.request,false,'invalid-travel');if(this.world.heights)target.y=Math.min(target.y||.04,this.navigation.height(target.x,target.z));p.ferry=null;p.missions.fastTravel();p.pose={...p.pose,...target,mode:'walk',vehicle:null,speed:0,vx:0,vz:0};p.travel={target,until:this.now()+5000};p.movementCredit=2;p.lastPose=this.now();p.budgetAt=this.now();p.send({t:'correction',pose:p.pose,travel:true});return this.result(p,m.request,true);
 }
 pose(p,m){const next=normalizePose(m.pose),cars=next&&normalizeCars(m.cars,next),now=this.now(),health=this.combat.players.get(p.id);if(!next||!cars||!Number.isSafeInteger(m.seq)||m.seq<=p.seq||m.life!==health?.life)return false;p.seq=m.seq;
  if(health.hp===0)return false;next.hp=health.hp;const old=p.pose,elapsed=Math.min(.35,Math.max(.01,(now-p.lastPose)/1000));let accepted=true;
  if(next.location!==old.location){const gate=this.world.entrances.find(g=>g.id===next.location),room=this.world.rooms[old.location];if(old.location==='outside'&&gate&&distance(old,gate)<=gate.radius+2&&distance(next,this.world.rooms[gate.id].spawn)<3)accepted=true;else if(next.location==='outside'&&room&&distance(old,room.exit)<=room.exit.radius+2&&distance(next,this.world.entrances.find(g=>g.id===old.location).spawn)<4)accepted=true;else accepted=false;}
  else {const speed=next.mode==='drive'&&next.vehicle?(topSpeed[next.vehicle.model]||0)/3.6:8,budgetTime=Math.max(0,Math.min(.35,(now-(p.budgetAt??p.lastPose))/1000));p.budgetAt=now;p.movementCredit=Math.min(speed*.4+2,p.movementCredit+speed*budgetTime);accepted=distance(next,old)<=p.movementCredit&&Math.abs(next.y-old.y)<=4+elapsed*15;
   if(p.travel&&now<p.travel.until&&next.location===p.travel.target.location&&distance(next,p.travel.target)<6){accepted=true;p.travel=null;}}
  const ferry=p.ferry&&now-p.ferry.at<600000&&!next.vehicle&&next.location==='outside';if(ferry){const points=[[1485,153],[1485,184],[1510,215],[1580,283],[1618,339],[1662,340],[1662,312]].map(([x,z])=>({x,z}));const corridor=points.slice(1).some((b,i)=>pointSegmentDistance(next,points[i],b)<30);const exit=p.ferry.from==='beach'?{x:1674,z:304}:{x:1475,z:138};if(next.mode==='walk'&&now-p.ferry.at>=43000&&distance(next,exit)<5){accepted=true;p.ferry=null;}else if(next.mode==='pause'&&corridor&&distance(next,old)<(p.ferry.first?26:25*elapsed+2)){accepted=true;p.ferry.first=false;}else accepted=false;}
  if(next.location==='outside'){const b=this.world.bounds;accepted&&=next.x>=b.minX&&next.x<=b.maxX&&next.z>=b.minZ&&next.z<=b.maxZ&&next.y>=-1&&next.y<=24&&(!!ferry||playableAt(next.x,next.z,this.world));}else{const b=this.world.rooms[next.location]?.bounds;accepted&&=!!b&&next.x>=b.minX-1&&next.x<=b.maxX+1&&next.z>=b.minZ-1&&next.z<=b.maxZ+1&&next.y>=-1&&next.y<=5;}
  if(accepted&&!ferry&&this.world.heights&&next.location==='outside')accepted=next.y<=this.navigation.height(next.x,next.z)+1.4;
  if(accepted&&!ferry&&!p.travel&&next.mode!=='passenger')accepted=this.navigation.path(old,next);
  if(next.vehicle){accepted&&=next.location==='outside'&&this.accounts.owns(p.account,next.vehicle.model);next.vehicle={...this.appearance(p,next.vehicle.model),steer:next.vehicle.steer,braking:next.vehicle.braking};}
  if(next.mode==='passenger'){const seat=this.seats.find(s=>s.player===p.id),owner=seat&&this.players.get(seat.owner),car=owner?.cars.find(c=>c.model===seat.model);accepted=!!car&&distance(next,car)<4;if(accepted){Object.assign(next,{x:car.x,z:car.z,y:car.y,hp:health.hp});next.passenger={owner:seat.owner,model:seat.model};}}
  if(!accepted){p.send({t:'correction',pose:old});return false;}
  // Checkpoints advance only after the movement envelope has been validated.
  this.races.tick();if(!this.races.movement(p.id,next,old)){p.send({t:'correction',pose:old});return false;}
  const delta=next.location===old.location?distance(next,old):0;if(next.mode==='drive'){const measured=delta/elapsed,maximum=(topSpeed[next.vehicle?.model]||0)/3.6;next.speed=Math.sign(next.speed)*Math.min(maximum,measured);next.vx=(next.x-old.x)/elapsed;next.vz=(next.z-old.z)/elapsed;}p.movementCredit=Math.max(0,p.movementCredit-delta);p.pose=next;p.lastPose=now;
  if(next.location!==old.location)p.missions.visit(next.location);p.missions.step(elapsed,{...next,forward:next.speed>0,highway:next.x>830&&Math.abs(next.z)<12,speedKmh:Math.abs(next.speed)*3.6,motionDt:elapsed});
  const validated=[];for(const c of cars){if(!this.accounts.owns(p.account,c.model))continue;const previous=p.cars.find(v=>v.model===c.model),driving=next.vehicle?.model===c.model;
   if(driving&&distance(c,next)<1)validated.push({...c,x:next.x,z:next.z,y:next.y,appearance:next.vehicle});else if(previous&&distance(c,previous)<1)validated.push({...previous,speed:0,vx:0,vz:0,appearance:this.appearance(p,c.model)});else if(!previous&&distance(c,next)<6)validated.push({...c,speed:0,vx:0,vz:0,appearance:this.appearance(p,c.model)});
  }for(const c of p.cars)if(!validated.some(v=>v.model===c.model))validated.push({...c,speed:0,vx:0,vz:0});p.cars=validated.slice(0,6);
  if(next.mode==='drive'&&next.vehicle&&delta>0&&Math.abs(next.speed)>1.4){p.driveRemainder+=delta;const units=Math.floor(p.driveRemainder/20);if(units){p.driveRemainder-=units*20;this.accounts.award(p.account,`drive-${this.combat.session}-${++p.driveSerial}`,Math.min(1000,units*(next.x>830?4:2)));}}
  if(p.slot===Math.min(...[...this.players.values()].map(p=>p.slot))){const w=normalizeWorld(m.world);if(w)this.worldState=w;}
  if(next.mode!=='passenger')this.seats=this.seats.filter(s=>s.player!==p.id);this.sync();return true;
 }
 resolveCombat(){for(const e of this.combat.events){if(this.eventsSeen.has(e.id))continue;this.eventsSeen.add(e.id);if(e.type==='npc-kill'){const p=this.players.get(e.player);if(p)this.accounts.award(p.account,e.id,50);}if(e.type==='player-kill')this.races.withdraw(e.target);}if(this.eventsSeen.size>128)this.eventsSeen=new Set(this.combat.events.map(e=>e.id));}
 tick(){const now=this.now(),dt=Math.min(.15,(now-this.lastTick)/1000);this.lastTick=now;this.sync();this.races.tick();this.resolveCombat();
  for(const p of this.players.values()){const a=this.combat.players.get(p.id);if(a.life!==p.life){p.life=a.life;p.pose={...a.pose};p.ammo=Object.fromEntries(Object.entries(WEAPONS).map(([id,w])=>[id,w.magazine]));p.reload={};this.seats=this.seats.filter(s=>s.player!==p.id);p.send({t:'correction',pose:p.pose});}for(const [weapon,end]of Object.entries(p.reload))if(end<=now){p.ammo[weapon]=WEAPONS[weapon].magazine;delete p.reload[weapon];}}
  for(const n of this.npcs){n.hp=this.combat.npcs.get(n.id)??100;n.dead=!n.hp;if(n.dead){n.state='dead';continue;}if(this.combat.panic&&n.state!=='fleeing'){n.state='fleeing';n.speed=2.35;const shooter=[...this.players.values()][0]?.pose||spawn;n.heading=Math.atan2(n.x-shooter.x,n.z-shooter.z);}if(n.state==='fleeing')fleeNpc(n,dt,this.navigation.environment(n.location));else if(n.route?.length&&n.speed){const end=n.route[n.routeIndex||0],x=Array.isArray(end)?end[0]:end.x,z=Array.isArray(end)?end[1]:end.z,d=Math.hypot(x-n.x,z-n.z),step=n.speed*dt;if(d<step)n.routeIndex=((n.routeIndex||0)+1)%n.route.length;else if(d){n.x+=(x-n.x)/d*step;n.z+=(z-n.z)/d*step;n.heading=Math.atan2(x-n.x,z-n.z);}}}
 }
 snapshot(id){
  const p=this.players.get(id);if(!p)return null;const now=this.now(),roster=this.roster(),frames=[];p.sentFrames??=new Map();
  for(const key of p.sentFrames.keys())if(!this.players.has(key))p.sentFrames.delete(key);
  for(const q of this.players.values()){
   if(q.id===id)continue;const near=q.pose.location===p.pose.location&&distance(q.pose,p.pose)<180,pose={...recordPose(q.pose),hp:this.combat.players.get(q.id)?.hp??100};
   const signature=JSON.stringify([pose,q.cars]),last=p.sentFrames.get(q.id);
   if(last&&(signature===last.signature&&now-last.at<1000||!near&&now-last.at<250))continue;
   p.sentFrames.set(q.id,{signature,at:now});frames.push({id:q.id,name:q.name,slot:q.slot,seq:++this.sequence,pose,cars:q.cars});
  }
  const combat=this.combat.snapshot(),key=JSON.stringify([combat.players.map(a=>[a.id,a.hp,a.life]),combat.events.at(-1)?.id,p.ammo,p.reload]);
  const sendCombat=key!==p.combatKey||now-(p.combatAt??-Infinity)>=250;
  if(sendCombat){p.combatKey=key;p.combatAt=now;const own=combat.players.find(a=>a.id===id);if(own){own.ammo={...p.ammo};own.reload={...p.reload};}
   // Nearby actors need motion updates. Death and panic events still reach the room.
   combat.npcs=combat.npcs.filter(n=>!n.hp||n.location===p.pose.location&&distance(n,p.pose)<250).map(n=>({...n,x:Math.round(n.x*1000)/1000,z:Math.round(n.z*1000)/1000,heading:Math.round(n.heading*1000)/1000}));
  }
  const revision=p.account.revision||0,sendAccount=p.accountRevision!==revision;if(sendAccount)p.accountRevision=revision;
  return {t:'snapshot',roster,frames,world:this.worldState,seats:this.seats,...(sendCombat?{combat}:{}),...(sendAccount?{account:this.accounts.snapshot(p.account)}:{}),games:{...this.races.snapshot(),pvpAllowed:this.pvp,preferences:{...p.preferences},players:[...this.players.values()].map(q=>({id:q.id,name:q.name,pvp:q.preferences.pvp}))}};
 }
}
