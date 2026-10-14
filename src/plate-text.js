export const PLATE_MAX_LENGTH=7;
export const DEFAULT_CAR_PLATES=Object.freeze({
 'bmw-m6':'34M6001','audi-r8':'34R8002','mercedes-amg':'34GT003',
 'koenigsegg-jesko':'JESKO34','vw-golf-r':'GOLFR34','vw-passat':'34VW006',
});
export function cleanPlateText(value){
 return typeof value==='string'?value.normalize('NFC').toLocaleUpperCase('tr-TR').replace(/[^\p{L}\p{N} ]/gu,'').replace(/ +/g,' ').trim():'';
}
export function validPlateText(value){const text=cleanPlateText(value);return text&&Array.from(text).length<=PLATE_MAX_LENGTH?text:null;}
export const trafficPlateText=index=>`34AA${String(index+1).padStart(3,'0').slice(-3)}`;
