import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {performance,monitorEventLoopDelay} from 'node:perf_hooks';
import WebSocket from 'ws';
import {createGameServer} from '../index.mjs';
import {SECURE_PROTOCOL_VERSION,validRoster} from '../../src/multiplayer-protocol.js';
import {RACE_TRACKS} from '../../src/race-rules.js';
import {SecureRoom} from '../../src/secure-room.js';
const world={bounds:{minX:-400,maxX:2075,minZ:-530,maxZ:400},peninsula:[[-400,-530],[830,-530],[830,146],[-400,146]],colliders:[],rooms:{},entrances:[],destinations:[],npcs:[]};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=4000){const end=Date.now()+ms;while(!fn()){if(Date.now()>end)throw Error('condition timeout');await wait(10);}}
function socketClient(base,clients){return async(room,name,token)=>{
 const response=await fetch(base+'/session',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({token})});assert.equal(response.status,200);const session=await response.json();
 const ws=new WebSocket(base.replace('http','ws')+'/room',{origin:base}),messages=[];clients.push(ws);ws.on('error',()=>{});ws.on('message',raw=>messages.push(JSON.parse(raw)));await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
 ws.send(JSON.stringify({t:'auth',v:SECURE_PROTOCOL_VERSION,room,name,token:session.token}));await until(()=>messages.some(m=>m.t==='welcome'||m.t==='error'));return {ws,messages,token:session.token,id:session.id,welcome:messages.find(m=>m.t==='welcome')};
};}

test('25 real WebSocket clients: five isolated rooms, concurrent driving, capacity and load measurements',async()=>{
 const app=await createGameServer({port:0,directory:null}),base=`http://127.0.0.1:${app.address.port}`,clients=[],connect=socketClient(base,clients),lag=monitorEventLoopDelay({resolution:10});lag.enable();let bytes=0,snapshots=0;
 try{
  const members=await Promise.all(Array.from({length:25},(_,i)=>connect(1+Math.floor(i/5),`Player ${i+1}`)));
  for(const n of [1,2,3,4,5]){assert.equal(app.rooms.get(n).players.size,5);assert(validRoster(app.rooms.get(n).roster()));}
  for(const c of members)c.ws.on('message',raw=>{bytes+=raw.length;if(JSON.parse(raw).t==='snapshot')snapshots++;});
  const rejected=await connect(1,'Sixth');assert.equal(rejected.messages.find(m=>m.t==='error').error,'full');
  const wrong=await connect(6,'Wrong room');assert.equal(wrong.messages.find(m=>m.t==='error').error,'invalid-room');
  for(const c of members){c.ws.send(JSON.stringify({t:'travel',destination:RACE_TRACKS[1].id,request:'load-travel'}));await until(()=>c.messages.some(m=>m.t==='result'&&m.request==='load-travel'&&m.ok));c.startPose={...app.rooms.get(c.welcome.room).players.get(c.id).pose};}
  const appearance={model:'bmw-m6',color:'gray',plate:'34ABC12',steer:0,braking:false};
  const start=performance.now(),cpu=process.cpuUsage();
  // Five rooms all drive at the normal 12.5 Hz client cadence for ten seconds.
  for(let seq=1;seq<=125;seq++){
   for(const c of members){const pose={...c.startPose,x:c.startPose.x+seq*.2,mode:'drive',vehicle:appearance,speed:2.5,vx:2.5,vz:0};c.ws.send(JSON.stringify({t:'pose',seq,life:0,pose,cars:[{...pose,model:appearance.model,appearance}]}));}
   await wait(80);
  }
  await until(()=>members.every(c=>app.rooms.get(c.welcome.room).players.get(c.id).pose.x>c.startPose.x+24));
  for(const c of members){const p=app.rooms.get(c.welcome.room).players.get(c.id);assert.equal(p.pose.mode,'drive');assert.equal(p.cars.length,1);assert(c.messages.some(m=>m.t==='snapshot'&&m.frames.some(f=>f.id!==c.id&&f.cars?.length)));}
  members[0].ws.send(JSON.stringify({t:'chat',text:'Room one only'}));await until(()=>members[4].messages.some(m=>m.t==='chat'));assert(!members[5].messages.some(m=>m.t==='chat'));
  members[4].ws.close();await until(()=>app.rooms.get(1).players.size===4);const replacement=await connect(1,'Replacement');assert.equal(replacement.welcome.slot,5);assert.equal(app.rooms.get(1).players.size,5);
  const usage=process.cpuUsage(cpu),duration=performance.now()-start;
  const report={transport:'real HTTP and WebSocket on localhost, shipped map and NPCs',players:25,rooms:5,seconds:duration/1000,snapshots,bytesReceived:bytes,kilobytesPerSecond:bytes/(duration/1000)/1000,cpuMs:(usage.user+usage.system)/1000,rssMB:process.memoryUsage().rss/1e6,eventLoopP95Ms:lag.percentile(95)/1e6,renderFreeTested:false};
  await writeFile(new URL('../../load-test-report.json',import.meta.url),JSON.stringify(report,null,2));console.log('25-player load:',JSON.stringify(report));
 }finally{lag.disable();for(const ws of clients)ws.terminate();await app.close();}
});

