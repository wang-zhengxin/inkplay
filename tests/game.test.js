import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, validate, clone, colliders, glyphs, makeLevel, upgradeStockLayouts, endOfText, exitPosition } from '../src/model.js';
import { Engine } from '../src/engine.js';
import { followText } from './helpers.js';
import { Camera } from '../src/camera.js';
const run=(e,seconds,input={})=>{for(let i=0;i<Math.round(seconds*120);i++)e.update(1/120,input);};
const setup=()=>{const p=defaults({starter:true});return{p,e:new Engine(p.levels[0],p.physics)};};
test('作品 JSON 往返保留所有章节和定制内容',()=>{
  const p=defaults({starter:true});p.theme.paper='#feefff';p.audio.events.jump='data:audio/wav;base64,AAAA';p.hud.x=30;
  assert.deepEqual(validate(JSON.parse(JSON.stringify(p))),p);
});
test('导入拒绝危险素材、非法坐标、重复 ID 与缺少出生点',()=>{
  const original=defaults({starter:true});
  for(const mutate of [p=>p.theme.background='https://example.com/track.png',p=>p.skin.image='data:image/svg+xml;base64,AAAA',p=>p.physics.speed=Infinity,p=>p.levels[0].objects[0].x=-10,p=>p.levels[0].objects[1].id=p.levels[0].objects[0].id,p=>p.levels[0].objects=p.levels[0].objects.filter(o=>o.type!=='spawn')]){const p=clone(original);mutate(p);assert.throws(()=>validate(p));}
});
test('文字中的空格形成真正的碰撞间隙',()=>{
  const l={objects:[{type:'platform',x:100,y:200,text:'甲 乙',width:90,fontSize:20}]};
  assert.deepEqual(colliders(l),[{x:105,y:200,w:20,h:25},{x:165,y:200,w:20,h:25}]);
});
test('出生后落到文字平台上，并可跳跃再次落地',()=>{
  const {e}=setup();run(e,.5);assert.equal(e.player.grounded,true);assert.equal(e.player.y+e.player.r,e.level.objects[0].y);
  e.update(1/120,{jump:true});assert.ok(e.player.vy<0);assert.equal(e.player.grounded,false);
  run(e,1);assert.equal(e.player.grounded,true);assert.equal(e.deaths,0);
});
test('按住上键接触文字后持续连跳，松开停止，下落重按仍可滑翔',()=>{
  const p=defaults({starter:true}),events=[],e=new Engine(p.levels[0],p.physics,event=>events.push(event));run(e,.3);run(e,3,{jump:true});assert.ok(events.filter(v=>v==='jump').length>=3);assert.equal(e.deaths,0);
  run(e,1.2);assert.equal(e.player.grounded,true);const count=events.filter(v=>v==='jump').length;run(e,.8);assert.equal(events.filter(v=>v==='jump').length,count);
  e.update(1/120,{jump:true});run(e,.5,{});e.update(1/120,{jump:true});assert.ok(e.player.vy<=95);
});
test('变大保持脚底位置、消耗墨水，松开后恢复',()=>{
  const {e}=setup();run(e,.3);run(e,.5,{grow:true});assert.ok(e.player.r>4.5);assert.ok(e.player.ink<100);assert.equal(e.player.y+e.player.r,e.level.objects[0].y);
  run(e,.4);assert.equal(e.player.r,4.5);assert.equal(e.player.y+e.player.r,e.level.objects[0].y);
});
test('星光可选收集，接触右箭头即可触发一次通关',()=>{
  const {p}=setup(),events=[],e=new Engine(p.levels[0],p.physics,event=>events.push(event));run(e,.4);
  const exit=p.levels[0].objects.find(o=>o.type==='exit');e.player.x=exit.x;e.player.y=exit.y;e.update(1/120);run(e,1);assert.equal(e.won,true);assert.equal(events.filter(v=>v==='win').length,1);assert.equal(e.collected.size,0);
});
test('墨水拾取只生效一次，掉落恢复墨水并重置收集',()=>{
  const {e}=setup(),drop=e.level.objects.find(o=>o.type==='ink');e.player.ink=10;e.player.x=drop.x;e.player.y=drop.y;run(e,.02);assert.equal(e.player.ink,55);run(e,.02);assert.equal(e.player.ink,55);
  e.player.y=650;e.update(1/120);assert.equal(e.deaths,1);assert.equal(e.player.ink,100);assert.equal(e.collected.size,0);
});
test('碰到障碍回到出生点',()=>{
  const p=defaults({starter:true}),l=p.levels[3],e=new Engine(l,p.physics),h=l.objects.find(o=>o.type==='hazard'),s=l.objects.find(o=>o.type==='spawn');e.player.x=h.x;e.player.y=h.y;e.update(1/120);assert.equal(e.deaths,1);assert.equal(e.player.x,s.x);
});
test('所有默认关卡的平台高度都在正常跳跃可达范围内',()=>{
  const p=defaults({starter:true}),maxRise=p.physics.jump**2/(2*p.physics.gravity);
  for(const l of p.levels){const platforms=l.objects.filter(o=>o.type==='platform');for(let i=1;i<platforms.length;i++)assert.ok(platforms[i-1].y-platforms[i].y<maxRise);assert.equal(l.objects.filter(o=>o.type==='exit').length,1);}
});
test('无空格的字与字之间存在实际空隙，墨点可以从中掉落',()=>{
  const p=defaults({starter:true}),l={objects:[{id:'platform',type:'platform',x:100,y:200,text:'甲乙',width:100,fontSize:20,letterGap:20},{id:'spawn',type:'spawn',x:150,y:180},{id:'exit',type:'exit',x:900,y:180}]};
  const e=new Engine(l,p.physics);run(e,.25);assert.equal(e.player.grounded,false);assert.ok(e.player.y>200);
  l.objects.find(o=>o.type==='spawn').x=125;e.reset(l);run(e,.25);assert.equal(e.player.grounded,true);
});
test('镜头随跳跃和落地上下移动，关闭跟随后固定画面',()=>{
  const {e,p}=setup(),camera=new Camera();run(e,.3);camera.reset(e.player,p.camera);const start=camera.y;
  for(let i=0;i<35;i++){e.update(1/120,{jump:true});camera.update(1/120,e.player,p.camera);}assert.ok(camera.y<start-40);
  for(let i=0;i<150;i++){e.update(1/120);camera.update(1/120,e.player,p.camera);}assert.ok(Math.abs(camera.y-start)<2);
  camera.reset(e.player,{follow:0,smoothing:9});camera.update(.1,{y:100},{follow:0,smoothing:9});assert.equal(camera.y,0);
});
test('旧作品缺少新增镜头、墨点尺寸和字间距字段时可以升级导入',()=>{
  const p=defaults({starter:true});delete p.camera;delete p.physics.radius;for(const l of p.levels)for(const o of l.objects)delete o.letterGap;
  const imported=validate(p);assert.equal(imported.camera.follow,1);assert.equal(imported.physics.radius,4.5);assert.equal(imported.levels[0].objects[0].letterGap,10);
});
test('五种布局模板均可通过实际连续移动与跳跃到达箭头',()=>{
  const p=defaults({starter:true});for(const l of p.levels){const e=new Engine(l,p.physics);followText(e);assert.equal(e.won,true,l.name);assert.equal(e.deaths,0,l.name);}
});
test('随机排布稳定，每组为 1–10 字，种子和间距参与导出',()=>{
  const o={...makeLevel().objects[0],text:'字'.repeat(100),width:10000};
  for(let seed=0;seed<50;seed++){
    const gs=glyphs({...o,seed}),groups=new Map();for(const g of gs){if(!groups.has(g.group))groups.set(g.group,[]);groups.get(g.group).push(g);}
    for(const group of groups.values())assert.ok(group.length>=1&&group.length<=10);
    assert.deepEqual(gs,glyphs({...o,seed}));
    for(let i=1;i<gs.length;i++)if(gs[i].group!==gs[i-1].group){const gap=gs[i].x-gs[i-1].x-gs[i-1].width;assert.ok(gap>=18&&gap<=40);}
  }
  assert.notDeepEqual(glyphs({...o,seed:1}),glyphs({...o,seed:2}));
});
test('随机字组之间是可掉落的真实空隙，绘制与碰撞边界一致',()=>{
  const p=defaults({starter:true}),o={...p.levels[0].objects[0],x:100,y:200,width:300,text:'天地玄黄',groupMin:1,groupMax:1,gapMin:25,gapMax:35};
  const gs=glyphs(o),x=(gs[0].x+gs[0].width+gs[1].x)/2;
  const l={objects:[o,{id:'spawn',type:'spawn',x,y:180},{id:'exit',type:'exit',x:900,y:100}]};
  assert.deepEqual(colliders(l).map(b=>[b.x,b.w]),gs.map(g=>[g.x,g.width]));
  const e=new Engine(l,p.physics);run(e,.25);assert.equal(e.player.grounded,false);assert.ok(e.player.y>200);
});
test('导入拒绝反向随机范围、小数分组和非法种子',()=>{
  for(const mutate of [o=>o.groupMin=11,o=>o.groupMax=0,o=>o.groupMin=1.5,o=>o.gapMin=60,o=>o.seed=-1]){const p=defaults({starter:true});mutate(p.levels[0].objects[0]);assert.throws(()=>validate(p));}
});
test('布局升级只更新完整的旧默认关卡，保留手工调整',()=>{
  const p=defaults({starter:true});assert.equal(upgradeStockLayouts(p),false);
  const texts=['从这里，出发','每一步','都是新的句子','在留白处','遇见自己'],coords=[[80,430,230],[275,370,160],[450,310,170],[635,250,160],[805,205,145]];
  const l=clone(p.levels[0]);l.objects.slice(0,5).forEach((o,i)=>{Object.assign(o,{text:texts[i],x:coords[i][0],y:coords[i][1],width:coords[i][2],letterGap:10});for(const key of ['spacing','seed','groupMin','groupMax','gapMin','gapMax'])delete o[key];});
  const rest=[['spawn',80+230/Array.from(texts[0]).length/2,414],['collectible',344,343],['collectible',528,283],['collectible',709,223],['ink',606,278],['exit',913,179]];
  l.objects.slice(5).forEach((o,i)=>Object.assign(o,{x:rest[i][1],y:rest[i][2]}));p.levels=[l];
  const moved=clone(p);moved.levels[0].objects[5].x+=10;const snapshot=clone(moved);assert.equal(upgradeStockLayouts(moved),false);assert.deepEqual(moved,snapshot);
  const id=l.id;p.theme.paper='#ffffee';assert.equal(upgradeStockLayouts(p),true);assert.equal(p.levels[0].id,id);assert.equal(p.theme.paper,'#ffffee');assert.equal(p.levels[0].objects[0].spacing,'grouped');
});

test('所有模板从左上到右下，下一关箭头紧接末尾文字',()=>{
  for(const l of defaults({starter:true}).levels){const ps=l.objects.filter(o=>o.type==='platform');for(let i=1;i<ps.length;i++){assert.ok(ps[i].x>ps[i-1].x);assert.ok(ps[i].y>ps[i-1].y);}const exit=l.objects.find(o=>o.type==='exit'),last=endOfText(l);assert.equal(exit.x,last.edge+28);assert.equal(exit.y,last.object.y+last.object.fontSize/2);}
});
