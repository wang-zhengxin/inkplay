import test from 'node:test';
import assert from 'node:assert/strict';
import { PageSlide } from '../src/transition.js';

test('触碰右箭头向右滑动，触碰左箭头向左滑动，两页始终相接',()=>{
  for(const direction of [1,-1]){
    const slide=new PageSlide(direction);
    assert.deepEqual(slide.offsets,{outgoing:direction===1?0:-0,incoming:-direction*100});
    for(let i=0;i<31;i++){
      const {outgoing,incoming}=slide.advance(.01);
      assert.ok(Math.abs(incoming-outgoing+direction*100)<1e-8);
    }
    assert.ok(Math.abs(slide.offsets.outgoing-direction*50)<1e-8);
    assert.equal(slide.done,false);
    slide.advance(1);assert.equal(slide.done,true);
    assert.equal(slide.offsets.outgoing,direction*100);assert.equal(Math.abs(slide.offsets.incoming),0);
    const end=slide.offsets;assert.deepEqual(slide.advance(1),end);
  }
});
test('转场暂停保持原位置，减少动画模式仍保持方向和终点',()=>{
  const slide=new PageSlide(-1,.2);slide.advance(.05);const at=slide.offsets;
  assert.deepEqual(slide.advance(0),at);assert.deepEqual(slide.advance(-1),at);
  slide.advance(.15);assert.equal(slide.done,true);assert.equal(slide.offsets.outgoing,-100);assert.equal(Math.abs(slide.offsets.incoming),0);
});
