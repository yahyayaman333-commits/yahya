import {randomBytes,createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {CAR_MODELS,CAR_COLORS} from '../src/garage-economy.js';
import {DEFAULT_CAR_PLATES,validPlateText} from '../src/plate-text.js';
import {HOMES} from '../src/homes.js';
const digest=token=>createHash('sha256').update(token).digest('hex');
export class AccountStore {
 constructor({directory=null,now=Date.now}={}){this.directory=directory;this.now=now;this.accounts=new Map();this.dirty=false;this.saving=null;this.ttl=directory?365*86400000:6*3600000;}
 async load(){if(!this.directory)return;await mkdir(this.directory,{recursive:true});try{const data=JSON.parse(await readFile(`${this.directory}/accounts.json`,'utf8'));for(const a of data)if(typeof a.key==='string'&&a.expires>this.now())this.accounts.set(a.key,a);}catch(e){if(e.code!=='ENOENT')throw e;}}
 session(token){if(typeof token==='string'&&/^[a-f0-9]{64}$/.test(token)){const a=this.accounts.get(digest(token));if(a&&a.expires>this.now()){a.expires=this.now()+this.ttl;this.dirty=true;return {token,account:a};}}for(const [key,a]of this.accounts)if(a.expires<this.now())this.accounts.delete(key);if(this.accounts.size>=1000)throw new Error('session-capacity');token=randomBytes(32).toString('hex');const account={key:digest(token),id:`p-${randomBytes(12).toString('hex')}`,expires:this.now()+this.ttl,wallet:100,audiOwned:false,owned:false,homesOwned:[],paints:Object.fromEntries(CAR_MODELS.map(m=>[m,'gray'])),plates:{...DEFAULT_CAR_PLATES},rewards:[]};this.accounts.set(account.key,account);this.dirty=true;return {token,account};}
 authenticate(token){if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return null;const a=this.accounts.get(digest(token));return a&&a.expires>this.now()?a:null;}
 owns(a,m){return CAR_MODELS.includes(m)&&(m!=='audi-r8'||a.audiOwned)&&(m!=='mercedes-amg'||a.owned);}
 snapshot(a){return {wallet:a.wallet,audiOwned:a.audiOwned,owned:a.owned,homesOwned:[...a.homesOwned],paints:{...a.paints},plates:{...a.plates},completedMissions:[...(a.completedMissions||[])],online:true,persistent:!!this.directory};}
 award(a,event,value){if(!Number.isInteger(value)||value<0||value>1000||a.rewards.includes(event))return false;a.rewards.push(event);if(a.rewards.length>4096)a.rewards.shift();a.wallet=Math.min(1000000,a.wallet+value);a.revision=(a.revision||0)+1;this.dirty=true;return true;}
 action(a,request){let price=0,change;
  if(request.action==='buy'&&['audi-r8','mercedes-amg'].includes(request.model)){if(this.owns(a,request.model))return false;price=request.model==='audi-r8'?50:200;change=()=>a[request.model==='audi-r8'?'audiOwned':'owned']=true;}
  else if(request.action==='paint'&&this.owns(a,request.model)&&Object.hasOwn(CAR_COLORS,request.color)&&a.paints[request.model]!==request.color){price=50;change=()=>a.paints[request.model]=request.color;}
  else if(request.action==='plate'&&this.owns(a,request.model)&&validPlateText(request.text)){change=()=>a.plates[request.model]=validPlateText(request.text);}
  else if(request.action==='home'){const home=HOMES.find(h=>h.id===request.home);if(!home||a.homesOwned.includes(home.id))return false;price=home.price;change=()=>a.homesOwned.push(home.id);}
  if(!change||a.wallet<price)return false;a.wallet-=price;change();a.revision=(a.revision||0)+1;this.dirty=true;return true;
 }
 prune(active=new Set()){for(const [key,a]of this.accounts){if(active.has(a.id))a.expires=this.now()+this.ttl;else if(a.expires<=this.now())this.accounts.delete(key);}}
 async flush(){if(!this.directory||!this.dirty)return;if(this.saving){await this.saving;return this.flush();}this.dirty=false;const content=JSON.stringify([...this.accounts.values()]);this.saving=(async()=>{try{await writeFile(`${this.directory}/accounts.tmp`,content,{mode:0o600});await rename(`${this.directory}/accounts.tmp`,`${this.directory}/accounts.json`);}catch(e){this.dirty=true;throw e;}finally{this.saving=null;}})();return this.saving;}
}
