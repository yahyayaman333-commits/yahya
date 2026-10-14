import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {isIP} from 'node:net';
import {readFile,stat,realpath} from 'node:fs/promises';
import {resolve,relative,extname} from 'node:path';
import {WebSocketServer} from 'ws';
import {AccountStore} from './account-store.mjs';
import {RoomAuthority} from './room-authority.mjs';
import {ROOM_NUMBERS,ROOM_CAPACITY,SECURE_PROTOCOL_VERSION} from '../src/multiplayer-protocol.js';

// TRUST_PROXY is for Render's TLS-terminating proxy; never expose that listener directly.
// Memory is the default. DATA_DIR is an optional, explicit self-hosted feature.
export async function createGameServer({port=Number(process.env.PORT||8787),host=process.env.HOST||'0.0.0.0',origins=(process.env.ALLOWED_ORIGINS||'https://istanbuloyun.netlify.app').split(','),trustProxy=process.env.TRUST_PROXY==='1',allowLocal=!trustProxy,pvp=process.env.PVP_ALLOWED!=='0',directory=process.env.STORAGE_MODE==='memory'||process.env.RENDER?null:process.env.DATA_DIR||null,staticDir=process.env.STATIC_DIR,world,now=Date.now,heartbeatMs=10000}={}){
 origins=origins.map(x=>x.trim()).filter(Boolean);
 for(const origin of origins){const u=new URL(origin);if(u.origin!==origin||u.protocol!=='https:'&&!allowLocal)throw Error('ALLOWED_ORIGINS must contain exact HTTPS origins');}
 world??=JSON.parse(await readFile(new URL('./world.json',import.meta.url),'utf8'));
 const bootId=randomUUID(),accounts=new AccountStore({directory,now});await accounts.load();
 const rooms=new Map(),active=new Map(),ipRates=new Map(),peers=new Set(),sockets=new Set();let closing=false;
 const local=req=>allowLocal&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
 const originAllowed=req=>origins.includes(req.headers.origin)||local(req)&&/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(req.headers.origin||'');
 const secure=req=>local(req)||req.socket.encrypted||trustProxy&&req.headers['x-forwarded-proto']==='https';
 const clientIP=req=>{const last=trustProxy&&String(req.headers['x-forwarded-for']||'').split(',').at(-1).trim();return last&&isIP(last)?last:req.socket.remoteAddress;};
 function allowedRate(req,kind,limit){const key=`${kind}:${clientIP(req)}`,time=now();let rate=ipRates.get(key);if(!rate||time-rate.at>=60000)rate={at:time,count:0};if(ipRates.size>=10000&&!ipRates.has(key))return false;ipRates.set(key,rate);return ++rate.count<=limit;}
 const response=(res,status,data,origin)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})});res.end(JSON.stringify(data));};
 const server=http.createServer(async(req,res)=>{try{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/health'){
   if(req.headers.origin&&!originAllowed(req)){response(res,403,{error:'origin'});return;}
   if(!['GET','HEAD'].includes(req.method)){response(res,405,{error:'method'});return;}
   response(res,closing?503:200,{ok:!closing,protocol:SECURE_PROTOCOL_VERSION,bootId,rooms:rooms.size,players:active.size,roomCount:ROOM_NUMBERS.length,roomCapacity:ROOM_CAPACITY,storage:directory?'disk':'memory',persistent:!!directory},req.headers.origin);return;
  }
  if(path==='/session'){
   if(!originAllowed(req)||!secure(req)){response(res,403,{error:'origin-or-tls'});return;}
   if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':req.headers.origin,'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600','Vary':'Origin'});res.end();return;}
   if(req.method!=='POST'){response(res,405,{error:'method'},req.headers.origin);return;}
   if(closing){response(res,503,{error:'restarting'},req.headers.origin);return;}
   if(!allowedRate(req,'session',120)){response(res,429,{error:'rate-limit'},req.headers.origin);return;}
   if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||'')){response(res,415,{error:'content-type'},req.headers.origin);return;}
   const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>1024){response(res,413,{error:'payload'},req.headers.origin);return;}chunks.push(chunk);}
   const input=JSON.parse(Buffer.concat(chunks).toString()||'{}');
   if(!input||Array.isArray(input)||typeof input!=='object'||Object.keys(input).some(k=>k!=='token')||input.token!=null&&(typeof input.token!=='string'||!/^[a-f0-9]{64}$/.test(input.token))){response(res,400,{error:'invalid-session'},req.headers.origin);return;}
   let session;try{session=accounts.session(input.token);}catch{response(res,503,{error:'session-capacity'},req.headers.origin);return;}
   response(res,200,{token:session.token,id:session.account.id,bootId,persistent:!!directory},req.headers.origin);return;
  }
  // Only local QA servers expose their URL; production game config is separate.
  if(path==='/multiplayer-config.json'&&staticDir&&local(req)){response(res,200,{serverUrl:`http://127.0.0.1:${server.address().port}`});return;}
  if(staticDir&&['GET','HEAD'].includes(req.method)){
   const root=await realpath(resolve(staticDir)),target=await realpath(resolve(root,`.${decodeURIComponent(path==='/'?'/index.html':path)}`)).catch(()=>null);
   if(!target||relative(root,target).startsWith('..')||relative(root,target).includes(':')||!(await stat(target)).isFile()){res.writeHead(404);res.end();return;}
   const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.gz':'application/gzip'};
   res.writeHead(200,{'Content-Type':types[extname(target)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});if(req.method==='HEAD')res.end();else {const {createReadStream}=await import('node:fs');createReadStream(target).pipe(res);}return;
  }
  response(res,404,{error:'not-found'});
 }catch{if(!res.headersSent)response(res,400,{error:'invalid-request'},originAllowed(req)?req.headers.origin:undefined);else res.end();}});
 server.requestTimeout=10000;server.headersTimeout=10000;server.maxHeadersCount=50;
 const wss=new WebSocketServer({noServer:true,maxPayload:8192,perMessageDeflate:false});
 server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
 server.on('upgrade',(req,socket,head)=>{
  const forbidden=req.url!=='/room'||!originAllowed(req)||!secure(req);
  const status=forbidden?403:closing||peers.size>=50?503:!allowedRate(req,'upgrade',120)?429:0;
  if(status){socket.write(`HTTP/1.1 ${status} Rejected\r\nConnection: close\r\n\r\n`);socket.destroy();return;}
  wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
 });
 wss.on('connection',ws=>{
  peers.add(ws);let member=null,room=null,invalid=0,invalidAt=now(),alive=true;
  const reject=limit=>{if(now()-invalidAt>10000){invalid=0;invalidAt=now();}if(++invalid>limit)ws.close(1008,'invalid-or-rate-limited');};
  const send=data=>{if(ws.readyState!==1)return;if(ws.bufferedAmount>65536){ws.close(1013,'slow-client');return;}ws.send(JSON.stringify(data));};
  const timeout=setTimeout(()=>{if(!member)ws.close(1008,'auth-timeout');},5000);timeout.unref();
  ws.on('pong',()=>alive=true);ws.heartbeat=()=>{if(!alive){ws.terminate();return;}alive=false;ws.ping();};
  ws.on('message',(raw,binary)=>{try{
   if(binary)throw Error('binary');const m=JSON.parse(raw.toString());
   if(!m||Array.isArray(m)||typeof m!=='object')throw Error('object');
   if(!member){
    if(m.t!=='auth'||Object.keys(m).some(k=>!['t','v','room','name','token','preferences'].includes(k)))throw Error('auth');
    if(m.preferences!==undefined&&(!m.preferences||Array.isArray(m.preferences)||typeof m.preferences!=='object'||Object.keys(m.preferences).some(k=>!['pvp','raceInvites','showNames'].includes(k))||Object.values(m.preferences).some(v=>typeof v!=='boolean')))throw Error('preferences');
    if(m.v!==SECURE_PROTOCOL_VERSION||!ROOM_NUMBERS.includes(m.room)){send({t:'error',error:m.v!==SECURE_PROTOCOL_VERSION?'protocol':'invalid-room'});ws.close(1008);return;}
    const account=accounts.authenticate(m.token);if(!account){send({t:'error',error:'auth'});ws.close(1008);return;}
    if(active.has(account.id)){send({t:'error',error:'already-connected'});ws.close(1008);return;}
    room=rooms.get(m.room);if(!room){room=new RoomAuthority(m.room,{world,accounts,now,pvp});rooms.set(m.room,room);}
    const joined=room.join(account,m.name,send);if(!joined.ok){send({t:'error',error:joined.error});ws.close(1008);if(!room.players.size)rooms.delete(room.number);return;}
    member=joined.player;if(m.preferences)room.command(member.id,{t:'preferences',preferences:m.preferences});active.set(member.id,ws);clearTimeout(timeout);
    send({t:'welcome',id:member.id,room:m.room,slot:member.slot,chat:room.chat,pose:member.pose,bootId,persistent:!!directory});send(room.snapshot(member.id));return;
   }
   if(!room.command(member.id,m))reject(100);
  }catch{reject(10);}});
  ws.on('error',()=>{});ws.on('close',()=>{clearTimeout(timeout);peers.delete(ws);if(member){active.delete(member.id);room.leave(member.id);if(!room.players.size)rooms.delete(room.number);}});
 });
 const broadcast=setInterval(()=>{for(const room of rooms.values()){room.tick();for(const p of room.players.values())p.send(room.snapshot(p.id));}},80);broadcast.unref();
 const upkeep=setInterval(()=>{for(const ws of peers)ws.heartbeat();for(const [ip,r]of ipRates)if(now()-r.at>=60000)ipRates.delete(ip);accounts.prune(new Set(active.keys()));accounts.flush().catch(e=>console.error('Account save failed:',e.code));},heartbeatMs);upkeep.unref();
 await new Promise((r,j)=>{server.once('error',j);server.listen(port,host,r);});
 return {server,accounts,rooms,bootId,address:server.address(),async close(){if(closing)return;closing=true;clearInterval(broadcast);clearInterval(upkeep);for(const ws of peers)ws.close(1012,'server-restarting');const force=setTimeout(()=>{for(const ws of peers)ws.terminate();},250);force.unref();await new Promise(r=>wss.close(r));clearTimeout(force);await accounts.flush();server.closeIdleConnections();await new Promise(r=>server.close(r));for(const s of sockets)s.destroy();rooms.clear();active.clear();}};
}
