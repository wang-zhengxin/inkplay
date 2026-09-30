import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, validate, localizedLevel, glyphs, colliders, installCampaign, clone, exitPosition, upgradeCampaignLayout, alignExits } from '../src/model.js';
import { generateCampaign, CAMPAIGN_LAYOUT } from '../src/campaign.js';
import { fragmentEnvelope } from '../src/route-layout.js';
import { followText } from './helpers.js';
import { Engine } from '../src/engine.js';

test('默认 100 关完整双语、内容与布局不同，相同种子完全复现',()=>{
  const p=defaults();assert.equal(p.levels.length,100);assert.deepEqual(validate(JSON.parse(JSON.stringify(p))),p);
  assert.deepEqual(generateCampaign(),p.levels);assert.notDeepEqual(generateCampaign(42),p.levels);
  assert.equal(new Set(p.levels.map(l=>l.id)).size,100);
  assert.equal(new Set(p.levels.map(l=>l.objects.filter(o=>o.type==='platform').map(o=>o.text).join('|'))).size,100);
  assert.equal(new Set(p.levels.map(l=>l.objects.filter(o=>o.type==='platform').map(o=>`${o.x},${o.y},${o.width}`).join('|'))).size,100);
  for(const l of p.levels)for(const o of l.objects.filter(o=>o.type==='platform'))assert.ok(o.textEn&&/[A-Za-z]/.test(o.textEn));
});
test('英文按完整单词绘制和碰撞，长词、连字符与撇号均不拆分',()=>{
  const o={type:'platform',x:100,y:200,width:300,fontSize:20,text:"Don't split well-being extraordinary",spacing:'grouped',seed:23,gapMin:24,gapMax:36};
  const gs=glyphs(o);assert.deepEqual(gs.map(g=>g.char),["Don't",'split','well-being','extraordinary']);
  assert.equal(colliders({objects:[o]}).length,4);
  for(let i=1;i<gs.length;i++)assert.ok(gs[i].x-gs[i-1].x-gs[i-1].width>9);
  assert.equal(glyphs({...o,width:10,text:'supercalifragilisticexpialidocious'}).length,1);
  const p=defaults(),word=gs[0],objects=[{id:'text',...o},{id:'spawn',type:'spawn',x:word.x+word.width*.6,y:180},{id:'exit',type:'exit',x:900,y:200}];
  let e=new Engine({objects},p.physics);for(let k=0;k<60;k++)e.update(1/120);assert.equal(e.player.grounded,true);
  objects[1].x=(gs[0].x+gs[0].width+gs[1].x)/2;e=new Engine({objects},p.physics);for(let k=0;k<40;k++)e.update(1/120);assert.equal(e.player.grounded,false);assert.ok(e.player.y>200);
});
test('长短片段都保持固定字号字宽，超出片段范围时自然延伸而不缩小',()=>{
  for(const text of ['Follow the mountains','Supercalifragilisticexpialidocious','从字间出发，越过留白']){
    const o={type:'platform',x:100,y:200,width:10,fontSize:19,text,spacing:'grouped',seed:23,letterGap:2,gapMin:24,gapMax:36};
    const narrow=glyphs(o),wide=glyphs({...o,width:1000});
    assert.deepEqual(narrow.map(g=>g.width),wide.map(g=>g.width));
    assert.ok(narrow.at(-1).x+narrow.at(-1).width>o.x+o.width);
    assert.deepEqual(colliders({objects:[o]}).map(b=>b.w),narrow.map(g=>g.width));
  }
  const p=defaults();p.language='en';p.levels[0].objects[4].textEn='W'.repeat(150);p.levels[0].objects[4].fontSize=40;alignExits(p);
  assert.ok(p.levels[0].objects.find(o=>o.type==='exit').x>2100);assert.deepEqual(validate(JSON.parse(JSON.stringify(p))),p);
});
test('语言切换不改写原文，出生点、星光和出口跟随对应单词',()=>{
  const p=defaults(),before=clone(p.levels),raw=p.levels[0];p.language='en';const en=localizedLevel(p,raw);
  assert.deepEqual(p.levels,before);assert.equal(en.objects[0].text,raw.objects[0].textEn);
  for(const o of en.objects.filter(o=>o.anchor)){
    const platform=en.objects.find(p=>p.id===o.anchor.platformId);
    assert.ok(glyphs(platform).some(g=>o.x>=g.x&&o.x<=g.x+g.width));
  }
  const exit=en.objects.find(o=>o.type==='exit');assert.deepEqual({x:exit.x,y:exit.y},exitPosition(en));
  assert.deepEqual(validate(JSON.parse(JSON.stringify(p))),p);
});
test('旧默认升级到 100 关，自定义内容保留，升级只执行一次',()=>{
  let p=defaults({starter:true}),ids=p.levels.map(l=>l.id);assert.equal(installCampaign(p),true);assert.equal(p.levels.length,100);assert.deepEqual(p.levels.slice(0,5).map(l=>l.id),ids);assert.equal(installCampaign(p),false);
  p=defaults({starter:true});p.levels[0].objects[0].text='我的关卡';const original=clone(p.levels);assert.equal(installCampaign(p),true);assert.equal(p.levels.length,105);assert.deepEqual(p.levels.slice(0,5),original);
  p=defaults({starter:true});p.levels[0].name='我的第一章';assert.equal(installCampaign(p),true);assert.equal(p.levels.length,105);assert.equal(p.levels[0].name,'我的第一章');
});
test('所有 100 关的中英文版均可真实移动跳跃、集齐星光并通关',()=>{
  const p=defaults();
  for(const language of ['zh','en']){
    p.language=language;
    for(const raw of p.levels){
      const l=localizedLevel(p,raw),e=new Engine(l,p.physics);followText(e);
      assert.equal(e.won,true,`${language} ${raw.name}`);assert.equal(e.deaths,0,`${language} ${raw.name}`);
      assert.ok(l.objects.filter(o=>o.type==='collectible').every(o=>e.collected.has(o.id)));
    }
  }
});

