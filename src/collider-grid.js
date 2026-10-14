// Broad phase only: the existing exact collision test still decides whether a
// candidate blocks the player. Padding covers the player's 0.32 m radius.
export function createColliderGrid(colliders,cellSize=32,padding=.5){
 const columns=new Map(),empty=[];
 for(const collider of colliders){
  let minX,maxX,minZ,maxZ;
  if(collider.obb){
   const cos=Math.abs(Math.cos(collider.heading)),sin=Math.abs(Math.sin(collider.heading));
   const halfX=cos*collider.halfWidth+sin*collider.halfLength;
   const halfZ=sin*collider.halfWidth+cos*collider.halfLength;
   minX=collider.x-halfX;maxX=collider.x+halfX;minZ=collider.z-halfZ;maxZ=collider.z+halfZ;
  }else if(collider.circle){
   minX=collider.x-collider.radius;maxX=collider.x+collider.radius;
   minZ=collider.z-collider.radius;maxZ=collider.z+collider.radius;
  }else{minX=collider.minX;maxX=collider.maxX;minZ=collider.minZ;maxZ=collider.maxZ}
  for(let ix=Math.floor((minX-padding)/cellSize);ix<=Math.floor((maxX+padding)/cellSize);ix++){
   let column=columns.get(ix);if(!column){column=new Map();columns.set(ix,column)}
   for(let iz=Math.floor((minZ-padding)/cellSize);iz<=Math.floor((maxZ+padding)/cellSize);iz++){
    let bucket=column.get(iz);if(!bucket){bucket=[];column.set(iz,bucket)}bucket.push(collider);
   }
  }
 }
 return {at(x,z){return columns.get(Math.floor(x/cellSize))?.get(Math.floor(z/cellSize))||empty},cellSize};
}
