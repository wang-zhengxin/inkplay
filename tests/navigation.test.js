import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, clone, glyphs, endOfText, exitPosition, alignExits } from '../src/model.js';
import { Engine } from '../src/engine.js';
import { adjacentChapter, ChapterProgress, arrivalPoint, gates, touchesArrow } from '../src/navigation.js';
import { immersiveView } from '../src/viewport.js';
const run=(e,seconds,input={})=>{for(let i=0;i<Math.round(seconds*120);i++)e.update(1/120,input);};
test('触碰左箭头触发一次上一关，不需要方向输入或起跳',()=>{
  const p=defaults({starter:true}),events=[],e=new Engine(p.levels[0],p.physics,k=>events.push(k));run(e,.5);const arrow=gates(e.level).previous;
  Object.assign(e.player,{x:arrow.x,y:arrow.y,vx:0,vy:0});e.update(1/120,{});assert.equal(e.transitioning,true);assert.equal(events.filter(k=>k==='previous').length,1);run(e,1,{left:true,jump:true});assert.equal(events.filter(k=>k==='previous').length,1);
  const nearby=new Engine(p.levels[0],p.physics);run(nearby,.5);Object.assign(nearby.player,{x:arrow.x,y:arrow.y-45,vx:0,vy:0});nearby.update(1/120,{left:true});assert.equal(nearby.transitioning,false);
});
test('箭头碰撞与可见线条一致，空白处不误触，冷却防止重复翻关',()=>{
  const arrow={x:100,y:200};assert.equal(touchesArrow({x:110,y:200,r:4.5},arrow),true);assert.equal(touchesArrow({x:100,y:225,r:4.5},arrow),false);assert.equal(touchesArrow({x:80,y:200,r:4.5},arrow),false);
  const p=defaults({starter:true}),e=new Engine(p.levels[0],p.physics);Object.assign(e.player,{...e.navigation.previous,vx:0,vy:0});e.update(1/120);assert.equal(e.transitioning,false);
});
test('翻页选择正确章节，首尾循环，返回落在上一关末尾字面上',()=>{
  assert.equal(adjacentChapter(2,-1,5),1);assert.equal(adjacentChapter(0,-1,5),4);assert.equal(adjacentChapter(4,1,5),0);
  const p=defaults({starter:true}),e=new Engine(p.levels[1],p.physics),point=arrivalPoint(e.level,e.player.r);Object.assign(e.player,point);run(e,.3);assert.equal(e.player.grounded,true);assert.equal(e.deaths,0);assert.ok(e.player.x>800);
});
test('来回翻关保留收集与墨水，新页面保持自己的进度',()=>{
  const p=defaults({starter:true}),progress=new ChapterProgress(),e=new Engine(p.levels[0],p.physics),star=e.level.objects.find(o=>o.type==='collectible');e.collected.add(star.id);e.player.ink=73;progress.remember(e);
  const next=new Engine(p.levels[1],p.physics);progress.restore(next);assert.equal(next.collected.size,0);
  const previous=new Engine(p.levels[0],p.physics);progress.restore(previous,true);assert.ok(previous.collected.has(star.id));assert.equal(previous.player.ink,73);assert.ok(previous.player.x>800);assert.equal(previous.won,false);
  progress.clear(previous.level.id);const reset=new Engine(p.levels[0],p.physics);progress.restore(reset);assert.equal(reset.collected.size,0);
});
test('宽屏与手机上的末尾箭头可到达，星光未收集也能接触翻关',()=>{
  for(const [width,height] of [[390,844],[1280,720],[2560,1440]]){
    const p=defaults({starter:true}),level=p.levels[0],nav=gates(level),view=immersiveView(width,height,level,1,nav.next.x),last=endOfText(level);
    assert.ok(Math.abs((nav.next.x-last.edge)*view.scale-28*view.scale)<1e-8);
    const e=new Engine(level,p.physics);run(e,.5);e.player.x=nav.next.x;e.player.y=nav.next.y;e.update(1/120);assert.equal(e.won,true);
    e.reset(level);run(e,.5);
    for(const star of level.objects.filter(o=>o.type==='collectible'))e.collected.add(star.id);
    e.player.y=nav.next.y+100;e.update(1/120);assert.equal(e.won,false);
    Object.assign(e.player,arrivalPoint(level,e.player.r),{vx:0,vy:0});run(e,.3);run(e,.5,{right:true});assert.equal(e.won,true);assert.equal(e.deaths,0);
  }
});
test('修改末尾文字、位置、字距或字号后，箭头自动跟随实际字形末端',()=>{
  const p=defaults({starter:true}),l=p.levels[0],last=endOfText(l).object,original=exitPosition(l);Object.assign(last,{x:last.x-30,y:last.y+10,text:'雨后，有新的故事',fontSize:26,width:230,seed:123});
  assert.equal(alignExits(p),true);const exit=l.objects.find(o=>o.type==='exit'),position=exitPosition(l);assert.deepEqual({x:exit.x,y:exit.y},position);assert.notDeepEqual(position,original);assert.deepEqual(gates(l).next,position);
});
