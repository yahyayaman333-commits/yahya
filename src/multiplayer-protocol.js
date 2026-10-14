export const ROOM_NUMBERS=Object.freeze(Array.from({length:5},(_,i)=>i+1));
// Admission is enforced by both transports and the authoritative server.
export const ROOM_CAPACITY=5;
export const SECURE_PROTOCOL_VERSION=7;
export function nextPlayerSlot(roster){const used=new Set(roster.map(p=>p.slot));let slot=1;while(used.has(slot))slot++;return slot;}
export const NETWORK_INTERVAL_MS=80;
export const PROTOCOL_VERSION=6;
export const PLAYER_NAME_MAX_LENGTH=20;
export function normalizePlayerName(value){
 if(typeof value!=='string')return null;
 const name=Array.from(value.normalize('NFC').replace(/[\p{Cc}\p{Cf}]/gu,'').replace(/\s+/gu,' ').trim()).slice(0,PLAYER_NAME_MAX_LENGTH).join('');
 return name||null;
}
const models=new Set(['bmw-m6','audi-r8','mercedes-amg','koenigsegg-jesko','vw-golf-r','vw-passat']);
const colors=new Set(['gray','black','red','blue','white','silver','graphite','green','yellow','orange','purple','burgundy']);
const number=(v,limit)=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=limit;
const rounded=v=>Math.round(v*1000)/1000;
export function roomNumber(value){const n=Number(value);if(!ROOM_NUMBERS.includes(n))throw new Error('invalid-room');return n;}
export function roomPeerId(namespace,room){
 let hash=2166136261;for(const c of String(namespace))hash=Math.imul(hash^c.charCodeAt(0),16777619);
 return `sultanahmet-mp-v${PROTOCOL_VERSION}-${(hash>>>0).toString(36)}-room-${roomNumber(room)}`;
}
export function normalizePose(p){
 if(!p||!number(p.x,10000)||!number(p.z,10000)||!number(p.y,200)||!number(p.heading,1000))return null;
 if(typeof p.location!=='string'||!/^[-a-z0-9]{1,64}$/.test(p.location))return null;
 const result={x:rounded(p.x),y:rounded(p.y),z:rounded(p.z),heading:rounded(p.heading),location:p.location,
  mode:['walk','drive','passenger','dead'].includes(p.mode)?p.mode:'pause',weapon:['pistol','rifle'].includes(p.weapon)?p.weapon:'none',pitch:rounded(number(p.pitch,1.5)?p.pitch:0),eyeHeight:rounded(number(p.eyeHeight,2.3)?p.eyeHeight:1.7),hp:number(p.hp,100)?p.hp:100,vx:rounded(number(p.vx,110)?p.vx:0),vz:rounded(number(p.vz,110)?p.vz:0),speed:rounded(number(p.speed,110)?p.speed:0),vehicle:null};
 if(p.vehicle){const v=p.vehicle;if(!models.has(v.model)||!colors.has(v.color)||typeof v.plate!=='string'||!/^[-A-Z0-9ÇĞİÖŞÜ ]{1,7}$/.test(v.plate))return null;
  result.vehicle={model:v.model,color:v.color,plate:v.plate,braking:v.braking===true,steer:rounded(number(v.steer,1.6)?v.steer:0)};
 }
 if(p.passenger&&/^[-a-zA-Z0-9_]{1,100}$/.test(p.passenger.owner)&&models.has(p.passenger.model))result.passenger={owner:p.passenger.owner,model:p.passenger.model};
 return result;
}
export function normalizeWorld(w){return w&&number(w.hour,24)&&w.hour>=0&&['clear','cloudy','rain'].includes(w.weather)?{hour:rounded(w.hour),weather:w.weather}:null;}
export function validSequence(n){return Number.isSafeInteger(n)&&n>=0;}
export function validRoster(roster){
 return Array.isArray(roster)&&roster.length>0&&roster.length<=ROOM_CAPACITY&&new Set(roster.map(p=>p?.id)).size===roster.length&&new Set(roster.map(p=>p?.slot)).size===roster.length&&roster.every(p=>typeof p?.id==='string'&&/^[-a-zA-Z0-9_]{1,100}$/.test(p.id)&&Number.isSafeInteger(p.slot)&&p.slot>=1&&p.slot<=ROOM_CAPACITY&&typeof p.name==='string'&&normalizePlayerName(p.name)===p.name);
}
