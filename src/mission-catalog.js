const text=(en,tr)=>Object.freeze({en,tr});
export const MISSION_POINTS=Object.freeze({
 ayasofya:{x:0,z:-35.1,name:text('Hagia Sophia entrance','Ayasofya girişi')},
 sultanahmet:{x:-65,z:55,name:text('Blue Mosque entrance','Sultanahmet Camii girişi')},
 chapel:{x:128,z:67.1,name:text('Cinar Church entrance','Çınar Kilisesi girişi')},
 pickup:{x:53,z:110,name:text('Arasta taxi pickup','Arasta yolcu durağı')},
 dropoff:{x:53,z:-390,name:text('Sirkeci station drop-off','Sirkeci Garı yolcu durağı')},
 phone:{x:21,z:16.6,name:text('Search beside the square bench','Meydandaki bankın yanını ara')},
 highway:{x:1450,z:0,name:text('Marmara Highway','Marmara Otoyolu')},
 'fener-gate':{x:-150,z:-201,name:text('Phanar College gate','Fener Rum Lisesi kapısı')},
});
export const MISSIONS=Object.freeze([
 {id:'fener-exam',reward:300,title:text('Phanar College entrance exam','Fener Rum Lisesi giriş sınavı'),description:text('Walk to the school gate. Answer 10 questions; get at least 7 right to earn $300 and an in-game student certificate. Retry if needed. The reward is paid once.','Lisenin kapısına yürüyerek gel. 10 sorudan en az 7’sini doğru cevapla; 300 $ ve oyun içi öğrenci belgesi kazan. Tekrar deneyebilirsin. Ödül bir kez verilir.'),objectives:[text('Reach the school gate · pass the 10-question exam','Lisenin kapısına ulaş · 10 soruluk sınavı geç')],targets:['fener-gate']},
 {id:'hagia-visit',reward:150,title:text('Step inside Hagia Sophia','Ayasofya’ya gir'),description:text('Enter through the actual visitor door.','Ziyaretçi kapısından gerçekten içeri gir.'),objectives:[text('Enter Hagia Sophia · E / Enter','Ayasofya’ya gir · E / Gir')],targets:['ayasofya']},
 {id:'speed-250',reward:300,title:text('250 km/h club','250 km/sa kulübü'),description:text('Prepare your Jesko or Golf before starting. Hold 250 km/h for 2 seconds on the highway.','Başlamadan Jesko veya Golf’üne bin. Otoyolda 250 km/sa hızı 2 saniye koru.'),objectives:[text('Reach 250 km/h on Marmara Highway','Marmara Otoyolu’nda 250 km/sa yap')],targets:['highway']},
 {id:'church-sprint',reward:360,limit:300,title:text('Five minutes to the church','Kiliseye beş dakikada'),description:text('Enter the Blue Mosque to start the 5-minute clock, then travel to and enter Cinar Church. No fast travel.','5 dakikayı başlatmak için Sultanahmet’e gir; sonra Çınar Kilisesi’ne gidip içeri gir. Hızlı seyahat kullanma.'),objectives:[text('Enter the Blue Mosque to begin','Başlamak için Sultanahmet’e gir'),text('Reach and enter Cinar Church in 5 minutes','5 dakikada Çınar Kilisesi’ne ulaş ve gir')],targets:['sultanahmet','chapel']},
 {id:'mosque-route',reward:200,title:text('Hagia Sophia → Blue Mosque','Ayasofya → Sultanahmet'),description:text('Visit both interiors in order and travel between them yourself.','İki mekâna sırayla gir ve aralarındaki yolu kendin tamamla.'),objectives:[text('Enter Hagia Sophia first','Önce Ayasofya’ya gir'),text('Travel to and enter the Blue Mosque','Sultanahmet’e git ve içeri gir')],targets:['ayasofya','sultanahmet']},
 {id:'taxi-ride',reward:240,title:text('Taxi: Arasta → Sirkeci','Taksi: Arasta → Sirkeci'),description:text('Use your own car. Stop at the gold pickup marker, carry your passenger to Sirkeci and stop there. Prepare your car before starting.','Kendi arabanı kullan. Altın işarette durup yolcuyu al; Sirkeci’ye taşı ve dur. Başlamadan arabanı hazırla.'),objectives:[text('Stop your car at Arasta · collect 1 passenger','Arasta’da arabanla dur · 1 yolcu al'),text('Passenger aboard · stop at Sirkeci station','Yolcu araçta · Sirkeci Garı’nda dur')],targets:['pickup','dropoff']},
 {id:'lost-phone',reward:180,title:text('The missing phone','Kayıp telefon'),description:text('Someone lost a phone near a bench in the square. Find the phone on foot and pick it up with E / Enter.','Meydandaki bankın yanında bir telefon kayboldu. Yürüyerek bul; E / Gir ile yerden al.'),objectives:[text('Search the bench · pick up the phone','Bankın yanını ara · telefonu al')],targets:['phone']},
 {id:'hagia-photo',reward:120,title:text('A postcard from Hagia Sophia','Ayasofya’dan bir kartpostal'),description:text('Walk to Hagia Sophia, frame the building in Photo mode and save a photo.','Ayasofya’ya yürü, Fotoğraf modunda binayı kadraja al ve fotoğrafı kaydet.'),objectives:[text('Frame Hagia Sophia · Photo → Save photo','Ayasofya’yı kadraja al · Fotoğraf → Kaydet')],targets:['ayasofya']},
]);
export const MISSION_REWARDS=Object.freeze(Object.fromEntries(MISSIONS.map(m=>[m.id,m.reward])));
export const missionText=(value,language='en')=>value[language==='tr'?'tr':'en'];
