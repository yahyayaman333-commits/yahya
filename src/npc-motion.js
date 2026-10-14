import {collides} from './player.js';
import {canCrossSurface} from './surface-step.js';
export function npcCanMove(p,x,z,{colliders=[],bounds,heightAt}={}){
 return !collides(x,z,colliders,.25,bounds)&&canCrossSurface(heightAt,p.x,p.z,x,z);
}
export function fleeNpc(p,dt,environment){
 if(p.dead||p.state!=='fleeing'||dt<=0)return false;
 const step=Math.min(dt,.06)*2.35,angle=p.fleeAngle??p.heading;
 // Try a few directions around an obstruction; no pathfinding or per-NPC
 // navigation meshes are needed for this small crowd.
 for(const offset of [0,.6,-.6,1.3,-1.3,Math.PI]){
  const a=angle+offset,x=p.x+Math.sin(a)*step,z=p.z+Math.cos(a)*step;
  const env=typeof environment==='function'?environment(x,z):environment;
  if(npcCanMove(p,x,z,env)){p.x=x;p.z=z;p.heading=a;p.fleeAngle=a;p.distance=(p.distance||0)+step;p.speed=2.35;return true;}
 }p.speed=0;return false;
}
export function panicCrowd(people,origin={x:0,z:0}){
 for(const [i,p]of people.entries())if(!p.dead){
  if(p.state==='fleeing')continue;p.state='fleeing';p.speed=2.35;
  p.fleeAngle=Math.atan2(p.x-origin.x,p.z-origin.z)+(i%3-1)*.2;
 }
}
