import test from 'node:test';
import assert from 'node:assert/strict';
import { immersiveView, compositionBounds } from '../src/viewport.js';
import { Camera } from '../src/camera.js';
import { isWorkshopPlaceholder, defaults, exitPosition, spawnGroundY, localizedLevel } from '../src/model.js';

test('关卡整体垂直居中，起点在左侧，末尾文字和箭头在右下并保留留白',()=>{
  for(const [w,h] of [[1280,720],[390,844],[844,390],[2560,1440]])for(const level of defaults({starter:true}).levels){
    const anchor=spawnGroundY(level),spawn=level.objects.find(o=>o.type==='spawn'),v=immersiveView(w,h,level),b=compositionBounds(level),arrow=exitPosition(level);
    assert.ok(Math.abs((b.y+b.h/2)*v.scale+v.offsetY-h*.5)<1e-8);assert.ok(v.scale<=1.15);
    const startX=spawn.x*v.scale+v.offsetX;assert.ok(startX>=w*.12&&startX<=w*.35);
    const end=immersiveView(w,h,level,1,arrow.x),endX=arrow.x*end.scale+end.offsetX,endY=arrow.y*end.scale+end.offsetY;
    assert.ok(endX>w*2/3&&endX<w*.9);assert.ok(endY>h*.58&&endY<h*.78);
    assert.ok((b.y+b.h)*v.scale+v.offsetY<=h*.9+1e-8);
    if(w>=700)assert.equal(v.scrolling,false);
    if(v.scrolling)assert.ok(Math.abs(endX-w*.78)<1e-8);
  }
});
test('100 关中英文版在宽屏、横屏和手机上均以整体内容居中',()=>{
  const p=defaults();
  for(const language of ['zh','en']){p.language=language;
    for(const raw of p.levels)for(const [w,h] of [[1280,720],[390,844],[844,390]]){
      const level=localizedLevel(p,raw),b=compositionBounds(level),v=immersiveView(w,h,level);
      const top=b.y*v.scale+v.offsetY,bottom=(b.y+b.h)*v.scale+v.offsetY;
      assert.ok(Math.abs(top+bottom-h)<1e-8);assert.ok(top>h*.2&&bottom<h*.8);
    }
  }
});
test('居中排布下纵向镜头仍随跳跃起落，初始不偏移文字区',()=>{
  const p=defaults({starter:true}),spawn=p.levels[0].objects.find(o=>o.type==='spawn'),player={y:spawn.y-p.physics.radius},camera=new Camera(),referenceHeight=player.y/.55;
  camera.reset(player,p.camera,referenceHeight);assert.ok(Math.abs(camera.y)<1e-8);
  player.y-=100;for(let i=0;i<120;i++)camera.update(1/120,player,p.camera,referenceHeight);
  assert.ok(Math.abs(camera.y+100)<1);
});
test('旧版系统标题和标语不进入沉浸游戏，自定义装饰文字正常保留',()=>{
  assert.equal(isWorkshopPlaceholder({type:'decoration',x:92,y:98,fontSize:64,text:'字间'}),true);
  assert.equal(isWorkshopPlaceholder({type:'decoration',x:99,y:263,fontSize:12,text:'EVERY WORD IS A LITTLE WORLD.'}),true);
  assert.equal(isWorkshopPlaceholder({type:'decoration',x:92,y:98,fontSize:64,text:'我的世界'}),false);
  assert.equal(isWorkshopPlaceholder({type:'platform',x:92,y:98,fontSize:64,text:'字间'}),false);
});

test('沿斜坡落地后镜头回到构图基准，跳跃跟随限制在页面留白内',()=>{
  const p=defaults({starter:true}),l=p.levels[0],settings=p.camera,camera=new Camera(),view=immersiveView(1280,720,l),firstY=spawnGroundY(l),last=l.objects.filter(o=>o.type==='platform').at(-1),lastY=last.y-p.physics.radius;
  camera.reset({y:firstY},settings,firstY/.55,view.cameraLimits);assert.ok(Math.abs(camera.y)<1e-8);
  camera.update(.2,{y:lastY},settings,lastY/.55,view.cameraLimits);assert.ok(Math.abs(camera.y)<1e-8);
  for(let i=0;i<120;i++)camera.update(1/120,{y:lastY-100},settings,lastY/.55,view.cameraLimits);
  assert.ok(camera.y<0);assert.ok(camera.y>=view.cameraLimits.min);assert.ok((compositionBounds(l).y+compositionBounds(l).h-camera.y)*view.scale+view.offsetY<=720*.97+1e-8);
});
