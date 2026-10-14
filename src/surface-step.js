// Curbs and stairs remain usable; a vertical retaining face is not a ramp.
// The travel allowance admits slopes even during a long physics frame.
export function canCrossSurface(heightAt,fromX,fromZ,toX,toZ){
 if(typeof heightAt!=='function'||!Number.isFinite(fromX)||!Number.isFinite(fromZ))return true;
 const from=heightAt(fromX,fromZ),to=heightAt(toX,toZ);
 if(!Number.isFinite(from)||!Number.isFinite(to))return true;
 return Math.abs(to-from)<=.32+Math.hypot(toX-fromX,toZ-fromZ)*.35;
}
