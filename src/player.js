import {createColliderGrid} from './collider-grid.js';
import {canCrossSurface} from './surface-step.js';
export const WALK_SPEED=7.0875;
export const EXTERIOR_BOUNDS=Object.freeze({minX:-101,maxX:90,minZ:-92,maxZ:90});
export function collides(x,z,colliders,radius=.32,bounds=EXTERIOR_BOUNDS){
 for(const c of colliders){if(c.obb){const cos=Math.cos(c.heading),sin=Math.sin(c.heading),dx=x-c.x,dz=z-c.z,lx=dx*cos-dz*sin,lz=dx*sin+dz*cos;if(Math.hypot(Math.max(0,Math.abs(lx)-c.halfWidth),Math.max(0,Math.abs(lz)-c.halfLength))<radius)return true}else if(c.circle){if(Math.hypot(x-c.x,z-c.z)<c.radius+radius)return true}else if(x>c.minX-radius&&x<c.maxX+radius&&z>c.minZ-radius&&z<c.maxZ+radius)return true}return x<bounds.minX||x>bounds.maxX||z<bounds.minZ||z>bounds.maxZ||bounds.contains?.(x,z)===false;
}
export class Player{
 constructor(camera,colliders){this.camera=camera;this.colliders=colliders;this.colliderGrid=createColliderGrid(colliders);this.colliderGridCount=colliders.length;this.x=18;this.z=31;this.y=.04;this.vy=0;this.yaw=.22;this.pitch=.05;this.height=1.7;this.velocity={x:0,z:0};this.grounded=true;this.distance=0;this.stepDistance=0;this.speed=0;this.bob=0;this.dynamicColliders=[];this.sync()}
 reset(){this.x=18;this.z=31;this.y=.04;this.yaw=.22;this.pitch=.05;this.vy=0;this.velocity.x=this.velocity.z=0;this.grounded=true;this.height=1.7;this.bob=0;this.distance=0;this.stepDistance=0;this.speed=0;this.sync()}
 sync(){this.camera.position.set(this.x,this.y+this.height+this.bob,this.z);this.camera.rotation.order='YXZ';this.camera.rotation.set(this.pitch,this.yaw,0)}
 setEnvironment(colliders,{bounds=EXTERIOR_BOUNDS,groundHeight=null}={}){this.colliders=colliders;this.colliderGrid=createColliderGrid(colliders);this.colliderGridCount=colliders.length;this.bounds=bounds;this.groundHeight=groundHeight;this.dynamicColliders=[];this.velocity.x=this.velocity.z=0;this.vy=0;this.speed=0}
 look(dx,dy){this.yaw-=dx*.0018;this.pitch=Math.max(-1.4,Math.min(1.4,this.pitch-dy*.0018));this.sync()}
 update(dt,keys,onStep){
  dt=Math.min(Math.max(dt,0),.05);if(!dt)return {running:false,crouch:false};const running=keys.has('ShiftLeft')||keys.has('ShiftRight'),crouch=keys.has('KeyC')||keys.has('ControlLeft');
  this.height+=( (crouch?1.07:1.7)-this.height)*Math.min(1,dt*12);
  if(keys.has('ArrowLeft'))this.yaw+=dt*1.4;if(keys.has('ArrowRight'))this.yaw-=dt*1.4;
  let forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),side=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0);const len=Math.hypot(forward,side)||1;forward/=len;side/=len;
  const max=crouch?1.7:WALK_SPEED;const tx=(-Math.sin(this.yaw)*forward+Math.cos(this.yaw)*side)*max,tz=(-Math.cos(this.yaw)*forward-Math.sin(this.yaw)*side)*max;
  this.velocity.x+=(tx-this.velocity.x)*Math.min(1,dt*12);this.velocity.z+=(tz-this.velocity.z)*Math.min(1,dt*12);
  if(this.colliderGridCount!==this.colliders.length){this.colliderGrid=createColliderGrid(this.colliders);this.colliderGridCount=this.colliders.length}
  const beforeX=this.x,beforeZ=this.z,nx=this.x+this.velocity.x*dt,nz=this.z+this.velocity.z*dt;
  const blocked=(x,z)=>collides(x,z,this.colliderGrid.at(x,z),.32,this.bounds)||collides(x,z,this.dynamicColliders,.32,this.bounds)||!canCrossSurface(this.groundHeight,this.x,this.z,x,z);
  if(!blocked(nx,this.z))this.x=nx;else this.velocity.x=0;if(!blocked(this.x,nz))this.z=nz;else this.velocity.z=0;
  const ground=typeof this.groundHeight==='function'?this.groundHeight(this.x,this.z):this.groundHeight??(this.x>=59&&this.x<=65||this.x>=42.4&&this.x<=47?.25:this.x>47&&this.x<59?.07:.04);
  if(keys.has('Space')&&this.grounded){this.vy=5;this.grounded=false;keys.delete('Space')}
  this.vy-=15*dt;this.y+=this.vy*dt;if(this.y<=ground){this.y=ground;this.vy=0;this.grounded=true}
  const travel=Math.hypot(this.x-beforeX,this.z-beforeZ);this.speed=travel/dt;this.distance+=travel;this.stepDistance+=this.grounded?travel:0;
  if(this.stepDistance>(running?1.45:1.15)){onStep?.();this.stepDistance=0}
  const targetBob=this.grounded&&travel>.001?Math.sin(this.distance*5.7)*.027*(running?1.5:1):0;this.bob+=(targetBob-this.bob)*Math.min(1,dt*12);this.sync();return {running,crouch};
 }
}
