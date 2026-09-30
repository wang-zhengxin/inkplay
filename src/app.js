import { adjacentChapter, arrivalPoint } from './navigation.js';
import { WORLD, THEMES, TYPES, defaults, makeLevel, uid, clone, validate, bounds, GROUPING, PATTERNS, upgradeStockLayouts, alignExits, localizedLevel, installCampaign, upgradeCampaignLayout } from './model.js';
import { generateCampaign, CAMPAIGN_LAYOUT } from './campaign.js';
import { isWordText } from './layout.js';
import { Engine } from './engine.js';
import { Renderer } from './render.js';
import { Sound } from './audio.js';
import * as storage from './storage.js';
const $=id=>document.getElementById(id);
let project=defaults(),levelIndex=0,selected=null,tab='content',mode='edit',grid=true,undo=[],redo=[],drag=null,saveTimer=null;
let keys={},pendingJump=false,completed=new Set(),engine,saveChain=Promise.resolve(),lastTime=0,accumulator=0,toastTimer;
const sound=new Sound(),renderer=new Renderer($('canvas'));
const level=()=>project.levels[levelIndex];
const viewLevel=()=>localizedLevel(project,level());
const object=()=>level().objects.find(o=>o.id===selected);
const esc=text=>String(text).replace(/[&<>"']/g,v=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[v]));
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3200);}
function historyButtons(){$('undo-btn').disabled=mode==='play'||!undo.length;$('redo-btn').disabled=mode==='play'||!redo.length;}
function checkpoint(){undo.push({project:clone(project),levelIndex,selected});if(undo.length>30)undo.shift();redo=[];historyButtons();}
function persist(){
  $('save-status').textContent='正在保存…';clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>{const snapshot=clone(project);saveChain=saveChain.catch(()=>{}).then(()=>storage.save(snapshot)).then(()=>{$('save-status').innerHTML='<i></i> 已保存在本机';}).catch(()=>{$('save-status').textContent='保存失败，请导出备份';toast('浏览器未能保存作品，请导出 JSON 备份。');});},350);
}
async function flushSave(){clearTimeout(saveTimer);await saveChain.catch(()=>{});await storage.save(clone(project));}
function apply(){
  sound.configure(project.audio);
  const t=project.theme,stage=$('stage');stage.style.setProperty('--game-paper',t.paper);stage.style.setProperty('--game-ink',t.ink);stage.style.setProperty('--game-accent',t.accent);
  $('game-hud').style.left=project.hud.x+'%';$('game-hud').style.top=project.hud.y+'%';$('game-hud').hidden=!project.hud.visible;
  $('chapter-label').innerHTML=`${String(levelIndex+1).padStart(2,'0')} / ${String(project.levels.length).padStart(2,'0')} · ${esc(viewLevel().name)}<span id="star-counter"></span>`;
  document.title='创作工坊 · '+project.title;
  document.querySelectorAll('.return-game,.brand').forEach(a=>a.href='./?chapter='+encodeURIComponent(level().id));
  if(engine)updateHud();
}
function rebuild(){alignExits(project);engine=new Engine(viewLevel(),project.physics,gameEvent);apply();$('game-result').hidden=true;updateHud();}
function change(fn,{inspect=false,restart=true}={}){checkpoint();fn();if(restart)rebuild();apply();renderLevels();renderLayers();if(inspect)renderInspector();persist();}
function restore(from,to){if(!from.length)return;to.push({project:clone(project),levelIndex,selected});const state=from.pop();project=state.project;levelIndex=state.levelIndex;selected=state.selected;setMode('edit');rebuild();refresh();persist();}
function refresh(){renderLevels();renderInspector();renderLayers();historyButtons();apply();}
function select(id){selected=id;renderInspector();renderLayers();}
function selectLevel(i){levelIndex=i;selected=null;setMode('edit');rebuild();refresh();}
function renderLevels(){
  $('level-count').textContent=String(project.levels.length).padStart(2,'0');
  $('level-list').innerHTML=project.levels.map((l,i)=>`<button class="level-item ${i===levelIndex?'active':''}" data-level="${i}" aria-current="${i===levelIndex?'true':'false'}"><span class="level-number">CHAPTER ${String(i+1).padStart(2,'0')}</span><span class="level-name">${esc(project.language==='en'?(l.nameEn||l.name):l.name)}</span>${completed.has(l.id)?'<span class="completion">✓</span>':''}</button>`).join('');
  $('level-list').querySelectorAll('button').forEach(b=>b.onclick=()=>selectLevel(Number(b.dataset.level)));
}
function renderLayers(){
  $('layers-panel').innerHTML=viewLevel().objects.map(o=>`<button data-object="${esc(o.id)}" class="${selected===o.id?'active':''}">${esc(TYPES[o.type])} · ${esc(o.text||o.id.slice(-4))}</button>`).join('');
  $('layers-panel').querySelectorAll('button').forEach(b=>b.onclick=()=>select(b.dataset.object));
}
function field(label,path,value,{type='text',min,max,step,help}={}){return `<label class="field"><span>${label}</span><input data-path="${path}" type="${type}" value="${esc(value)}" ${min!==undefined?`min="${min}"`:''} ${max!==undefined?`max="${max}"`:''} ${step!==undefined?`step="${step}"`:''}>${help?`<small>${help}</small>`:''}</label>`;}
function options(label,path,value,entries){return `<label class="field"><span>${label}</span><select data-path="${path}">${entries.map(([v,label])=>`<option value="${v}" ${v===value?'selected':''}>${label}</option>`).join('')}</select></label>`;}
function colorField(label,path,color){return `<label class="color-field"><span>${label}</span><input type="color" data-path="${path}" value="${color}"></label>`;}
function upload(label,target,kind){return `<label class="upload-label">${label}<input type="file" data-upload="${target}" accept="${kind==='image'?'image/png,image/jpeg,image/webp,image/gif':'audio/*'}"></label>`;}
function getPath(path){const [scope,...parts]=path.split('.');let value=scope==='level'?level():scope==='object'?object():project;for(const p of parts)value=value?.[p];return value;}
function setPath(path,value){const [scope,...parts]=path.split('.');let target=scope==='level'?level():scope==='object'?object():project;for(const p of parts.slice(0,-1))target=target[p];target[parts.at(-1)]=value;}
function renderInspector(){
  const o=object(),t=project.theme,a=project.audio;
  const display=o?viewLevel().objects.find(v=>v.id===o.id):null,wordMode=o&&isWordText(display.text);
  let html='';
  if(tab==='content'){
    html=options('游戏语言','project.language',project.language,[['zh','中文'],['en','English · 完整单词']])+field('章节名称','level.name',level().name,{max:80})+`<label class="field"><span>章节说明</span><textarea data-path="level.subtitle" maxlength="200">${esc(level().subtitle)}</textarea></label>`;
    html+=`<div class="section-title">${o?'选中对象':'开始创作'}${o?`<span class="object-badge">${TYPES[o.type]}</span>`:'<span>↖</span>'}</div>`;
    if(o){
      if(['platform','decoration'].includes(o.type))html+=`<label class="field"><span>中文文字</span><textarea data-path="object.text" maxlength="250">${esc(o.text)}</textarea></label><label class="field"><span>English</span><textarea data-path="object.textEn" maxlength="250">${esc(o.textEn??'')}</textarea><small>英文单词内部连续，词间留空隙。未填写英文时使用原文字。</small></label>`;
      html+=`<div class="field-row">${field('X · 水平位置','object.x',display.x,{type:'number',min:0,max:1000})}${field('Y · 垂直位置','object.y',display.y,{type:'number',min:0,max:620})}</div>`;
      if(['platform','decoration','hazard'].includes(o.type))html+=`<div class="field-row">${field('宽度','object.width',o.width,{type:'number',min:10,max:1000})}${o.type!=='hazard'?field('字号','object.fontSize',o.fontSize,{type:'number',min:8,max:100}):''}</div>`;
      if(o.type==='exit')html+='<p class="help-copy">下一关箭头紧跟最后一个文字平台，随文字的位置、字距和字号自动移动。起点左跳返回上一关。</p>';
      if(o.type==='platform'){
        html+=options('文字排列','object.spacing',o.spacing??'uniform',[['grouped','随机分组'],['uniform','等距排列']]);
        if(!wordMode||o.spacing!=='grouped')html+=field(wordMode?'单词间距 · px':o.spacing==='grouped'?'组内字间距 · px':'字间空隙 · px','object.letterGap',o.letterGap??10,{type:'number',min:0,max:80,help:wordMode?'单词内部始终连续；仅单词之间存在空隙。':'字缝参与真实碰撞；墨点直径小于空隙时会落下。'});
        if(o.spacing==='grouped'){
          if(!wordMode)html+=`<div class="field-row">${field('每组最少字数','object.groupMin',o.groupMin,{type:'number',min:1,max:10,step:1})}${field('每组最多字数','object.groupMax',o.groupMax,{type:'number',min:1,max:10,step:1})}</div>`;
          html+=`<div class="field-row">${field('组间距最小 · px','object.gapMin',o.gapMin,{type:'number',min:0,max:100})}${field('组间距最大 · px','object.gapMax',o.gapMax,{type:'number',min:0,max:100})}</div>`;
          html+=field('随机种子','object.seed',o.seed,{type:'number',min:0,max:4294967295,step:1})+'<button id="reroll-spacing" class="secondary">重新随机分组 ↻</button><p class="help-copy">同一随机种子会保留同一排布。宽度不足时，字距会等比收缩；加大宽度可容纳完整间距。</p>';
        }
      }
      if(!['spawn','exit'].includes(o.type))html+='<div class="inspector-buttons"><button id="duplicate-object" class="secondary">复制对象</button><button id="delete-object" class="secondary danger">删除对象</button></div>';
      else html+='<p class="help-copy">每章保留一个出生点和一个出口。出生点可拖动；出口自动跟随末尾文字。</p>';
    }else html+='<p class="help-copy">点击画布中的文字或图标，在这里精细调整。按住并拖动，即可改变它的位置。</p><p class="help-copy">下方「落笔」工具可以添加文字、星光、墨水和障碍。</p>';
    html+='<div class="section-title">布局模板</div>'+options('路线方向','layout-pattern',level().layoutPattern??'zigzag',PATTERNS)+'<button id="apply-pattern" class="secondary">应用到当前章节</button><p class="help-copy">替换当前文字与游戏对象，保留装饰文字。可通过撤销恢复，应用后仍可自由拖动。</p>';
    html+='<div class="section-title">随机世界 · 100 关</div>'+field('整套关卡的随机种子','campaign-seed',project.campaign?.seed??20260930,{type:'number',min:0,max:4294967295,step:1})+'<button id="generate-campaign" class="secondary">重新生成 100 关 ↻</button><p class="help-copy">同一种子得到同一套双语关卡。替换整套章节，可撤销恢复；外观、声音和规则保留。</p><div class="section-title">章节管理</div><div class="inspector-buttons"><button id="duplicate-level" class="secondary">复制章节</button><button id="delete-level" class="secondary danger">删除章节</button></div>';
  }else if(tab==='style'){
    html='<span class="field-title">纸张与墨色</span><div class="theme-grid">'+Object.entries(THEMES).map(([id,theme])=>`<button class="theme-card ${t.preset===id?'active':''}" data-theme="${id}"><span class="theme-swatch" style="background:${theme.paper};color:${theme.ink}">a little world</span>${theme.name}</button>`).join('')+'</div>';
    html+='<div class="section-title">自定义调色</div>'+colorField('纸张颜色','project.theme.paper',t.paper)+colorField('文字颜色','project.theme.ink',t.ink)+colorField('强调色','project.theme.accent',t.accent)+colorField('装饰与网格','project.theme.muted',t.muted);
    html+=options('文字风格','project.theme.font',t.font,[['calligraphy','墨迹 · 毛笔楷书'],['serif','书页 · 宋体 / Serif'],['mono','打字机 · Monospace'],['sans','清简 · Sans Serif']]);
    html+=upload(t.background?'↥ 替换背景图片':'＋ 上传背景图片','project.theme.background','image')+(t.background?'<button id="clear-background" class="quiet">移除背景图片</button>':'');
    html+='<div class="section-title">你的墨点</div><div class="skin-options">'+[['ink','●','墨点'],['star','✦','星星'],['leaf','❧','叶子']].map(([type,icon,name])=>`<button data-skin="${type}" class="skin-option ${project.skin.type===type?'active':''}"><span>${icon}</span>${name}</button>`).join('')+'</div>';
    html+=colorField('角色颜色','project.skin.color',project.skin.color)+upload(project.skin.image?'↥ 替换角色图片':'＋ 上传角色皮肤','project.skin.image','image');
    html+='<div class="section-title">墨水状态栏</div>'+`<label class="toggle-field">显示状态栏<input data-path="project.hud.visible" type="checkbox" ${project.hud.visible?'checked':''}></label><div class="field-row">${field('X · 百分比','project.hud.x',project.hud.x,{type:'number',min:0,max:75})}${field('Y · 百分比','project.hud.y',project.hud.y,{type:'number',min:0,max:90})}</div>`;
  }else if(tab==='audio'){
    html=`<label class="toggle-field">开启声音<input data-path="project.audio.enabled" type="checkbox" ${a.enabled?'checked':''}></label><label class="field"><span>主音量 <output id="volume-value">${Math.round(a.volume*100)}%</output></span><input data-path="project.audio.volume" type="range" min="0" max="1" step=".01" value="${a.volume}"></label>`;
    html+=options('默认音色','project.audio.preset',a.preset,[['piano','纸间琴音'],['soft','柔和轻响'],['chiptune','像素游戏机']]);
    html+='<div class="section-title">事件音效</div><p class="help-copy">点击 ▶ 试听。上传音频后，将替换该事件的默认音效。</p>';
    for(const [key,name] of [['jump','跳跃'],['land','落地'],['collect','收集'],['death','重生'],['win','通关']])html+=`<div class="sound-event"><span>${name}</span><button data-preview="${key}" aria-label="试听${name}">▶</button>${upload(a.events[key]?'替换音频':'上传音频','project.audio.events.'+key,'audio')}${a.events[key]?`<button data-clear-sound="${key}" class="remove-sound" aria-label="恢复${name}默认音效">×</button>`:''}</div>`;
    html+='<div class="section-title">背景音乐</div>'+upload(a.music?'↥ 替换背景音乐':'＋ 上传循环背景音乐','project.audio.music','audio')+(a.music?'<button id="music-preview" class="quiet">▶ 试听音乐</button> <button id="clear-music" class="quiet">移除音乐</button>':'')+'<p class="help-copy">音乐在试玩时循环播放，回到创作时停止。音频上限 2 MB；图片上限 1 MB。素材随 JSON 一同导出。</p>';
  }else{
    html=field('作品名称','project.title',project.title,{max:80})+'<div class="section-title">运动与墨水</div>'+field('移动速度 · px/s','project.physics.speed',project.physics.speed,{type:'number',min:60,max:600})+field('跳跃力度 · px/s','project.physics.jump',project.physics.jump,{type:'number',min:200,max:900})+field('重力 · px/s²','project.physics.gravity',project.physics.gravity,{type:'number',min:300,max:2400})+field('墨点半径 · px','project.physics.radius',project.physics.radius,{type:'number',min:3,max:12,step:.5})+field('变大倍率','project.physics.growScale',project.physics.growScale,{type:'number',min:1,max:3,step:.1})+field('变大时墨水消耗 · %/s','project.physics.inkDrain',project.physics.inkDrain,{type:'number',min:0,max:30,help:'设为 0 可无限变大。拾取墨水恢复 45%。'})+'<div class="section-title">随墨点起落的镜头</div>'+field('跟随强度','project.camera.follow',project.camera.follow,{type:'number',min:0,max:1.5,step:.1,help:'1 为完整跟随，0 为固定画面。跳跃、下落、跨平台时整页文字随镜头上下移动。'})+field('镜头跟随速度','project.camera.smoothing',project.camera.smoothing,{type:'number',min:1,max:30,help:'越高越紧跟，越低越柔和。'});
    html+='<p class="help-copy">规则与外观作用于全部章节。创作内容按章节独立保存。修改参数后点「试玩」，感受不同的跳跃节奏。</p><div class="section-title">试玩操作</div><p class="help-copy">A / D 移动 · W 跳跃<br>按住 W / ↑ 落地连跳<br>起点左跳返回上一关<br>空格变大 · R 重来 · Esc 返回创作</p>';
  }
  $('inspector-body').innerHTML=html;
  $('inspector-body').querySelectorAll('[data-path]').forEach(input=>{
    if(['object.x','object.y'].includes(input.dataset.path)&&o?.type==='exit')input.disabled=true;
    if(input.type==='text')input.maxLength=Number(input.max)||80;
    input.onchange=()=>{
      if(['layout-pattern','campaign-seed'].includes(input.dataset.path))return;
      let value=input.type==='checkbox'?input.checked:['number','range'].includes(input.type)?Number(input.value):input.value;
      if(input.type==='number'&&(!Number.isFinite(value)||input.value==='')){input.value=getPath(input.dataset.path);return;}
      if(input.type==='number')value=Math.max(Number(input.min),Math.min(Number(input.max),value));
      const path=input.dataset.path;
      if(['object.x','object.y','object.width','object.fontSize','object.seed','object.groupMin','object.groupMax'].includes(path))value=Math.round(value);
      change(()=>{
        if(path==='object.spacing')Object.assign(object(),{...GROUPING,...object(),seed:object().seed??Math.floor(Math.random()*4294967296)});
        setPath(path,value);
        if(['object.x','object.y'].includes(path))delete object().anchor;
      if(path==='object.groupMin')object().groupMax=Math.max(value,object().groupMax);
        if(path==='object.groupMax')object().groupMin=Math.min(value,object().groupMin);
        if(path==='object.gapMin')object().gapMax=Math.max(value,object().gapMax);
        if(path==='object.gapMax')object().gapMin=Math.min(value,object().gapMin);
        if(path.startsWith('project.theme.')&&input.type==='color'){project.theme.preset='custom';if(path.endsWith('.muted'))project.theme.grid=value;}},{inspect:input.type==='color'||['project.language','object.spacing','object.groupMin','object.groupMax','object.gapMin','object.gapMax'].includes(path)});
      if(input.type==='number')input.value=value;
      if(path==='project.audio.volume')$('volume-value').textContent=Math.round(value*100)+'%';
    };
    if(input.type==='range')input.oninput=()=>{if(input.dataset.path==='project.audio.volume')$('volume-value').textContent=Math.round(Number(input.value)*100)+'%';};
  });
  $('inspector-body').querySelectorAll('[data-upload]').forEach(i=>i.onchange=()=>uploadAsset(i));
  $('inspector-body').querySelectorAll('[data-theme]').forEach(b=>b.onclick=()=>change(()=>{project.theme={...project.theme,...THEMES[b.dataset.theme],preset:b.dataset.theme};project.skin.color=project.theme.ink;},{inspect:true}));
  $('inspector-body').querySelectorAll('[data-skin]').forEach(b=>b.onclick=()=>change(()=>project.skin.type=b.dataset.skin,{inspect:true}));
  $('inspector-body').querySelectorAll('[data-preview]').forEach(b=>b.onclick=()=>sound.play(b.dataset.preview));
  $('inspector-body').querySelectorAll('[data-clear-sound]').forEach(b=>b.onclick=()=>change(()=>project.audio.events[b.dataset.clearSound]='',{inspect:true}));
  if($('duplicate-object'))$('duplicate-object').onclick=()=>{if(level().objects.length>=250){toast('每章最多 250 个对象。');return;}change(()=>{const c=clone(object()),visible=viewLevel().objects.find(o=>o.id===selected);Object.assign(c,{x:visible.x,y:visible.y});delete c.anchor;c.id=uid();c.x=Math.min(970,c.x+25);c.y=Math.min(590,c.y+25);level().objects.push(c);selected=c.id;},{inspect:true});};
  if($('reroll-spacing'))$('reroll-spacing').onclick=()=>change(()=>object().seed=Math.floor(Math.random()*4294967296),{inspect:true});
  if($('apply-pattern'))$('apply-pattern').onclick=()=>{const pattern=$('inspector-body').querySelector('[data-path="layout-pattern"]').value;change(()=>{level().layoutPattern=pattern;level().objects=[...makeLevel(levelIndex,pattern).objects,...level().objects.filter(o=>o.type==='decoration')];selected=null;},{inspect:true});};
  if($('generate-campaign'))$('generate-campaign').onclick=()=>{const input=$('inspector-body').querySelector('[data-path="campaign-seed"]'),seed=Math.max(0,Math.min(4294967295,Math.round(Number(input.value)||0)));change(()=>{project.levels=generateCampaign(seed);project.campaign={seed,count:100,layoutVersion:CAMPAIGN_LAYOUT};levelIndex=0;selected=null;completed.clear();},{inspect:true});toast('100 个中英文关卡已生成，可以撤销恢复原作品。');};
  if($('delete-object'))$('delete-object').onclick=deleteObject;
  if($('duplicate-level'))$('duplicate-level').onclick=()=>{if(project.levels.length>=200){toast('最多可创建 200 个章节。');return;}change(()=>{const copy=clone(level());copy.id='chapter-'+uid();copy.name+=' · 副本';if(copy.nameEn)copy.nameEn+=' · Copy';const ids=new Map(copy.objects.map(o=>[o.id,uid()]));copy.objects.forEach(o=>{o.id=ids.get(o.id);if(o.anchor)o.anchor.platformId=ids.get(o.anchor.platformId);});project.levels.splice(levelIndex+1,0,copy);levelIndex++;selected=null;},{inspect:true});};
  if($('delete-level')){$('delete-level').disabled=project.levels.length===1;$('delete-level').onclick=()=>{change(()=>{project.levels.splice(levelIndex,1);levelIndex=Math.min(levelIndex,project.levels.length-1);selected=null;},{inspect:true});toast('章节已删除，可以撤销恢复。');};}
  if($('clear-background'))$('clear-background').onclick=()=>change(()=>project.theme.background='',{inspect:true});
  if($('clear-music'))$('clear-music').onclick=()=>{sound.stopMusic();change(()=>project.audio.music='',{inspect:true});};
  if($('music-preview'))$('music-preview').onclick=()=>{sound.unlock();if(sound.music){sound.stopMusic();$('music-preview').textContent='▶ 试听音乐';}else{sound.startMusic();$('music-preview').textContent='■ 停止试听';}};
}
async function uploadAsset(input){
  const file=input.files[0];if(!file)return;const isImage=input.dataset.upload.includes('skin')||input.dataset.upload.includes('background');
  const limit=(isImage?1:2)*1024*1024;if(file.size>limit){toast('素材过大，请使用不超过 '+(isImage?'1':'2')+' MB 的文件。');return;}
  if(isImage&&!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)){toast('请选择 PNG、JPEG、WebP 或 GIF 图片。');return;}
  const capturedPath=input.dataset.upload;
  try{
    const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file);});
    if(isImage){await new Promise((resolve,reject)=>{const image=new Image();image.onload=resolve;image.onerror=()=>reject(new Error('图片无法解码'));image.src=data;});}
    else{await new Promise((resolve,reject)=>{const audio=new Audio();audio.onloadedmetadata=resolve;audio.onerror=()=>reject(new Error('音频无法解码'));audio.src=data;});}
    const candidate=clone(project);let target=candidate;const parts=capturedPath.split('.').slice(1);for(const p of parts.slice(0,-1))target=target[p];target[parts.at(-1)]=data;if(capturedPath==='project.skin.image')candidate.skin.type='image';validate(candidate);
    if(JSON.stringify(candidate).length>18_000_000)throw new Error('作品素材总量超过 18 MB，请移除部分素材');
    change(()=>{sound.stopMusic();project=candidate;},{inspect:true});toast('素材已添加，会随作品保存与导出。');
  }catch(e){toast(e.message||'素材读取失败，请换一个文件。');}
}
function deleteObject(){const o=object();if(!o||['spawn','exit'].includes(o.type))return;change(()=>{level().objects=level().objects.filter(o=>o.id!==selected);for(const item of level().objects)if(item.anchor?.platformId===selected)delete item.anchor;selected=null;},{inspect:true});}
function setMode(next){
  mode=next;keys={};pendingJump=false;drag=null;sound.stop();$('edit-mode').classList.toggle('active',mode==='edit');$('play-mode').classList.toggle('active',mode==='play');$('stage-cta').hidden=mode==='play';$('game-result').hidden=true;
  $('mode-hint').innerHTML=mode==='edit'?'<i class="small-dot"></i> 拖动文字，重新编排你的世界':'<i class="small-dot"></i> 收集星光，向着箭头出口前行';
  document.querySelectorAll('[data-add]').forEach(b=>b.disabled=mode==='play');
  $('touch-controls').hidden=mode!=='play'||!matchMedia('(pointer: coarse)').matches;
  if(mode==='play'){rebuild();sound.unlock();sound.startMusic();$('canvas').focus();}else{rebuild();}
  $('inspector-body').inert=mode==='play';$('undo-btn').disabled=mode==='play'||!undo.length;$('redo-btn').disabled=mode==='play'||!redo.length;
}
function updateHud(){$('ink-fill').style.width=engine.player.ink+'%';$('ink-value').textContent=Math.round(engine.player.ink)+'%';const stars=level().objects.filter(o=>o.type==='collectible');if($('star-counter'))$('star-counter').textContent=mode==='play'?`✧ ${stars.filter(o=>engine.collected.has(o.id)).length} / ${stars.length}`:`✧ ${stars.length} 颗星光`;}
function gameEvent(event){if(event==='previous'){queueMicrotask(()=>{levelIndex=adjacentChapter(levelIndex,-1,project.levels.length);selected=null;setMode('play');Object.assign(engine.player,arrivalPoint(engine.level,engine.player.r));engine.gateCooldown=.7;refresh();$('inspector-body').inert=true;});return;}sound.play(event);if(event==='win'){completed.add(level().id);$('result-copy').textContent=`${level().subtitle} 用时 ${engine.elapsed.toFixed(1)} 秒 · 收集 ${level().objects.filter(o=>o.type==='collectible').length} 颗星光 · 重生 ${engine.deaths} 次`;$('next-level').textContent=levelIndex===project.levels.length-1?'回到第一页 ↻':'翻开下一页 →';$('game-result').hidden=false;renderLevels();sound.stopMusic();}if(event==='death')toast('墨点回到了起点。再试一次。');}
function pointerPosition(e){const r=$('canvas').getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*WORLD.width,y:(e.clientY-r.top)/r.height*WORLD.height};}
$('canvas').addEventListener('pointerdown',e=>{
  if(mode!=='edit')return;const p=pointerPosition(e);
  const hit=[...viewLevel().objects].reverse().find(o=>{const b=bounds(o);return p.x>=b.x-10&&p.x<=b.x+b.w+10&&p.y>=b.y-12&&p.y<=b.y+b.h+12;});
  select(hit?.id||null);if(!hit||hit.type==='exit')return;
  drag={id:hit.id,dx:p.x-hit.x,dy:p.y-hit.y,startX:hit.x,startY:hit.y,moved:false};$('canvas').setPointerCapture(e.pointerId);$('canvas').style.cursor='grabbing';
});
$('canvas').addEventListener('pointermove',e=>{
  if(mode!=='edit')return;const p=pointerPosition(e);
  if(drag){const o=level().objects.find(o=>o.id===drag.id);if(!o)return;
    if(!drag.moved&&Math.hypot(p.x-drag.dx-drag.startX,p.y-drag.dy-drag.startY)<3)return;
    if(!drag.moved){checkpoint();drag.moved=true;delete o.anchor;}
    const snap=value=>Math.round(value/(grid?10:1))*(grid?10:1);
    o.x=Math.max(0,Math.min(WORLD.width,snap(p.x-drag.dx)));o.y=Math.max(0,Math.min(WORLD.height,snap(p.y-drag.dy)));
    const x=$('inspector-body').querySelector('[data-path="object.x"]'),y=$('inspector-body').querySelector('[data-path="object.y"]');if(x)x.value=o.x;if(y)y.value=o.y;
  }else{$('canvas').style.cursor=level().objects.some(o=>{const b=bounds(o);return p.x>=b.x-8&&p.x<=b.x+b.w+8&&p.y>=b.y-8&&p.y<=b.y+b.h+8;})?'grab':'default';}
});
function endDrag(){if(drag?.moved){rebuild();persist();}drag=null;$('canvas').style.cursor='default';}
$('canvas').addEventListener('pointerup',endDrag);$('canvas').addEventListener('pointercancel',endDrag);
document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{
  if(level().objects.length>=250){toast('每章最多 250 个对象。');return;}
  const type=b.dataset.add;change(()=>{const o={id:uid(),type,x:420,y:420,text:type==='platform'?'写下新的路':type==='decoration'?'你的故事。':'',width:type==='platform'?180:type==='decoration'?320:type==='hazard'?65:20,fontSize:type==='decoration'?36:19,letterGap:type==='platform'?2:10,...(type==='platform'?{...GROUPING,seed:Math.floor(Math.random()*4294967296)}:{})};level().objects.push(o);selected=o.id;tab='content';syncTabs();},{inspect:true});
});
function syncTabs(){document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',tab===b.dataset.tab);b.setAttribute('aria-selected',String(tab===b.dataset.tab));});}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;syncTabs();renderInspector();$('inspector-body').inert=mode==='play';});
$('add-level').onclick=()=>{if(project.levels.length>=200){toast('最多可创建 200 个章节。');return;}setMode('edit');change(()=>{const l=makeLevel(0);l.name='未命名章节';l.subtitle='写下属于你的冒险。';l.objects=l.objects.filter(o=>['platform','spawn','exit'].includes(o.type));project.levels.push(l);levelIndex=project.levels.length-1;selected=null;},{inspect:true});};
$('edit-mode').onclick=()=>setMode('edit');$('play-mode').onclick=()=>setMode('play');$('stage-cta').onclick=()=>setMode('play');
$('restart-btn').onclick=()=>{rebuild();if(mode==='play'){sound.startMusic();$('canvas').focus();toast('已回到本章起点。');}};
$('result-replay').onclick=()=>setMode('play');$('next-level').onclick=()=>{levelIndex=(levelIndex+1)%project.levels.length;selected=null;setMode('play');refresh();$('inspector-body').inert=true;};
$('undo-btn').onclick=()=>restore(undo,redo);$('redo-btn').onclick=()=>restore(redo,undo);
$('grid-btn').onclick=()=>{grid=!grid;$('grid-btn').classList.toggle('active',grid);$('grid-btn').setAttribute('aria-pressed',String(grid));};
$('layers-btn').onclick=()=>{$('layers-panel').hidden=!$('layers-panel').hidden;};
$('fullscreen-btn').onclick=()=>{const focused=document.body.classList.toggle('focus-mode');$('fullscreen-btn').textContent=focused?'⤢ 退出专注':'⤢ 专注模式';toast(focused?'已进入专注模式，按 Esc 退出。':'已退出专注模式。');};
$('exit-focus').onclick=()=>{document.body.classList.remove('focus-mode');$('fullscreen-btn').textContent='⤢ 专注模式';};
$('help-btn').onclick=()=>{keys={};sound.stop();$('help-dialog').showModal();};
document.querySelectorAll('.dialog-close,.dialog-close-btn').forEach(b=>b.onclick=()=>$('help-dialog').close());
$('help-dialog').addEventListener('close',()=>{if(mode==='play'){sound.startMusic();$('canvas').focus();}});
$('export-btn').onclick=()=>{
  const blob=new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=project.title.replace(/[\\/:*?"<>|]/g,'_')+'.inkplay.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('作品已导出，包含全部章节与自定义素材。');
};
$('import-btn').onclick=()=>$('import-file').click();
$('import-file').onchange=async()=>{
  const file=$('import-file').files[0];$('import-file').value='';if(!file)return;
  try{if(file.size>20*1024*1024)throw new Error('文件超过 20 MB');const imported=validate(JSON.parse(await file.text()));upgradeCampaignLayout(imported);alignExits(imported);setMode('edit');change(()=>{project=imported;levelIndex=0;selected=null;completed.clear();},{inspect:true});toast('作品已导入，原作品可通过撤销恢复。');}catch(e){toast('导入失败：'+e.message);}
};
window.addEventListener('keydown',e=>{
  if($('help-dialog').open)return;
  const typing=e.target.closest('input,textarea,select,[contenteditable="true"]');if(typing)return;
  if(e.key==='Escape'){document.body.classList.remove('focus-mode');$('fullscreen-btn').textContent='⤢ 专注模式';if(mode==='play')setMode('edit');return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&mode==='edit'){e.preventDefault();e.shiftKey?restore(redo,undo):restore(undo,redo);return;}
  if(mode==='edit'&&['Delete','Backspace'].includes(e.key)){e.preventDefault();deleteObject();return;}
  if(mode==='play'&&!e.ctrlKey&&!e.metaKey){if(['ArrowLeft','ArrowRight','ArrowUp',' '].includes(e.key))e.preventDefault();keys[e.key.toLowerCase()]=true;if(['w','arrowup'].includes(e.key.toLowerCase())&&!e.repeat)pendingJump=true;if(e.key.toLowerCase()==='r'){rebuild();sound.startMusic();}}
});
window.addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;});window.addEventListener('blur',()=>{keys={};pendingJump=false;sound.stop();});
window.addEventListener('focus',()=>{if(mode==='play'&&!engine.won&&!$('help-dialog').open)sound.startMusic();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys={};sound.stop();}else if(mode==='play'&&!engine.won&&!$('help-dialog').open)sound.startMusic();});
document.querySelectorAll('[data-control]').forEach(button=>{
  button.onpointerdown=e=>{e.preventDefault();button.setPointerCapture(e.pointerId);keys[button.dataset.control]=true;if(button.dataset.control==='jump')pendingJump=true;sound.unlock();};
  const release=()=>{keys[button.dataset.control]=false;};button.onpointerup=release;button.onpointercancel=release;button.onlostpointercapture=release;
});
function frame(now){
  const dt=Math.min((now-lastTime)/1000||0,1/15);lastTime=now;
  if(mode==='play'&&!$('help-dialog').open&&!document.hidden){accumulator+=dt;while(accumulator>=1/120){engine.update(1/120,{left:keys.a||keys.arrowleft||keys.left,right:keys.d||keys.arrowright||keys.right,jump:pendingJump||keys.w||keys.arrowup||keys.jump,grow:keys[' ']||keys.grow});pendingJump=false;accumulator-=1/120;}updateHud();}else accumulator=0;
  renderer.draw(project,viewLevel(),engine,{mode,grid,selected},now);requestAnimationFrame(frame);
}
try{const stored=await storage.load();if(stored){project=validate(stored);const changed=upgradeStockLayouts(project),campaign=installCampaign(project),layout=upgradeCampaignLayout(project),exits=alignExits(project);if(changed||campaign||layout||exits)await storage.save(clone(project));}}catch{toast('暂时无法读取本机存档，可通过导入作品继续。');}
const requestedChapter=new URLSearchParams(location.search).get('chapter');
const requestedIndex=project.levels.findIndex(l=>l.id===requestedChapter);if(requestedIndex>=0)levelIndex=requestedIndex;
await Promise.all([document.fonts.load('19px "Inkplay Brush"'),document.fonts.load('19px "Inkplay Latin"')]).catch(()=>{});
rebuild();refresh();requestAnimationFrame(frame);
document.querySelectorAll('.return-game,.brand').forEach(a=>a.addEventListener('click',async e=>{e.preventDefault();try{await flushSave();sound.stop();location.assign(a.href);}catch{toast('保存失败，请先导出作品备份。');}}));
window.addEventListener('pagehide',()=>{clearTimeout(saveTimer);storage.save(clone(project)).catch(()=>{});sound.stop();});
