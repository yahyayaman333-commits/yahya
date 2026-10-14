export const PAINT_PRICE=50;
export const CAR_COLORS=Object.freeze({gray:0x9da5ac,black:0x15191f,red:0xb41624,blue:0x164fac,white:0xf2f2ed,silver:0xc4c8cc,graphite:0x41484f,green:0x125b41,yellow:0xe5bb25,orange:0xe25d1d,purple:0x653a91,burgundy:0x651d32});
export const CAR_COLOR_NAMES=Object.freeze({gray:['Gray','Gri'],black:['Black','Siyah'],red:['Red','Kırmızı'],blue:['Blue','Mavi'],white:['White','Beyaz'],silver:['Silver','Gümüş'],graphite:['Graphite','Antrasit'],green:['Emerald','Zümrüt'],yellow:['Yellow','Sarı'],orange:['Orange','Turuncu'],purple:['Purple','Mor'],burgundy:['Burgundy','Bordo']});
export const CAR_MODELS=['bmw-m6','audi-r8','mercedes-amg','koenigsegg-jesko','vw-golf-r','vw-passat'];
export const AUDI_PRICE=50;
export const MERCEDES_PRICE=200;
import {HOMES} from './homes.js';
import {MISSION_REWARDS} from './mission-catalog.js';
import {DEFAULT_CAR_PLATES,validPlateText} from './plate-text.js';
export const GARAGE_STORAGE_KEY='sultanahmet-garage-v1';
const clampNumber=(value,max)=>Number.isFinite(value)&&value>=0?Math.min(value,max):0;

