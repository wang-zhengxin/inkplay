import { isWordText } from './layout.js';
import { gates } from './navigation.js';
import { WORLD, bounds, glyphs, isWorkshopPlaceholder } from './model.js';
import { Camera } from './camera.js';
import { immersiveView } from './viewport.js';
import { bounceScale } from './bounce.js';
const fonts={calligraphy:"'Inkplay Brush', 'Kaiti SC', 'STKaiti', 'KaiTi', serif",serif:"'Inkplay Latin', Georgia, 'Songti SC', serif",mono:"'Courier New', 'Songti SC', monospace",sans:"'PingFang SC', sans-serif"};
export class Renderer {
  constructor(canvas){this.reducedMotion=window.matchMedia('(prefers-reduced-motion:reduce)');this.canvas=canvas;this.ctx=canvas.getContext('2d');this.images=new Map();this.camera=new Camera();this.cameraX=0;this.lastEngine=null;this.lastMode=null;this.lastTime=0;}
  image(src){if(!src)return null;if(!this.images.has(src)){const img=new Image();img.src=src;this.images.set(src,img);if(this.images.size>12)this.images.delete(this.images.keys().next().value);}const img=this.images.get(src);return img?.complete&&img.naturalWidth?img:null;}
  draw(project,level,engine,{mode,grid,selected,immersive=false},time){
    const c=this.ctx,t=project.theme,rect=this.canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
    const w=Math.round(rect.width*dpr),h=Math.round(rect.height*dpr);if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
    c.setTransform(w/WORLD.width,0,0,h/WORLD.height,0,0);c.fillStyle=t.paper;c.fillRect(0,0,WORLD.width,WORLD.height);
    // A quiet, deterministic paper grain; no remote texture assets.
    c.fillStyle=t.ink;c.globalAlpha=.025;for(let i=0;i<500;i++){const x=(i*367.73)%WORLD.width,y=(i*191.41)%WORLD.height;c.fillRect(x,y,.65,.65);}c.globalAlpha=1;
    const dt=Math.min((time-this.lastTime)/1000||0,.05);this.lastTime=time;
    const view=immersive?immersiveView(w,h,level,dpr,engine.player.x,engine.startGroundY):null;
    const nav=gates(level);
    engine.setNavigation(nav);
    const cameraHeight=immersive?engine.groundY/.55:view?.height;
    if(mode==='play'){
      if(this.lastEngine!==engine||this.lastMode!=='play'){this.camera.reset(engine.player,project.camera,cameraHeight,view?.cameraLimits);this.cameraX=view?.cameraX||0;}
      this.camera.update(dt,engine.player,project.camera,cameraHeight,view?.cameraLimits);
      this.cameraX+=((project.camera.follow>0?(view?.cameraX||0):0)-this.cameraX)*(1-Math.exp(-project.camera.smoothing*dt));
    }else this.camera.y=0;
    this.lastEngine=engine;this.lastMode=mode;
    if(view)c.setTransform(view.scale,0,0,view.scale,view.offsetX,view.offsetY);
    c.save();c.translate(0,-this.camera.y);
    const bg=this.image(t.background);if(bg){const scale=Math.max(WORLD.width/bg.width,WORLD.height/bg.height);c.globalAlpha=.26;c.drawImage(bg,(WORLD.width-bg.width*scale)/2,(WORLD.height-bg.height*scale)/2,bg.width*scale,bg.height*scale);c.globalAlpha=1;}
    if(mode==='edit'&&grid){c.fillStyle=t.grid;c.globalAlpha=.12;for(let x=20;x<WORLD.width;x+=20)for(let y=20;y<WORLD.height;y+=20){c.beginPath();c.arc(x,y,.8,0,Math.PI*2);c.fill();}c.globalAlpha=1;}
    for(const o of level.objects){if((mode==='play'&&engine.collected.has(o.id))||(immersive&&isWorkshopPlaceholder(o)))continue;
      c.save();c.fillStyle=t.ink;c.strokeStyle=t.accent;
      if(view?.scrolling&&o.type!=='exit'){c.beginPath();c.rect((w*.12-view.offsetX)/view.scale,(0-view.offsetY)/view.scale+this.camera.y,w*.70/view.scale,h/view.scale);c.clip();}
      if(['platform','decoration'].includes(o.type)){
        const wordFont=isWordText(o.text)&&t.font==='calligraphy';
        const family=fonts[wordFont?'serif':t.font],weight=o.type==='decoration'&&o.fontSize>=40?'500 ':'';
        c.font=weight+o.fontSize+'px '+family;
        c.globalAlpha=o.type==='decoration'?.24:1;
        if(o.type==='decoration'){c.fillText(o.text,o.x,o.y+o.fontSize);}else{
          const letters=glyphs(o);
          c.textAlign='center';letters.forEach(g=>c.fillText(g.char,g.x+g.width/2,o.y+o.fontSize));c.textAlign='left';
          if(mode==='edit'){c.globalAlpha=.2;c.lineWidth=1;c.beginPath();letters.filter(g=>!(/\s/.test(g.char))).forEach(g=>{c.moveTo(g.x,o.y+o.fontSize+7);c.lineTo(g.x+g.width,o.y+o.fontSize+7);});c.stroke();}
        }
      } else if(o.type==='spawn'){
        if(mode==='edit'){this.player(project,{x:o.x,y:o.y,r:project.physics.radius},time);c.fillStyle=t.muted;c.font='9px '+fonts.mono;c.fillText('YOU',o.x-10,o.y-22);}
      }else if(o.type==='exit'){
        const {x,y}=nav.next;
        this.portal(project,x,y,'→',.65);
        if(!immersive){c.fillStyle=t.muted;c.textAlign='center';c.font='9px '+fonts.mono;c.fillText('NEXT PAGE',x,y-31);}
      }else if(o.type==='ink'){
        const bob=mode==='play'?Math.sin(time*.002+o.x)*3:0;c.globalAlpha=.65;c.lineWidth=1.5;c.beginPath();c.moveTo(o.x,o.y-10+bob);c.bezierCurveTo(o.x-14,o.y+4+bob,o.x-4,o.y+13+bob,o.x,o.y+9+bob);c.bezierCurveTo(o.x+8,o.y+11+bob,o.x+12,o.y+3+bob,o.x,o.y-10+bob);c.stroke();
      }else if(o.type==='collectible'){
        const bob=mode==='play'?Math.sin(time*.002+o.x)*3:0;c.translate(o.x,o.y+bob);c.strokeStyle=t.accent;c.lineWidth=1.4;c.beginPath();c.moveTo(0,-10);c.quadraticCurveTo(1,-1,10,0);c.quadraticCurveTo(1,1,0,10);c.quadraticCurveTo(-1,1,-10,0);c.quadraticCurveTo(-1,-1,0,-10);c.stroke();c.fillStyle=t.accent;c.globalAlpha=.3;c.fill();
      }else if(o.type==='hazard'){
        c.strokeStyle=t.ink;c.lineWidth=1.5;for(let x=o.x-10;x<o.x-10+o.width;x+=16){c.beginPath();c.moveTo(x,o.y+10);c.lineTo(x+8,o.y-10);c.lineTo(x+16,o.y+10);c.stroke();}
      }
      c.restore();
    }
    this.portal(project,nav.previous.x,nav.previous.y,'←',.35);
    if(mode==='play'){
      engine.trail.forEach((p,i)=>{c.globalAlpha=i/engine.trail.length*.08;c.fillStyle=project.skin.color;c.beginPath();c.arc(p.x,p.y,p.r*.6,0,Math.PI*2);c.fill();});c.globalAlpha=1;this.player(project,engine.player,time);
    }
    if(mode==='edit'&&selected){const o=level.objects.find(o=>o.id===selected);if(o){const b=bounds(o);c.save();c.strokeStyle=t.accent;c.fillStyle=t.accent;c.lineWidth=1;c.setLineDash([5,4]);c.strokeRect(b.x-7,b.y-7,b.w+14,b.h+14);c.setLineDash([]);[[b.x-7,b.y-7],[b.x+b.w+7,b.y-7],[b.x-7,b.y+b.h+7],[b.x+b.w+7,b.y+b.h+7]].forEach(([x,y])=>c.fillRect(x-2,y-2,4,4));c.restore();}}
    c.restore();
  }
  portal(project,x,y,arrow,alpha=1,scale=1){
    const c=this.ctx;c.save();c.translate(x,y);c.scale(scale,scale);if(arrow==='←')c.scale(-1,1);
    c.strokeStyle=project.theme.accent;c.globalAlpha=alpha;c.lineWidth=1.6;c.lineCap='round';c.lineJoin='round';
    c.beginPath();c.moveTo(-11,1);c.quadraticCurveTo(0,-1,11,0);c.moveTo(4,-7);c.quadraticCurveTo(8,-3,11,0);c.quadraticCurveTo(8,3,4,7);c.stroke();c.restore();
  }
  player(project,p,time){
    const c=this.ctx,s=project.skin,shape=bounceScale(this.reducedMotion.matches?0:p.stretch);
    c.save();c.translate(p.x,p.y+(p.grounded?p.r*(1-shape.y):0));c.scale(shape.x,shape.y);c.fillStyle=s.color;c.strokeStyle=s.color;c.shadowColor=s.color+'44';c.shadowBlur=2;
    const img=s.type==='image'?this.image(s.image):null;
    if(img){c.drawImage(img,-p.r*1.4,-p.r*1.4,p.r*2.8,p.r*2.8);}
    else if(s.type==='star'){c.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=p.r*(i%2?.5:1.2);i?c.lineTo(Math.cos(a)*r,Math.sin(a)*r):c.moveTo(Math.cos(a)*r,Math.sin(a)*r);}c.closePath();c.fill();}
    else if(s.type==='leaf'){c.rotate(-.4);c.beginPath();c.ellipse(0,0,p.r*.7,p.r*1.25,0,0,Math.PI*2);c.fill();c.strokeStyle=project.theme.paper;c.lineWidth=1;c.beginPath();c.moveTo(0,-p.r*.8);c.lineTo(0,p.r*.8);c.stroke();}
    else{c.beginPath();for(let i=0;i<=24;i++){const a=i*Math.PI/12,r=p.r*(1+.055*Math.sin(a*5+time*.003));i?c.lineTo(Math.cos(a)*r,Math.sin(a)*r):c.moveTo(Math.cos(a)*r,Math.sin(a)*r);}c.fill();c.globalAlpha=.35;c.fillStyle=project.theme.paper;c.beginPath();c.arc(-p.r*.27,-p.r*.33,p.r*.2,0,Math.PI*2);c.fill();}
    c.restore();
  }
}
