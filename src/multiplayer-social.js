import {normalizePose,normalizePlayerName} from './multiplayer-protocol.js';
export const CHAT_LIMIT=160;
const validId=id=>typeof id==='string'&&/^[-a-zA-Z0-9_]{1,100}$/.test(id);
export function normalizeChat(value){return typeof value==='string'?Array.from(value.normalize('NFC').replace(/[\p{Cc}\p{Cf}]/gu,'').replace(/\s+/gu,' ').trim()).slice(0,CHAT_LIMIT).join(''):'';}
export function validChat(message,roster){return validId(message?.id)&&validId(message.player)&&roster.some(p=>p.id===message.player&&p.name===message.name)&&normalizePlayerName(message.name)===message.name&&!!message.text&&normalizeChat(message.text)===message.text;}
export function normalizeCars(value,pose){
 const input=value??(pose?.vehicle?[{...pose,model:pose.vehicle.model,appearance:pose.vehicle}]:[]);
 if(!Array.isArray(input)||input.length>6)return null;const cars=[];
 for(const c of input){const p=normalizePose({...c,location:'outside',vehicle:c.appearance||c.vehicle});if(!p?.vehicle||c.model!==p.vehicle.model||cars.some(v=>v.model===c.model))return null;cars.push({...p,model:c.model,appearance:p.vehicle,vehicle:null});}
 return cars;
}
export function validSeats(seats,roster){return Array.isArray(seats)&&seats.length<=roster.length&&new Set(seats.map(s=>s.player)).size===seats.length&&new Set(seats.map(s=>`${s.owner}:${s.model}`)).size===seats.length&&seats.every(s=>s.player!==s.owner&&roster.some(p=>p.id===s.player)&&roster.some(p=>p.id===s.owner)&&['bmw-m6','audi-r8','mercedes-amg','koenigsegg-jesko','vw-golf-r','vw-passat'].includes(s.model));}
export function seatRequest(id,owner,model,frames,seats){
 const rider=frames.get(id)?.pose,driver=frames.get(owner),car=driver?.cars?.find(c=>c.model===model);
 if(id===owner||!rider||rider.mode!=='walk'||rider.location!=='outside'||rider.hp===0||!car||driver.pose.hp===0)return {ok:false,reason:'unavailable'};
 if(Math.abs(car.speed)>=.6)return {ok:false,reason:'moving'};
 if(Math.hypot(rider.x-car.x,rider.z-car.z)>5.2)return {ok:false,reason:'distance'};
 if(seats.some(s=>s.player===id||s.owner===owner&&s.model===model))return {ok:false,reason:'occupied'};
 return {ok:true,seat:{player:id,owner,model}};
}
