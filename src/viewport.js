import { WORLD, bounds, isWorkshopPlaceholder, exitPosition, spawnGroundY } from './model.js';
export function compositionBounds(level){
  const objects=level?.objects.filter(o=>o.type!=='hazard'&&!isWorkshopPlaceholder(o));
  if(!objects?.length)return {x:0,y:0,w:WORLD.width,h:WORLD.height};
  const bs=objects.map(bounds),x=Math.min(...bs.map(b=>b.x)),y=Math.min(...bs.map(b=>b.y));
  return {x,y,w:Math.max(...bs.map(b=>b.x+b.w))-x,h:Math.max(...bs.map(b=>b.y+b.h))-y};
}
export function immersiveView(width,height,level,dpr=1,playerX,anchorY=spawnGroundY(level)){
  const b=compositionBounds(level);
  const scale=Math.min(width*.76/Math.max(Math.min(b.w,width<700*dpr?320:b.w),100),height*.40/Math.max(b.y+b.h-anchorY,100),1.15*dpr);
  const scrolling=b.w*scale>width*.76+1e-6;
  let offsetX=width/2-(b.x+b.w/2)*scale;
  if(scrolling){const spawn=level.objects.find(o=>o.type==='spawn');const start=width*.25-spawn.x*scale,end=width*.78-exitPosition(level).x*scale;offsetX=Math.max(Math.min(start,end),Math.min(Math.max(start,end),width*.45-(playerX??spawn.x)*scale));}
  const offsetY=height*.5-(b.y+b.h/2)*scale;
  const cameraLimits={min:Math.min(0,((b.y+b.h)*scale+offsetY-height*.97)/scale),max:Math.max(0,(b.y*scale+offsetY-height*.03)/scale)};
  return {scale,width:width/scale,height:height/scale,cameraX:0,scrolling,offsetX,offsetY,cameraLimits};
}
