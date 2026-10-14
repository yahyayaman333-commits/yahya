import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {RoomAuthority} from '../room-authority.mjs';import {AccountStore} from '../account-store.mjs';import {RACE_TRACKS} from '../../src/race-rules.js';import {CAR_MODELS} from '../../src/garage-economy.js';import {SCHOOL_QUESTIONS} from '../../src/school-exam.js';
const world=JSON.parse(readFileSync(new URL('../world.json',import.meta.url)));
function setup(){let at=1000,seq=0;const accounts=new AccountStore({now:()=>at}),room=new RoomAuthority(1,{world,accounts,now:()=>at}),a=accounts.session().account,b=accounts.session().account;room.join(a,'A',()=>{});room.join(b,'B',()=>{});const players=[room.players.get(a.id),room.players.get(b.id)];
 const pose=(p,patch,dt=100)=>{at+=dt;return room.command(p.id,{t:'pose',life:room.combat.players.get(p.id).life,seq:++seq,pose:{...p.pose,...patch},cars:patch.vehicle?[{...p.pose,...patch,model:patch.vehicle.model,appearance:patch.vehicle}]:p.cars});};return {room,accounts,players,pose,advance:ms=>{at+=ms;room.tick();}};}
test('all six existing vehicle models register, persist after exit and reject fabricated cash and flying poses',()=>{
 const f=setup(),p=f.players[0];p.account.audiOwned=p.account.owned=true;
 for(const model of CAR_MODELS){assert(f.room.command(p.id,{t:'travel',destination:'marmara-sprint'}));const vehicle=f.room.appearance(p,model);assert(f.pose(p,{mode:'drive',vehicle}));assert(f.pose(p,{x:p.pose.x+1,mode:'drive',vehicle,speed:5}));assert(f.pose(p,{mode:'walk',vehicle:null,speed:0}));assert(p.cars.some(c=>c.model===model));}
 assert.equal(p.cars.length,6);assert.equal(f.pose(p,{y:8}),false);assert.equal(f.room.command(p.id,{t:'account',action:'buy',model:'mercedes-amg',money:1e6}),false);
});
test('both shipped race routes cross the real city collision geometry without a broken checkpoint',()=>{
 for(const track of RACE_TRACKS){const f=setup(),[a,b]=f.players,vehicle=f.room.appearance(a,'koenigsegg-jesko');
  for(const p of [a,b]){assert(f.room.command(p.id,{t:'travel',destination:track.id}));assert(f.pose(p,{mode:'pause',vehicle,speed:0}));}
  assert(f.room.command(a.id,{t:'race-invite',track:track.id,targets:[b.id]}));assert(f.room.command(b.id,{t:'race-reply',invitation:f.room.races.invitation.id,accept:true}));assert(f.room.command(a.id,{t:'race-start'}));f.advance(3000);f.room.leave(b.id);
  for(const target of track.points){const from={...a.pose},length=Math.hypot(target.x-from.x,target.z-from.z),steps=Math.ceil(length/2);for(let i=1;i<=steps;i++){const t=i/steps;assert(f.pose(a,{x:from.x+(target.x-from.x)*t,z:from.z+(target.z-from.z)*t,mode:'drive',vehicle,speed:20}),`${track.id} at ${JSON.stringify(a.pose)} towards ${JSON.stringify(target)}`);}}
  assert.equal(f.room.races.snapshot().race.results[0]?.id,a.id);assert(a.account.wallet>=600);
 }
});
test('the server scores all ten school answers and only pays a passing exam once',()=>{
 const f=setup(),p=f.players[0];assert(f.room.command(p.id,{t:'travel',target:{x:-150,z:-201,y:0}}));
 assert.equal(f.room.command(p.id,{t:'mission-complete',mission:'fener-exam'}),false);assert(f.room.command(p.id,{t:'exam-start'}));
 assert.equal(f.room.command(p.id,{t:'exam-answer',index:9,choice:0}),false);
 SCHOOL_QUESTIONS.forEach((q,index)=>assert(f.room.command(p.id,{t:'exam-answer',index,choice:q.answer})));
 assert(f.room.command(p.id,{t:'mission-complete',mission:'fener-exam'}));assert.equal(p.account.wallet,400);f.room.command(p.id,{t:'mission-complete',mission:'fener-exam'});assert.equal(p.account.wallet,400);
});
