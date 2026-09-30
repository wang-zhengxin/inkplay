import { groupedGlyphs, wordGlyphs, isWordText } from './layout.js';
import { generateCampaign, CAMPAIGN_SEED, CAMPAIGN_LAYOUT } from './campaign.js';
export const WORLD = { width: 1000, height: 620 };
export const THEMES = {
  ink: { name: '黑白水墨', paper: '#ffffff', ink: '#202020', accent: '#303030', muted: '#a0a0a0', grid: '#555555' },
  paper: { name: '苔绿纸页', paper: '#faf8f0', ink: '#45553e', accent: '#60774f', muted: '#a7af96', grid: '#65764a' },
  night: { name: '午夜书房', paper: '#242b32', ink: '#e4dece', accent: '#cfb574', muted: '#7f8c95', grid: '#bcc1c5' },
  ocean: { name: '潮汐来信', paper: '#eef5f5', ink: '#315964', accent: '#468f9b', muted: '#8dafb3', grid: '#4b8993' },
  sunset: { name: '落日手稿', paper: '#fbf0e4', ink: '#78503d', accent: '#c37952', muted: '#c8a28b', grid: '#a47859' }
};
export const TYPES = { platform: '文字平台', decoration: '装饰文字', spawn: '出生点', exit: '出口', ink: '墨水', collectible: '星光', hazard: '障碍' };
export const clone = v => structuredClone(v);
export const uid = () => 'o-' + (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2));
export const GROUPING={spacing:'grouped',seed:1,groupMin:1,groupMax:10,gapMin:18,gapMax:40};
const object = (id,type,x,y,text='',width=30,fontSize=18) => ({id,type,x,y,text,width,fontSize,letterGap:type==='platform'?2:10,...(type==='platform'?GROUPING:{})});
export const PATTERNS=[['zigzag','斜向下 · 错落'],['leftward','斜向下 · 台阶'],['column','斜向下 · 均匀'],['scattered','斜向下 · 字岛'],['arch','斜向下 · 弧线']];
const previousPositions={
  zigzag:[[285,440],[445,380],[325,320],[465,260],[365,200]],
  leftward:[[545,440],[435,380],[325,320],[215,260],[315,200]],
  column:[[380,440],[420,380],[360,320],[400,260],[380,200]],
  scattered:[[270,440],[410,385],[530,330],[405,265],[290,205]],
  arch:[[260,440],[390,380],[510,320],[410,260],[290,200]]
};
const previousPhrases=[
  ['从这里出发，走进字里行间','每一步都是一个新的故事','让风带你越过纸上的留白','在转弯处听见自己的回声','慢慢走，遇见更好的自己'],
  ['穿过长长的留白，向远处走','慢一点也没有关系','听见风从字与字之间经过','跃过空隙，再回头看一眼','继续前行，故事还没有结束'],
  ['月光落在纸上，也落在心上','一盏灯照亮一页安静的文字','把夜色读完，把梦轻轻收好','收集微光，等一阵温柔的风','等天亮，新的句子就会醒来'],
  ['山川藏在字句之间，向上走','走向心里的山，也走向自己','远处的风带来了小小的回声','停一停，看看走过的字句','你有自己的答案，不必着急'],
  ['把故事写给远方，也写给你','带上光，沿着字句慢慢走','也带上一点墨，留下一点梦','写下最后一句，再翻开一页','未完待续，我们下页再见']
];
const forwardPositions={
  zigzag:[[110,440],[280,385],[450,405],[620,345],[790,290]],
  leftward:[[110,440],[280,400],[450,360],[620,320],[790,280]],
  column:[[110,440],[280,380],[450,320],[620,260],[790,200]],
  scattered:[[110,440],[280,400],[450,355],[620,390],[790,335]],
  arch:[[110,440],[280,380],[450,330],[620,375],[790,425]]
};
const positions={
  zigzag:[[110,190],[280,245],[450,315],[620,365],[790,430]],
  leftward:[[110,190],[280,250],[450,310],[620,370],[790,430]],
  column:[[110,180],[280,250],[450,320],[620,390],[790,460]],
  scattered:[[110,195],[280,250],[450,325],[620,390],[790,445]],
  arch:[[110,185],[280,220],[450,275],[620,355],[790,450]]
};
const phrases=[
 ['从这里，出发','每一步，都是故事','越过纸上的留白','听见风的回声','下一页，遇见自己'],
 ['穿过长长的留白','慢一点，也没关系','听见字间的风','跃过空隙，继续','故事还没有结束'],
 ['月光落在纸上','一盏灯，读一页','把夜色轻轻读完','收集一点微光','等天亮，翻新页'],
 ['山川藏在字句里','走向心里的山','风带来小小回声','停一停，再向前','答案就在下一页'],
 ['把故事写给远方','带上光，慢慢走','带一点墨和梦','写下最后一句','未完待续，下页见']
];
export function makeLevel(index=0,pattern=PATTERNS[index%5][0]) {
  const names=['初见 · 字间','穿过留白','夜读一页','山有回响','写给远方'];
  const platforms=positions[pattern].map(([x,y],i)=>({...object(uid(),'platform',x,y,phrases[index%5][i],175,19),seed:101+index*37+i*13}));
  const center=(o,f=.5)=>{const gs=glyphs(o).filter(g=>!(/\s/.test(g.char)));const g=gs[Math.floor((gs.length-1)*f)];return g.x+g.width/2;};
  const objects=[...platforms,object(uid(),'spawn',center(platforms[0],.35),platforms[0].y-16,'',18),
    ...platforms.slice(1,4).map(o=>object(uid(),'collectible',center(o),o.y-16,'',20)),
    object(uid(),'ink',center(platforms[2],.8),platforms[2].y-20,'',20),
    object(uid(),'exit',0,0,'',28),
    ...(index===3?[object(uid(),'hazard',540,500,'',65)]:[])];
  Object.assign(objects.find(o=>o.type==='exit'),exitPosition({objects}));
  return {id:'chapter-'+uid(),layoutPattern:pattern,name:names[index%5],subtitle:'在字句间，找到自己的节奏。',objects};
}
// Update only untouched starter routes, never a hand-positioned/custom chapter.
export function upgradeStockLayouts(project){
  const oldPhrases=[['从这里，出发','每一步','都是新的句子','在留白处','遇见自己'],['穿过长长的留白','慢一点','听见风的声音','跃过空隙','继续前行'],['月光落在纸上','一盏灯','把夜色读完','收集微光','等天亮'],['山川在字句之间','向上走','向心里的山走','风有回声','你有答案'],['把故事写给远方','带上光','也带上一点墨','写下最后','未完待续']];
  const coords=[[80,430,230],[275,370,160],[450,310,170],[635,250,160],[805,205,145]];
  let changed=false;
  for(const l of project.levels){
    const ps=l.objects.filter(o=>o.type==='platform'),index=oldPhrases.findIndex(p=>ps.length===5&&ps.every((o,i)=>o.text===p[i]&&o.x===coords[i][0]&&o.y===coords[i][1]&&o.width===coords[i][2]&&o.fontSize===19&&o.letterGap===10&&(o.spacing??'uniform')==='uniform'));
    if(index<0){
      const recentIndex=phrases.findIndex((p,i)=>ps.length===5&&ps.every((o,j)=>o.text===p[j]&&o.x===forwardPositions[PATTERNS[i][0]][j][0]&&o.y===forwardPositions[PATTERNS[i][0]][j][1]&&o.width===175&&o.fontSize===19&&o.spacing==='grouped'&&o.seed===101+i*37+j*13&&o.letterGap===2&&o.groupMin===1&&o.groupMax===10&&o.gapMin===18&&o.gapMax===40));
      if(recentIndex>=0&&l.objects.length===11+(recentIndex===3?1:0)){
        const center=(o,f=.5)=>{const gs=glyphs(o);const g=gs[Math.floor((gs.length-1)*f)];return g.x+g.width/2;};
        const expected=[['spawn',center(ps[0],.35),ps[0].y-16],...ps.slice(1,4).map(o=>['collectible',center(o),o.y-16]),['ink',center(ps[2],.8),ps[2].y-20],['exit',965,ps[4].y-18],...(recentIndex===3?[['hazard',540,500]]:[])];
        if(l.objects.slice(5).every((o,i)=>o.type===expected[i][0]&&o.x===expected[i][1]&&o.y===expected[i][2])){const fresh=makeLevel(recentIndex);l.objects=fresh.objects;l.layoutPattern=fresh.layoutPattern;changed=true;continue;}
      }
      const oldIndex=previousPhrases.findIndex((p,i)=>ps.length===5&&ps.every((o,j)=>o.text===p[j]&&o.x===previousPositions[PATTERNS[i][0]][j][0]&&o.y===previousPositions[PATTERNS[i][0]][j][1]&&o.width===240&&o.fontSize===19&&o.spacing==='grouped'&&o.seed===101+i*37+j*13&&o.letterGap===2&&o.groupMin===1&&o.groupMax===10&&o.gapMin===18&&o.gapMax===40));
      if(oldIndex<0||l.objects.length!==11+(oldIndex===3?1:0))continue;
      const center=(o,f=.5)=>{const gs=glyphs(o);const g=gs[Math.floor((gs.length-1)*f)];return g.x+g.width/2;};
      const expected=[['spawn',center(ps[0],.4),424],...ps.slice(1,4).map(o=>['collectible',center(o),o.y-16]),['ink',center(ps[2],.8),ps[2].y-20],['exit',center(ps[4]),ps[4].y-18],...(oldIndex===3?[['hazard',790,450]]:[])];
      if(l.objects.slice(5).some((o,i)=>o.type!==expected[i][0]||o.x!==expected[i][1]||o.y!==expected[i][2]))continue;
      const fresh=makeLevel(oldIndex);l.objects=fresh.objects;l.layoutPattern=fresh.layoutPattern;changed=true;continue;
    }
    // Extra non-stock objects signal an authored chapter; leave it intact.
    if(l.objects.some(o=>!ps.includes(o)&&!isWorkshopPlaceholder(o)&&!(['spawn','exit','ink','collectible','hazard'].includes(o.type)))||l.objects.length!==11+(index===3?1:0)+l.objects.filter(isWorkshopPlaceholder).length)continue;
    const rest=l.objects.filter(o=>!ps.includes(o)&&!isWorkshopPlaceholder(o));
    const expected=[['spawn',80+230/Array.from(oldPhrases[index][0]).length/2,414],['collectible',344,343],['collectible',528,283],['collectible',709,223],['ink',606,278],['exit',913,179],...(index===3?[['hazard',620,415]]:[])];
    if(rest.length!==expected.length||rest.some((o,i)=>o.type!==expected[i][0]||o.x!==expected[i][1]||o.y!==expected[i][2]))continue;
    const fresh=makeLevel(index);l.objects=fresh.objects;l.layoutPattern=fresh.layoutPattern;changed=true;
  }
  if(changed&&project.theme.font==='serif')project.theme.font='calligraphy';
  return changed;
}
export function endOfText(level){
  let last=null;
  for(const o of level.objects.filter(o=>o.type==='platform'))for(const g of glyphs(o).filter(g=>!(/\s/.test(g.char))))if(!last||g.x+g.width>last.edge)last={object:o,glyph:g,edge:g.x+g.width};
  return last;
}
export function exitPosition(level){
  const last=endOfText(level);
  if(last)return {x:last.edge+28,y:last.object.y+last.object.fontSize/2};
  const existing=level.objects.find(o=>o.type==='exit');return {x:existing?.x??900,y:existing?.y??400};
}
export function localizedLevel(project,level){
  const english=project.language==='en';
  const result={...level,name:english?(level.nameEn||level.name):level.name,subtitle:english?(level.subtitleEn||level.subtitle):level.subtitle,objects:level.objects.map(o=>({...o,text:english?(o.textEn||o.text):o.text}))};
  for(const o of result.objects){
    if(!o.anchor)continue;
    const platform=result.objects.find(p=>p.id===o.anchor.platformId),gs=platform?glyphs(platform).filter(g=>!/\s/.test(g.char)):[];
    if(gs.length){const g=gs[Math.floor((gs.length-1)*o.anchor.ratio)];o.x=g.x+g.width/2;o.y=platform.y+o.anchor.dy;}
  }
  const exit=result.objects.find(o=>o.type==='exit');if(exit)Object.assign(exit,exitPosition(result));
  return result;
}
export function alignExits(project){let changed=false;for(const l of project.levels){const exit=l.objects.find(o=>o.type==='exit'),position=exitPosition(localizedLevel(project,l));if(exit&&(exit.x!==position.x||exit.y!==position.y)){Object.assign(exit,position);changed=true;}}return changed;}
export function installCampaign(project){
  if(project.campaign)return false;
  const attrs=['type','x','y','width','fontSize','text','letterGap','spacing','seed','groupMin','groupMax','gapMin','gapMax'];
  const signature=l=>JSON.stringify(l.objects.filter(o=>!isWorkshopPlaceholder(o)).map(o=>attrs.map(k=>o[k])));
  const untouched=project.levels.length===5&&project.levels.every((l,i)=>{const stock=makeLevel(i);return l.name===stock.name&&l.subtitle===stock.subtitle&&l.nameEn===undefined&&l.subtitleEn===undefined&&signature(l)===signature(stock);});
  const generated=generateCampaign();
  if(untouched){generated.slice(0,5).forEach((l,i)=>l.id=project.levels[i].id);project.levels=generated;}
  else if(project.levels.length<=100)project.levels.push(...generated);
  else return false;
  project.campaign={seed:CAMPAIGN_SEED,count:100,layoutVersion:CAMPAIGN_LAYOUT};alignExits(project);return true;
}
export function upgradeCampaignLayout(project){
  if(!project.campaign||(project.campaign.layoutVersion??1)>=CAMPAIGN_LAYOUT)return false;
  const old=generateCampaign(project.campaign.seed,{layoutVersion:project.campaign.layoutVersion??1}),fresh=generateCampaign(project.campaign.seed);
  // Anchored positions are derived from glyph metrics and the current language.
  // Compare their anchors, while retaining all manually authored platform edits.
  const signature=l=>JSON.stringify(l.objects.map(o=>Object.keys(o).sort().filter(k=>!((o.type==='exit'||o.anchor)&&['x','y'].includes(k))).map(k=>[k,o[k]])));
  for(const l of project.levels){
    const index=old.findIndex(stock=>stock.objects[0].id===l.objects[0]?.id);
    if(index<0)continue;const stock=old[index];
    if(l.name===stock.name&&l.nameEn===stock.nameEn&&l.subtitle===stock.subtitle&&l.subtitleEn===stock.subtitleEn&&signature(l)===signature(stock))l.objects=fresh[index].objects;
  }
  project.campaign.layoutVersion=CAMPAIGN_LAYOUT;alignExits(project);return true;
}
export function spawnGroundY(level,radius=4.5){
  const spawn=level.objects.find(o=>o.type==='spawn');
  const support=colliders(level).filter(b=>spawn.x>=b.x&&spawn.x<=b.x+b.w&&b.y>=spawn.y-radius).sort((a,b)=>a.y-b.y)[0];
  return support?support.y-radius:spawn.y;
}
export function defaults({starter=false}={}) {
  return { version:1,title:'字间漫游',language:'zh',...(!starter?{campaign:{seed:CAMPAIGN_SEED,count:100,layoutVersion:CAMPAIGN_LAYOUT}}:{}),theme:{ preset:'ink',...THEMES.ink,background:'',font:'calligraphy' },skin:{ type:'ink',color:'#202020',image:'' },audio:{ enabled:true,volume:.35,preset:'piano',music:'',events:{ jump:'',land:'',collect:'',death:'',win:'' } },physics:{ speed:240,jump:520,gravity:1250,growScale:1.9,inkDrain:5,radius:4.5 },camera:{follow:1,smoothing:9},hud:{ x:4,y:5,visible:true },levels:starter?Array.from({length:5},(_,i)=>makeLevel(i)):generateCampaign() };
}
export function bounds(o) {
  if(o.type==='platform'){const gs=glyphs(o);if(gs.length)return{x:gs[0].x,y:o.y,w:gs.at(-1).x+gs.at(-1).width-gs[0].x,h:o.fontSize+7};}
  if (['platform','decoration'].includes(o.type)) return { x:o.x,y:o.y,w:o.width,h:o.fontSize+7 };
  const size=o.type==='exit'?28:o.type==='spawn'?18:20;
  return { x:o.x-size/2,y:o.y-size/2,w:o.type==='hazard'?o.width:size,h:size };
}
// Only the old workshop's stock title and slogan are omitted in the player.
// User-created decorations remain editable and visible in the game.
export function isWorkshopPlaceholder(o){
  return o.type==='decoration'&&(
    (o.x===92&&o.y===98&&o.fontSize===64&&['字间','留白'].includes(o.text))||
    (o.x===94&&o.y===174&&o.fontSize===64&&['漫游。','穿过留白','夜读一页','山有回响','写给远方'].includes(o.text))||
    (o.x===99&&o.y===263&&o.text==='EVERY WORD IS A LITTLE WORLD.')
  );
}
export function colliders(level) {
  return level.objects.filter(o=>o.type==='platform').flatMap(o=>{
    return glyphs(o).filter(g=>!(/\s/.test(g.char))).map(g=>({x:g.x,y:o.y,w:g.width,h:o.fontSize+5}));
  });
}
// Drawing and collision share the same per-glyph bounds. The unused part of
// each slot stays empty; even a word with no literal spaces has real gaps.
export function glyphs(o){
  if(isWordText(o.text))return wordGlyphs(o);
  if(o.spacing==='grouped')return groupedGlyphs(o);
  const chars=Array.from(o.text),unit=Math.max(o.width/Math.max(1,chars.length),o.fontSize+(o.letterGap??10)),width=o.fontSize;
  return chars.map((char,i)=>({char,x:o.x+unit*(i+.5)-width/2,width}));
}
const fail=message=>{throw new Error(message)};
const num=(v,min,max,name)=>{ if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max) fail(name+'超出范围');return v; };
const str=(v,max,name)=>{if(typeof v!=='string'||v.length>max)fail(name+'格式不正确');return v;};
const choice=(v,choices,name)=>choices.includes(v)?v:fail(name+'不受支持');
const color=(v)=>/^#[0-9a-f]{6}$/i.test(v)?v:fail('颜色需要使用 #RRGGBB 格式');
function asset(v,kind){str(v,4_000_000,'素材');if(v===''||new RegExp(kind==='image'?'^data:image/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$':'^data:audio/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+$').test(v))return v;fail('素材需要使用内嵌的'+(kind==='image'?'PNG/JPEG/WebP/GIF 图片':'音频'));}
export function validate(raw) {
  if(!raw||typeof raw!=='object'||raw.version!==1)fail('不支持的作品格式或版本');
  const d=defaults({starter:true});
  d.language=choice(raw.language??'zh',['zh','en'],'游戏语言');
  if(raw.campaign)d.campaign={seed:num(raw.campaign.seed,0,4294967295,'关卡随机种子'),count:num(raw.campaign.count,100,100,'随机关卡数'),layoutVersion:choice(raw.campaign.layoutVersion??1,[1,2,3,CAMPAIGN_LAYOUT],'关卡布局版本')};
  if(d.campaign&&!Number.isInteger(d.campaign.seed))fail('关卡随机种子需要为整数');
  d.title=str(raw.title,80,'作品名');
  const t=raw.theme; if(!t)fail('缺少主题');
  d.theme={preset:choice(t.preset,[...Object.keys(THEMES),'custom'],'主题'),name:str(t.name,80,'主题名'),paper:color(t.paper),ink:color(t.ink),accent:color(t.accent),muted:color(t.muted),grid:color(t.grid),background:asset(t.background,'image'),font:choice(t.font,['calligraphy','serif','mono','sans'],'字体')};
  const s=raw.skin;if(!s)fail('缺少角色皮肤');d.skin={type:choice(s.type,['ink','star','leaf','image'],'皮肤'),color:color(s.color),image:asset(s.image,'image')};
  if(s.type==='image'&&!s.image)fail('图片皮肤缺少图片');
  const a=raw.audio;if(!a||typeof a.enabled!=='boolean')fail('声音设置无效');d.audio={enabled:a.enabled,volume:num(a.volume,0,1,'音量'),preset:choice(a.preset,['piano','chiptune','soft'],'音色'),music:asset(a.music,'audio'),events:{}};
  for(const k of Object.keys(d.audio.events={jump:'',land:'',collect:'',death:'',win:''}))d.audio.events[k]=asset(a.events?.[k],'audio');
  const p=raw.physics;if(!p)fail('缺少物理设置');d.physics={speed:num(p.speed,60,600,'移动速度'),jump:num(p.jump,200,900,'跳跃力度'),gravity:num(p.gravity,300,2400,'重力'),growScale:num(p.growScale,1,3,'变大倍率'),inkDrain:num(p.inkDrain,0,30,'墨水消耗'),radius:num(p.radius??4.5,3,12,'墨点半径')};
  d.camera={follow:num(raw.camera?.follow??1,0,1.5,'镜头跟随强度'),smoothing:num(raw.camera?.smoothing??9,1,30,'镜头跟随速度')};
  const h=raw.hud;if(!h||typeof h.visible!=='boolean')fail('HUD 设置无效');d.hud={x:num(h.x,0,75,'HUD X'),y:num(h.y,0,90,'HUD Y'),visible:h.visible};
  if(!Array.isArray(raw.levels)||raw.levels.length<1||raw.levels.length>200)fail('作品需包含 1–200 个章节');
  const ids=new Set();d.levels=raw.levels.map(l=>{
    if(!l||typeof l!=='object')fail('章节格式无效');const id=str(l.id,100,'章节 ID');if(ids.has(id))fail('章节 ID 重复');ids.add(id);
    if(!Array.isArray(l.objects)||l.objects.length>250)fail('每章最多 250 个对象');
    const objIds=new Set();const objects=l.objects.map(o=>{
      if(!o||typeof o!=='object')fail('对象格式无效');const oid=str(o.id,100,'对象 ID');if(objIds.has(oid))fail('对象 ID 重复');objIds.add(oid);
      const type=choice(o.type,Object.keys(TYPES),'对象类型');
      const grouping=o.spacing!==undefined?{spacing:choice(o.spacing,['uniform','grouped'],'文字排列'),seed:num(o.seed??1,0,4294967295,'随机种子'),groupMin:num(o.groupMin??1,1,10,'每组最少字数'),groupMax:num(o.groupMax??10,1,10,'每组最多字数'),gapMin:num(o.gapMin??18,0,100,'最小组间距'),gapMax:num(o.gapMax??40,0,100,'最大组间距')}:{};
      if(Object.keys(grouping).length&&(grouping.groupMin>grouping.groupMax||grouping.gapMin>grouping.gapMax||!Number.isInteger(grouping.seed)||!Number.isInteger(grouping.groupMin)||!Number.isInteger(grouping.groupMax)))fail('随机排列范围无效');
      const anchor=o.anchor?{platformId:str(o.anchor.platformId,100,'锚点平台'),ratio:num(o.anchor.ratio,0,1,'锚点位置'),dy:num(o.anchor.dy,-100,100,'锚点偏移')}:null;
      return {id:oid,type,...grouping,...(anchor?{anchor}:{}),x:num(o.x,0,type==='exit'?40000:WORLD.width,'对象 X'),y:num(o.y,0,type==='exit'?720:WORLD.height,'对象 Y'),width:num(o.width,10,1000,'对象宽度'),text:str(o.text,250,'文字'),...(o.textEn!==undefined?{textEn:str(o.textEn,250,'英文文字')}:{}),fontSize:num(o.fontSize,8,100,'字号'),letterGap:num(o.letterGap??10,0,80,'字间空隙')};
    });
    for(const type of ['spawn','exit'])if(objects.filter(o=>o.type===type).length!==1)fail('每章需要恰好一个'+TYPES[type]);
    for(const o of objects)if(o.anchor&&!objects.some(p=>p.id===o.anchor.platformId&&p.type==='platform'))fail('锚点需要指向本章文字平台');
    return {id,...(l.layoutPattern!==undefined?{layoutPattern:choice(l.layoutPattern,PATTERNS.map(([id])=>id),'布局模板')}:{}),name:str(l.name,80,'章节名'),...(l.nameEn!==undefined?{nameEn:str(l.nameEn,80,'英文章节名')}:{}),subtitle:str(l.subtitle,200,'章节说明'),...(l.subtitleEn!==undefined?{subtitleEn:str(l.subtitleEn,200,'英文章节说明')}:{}),objects};
  });return d;
}