test('随机路线的回折与交叠分散在不同位置，保持向右下行进与统一字号',()=>{
  const p=defaults();
  const profiles=new Map(),overlaps=[0,0,0,0];let overlapLevels=0;
  for(const l of p.levels){
    const rows=l.objects.filter(o=>o.type==='platform'),deltas=rows.slice(1).map((o,i)=>o.y-rows[i].y),profile=deltas.map(Math.sign).join(',');
    profiles.set(profile,(profiles.get(profile)||0)+1);
    assert.ok(rows.at(-1).y>rows[0].y+230);assert.ok(rows.every(o=>o.fontSize===19&&o.x>=0&&o.x<=990&&o.y>=0&&o.y<=620));
    assert.ok(rows.slice(1).every((o,i)=>o.x>rows[i].x));
    assert.ok(deltas.every(d=>d>=-45&&d<=132&&Math.abs(d)>=28));
    assert.ok(new Set(rows.slice(1).map((o,i)=>o.x-rows[i].x)).size>1);
    let count=0;
    for(let i=0;i<4;i++){
      const gap=rows[i+1].x+fragmentEnvelope(rows[i+1]).left-rows[i].x-fragmentEnvelope(rows[i]).right;
      assert.ok(gap>=-35&&gap<=45);
      if(gap<0){count++;overlaps[i]++;}
    }
    assert.ok(count<=1);if(count)overlapLevels++;
    for(const language of ['zh','en']){
      p.language=language;const localized=localizedLevel(p,l),texts=localized.objects.filter(o=>o.type==='platform');
      for(let i=0;i<4;i++){
        const a=glyphs(texts[i]),b=glyphs(texts[i+1]);
        assert.ok(b.at(-1).x+b.at(-1).width>a.at(-1).x+a.at(-1).width);
        assert.ok(b[0].x-a.at(-1).x-a.at(-1).width<=140);
      }
      assert.equal(exitPosition(localized).y,texts.at(-1).y+19/2);
    }
  }
  assert.equal(profiles.size,3);assert.ok([...profiles.values()].every(count=>count>=15));
  assert.ok(overlaps.every(count=>count>=5));assert.ok(overlapLevels>=25&&overlapLevels<=55);
});
test('版本 1 随机存档升级保留手工编辑',()=>{
  const p=defaults();
  delete p.campaign.layoutVersion;p.levels=generateCampaign(p.campaign.seed,{layoutVersion:1});p.levels[0].objects[0].text='自己写的路';const stored=validate(JSON.parse(JSON.stringify(p)));Object.assign(p,stored);const original=clone(p.levels[0]);
  assert.equal(upgradeCampaignLayout(p),true);assert.deepEqual(p.levels[0],original);assert.deepEqual(p.levels[1].objects,generateCampaign()[1].objects);assert.equal(upgradeCampaignLayout(p),false);
});
test('版本 2、3 存档升级：派生锚点随排布更新，自定义位置、文字和收集物保留',()=>{
  for(const layoutVersion of [2,3]){
    const p=defaults();p.campaign.layoutVersion=layoutVersion;p.levels=generateCampaign(p.campaign.seed,{layoutVersion});
    p.levels[0].id='保留章节链接';
    for(const o of p.levels[0].objects.filter(o=>o.anchor)){o.x+=3;o.y+=2;}
    p.levels[2].objects[1].x+=5;
    p.levels[3].objects[1].textEn='My own words';
    p.levels[4].objects.find(o=>o.anchor).anchor.ratio=.2;
    p.levels[5].objects.push({id:'my-star',type:'collectible',x:10,y:20,width:20,fontSize:18,text:'',letterGap:10});
    alignExits(p);const saved=validate(JSON.parse(JSON.stringify(p))),custom=clone(saved.levels.slice(2,6));
    assert.equal(upgradeCampaignLayout(saved),true);assert.equal(saved.campaign.layoutVersion,CAMPAIGN_LAYOUT);
    assert.equal(saved.levels[0].id,'保留章节链接');assert.deepEqual(saved.levels[0].objects,generateCampaign()[0].objects);
    assert.deepEqual(saved.levels.slice(2,6),custom);assert.equal(upgradeCampaignLayout(saved),false);
  }
});
test('不同种子的随机路线均满足双语真实跳跃通关与存档范围',()=>{
  for(const seed of [0,42,4294967295]){
    const p=defaults();p.campaign.seed=seed;p.levels=generateCampaign(seed);
    assert.deepEqual(validate(JSON.parse(JSON.stringify(p))),p);
    for(const language of ['zh','en']){
      p.language=language;
      for(const raw of p.levels){
        const level=localizedLevel(p,raw),e=new Engine(level,p.physics);followText(e);
        assert.equal(e.won,true,`${seed} ${language} ${raw.name}`);assert.equal(e.deaths,0);
        assert.ok(level.objects.filter(o=>o.type==='collectible').every(o=>e.collected.has(o.id)));
      }
    }
  }
});
