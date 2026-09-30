import test from 'node:test';
import assert from 'node:assert/strict';
import { BounceShape, bounceScale } from '../src/bounce.js';
import { defaults } from '../src/model.js';
import { Engine } from '../src/engine.js';

test('起跳拉伸、落地压扁，弹性回弹后恢复圆形并保持面积',()=>{
  const shape=new BounceShape();shape.jump();assert.ok(shape.update(1/120,{grounded:false,vy:-520})>.25);
  shape.land(520);assert.ok(shape.update(1/120,{grounded:true,vy:0})<-.3);
  for(let k=0;k<240;k++)shape.update(1/120,{grounded:true,vy:0});assert.ok(Math.abs(shape.value)<.001);
  for(const stretch of [-.35,0,.42]){const scale=bounceScale(stretch);assert.ok(Math.abs(scale.x*scale.y-1)<1e-10);}
});
test('形变不改变碰撞半径和站立高度，起跳和落地的视觉状态随物理更新',()=>{
  const p=defaults(),e=new Engine(p.levels[0],p.physics);for(let k=0;k<90;k++)e.update(1/120);
  const radius=e.player.r,feet=e.player.y+radius;e.update(1/120,{jump:true});assert.ok(e.player.stretch>0);
  let landed=false;for(let k=0;k<150;k++){e.update(1/120);if(e.player.grounded){landed=true;assert.ok(e.player.stretch<0);break;}}
  assert.equal(landed,true);assert.equal(e.player.r,radius);assert.equal(e.player.y+radius,feet);
  const scale=bounceScale(e.player.stretch),visualY=e.player.y+radius*(1-scale.y);assert.equal(visualY+radius*scale.y,feet);
  e.player.y=650;e.update(1/120);assert.equal(e.player.stretch,0);
});