// Currency comes from driving, completed missions, and confirmed NPC kills. It has no real
// money value and is stored locally alongside the player's exploration save.
export function createGarageEconomy({storage}={}){
  if(storage===undefined){try{storage=globalThis.localStorage??null}catch{storage=null}}
  let online=null,paints=Object.fromEntries(CAR_MODELS.map(id=>[id,'gray']));
  let completedMissions=[],npcKillRewards=[];
  const plates={...DEFAULT_CAR_PLATES};
  let wallet=0,audiOwned=false,owned=false,homesOwned=[],distanceMeters=0,roadRemainder=0,highwayRemainder=0;
  try{
    const saved=JSON.parse(storage?.getItem(GARAGE_STORAGE_KEY)||'null');
    if([1,2,3,4,5,6,7].includes(saved?.version)){for(const id of CAR_MODELS)if(Object.hasOwn(CAR_COLORS,saved.paints?.[id]))paints[id]=saved.paints[id];if(!saved.paints?.['vw-passat']&&Object.hasOwn(CAR_COLORS,saved.paints?.['togg-t10x']))paints['vw-passat']=saved.paints['togg-t10x'];for(const id of CAR_MODELS)plates[id]=validPlateText(saved.plates?.[id])||DEFAULT_CAR_PLATES[id];wallet=Math.floor(clampNumber(saved.wallet,1000000));owned=saved.owned===true;
      audiOwned=saved.version>=2&&saved.audiOwned===true;
      homesOwned=saved.version>=3&&Array.isArray(saved.homesOwned)?saved.homesOwned.filter(id=>HOMES.some(home=>home.id===id)):[];
      distanceMeters=clampNumber(saved.distanceMeters,100000000);roadRemainder=clampNumber(saved.roadRemainder,20);
      highwayRemainder=clampNumber(saved.highwayRemainder,20);
      npcKillRewards=Array.isArray(saved.npcKillRewards)?[...new Set(saved.npcKillRewards.filter(id=>typeof id==='string'&&/^[-a-zA-Z0-9_]{1,140}$/.test(id)))].slice(-4096):[];
      completedMissions=Array.isArray(saved.completedMissions)?[...new Set(saved.completedMissions.filter(id=>Object.hasOwn(MISSION_REWARDS,id)))]:[];}
  }catch{}
  function persist(){try{storage?.setItem(GARAGE_STORAGE_KEY,JSON.stringify({version:7,npcKillRewards,completedMissions,paints,plates,wallet,audiOwned,owned,homesOwned,distanceMeters,roadRemainder,highwayRemainder}))}catch{};return snapshot()}
  function snapshot(){const s={completedMissions:[...completedMissions],paints:{...paints},plates:{...plates},wallet,audiOwned,owned,homesOwned:[...homesOwned],distanceMeters,audiPrice:AUDI_PRICE,audiRemaining:Math.max(0,AUDI_PRICE-wallet),price:MERCEDES_PRICE,remaining:Math.max(0,MERCEDES_PRICE-wallet)};if(online){const a=online.read();return {...s,...a,completedMissions:[...(a.completedMissions||[])],audiRemaining:Math.max(0,AUDI_PRICE-a.wallet),remaining:Math.max(0,MERCEDES_PRICE-a.wallet)};}return s;}
  function recordDrive(meters,{speedKmh=0,highway=false}={}){
    if(online)return 0;
    if(!Number.isFinite(meters)||meters<=0||!Number.isFinite(speedKmh)||speedKmh<5)return 0;
    const valid=Math.min(meters,12);distanceMeters+=valid;
    if(highway)highwayRemainder+=valid;else roadRemainder+=valid;
    const units=Math.floor((highway?highwayRemainder:roadRemainder)/20);
    if(!units)return 0;
    if(highway)highwayRemainder-=units*20;else roadRemainder-=units*20;
    const earned=units*(highway?4:2);wallet=Math.min(1000000,wallet+earned);persist();return earned;
  }
  function awardMission(id){
    if(online){const confirmation=online.action({t:'mission-complete',mission:id});return {ok:true,reward:0,pending:true,confirmation};}
    if(!Object.hasOwn(MISSION_REWARDS,id)||completedMissions.includes(id))return {ok:false};
    const reward=MISSION_REWARDS[id];completedMissions.push(id);wallet=Math.min(1000000,wallet+reward);persist();return {ok:true,reward};
  }
  function awardNpcKill(id){
    if(online)return {ok:false};
    if(typeof id!=='string'||!/^[-a-zA-Z0-9_]{1,140}$/.test(id)||npcKillRewards.includes(id))return {ok:false};
    npcKillRewards.push(id);if(npcKillRewards.length>4096)npcKillRewards.shift();wallet=Math.min(1000000,wallet+50);persist();return {ok:true,reward:50};
  }
  function buyAudi(){
    if(online)return online.action({t:'account',action:'buy',model:'audi-r8'});
    if(audiOwned)return {ok:false,message:'Avero R8 zaten garajında.'};
    if(wallet<AUDI_PRICE)return {ok:false,message:`Avero R8 için ${AUDI_PRICE-wallet} $ daha sürüş kazancı gerekli.`};
    wallet-=AUDI_PRICE;audiOwned=true;persist();return {ok:true,message:'Avero R8 satın alındı. Aracın yanında E ile binebilirsin.'};
  }
  function buyMercedes(){
    if(online)return online.action({t:'account',action:'buy',model:'mercedes-amg'});
    if(owned)return {ok:false,message:'Meridian GT zaten garajında.'};
    if(wallet<MERCEDES_PRICE)return {ok:false,message:`Meridian için ${MERCEDES_PRICE-wallet} $ daha sürüş kazancı gerekli.`};
    wallet-=MERCEDES_PRICE;owned=true;persist();return {ok:true,message:'Meridian GT satın alındı. Galeride E ile binebilirsin.'};
  }
  function buyHome(id){
    if(online)return online.action({t:'account',action:'home',home:id});
    const home=HOMES.find(entry=>entry.id===id);
    if(!home)return {ok:false,message:'Ev bulunamadı.'};
    if(homesOwned.includes(id))return {ok:false,message:`${home.name} zaten senin.`};
    if(wallet<home.price)return {ok:false,message:`${home.name} için ${home.price-wallet} $ daha sürüş kazancı gerekli.`};
    wallet-=home.price;homesOwned.push(id);persist();
    return {ok:true,message:`${home.name} satın alındı. Evler bölümünden evine gidebilirsin.`};
  }
  function repaint(model,color){
    if(online)return online.action({t:'account',action:'paint',model,color});
    if(!CAR_MODELS.includes(model)||!Object.hasOwn(CAR_COLORS,color))return {ok:false,reason:'invalid'};
    if(model==='audi-r8'&&!audiOwned||model==='mercedes-amg'&&!owned)return {ok:false,reason:'locked'};
    if(paints[model]===color)return {ok:false,reason:'same'};
    if(wallet<PAINT_PRICE)return {ok:false,reason:'funds'};
    wallet-=PAINT_PRICE;paints[model]=color;persist();return {ok:true};
  }
  function setPlate(model,value){
    if(online)return online.action({t:'account',action:'plate',model,text:value});
    const text=validPlateText(value);
    if(!CAR_MODELS.includes(model)||!text)return {ok:false,reason:'invalid'};
    if(model==='audi-r8'&&!audiOwned||model==='mercedes-amg'&&!owned)return {ok:false,reason:'locked'};
    if(plates[model]===text)return {ok:false,reason:'same'};
    plates[model]=text;persist();return {ok:true};
  }
  return {snapshot,persist,awardMission,awardNpcKill,recordDrive,buyAudi,buyMercedes,buyHome,repaint,setPlate,setOnlineAccount(value){online=value;},beginMission(id){online?.action({t:'mission-start',mission:id});},cancelMission(){online?.action({t:'mission-cancel'});},beginExam(){online?.action({t:'exam-start'});},answerExam(index,choice){online?.action({t:'exam-answer',index,choice});}};
}
