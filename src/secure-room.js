import {ROOM_CAPACITY,SECURE_PROTOCOL_VERSION,roomNumber,normalizePlayerName,normalizePose,validRoster} from './multiplayer-protocol.js';
import {validCombatSnapshot} from './combat-rules.js';
import {normalizeCars,validSeats,validChat} from './multiplayer-social.js';

// Reconnect only the transport. Never replay purchases, shots or race commands.
export class SecureRoom {
 constructor(options={}){this.options=options;this.frames=new Map();this.roster=[];this.seats=[];this.status='idle';this.authoritative=true;this.requests=new Map();this.serial=0;this.preferences={pvp:true,raceInvites:true,showNames:true};this.epoch=0;this.ticketCounter=0;this.timers=options.timers||globalThis;this.now=options.now||Date.now;try{this.storage=options.storage??globalThis.localStorage;}catch{}this.fetch=options.fetch||globalThis.fetch?.bind(globalThis);this.Socket=options.WebSocket||globalThis.WebSocket;}
 snapshot(){return {status:this.status,room:this.room,count:this.roster.length,capacity:ROOM_CAPACITY,slot:this.roster.find(p=>p.id===this.peer?.id)?.slot||0,host:this.host,name:this.name||'',players:this.roster,error:this.error||null,authoritative:true,spawn:this.spawn,persistent:this.persistent===true};}
 get host(){return this.roster[0]?.id===this.peer?.id;}
 get passenger(){return this.seats.find(s=>s.player===this.peer?.id)||null;}
 change(status,error=null){this.status=status;this.error=error;const s=this.snapshot(),signature=JSON.stringify(s);if(signature!==this.lastChange){this.lastChange=signature;this.options.onChange?.(s);}}
 send(m){if(this.ws?.readyState!==1||this.ws.bufferedAmount>16384||m.t!=='auth'&&this.status!=='connected')return false;try{this.ws.send(JSON.stringify(m));return true;}catch{return false;}}
 async join(n,name){this.leave();this.room=roomNumber(n);this.name=normalizePlayerName(name);if(!this.name)throw Error('invalid-name');this.base=this.options.serverUrl.replace(/\/$/,'');this.active=true;this.joined=false;this.bootId=null;this.retries=0;this.startedAt=this.now();this.change('connecting');const promise=new Promise((resolve,reject)=>{this.resolveJoin=resolve;this.rejectJoin=reject;});void this.connect(this.epoch);return promise;}
 async json(url,init={}){const controller=new AbortController();this.abort=controller;const deadline=this.timers.setTimeout(()=>controller.abort(),this.options.fetchTimeoutMs||10000);try{const r=await this.fetch(url,{cache:'no-store',...init,signal:controller.signal});if(r.status===403)throw Error('origin');if(r.status===400)throw Error('auth');if(!r.ok)throw Error('network');return await r.json();}finally{this.timers.clearTimeout(deadline);if(this.abort===controller)this.abort=null;}}
 async connect(epoch){
  if(!this.active||epoch!==this.epoch)return;const ticket=++this.ticketCounter;this.ticket=ticket;
  try{
   const health=await this.json(`${this.base}/health`);if(!this.active||epoch!==this.epoch||ticket!==this.ticket)return;
   if(health.protocol!==SECURE_PROTOCOL_VERSION)throw Error('protocol');
   let token;try{token=this.storage?.getItem(`istanbul-session:${this.base}`);}catch{}
   const session=await this.json(`${this.base}/session`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});if(!this.active||epoch!==this.epoch||ticket!==this.ticket)return;
   if(typeof session.token!=='string'||!/^[a-f0-9]{64}$/.test(session.token)||typeof session.id!=='string')throw Error('auth');
   try{this.storage?.setItem(`istanbul-session:${this.base}`,session.token);}catch{}this.sessionReset=this.joined&&this.peer?.id!==session.id;this.peer={id:session.id};
   const ws=this.ws=new this.Socket(this.base.replace(/^http/,'ws')+'/room');
   this.deadline=this.timers.setTimeout(()=>this.retry('timeout',epoch,ticket),this.options.socketTimeoutMs||12000);
   ws.onopen=()=>{if(this.active&&epoch===this.epoch&&ticket===this.ticket)this.send({t:'auth',v:SECURE_PROTOCOL_VERSION,room:this.room,name:this.name,token:session.token,preferences:this.preferences});};
   ws.onmessage=e=>{if(!this.active||epoch!==this.epoch||ticket!==this.ticket||typeof e.data!=='string')return;try{this.receive(JSON.parse(e.data));}catch{this.retry('network',epoch,ticket);}};
   ws.onclose=e=>{if(!this.active||epoch!==this.epoch||ticket!==this.ticket)return;if([1008,1009].includes(e.code))this.fail('rejected');else this.retry('disconnected',epoch,ticket);};
   ws.onerror=()=>this.retry('network',epoch,ticket);
  }catch(e){if(this.active&&epoch===this.epoch&&ticket===this.ticket){if(['origin','auth','protocol'].includes(e.message))this.fail(e.message);else this.retry('network',epoch,ticket);}}
 }
 stopTransport(){this.ticket=0;this.abort?.abort();this.abort=null;this.timers.clearInterval(this.interval);this.timers.clearTimeout(this.deadline);if(this.ws){this.ws.onclose=this.ws.onmessage=this.ws.onopen=null;this.ws.onerror=()=>{};this.ws.close();this.ws=null;}for(const q of this.requests.values()){this.timers.clearTimeout(q.timer);q.resolve({ok:false,reason:'disconnected'});}this.requests.clear();}
 retry(error,epoch=this.epoch,ticket=this.ticket){
  if(!this.active||epoch!==this.epoch||ticket!==this.ticket)return;
  this.stopTransport();this.frames.clear();this.roster=[];this.seats=[];this.games=null;this.accountSignature=null;this.options.onSeats?.([]);this.options.onSnapshot?.([],null);this.options.onGames?.(null);
  if(!this.joined&&this.now()-this.startedAt>(this.options.wakeTimeoutMs||150000)){this.fail('timeout');return;}
  this.change(this.joined?'reconnecting':'waking',null);
  const base=this.options.retryBaseMs||1000,max=this.options.retryMaxMs||8000,jitter=this.options.random?.()??Math.random();
  const delay=Math.min(max,base*2**Math.min(this.retries++,3))*(.85+jitter*.3);
  this.retryTimer=this.timers.setTimeout(()=>void this.connect(epoch),delay);
 }
 receive(m){
  if(!m||typeof m!=='object')return;
  if(m.t==='error'){if(m.error==='already-connected'){this.retry(m.error);return;}this.fail(m.error);return;}
  if(m.t==='notice'){if(typeof m.text==='string')this.options.onNotice?.(m.text.slice(0,160));return;}
  if(m.t==='welcome'&&m.id===this.peer?.id){
   const spawn=normalizePose(m.pose);if(!spawn||m.room!==this.room||typeof m.bootId!=='string'){this.fail('protocol');return;}
   this.timers.clearTimeout(this.deadline);this.spawn=spawn;this.seq=0;this.life=0;this.retries=0;this.persistent=m.persistent===true;
   const reconnected=this.joined,restarted=this.sessionReset||this.bootId&&this.bootId!==m.bootId;this.bootId=m.bootId;this.joined=true;this.status='connected';this.lastPoseSignature=null;
   // Align the local position before sending movement to the new room authority.
   if(reconnected)this.options.onReconnect?.(spawn);
   if(restarted&&!this.persistent)this.options.onNotice?.('Online session reset. Your solo save is safe.');
   else if(reconnected)this.options.onNotice?.('Reconnected to your room.');
   this.resolveJoin?.(this.snapshot());this.resolveJoin=this.rejectJoin=null;
   this.interval=this.timers.setInterval(()=>this.tick(),80);this.send({t:'preferences',preferences:this.preferences});this.pendingHistory=Array.isArray(m.chat)?m.chat.slice(-30):[];return;
  }
  if(m.t==='result'){if(m.account){this.accountSignature=JSON.stringify(m.account);this.options.onAccount?.(m.account);}const q=this.requests.get(m.request);if(q){this.timers.clearTimeout(q.timer);this.requests.delete(m.request);q.resolve({ok:m.ok===true,reason:m.reason});}return;}
  if(m.t==='correction'){const pose=normalizePose(m.pose);if(pose)this.options.onCorrection?.(pose,m.travel===true);return;}
  if(m.t==='chat'&&validChat(m.message,this.roster)){this.options.onChat?.(m.message);return;}
  if(m.t!=='snapshot'||!validRoster(m.roster)||!m.roster.some(p=>p.id===this.peer?.id))return;
  this.roster=m.roster;const ids=new Set(m.roster.map(p=>p.id));for(const id of this.frames.keys())if(!ids.has(id))this.frames.delete(id);
  for(const f of m.frames||[]){if(!ids.has(f.id)||f.id===this.peer.id)continue;const pose=normalizePose(f.pose),cars=pose&&normalizeCars(f.cars,pose);if(pose&&cars)this.frames.set(f.id,{...f,pose,cars});}
  if(validSeats(m.seats,this.roster)){this.seats=m.seats;this.options.onSeats?.(this.seats);}this.options.onSnapshot?.([...this.frames.values()],m.world);
  if(validCombatSnapshot(m.combat,this.roster)){this.life=m.combat.players.find(p=>p.id===this.peer.id)?.life||0;this.options.onCombat?.(m.combat);}
  if(m.games){this.preferences={...m.games.preferences,showNames:true};this.games={...m.games,preferences:this.preferences};this.options.onGames?.(this.games);}
  if(m.account){const signature=JSON.stringify(m.account);if(signature!==this.accountSignature){this.accountSignature=signature;this.options.onAccount?.(m.account);}}this.change('connected');
  // The chat view resets when onChange announces a new room. Replay its bounded
  // history afterwards so reconnecting players do not lose that history.
  for(const message of this.pendingHistory||[])if(validChat(message,this.roster))this.options.onChat?.(message);this.pendingHistory=[];
 }
 tick(){if(this.status!=='connected')return;const s=this.options.readState?.();if(!s)return;const signature=JSON.stringify(s),now=this.now();if(signature===this.lastPoseSignature&&now-this.lastPoseAt<500)return;if(globalThis.document?.hidden&&now-this.lastPoseAt<500)return;if(this.send({t:'pose',seq:++this.seq,life:this.life||0,...s})){this.lastPoseSignature=signature;this.lastPoseAt=now;}}
 request(m){if(this.status!=='connected')return Promise.resolve({ok:false,reason:'disconnected'});const request=`r-${++this.serial}`;return new Promise(resolve=>{const timer=this.timers.setTimeout(()=>{this.requests.delete(request);resolve({ok:false,reason:'timeout'});},5000);this.requests.set(request,{resolve,timer});if(!this.send({...m,request})){this.timers.clearTimeout(timer);this.requests.delete(request);resolve({ok:false,reason:'network'});}});}
 fire(shot){return this.send({t:'shot',shot});}reload(weapon){return this.send({t:'reload',weapon});}sendChat(text){return this.send({t:'chat',text});}
 requestSeat(owner,model){return this.request({t:'seat',owner,model});}releaseSeat(){return this.send({t:'seat',owner:null});}
 setPreferences(value){Object.assign(this.preferences,value,{showNames:true});return this.send({t:'preferences',preferences:this.preferences});}
 leave(){this.epoch++;this.active=false;this.timers.clearTimeout(this.retryTimer);this.stopTransport();this.rejectJoin?.(Error('cancelled'));this.rejectJoin=this.resolveJoin=null;this.frames.clear();this.roster=[];this.seats=[];this.games=null;this.pendingHistory=[];this.accountSignature=null;this.options.onSeats?.([]);this.options.onSnapshot?.([],null);this.options.onAccount?.(null);this.options.onGames?.(null);this.change('idle');}
 fail(error){const reject=this.rejectJoin;this.rejectJoin=null;this.leave();this.change('error',error);reject?.(Error(error));}
}
