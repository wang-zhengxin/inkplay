import { WORLD, endOfText, exitPosition, glyphs } from './model.js';
export function gates(level){
  const spawn=level.objects.find(o=>o.type==='spawn');
  const start=level.objects.filter(o=>o.type==='platform'&&Math.abs(o.y-spawn.y)<60).sort((a,b)=>Math.abs(a.x-spawn.x)-Math.abs(b.x-spawn.x))[0];
  const first=start?glyphs(start).find(g=>!/\s/.test(g.char)):null;
  return {previous:{x:Math.max(25,Math.min(spawn.x-36,(first?.x??spawn.x)-28)),y:start?start.y+start.fontSize/2:spawn.y},next:exitPosition(level),minX:0,maxX:Math.max(WORLD.width,exitPosition(level).x+30)};
}
export function touchesArrow(player,arrow,direction=1){
  const x=(player.x-arrow.x)*direction,y=player.y-arrow.y;
  return [[-11,1,11,0],[4,-7,11,0],[11,0,4,7]].some(([ax,ay,bx,by])=>{
    const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));
    return Math.hypot(x-ax-t*dx,y-ay-t*dy)<=player.r+2;
  });
}
export function arrivalPoint(level,radius=4.5){
  const last=endOfText(level);if(last)return{x:last.glyph.x+last.glyph.width/2,y:last.object.y-radius-12};
  const s=level.objects.find(o=>o.type==='spawn');return{x:s.x,y:s.y};
}
export const adjacentChapter=(index,direction,count)=>(index+direction+count)%count;
export class ChapterProgress {
  constructor(){this.pages=new Map();}
  remember(engine){this.pages.set(engine.level.id,{collected:[...engine.collected],ink:engine.player.ink});}
  restore(engine,fromEnd=false){const saved=this.pages.get(engine.level.id);if(saved){engine.collected=new Set(saved.collected.filter(id=>engine.level.objects.some(o=>o.id===id)));engine.player.ink=saved.ink;}
    if(fromEnd){Object.assign(engine.player,arrivalPoint(engine.level,engine.player.r));engine.groundY=engine.player.y+12;}engine.gateCooldown=.7;
  }
  clear(id){this.pages.delete(id);}
}
