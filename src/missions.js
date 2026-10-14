import {MISSIONS,MISSION_POINTS} from './mission-catalog.js';
import {SCHOOL_EXAM_ID,SCHOOL_EXAM_PASS,schoolGateInReach} from './school-exam.js';
export const MISSION_STORAGE_KEY='sultanahmet-missions-v1';
// Economy owns the paid-reward ledger. A reload between reward and mission-save
// writes cannot duplicate a reward. Only physical gameplay events advance tasks.
export function createMissions({garage,storage,onEvent=()=>{}}){
 if(storage===undefined){try{storage=globalThis.localStorage}catch{storage=null}}
 let active=null,previous=null,saveAge=0;
 const completed=()=>garage.snapshot().completedMissions;
 try{const s=JSON.parse(storage?.getItem(MISSION_STORAGE_KEY)||'null'),m=MISSIONS.find(m=>m.id===s?.active?.id);if(s?.version===1&&m&&!completed().includes(m.id)){
  const a=s.active;active={id:m.id,stage:Number.isInteger(a.stage)?Math.max(0,Math.min(m.objectives.length-1,a.stage)):0,elapsed:Number.isFinite(a.elapsed)?Math.max(0,Math.min(300,a.elapsed)):0,travel:Number.isFinite(a.travel)?Math.max(0,Math.min(10000,a.travel)):0,hold:0};
 }}catch{}
 function persist(){try{storage?.setItem(MISSION_STORAGE_KEY,JSON.stringify({version:1,active}))}catch{}}
 function snapshot(){const m=MISSIONS.find(m=>m.id===active?.id);return {active:active?{...active,target:MISSION_POINTS[m.targets[active.stage]]}:null,completed:completed()};}
 function start(id){if(active||completed().includes(id)||!MISSIONS.some(m=>m.id===id))return false;active={id,stage:0,elapsed:0,travel:0,hold:0};previous=null;saveAge=0;garage.beginMission?.(id);persist();return true;}
 function cancel(reason='cancelled'){if(!active)return false;const id=active.id;active=null;previous=null;garage.cancelMission?.();persist();onEvent({type:reason,id});return true;}
 function finish(){if(!active)return false;const id=active.id,r=garage.awardMission(id);active=null;previous=null;persist();if(r.ok)onEvent({type:'completed',id,reward:r.reward});return r.ok;}
 function advance(){active.stage++;active.travel=active.hold=active.elapsed=0;previous=null;persist();onEvent({type:'stage',id:active.id,stage:active.stage});}
 function visit(id){
  previous=null;if(!active)return false;
  const a=active;
  if(a.id==='hagia-visit'&&id==='ayasofya')return finish();
  if(a.id==='church-sprint'){if(!a.stage&&id==='sultanahmet')advance();else if(a.stage&&id==='chapel'&&a.elapsed<=300&&a.travel>=100)return finish();}
  if(a.id==='mosque-route'){if(!a.stage&&id==='ayasofya')advance();else if(a.stage&&id==='sultanahmet'&&a.travel>=35)return finish();}
  return false;
 }
 function fastTravel(){previous=null;if(active&&['church-sprint','mosque-route','taxi-ride'].includes(active.id))cancel('fast-travel');}
 function resetPosition(){previous=null;}
 function step(dt,p){
  if(!active||!p||!['walk','drive'].includes(p.mode)||!Number.isFinite(dt)||dt<=0){previous=null;return;}
  const a=active;const outdoors=p.location==='outside';
  const delta=outdoors&&previous?.location==='outside'?Math.hypot(p.x-previous.x,p.z-previous.z):0;
  const valid=Number.isFinite(delta)&&delta<=Math.max(2,dt*100+1);
  if(!valid){fastTravel();previous={...p};return;}
  a.travel+=delta;previous={...p};
  if(a.id==='church-sprint'&&a.stage){a.elapsed+=dt;if(a.elapsed>300){cancel('expired');return;}}
  if(a.id==='speed-250'){
   const qualifies=outdoors&&p.mode==='drive'&&!p.bus&&p.forward&&p.highway&&p.speedKmh>=249.5&&delta>(p.motionDt||dt)*40;
   a.hold=qualifies?a.hold+dt:0;if(a.hold>=2&&a.travel>=80){finish();return;}
  }
  if(a.id==='taxi-ride'){
   const t=MISSION_POINTS[a.stage?'dropoff':'pickup'];
   const stopped=outdoors&&p.mode==='drive'&&!p.bus&&p.speedKmh<3&&Math.hypot(p.x-t.x,p.z-t.z)<10;
   a.hold=stopped?a.hold+dt:0;
   if(!a.stage&&a.hold>=1)advance();else if(a.stage&&a.hold>=2&&a.travel>=300){finish();return;}
  }
  saveAge+=dt;if(saveAge>=5){saveAge=0;persist();}
 }
 function collectPhone(p){const t=MISSION_POINTS.phone;return active?.id==='lost-phone'&&p?.mode==='walk'&&p.location==='outside'&&Math.hypot(p.x-t.x,p.z-t.z)<=2.4?finish():false;}
 function photo(id,p){return active?.id==='hagia-photo'&&id==='ayasofya'&&p?.mode==='photo'&&(p.location==='ayasofya'||p.location==='outside'&&Math.hypot(p.x,p.z+35.1)<100)?finish():false;}
 function completeSchoolExam(score,p){
  if(!Number.isInteger(score)||score<SCHOOL_EXAM_PASS||score>10||!schoolGateInReach(p))return{ok:false};
  const result=garage.awardMission(SCHOOL_EXAM_ID);
  if(active?.id===SCHOOL_EXAM_ID){active=null;previous=null;persist();}
  if(result.ok)onEvent({type:'completed',id:SCHOOL_EXAM_ID,reward:result.reward});
  return result;
 }
 return {snapshot,start,cancel,persist,visit,step,collectPhone,photo,fastTravel,resetPosition,completeSchoolExam,beginExam:()=>garage.beginExam?.(),answerExam:(i,c)=>garage.answerExam?.(i,c)};
}
