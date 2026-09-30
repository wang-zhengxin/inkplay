import { glyphs } from '../src/model.js';
// Exercise real controls, using each visible character/word as a landing goal.
export function followText(engine){
  for(let k=0;k<50;k++)engine.update(1/120);
  const margin=engine.player.r+4;
  const points=engine.level.objects.filter(o=>o.type==='platform').flatMap(o=>glyphs(o).filter(g=>!/\s/.test(g.char)).map(g=>({x:g.x+g.width/2,y:o.y,min:g.x+Math.min(margin,g.width/2),max:g.x+g.width-Math.min(margin,g.width/2)}))).filter(g=>g.x>engine.player.x+.1);
  for(const target of points){
    // Aim at the exposed part of a word when another row overlaps its edge.
    let intervals=[[target.min,target.max]];
    for(const b of engine.platforms.filter(b=>b.y<target.y)){
      const left=b.x+.5-margin,right=b.x+b.w-.5+margin;
      intervals=intervals.flatMap(([min,max])=>max<left||min>right?[[min,max]]:[[min,Math.min(max,left-.1)],[Math.max(min,right+.1),max]].filter(([a,z])=>a<=z));
    }
    if(!intervals.length)continue;
    target.x=intervals.map(([min,max])=>Math.max(min,Math.min(max,target.x))).sort((a,b)=>Math.abs(a-target.x)-Math.abs(b-target.x))[0];
    if(engine.won)break;const risingTarget=target.y<engine.player.y+engine.player.r-.5;engine.update(1/120,{jump:true});let landed=false;
    for(let k=0;k<180;k++){
      const delta=target.x-engine.player.x-engine.player.vx/18,clearEdge=risingTarget&&engine.player.vy<0&&engine.player.y+engine.player.r>target.y-1;
      engine.update(1/120,clearEdge?{}:{right:delta>.8,left:delta<-.8});
      if(engine.won||(k>20&&engine.player.grounded&&Math.abs(engine.player.y+engine.player.r-target.y)<.1&&Math.abs(engine.player.x-target.x)<4)){landed=true;break;}
    }
    if(!landed)throw new Error(`未到达文字落点 (${target.x}, ${target.y})`);
  }
  for(let k=0;k<60;k++)engine.update(1/120,{right:true});
}
