import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, localizedLevel, colliders } from '../src/model.js';
import { Engine } from '../src/engine.js';

test('主页面换语言保留章节、星光、墨水和游玩统计，并落在新文字上',()=>{
  const p=defaults();
  for(const raw of p.levels){
    p.language='zh';const e=new Engine(localizedLevel(p,raw),p.physics);
    for(let k=0;k<70;k++)e.update(1/120);
    assert.equal(e.player.grounded,true);e.player.ink=73;e.deaths=2;
    const collected=raw.objects.find(o=>o.type==='collectible').id;e.collected.add(collected);
    for(const language of ['en','zh']){
      const elapsed=e.elapsed,y=e.player.y;p.language=language;const l=localizedLevel(p,raw);e.localize(l);
      assert.equal(e.level.id,raw.id);assert.deepEqual(e.platforms,colliders(l));assert.equal(e.player.y,y);
      assert.equal(e.elapsed,elapsed);assert.equal(e.deaths,2);assert.equal(e.player.ink,73);assert.ok(e.collected.has(collected));
      for(let k=0;k<25;k++)e.update(1/120);
      assert.equal(e.player.grounded,true);assert.equal(e.deaths,2);
    }
  }
});
test('空中换语言延续起跳运动，不重置角色或触发翻页',()=>{
  const p=defaults(),events=[],e=new Engine(localizedLevel(p,p.levels[0]),p.physics,event=>events.push(event));
  for(let k=0;k<70;k++)e.update(1/120);e.update(1/120,{jump:true,right:true});
  const state=structuredClone(e.player);p.language='en';e.localize(localizedLevel(p,p.levels[0]));
  assert.deepEqual(e.player,state);assert.equal(e.won,false);assert.equal(e.transitioning,false);assert.deepEqual(events,['land','jump']);
});
test('出生尚未落地时快速切换语言，随新语言的出生点落到文字上',()=>{
  const p=defaults();
  for(const raw of p.levels){
    p.language='zh';const e=new Engine(localizedLevel(p,raw),p.physics);e.update(1/120);
    p.language='en';e.localize(localizedLevel(p,raw));
    for(let k=0;k<70;k++)e.update(1/120);
    assert.equal(e.player.grounded,true);assert.equal(e.deaths,0);
  }
});
