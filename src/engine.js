import { gates, touchesArrow } from './navigation.js';
import { colliders, WORLD, spawnGroundY } from './model.js';
import { BounceShape } from './bounce.js';
export class Engine {
  constructor(level,physics,onEvent=()=>{}){this.physics=physics;this.onEvent=onEvent;this.reset(level);}
  reset(level){this.bounce=new BounceShape();this.level=level;this.platforms=colliders(level);this.navigation=gates(level);this.transitioning=false;this.jumping=false;this.gateCooldown=.35;const s=level.objects.find(o=>o.type==='spawn');this.player={x:s.x,y:s.y,vx:0,vy:0,r:this.physics.radius??4.5,grounded:false,ink:100,stretch:0};this.startGroundY=spawnGroundY(level,this.player.r);this.groundY=this.startGroundY;this.collected=new Set();this.elapsed=0;this.deaths=0;this.won=false;this.trail=[];this.coyote=0;this.buffer=0;this.previousJump=false;this.jumpLatched=false;this.grow=0;}
  setNavigation(navigation){this.navigation=navigation;}
  localize(level){
    const p=this.player,support=p.grounded?this.platforms.find(b=>Math.abs(b.y-p.y-p.r)<.5&&p.x+p.r>b.x+.5&&p.x-p.r<b.x+b.w-.5):null;
    const spawn=this.level.objects.find(o=>o.type==='spawn'),settling=!p.grounded&&!this.jumping&&this.elapsed<.35&&Math.abs(p.x-spawn.x)<.5&&p.y<=this.startGroundY+1;
    this.level=level;this.platforms=colliders(level);this.navigation=gates(level);this.startGroundY=spawnGroundY(level,p.r);
    if(settling)p.x=level.objects.find(o=>o.type==='spawn').x;
    if(support){
      // Keep the player on the same row when characters become whole words.
      const candidates=this.platforms.filter(b=>b.y===support.y).map(b=>{
        const margin=Math.min(p.r+1,b.w/2),x=Math.max(b.x+margin,Math.min(b.x+b.w-margin,p.x));return{b,x};
      }).filter(({b,x})=>!this.platforms.some(other=>other.y<b.y&&other.y+other.h>b.y-p.r*2&&x+p.r>other.x+.5&&x-p.r<other.x+other.w-.5));
      const nearest=candidates.sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x))[0];
      if(nearest){p.x=nearest.x;p.y=nearest.b.y-p.r;p.vx=0;}else p.grounded=false;
    }
    this.trail=[];this.buffer=0;this.previousJump=false;this.gateCooldown=Math.max(this.gateCooldown,.35);
  }
  respawn(){this.bounce=new BounceShape();const s=this.level.objects.find(o=>o.type==='spawn');Object.assign(this.player,{x:s.x,y:s.y,vx:0,vy:0,r:this.physics.radius??4.5,ink:100,grounded:false,stretch:0});this.collected.clear();this.trail=[];this.coyote=0;this.buffer=0;this.grow=0;this.jumping=false;this.groundY=this.startGroundY;this.gateCooldown=.35;this.deaths++;this.onEvent('death');}
  update(dt,input={}) {
    if(this.won||this.transitioning)return;dt=Math.min(dt,1/30);this.elapsed+=dt;this.gateCooldown=Math.max(0,this.gateCooldown-dt);const p=this.player,rules=this.physics;
    if(input.jump&&!this.previousJump)this.buffer=.12;else this.buffer=Math.max(0,this.buffer-dt);if(!input.jump)this.jumpLatched=false;this.previousJump=!!input.jump;
    this.coyote=p.grounded?.1:Math.max(0,this.coyote-dt);
    this.grow=Math.max(0,Math.min(1,this.grow+dt*(input.grow&&p.ink>0?3:-5)));
    p.ink=Math.max(0,p.ink-(input.grow?rules.inkDrain*dt:0));
    const nextR=(rules.radius??4.5)*(1+this.grow*(rules.growScale-1));const oldR=p.r;
    // Keep the feet on the same surface while the body changes size.
    if(p.grounded)p.y-=nextR-oldR;p.r=nextR;
    const dir=(input.right?1:0)-(input.left?1:0),target=dir*rules.speed;
    p.vx+=(target-p.vx)*Math.min(1,dt*(dir?13:18));
    if((this.buffer>0||input.jump)&&this.coyote>0){p.vy=-rules.jump*(1+this.grow*.22);p.grounded=false;this.coyote=0;this.buffer=0;this.jumpLatched=true;this.jumping=true;this.bounce.jump();this.onEvent('jump');}
    const oldX=p.x;p.x=Math.max(this.navigation.minX+p.r,Math.min(this.navigation.maxX-p.r,p.x+p.vx*dt));
    for(const b of this.platforms){if(p.y+p.r>b.y+1&&p.y-p.r<b.y+b.h-1&&p.x+p.r>b.x&&p.x-p.r<b.x+b.w){if(oldX+p.r<=b.x+.5)p.x=b.x-p.r;else if(oldX-p.r>=b.x+b.w-.5)p.x=b.x+b.w+p.r;}}
    const oldY=p.y,wasGrounded=p.grounded;
    const glide=p.vy>0&&input.jump&&!this.jumpLatched;p.vy=Math.min(glide?95:700,p.vy+rules.gravity*dt*(glide?.13:1));const impact=p.vy;p.y+=p.vy*dt;p.grounded=false;
    for(const b of this.platforms){
      if(p.x+p.r<=b.x+.5||p.x-p.r>=b.x+b.w-.5)continue;
      if(p.vy>=0&&oldY+p.r<=b.y+1&&p.y+p.r>=b.y){p.y=b.y-p.r;p.vy=0;p.grounded=true;}
      else if(p.vy<0&&oldY-p.r>=b.y+b.h-1&&p.y-p.r<=b.y+b.h){p.y=b.y+b.h+p.r;p.vy=0;}
    }
    if(p.grounded){this.jumping=false;this.groundY=p.y;}
    if(p.grounded&&!wasGrounded){this.bounce.land(impact);this.onEvent('land');}
    p.stretch=this.bounce.update(dt,p);
    if(p.y-p.r>WORLD.height){this.respawn();return;}
    const nav=this.navigation;
    if(this.gateCooldown===0&&touchesArrow(p,nav.previous,-1)){this.transitioning=true;this.onEvent('previous');return;}
    if(this.gateCooldown===0&&touchesArrow(p,nav.next)){this.won=true;this.onEvent('win');return;}
    for(const o of this.level.objects){
      if(o.type==='hazard'&&p.x+p.r>o.x-10&&p.x-p.r<o.x-10+o.width&&p.y+p.r>o.y-10&&p.y-p.r<o.y+10){this.respawn();return;}
      if(this.collected.has(o.id)||Math.hypot(p.x-o.x,p.y-o.y)>p.r+15)continue;
      if(o.type==='ink'){p.ink=Math.min(100,p.ink+45);this.collected.add(o.id);this.onEvent('collect');}
      if(o.type==='collectible'){this.collected.add(o.id);this.onEvent('collect');}
    }
    this.trail.push({x:p.x,y:p.y,r:p.r});if(this.trail.length>16)this.trail.shift();
  }
}
