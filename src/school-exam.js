const text=(en,tr)=>Object.freeze({en,tr});
export const SCHOOL_EXAM_ID='fener-exam';
export const SCHOOL_EXAM_PASS=7;
export const SCHOOL_EXAM_GATE=Object.freeze({x:-150,z:-201,radius:3.2});
export const SCHOOL_CERTIFICATE_KEY='sultanahmet-fener-student-v1';
const question=(id,en,tr,options,answer,explanation)=>Object.freeze({id,title:text(en,tr),options:options.map(([en,tr])=>text(en,tr)),answer,explanation:text(...explanation)});
export const SCHOOL_QUESTIONS=Object.freeze([
 question('continents','Which two continents does Istanbul connect?','İstanbul hangi iki kıtayı birbirine bağlar?',[['Europe and Asia','Avrupa ve Asya'],['Africa and Europe','Afrika ve Avrupa'],['Asia and Australia','Asya ve Avustralya'],['Europe and America','Avrupa ve Amerika']],0,['Istanbul has shores in both Europe and Asia.','İstanbul’un Avrupa ve Asya kıtalarında kıyıları vardır.']),
 question('strait','Which strait separates the two sides of Istanbul?','İstanbul’un iki yakasını hangi boğaz ayırır?',[['Dardanelles','Çanakkale Boğazı'],['Bosphorus','İstanbul Boğazı'],['Gibraltar','Cebelitarık Boğazı'],['Bering Strait','Bering Boğazı']],1,['The Bosphorus separates Istanbul’s European and Asian sides.','İstanbul Boğazı, şehrin Avrupa ve Anadolu yakalarını ayırır.']),
 question('school','What is the most distinctive exterior colour of this school?','Bu lisenin dış cephesinin en belirgin rengi hangisi?',[['White','Beyaz'],['Blue','Mavi'],['Brick red','Kiremit kırmızısı'],['Yellow','Sarı']],2,['The school’s red brick facade gives it its striking appearance.','Lisenin kırmızı tuğla cephesi ona dikkat çekici görünümünü verir.']),
 question('tower','Where does Maiden’s Tower stand?','Kız Kulesi nerede bulunur?',[['On a small island','Küçük bir ada üzerinde'],['On a mountain','Bir dağın zirvesinde'],['Inside a shopping mall','Bir alışveriş merkezinde'],['In a forest','Bir ormanda']],0,['Maiden’s Tower stands on a small island in the sea.','Kız Kulesi denizdeki küçük bir adanın üzerindedir.']),
 question('math','A class has 6 rows with 4 students in each. How many students are there?','Bir sınıfta 6 sıra, her sırada 4 öğrenci var. Toplam kaç öğrenci var?',[['18','18'],['20','20'],['28','28'],['24','24']],3,['6 × 4 = 24 students.','6 × 4 = 24 öğrenci.']),
 question('bridge','Which waterway does Galata Bridge cross?','Galata Köprüsü hangi suyun üzerinden geçer?',[['Black Sea','Karadeniz'],['Golden Horn','Haliç'],['Lake Van','Van Gölü'],['Mediterranean','Akdeniz']],1,['Galata Bridge crosses the Golden Horn.','Galata Köprüsü Haliç’in üzerinden geçer.']),
 question('sequence','What comes next: 3, 6, 12, 24, …?','3, 6, 12, 24, … dizisinde sıradaki sayı kaçtır?',[['30','30'],['36','36'],['48','48'],['42','42']],2,['Each number is twice the previous one.','Her sayı bir öncekinin iki katıdır.']),
 question('traffic','What should a driver do at a red traffic light?','Kırmızı trafik ışığında sürücü ne yapmalıdır?',[['Stop','Durmalı'],['Accelerate','Hızlanmalı'],['Sound the horn and continue','Korna çalıp geçmeli'],['Close their eyes','Gözlerini kapatmalı']],0,['A red light means stop.','Kırmızı ışık dur anlamına gelir.']),
 question('clock','An exam starts at 10:20 and lasts 35 minutes. When does it finish?','10.20’de başlayan sınav 35 dakika sürerse kaçta biter?',[['10:45','10.45'],['11:05','11.05'],['10:50','10.50'],['10:55','10.55']],3,['20 + 35 = 55, so it finishes at 10:55.','20 + 35 = 55; sınav 10.55’te biter.']),
 question('mosques','Which city is home to both Hagia Sophia and the Blue Mosque?','Ayasofya ve Sultanahmet Camii hangi şehirdedir?',[['Ankara','Ankara'],['Istanbul','İstanbul'],['Izmir','İzmir'],['Bursa','Bursa']],1,['Both landmarks are in Istanbul’s historic peninsula.','İki yapı da İstanbul’un tarihî yarımadasındadır.']),
]);
export function schoolGateInReach(p){return !!p&&p.location==='outside'&&['walk','exam'].includes(p.mode)&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&Math.hypot(p.x-SCHOOL_EXAM_GATE.x,p.z-SCHOOL_EXAM_GATE.z)<=SCHOOL_EXAM_GATE.radius;}

// A single answer can be accepted per question. Currency still goes through
// the existing mission reward ledger, so retries and reloads never pay twice.
export function createSchoolExam({missions,storage,now=()=>new Date().toISOString()}={}){
 if(storage===undefined){try{storage=globalThis.localStorage}catch{storage=null}}
 let certificate=null,attempt=null;
 try{const saved=JSON.parse(storage?.getItem(SCHOOL_CERTIFICATE_KEY)||'null');if(saved?.version===1&&Number.isInteger(saved.score)&&saved.score>=SCHOOL_EXAM_PASS&&saved.score<=10&&typeof saved.date==='string'&&!Number.isNaN(Date.parse(saved.date)))certificate={score:saved.score,date:saved.date};}catch{}
 function hasPassed(){return missions.snapshot().completed.includes(SCHOOL_EXAM_ID);}
 function getCertificate(){return hasPassed()?certificate||{score:null,date:null}:null;}
 function snapshot(){return{index:attempt?.index??0,answered:!!attempt&&attempt.answers.length>attempt.index,answer:attempt?.answers[attempt.index]??null,score:attempt?.score??0,result:attempt?.result??null,certificate:getCertificate()};}
 function start(p){if(!schoolGateInReach(p)||p.mode!=='walk')return false;attempt={index:0,answers:[],score:0,result:null};missions.beginExam?.();return true;}
 function answer(choice){if(!attempt||attempt.result||attempt.answers.length>attempt.index||!Number.isInteger(choice)||choice<0||choice>3)return false;missions.answerExam?.(attempt.index,choice);attempt.answers.push(choice);if(choice===SCHOOL_QUESTIONS[attempt.index].answer)attempt.score++;return true;}
 function next(p){
  if(!attempt||attempt.result||attempt.answers.length!==attempt.index+1||!schoolGateInReach(p))return false;
  if(attempt.index<9){attempt.index++;return true;}
  const passed=attempt.score>=SCHOOL_EXAM_PASS;
  const paid=passed?missions.completeSchoolExam(attempt.score,p):{ok:false};
  const score=attempt.score;const saveCertificate=()=>{if(!hasPassed())return;certificate={score,date:now()};try{storage?.setItem(SCHOOL_CERTIFICATE_KEY,JSON.stringify({version:1,...certificate}))}catch{}};
  if(passed){saveCertificate();paid.confirmation?.then(result=>{if(result.ok)saveCertificate();});}
  attempt.result={passed,score:attempt.score,reward:paid.reward||0};return true;
 }
 return {start,answer,next,snapshot,cancel(){attempt=null;},hasPassed,getCertificate};
}