test('TLS/proxy, exact CORS origins, JSON size/shape, protocol, malformed packets and message-rate protection',async()=>{
 const app=await createGameServer({port:0,directory:null,world,trustProxy:true,origins:['https://istanbuloyun.netlify.app']}),base=`http://127.0.0.1:${app.address.port}`,clients=[];
 const headers={Origin:'https://istanbuloyun.netlify.app','Content-Type':'application/json','X-Forwarded-Proto':'https','X-Forwarded-For':'203.0.113.1'};
 try{
  const pre=await fetch(base+'/session',{method:'OPTIONS',headers});assert.equal(pre.status,204);assert.equal(pre.headers.get('Access-Control-Allow-Origin'),headers.Origin);
  for(const bad of ['https://istanbuloyun.netlify.app.evil.test','https://evil.test','http://localhost:8888'])assert.equal((await fetch(base+'/session',{method:'POST',headers:{...headers,Origin:bad},body:'{}'})).status,403);
  assert.equal((await fetch(base+'/session',{method:'POST',headers:{...headers,'X-Forwarded-Proto':'http'},body:'{}'})).status,403);
  for(const body of ['[]','null','{"wallet":9000}','{"token":3}','invalid-json'])assert.equal((await fetch(base+'/session',{method:'POST',headers,body})).status,400);
  assert.equal((await fetch(base+'/session',{method:'POST',headers,body:' '.repeat(1025)})).status,413);
  const s=await (await fetch(base+'/session',{method:'POST',headers,body:'{}'})).json();
  const connect=async()=>{const ws=new WebSocket(base.replace('http','ws')+'/room',{headers}),messages=[];clients.push(ws);ws.on('error',()=>{});ws.on('message',raw=>messages.push(JSON.parse(raw)));await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});return {ws,messages};};
  const old=await connect();old.ws.send(JSON.stringify({t:'auth',v:6,room:1,name:'Old',token:s.token}));await until(()=>old.messages.some(m=>m.error==='protocol'));
  const malformed=await connect();for(let i=0;i<11;i++)malformed.ws.send('null');await until(()=>malformed.ws.readyState===3);
  const huge=await connect();huge.ws.send('x'.repeat(8193));await until(()=>huge.ws.readyState===3);
  const flood=await connect();flood.ws.send(JSON.stringify({t:'auth',v:7,room:1,name:'Flood',token:s.token}));await until(()=>flood.messages.some(m=>m.t==='welcome'));for(let i=0;i<200;i++)flood.ws.send(JSON.stringify({t:'money',money:1e6}));await until(()=>flood.ws.readyState===3);assert.equal(app.accounts.authenticate(s.token).wallet,100);
  let limited;for(let i=0;i<121;i++){const r=await fetch(base+'/session',{method:'POST',headers:{...headers,'X-Forwarded-For':'203.0.113.2'},body:'{}'});if(r.status===429){limited=r.status;break;}}assert.equal(limited,429);
  const badSocket=new WebSocket(base.replace('http','ws')+'/room',{headers:{...headers,Origin:'https://evil.test'}});clients.push(badSocket);assert.match(await new Promise(r=>badSocket.once('error',e=>r(e.message))),/403/);
 }finally{for(const ws of clients)ws.terminate();await app.close();}
});

test('real client reconnects after abrupt loss and a server restart; memory resets honestly and no request replays',async()=>{
 let app=await createGameServer({port:0,host:'127.0.0.1',directory:null,world,heartbeatMs:40});const port=app.address.port,base=`http://127.0.0.1:${port}`,states=[],notices=[],accounts=[],poses=[];const values=new Map();
 class BrowserSocket extends WebSocket{constructor(url){super(url,{origin:base});}}
 const client=new SecureRoom({serverUrl:base,fetch:(url,init)=>fetch(url,{...init,headers:{...init.headers,Origin:base}}),WebSocket:BrowserSocket,storage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},retryBaseMs:20,retryMaxMs:50,random:()=>.5,onChange:s=>states.push(s.status),onNotice:s=>notices.push(s),onAccount:a=>accounts.push(a),onReconnect:p=>poses.push(p)});
 try{
  client.setPreferences({pvp:false});await client.join(2,'Reconnect');await until(()=>client.roster.length===1);const id=client.peer.id,boot=app.bootId;assert.equal(app.rooms.get(2).players.get(id).preferences.pvp,false);
  assert((await client.request({t:'account',action:'buy',model:'audi-r8'})).ok);await until(()=>accounts.at(-1)?.wallet===50);
  client.ws.terminate();await until(()=>states.includes('reconnecting')&&poses.length===1);assert.equal(client.peer.id,id);assert.equal(app.rooms.get(2).players.get(id).preferences.pvp,false);assert.equal(app.accounts.authenticate(values.get(`istanbul-session:${base}`)).wallet,50);
  const pending=client.request({t:'account',action:'invalid'});await app.close();await pending;await wait(100);
  app=await createGameServer({port,host:'127.0.0.1',directory:null,world});assert.notEqual(app.bootId,boot);assert.equal(app.rooms.size,0);assert.equal(app.accounts.accounts.size,0);
  await until(()=>client.status==='connected'&&client.peer.id!==id&&poses.length===2);await until(()=>accounts.at(-1)?.wallet===100);assert.equal(accounts.at(-1).persistent,false);assert(notices.some(n=>n.includes('session reset')));assert.equal(client.requests.size,0);assert.equal(client.frames.size,0);
  client.leave();await until(()=>app.rooms.size===0);assert.equal(client.status,'idle');await wait(100);assert.equal(app.rooms.size,0);
 }finally{client.leave();await app.close();}
});
