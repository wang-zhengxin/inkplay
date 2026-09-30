import { ChapterProgress, adjacentChapter } from './navigation.js';
import { defaults, validate, upgradeStockLayouts, alignExits, localizedLevel, installCampaign, upgradeCampaignLayout } from './model.js';
import { Engine } from './engine.js';
import { Renderer } from './render.js';
import { Sound } from './audio.js';
import * as storage from './storage.js';
import { PageSlide } from './transition.js';

const canvas=document.getElementById('canvas'),entry=document.getElementById('studio-entry'),turn=document.getElementById('page-turn'),languageSwitch=document.getElementById('language-switch');
const renderer=new Renderer(canvas),turnRenderer=new Renderer(turn),sound=new Sound(),progress=new ChapterProgress();
let project=defaults(),engine,levelIndex=0,keys={},pendingJump=false,lastTime=0,accumulator=0,pageSlide=null,turnTarget=null,audioReady=false,active=true;
let languageSave=Promise.resolve();
const level=()=>localizedLevel(project,project.levels[levelIndex]);
function rememberChapter(){try{sessionStorage.setItem('inkplay-chapter',level().id);const url=new URL(location.href);url.searchParams.set('chapter',level().id);history.replaceState(null,'',url);}catch{}}
function finishTurn(){pageSlide=null;turnTarget=null;turn.hidden=true;canvas.style.transform='';turn.style.transform='';canvas.style.willChange='';turn.style.willChange='';}
function publishChapter(){
  canvas.dataset.state='playing';canvas.dataset.chapter=level().id;
  languageSwitch.disabled=false;
  entry.href='editor.html?chapter='+encodeURIComponent(level().id);rememberChapter();
  if(audioReady)sound.startMusic();
}
function rebuild(fromEnd=false,restore=false){
  finishTurn();engine=new Engine(level(),project.physics,onEvent);if(restore)progress.restore(engine,fromEnd);publishChapter();
}
function onEvent(event){
  if(audioReady)sound.play(event==='previous'?'win':event);
  if((event==='win'||event==='previous')&&!pageSlide){
    progress.remember(engine);
    const direction=event==='previous'?-1:1,index=adjacentChapter(levelIndex,direction,project.levels.length);
    const incoming=new Engine(localizedLevel(project,project.levels[index]),project.physics,onEvent);progress.restore(incoming,direction<0);
    turnTarget={index,engine:incoming};pageSlide=new PageSlide(direction,matchMedia('(prefers-reduced-motion:reduce)').matches ? .2 : .62);
    turn.style.transform=`translate3d(${-direction*100}%,0,0)`;turn.hidden=false;
    canvas.style.willChange=turn.style.willChange='transform';
    accumulator=0;canvas.dataset.state='turning';canvas.dataset.direction=String(direction);sound.stopMusic();
    languageSwitch.disabled=true;
  }
}
function unlockAudio(){if(!active)resume();sound.unlock();if(!audioReady){audioReady=true;sound.startMusic();}}
function clearInput(){keys={};pendingJump=false;}
function suspend(){active=false;clearInput();sound.stop();}
function resume(){active=true;if(audioReady&&!engine.won&&!pageSlide)sound.startMusic();}
function updateLanguage(){
  const english=project.language==='en',touch=matchMedia('(pointer:coarse)').matches,hint=document.getElementById('controls-hint');
  document.documentElement.lang=english?'en':'zh-CN';document.title=english&&project.title==='字间漫游'?'Inkplay':project.title;
  hint.setAttribute('aria-label',english?'Controls':'操作规则');
  entry.setAttribute('aria-label',english?'Settings and studio':'设置与创作');entry.title=english?'Settings and studio':'设置与创作';
  canvas.setAttribute('aria-label',english?'Inkplay: A D or arrows to move, hold W or Up to jump, Space to grow, R to restart':'字间漫游：A D 或方向键移动，W 或上方向键跳跃，空格变大，R 重来');
  const goal=english?'<p class="goal-hint">Touch <span>← →</span> to turn · <span>✧</span> optional</p>':'<p class="goal-hint">触碰 <span>← →</span> 翻页 · <span>✧</span> 可选收集</p>';
  hint.innerHTML=(touch?(english?'<p>Left hand to move, right hand to jump or grow</p><p>Hold ↑ to keep jumping</p>':'<p>左手移动，右手跳跃或变大</p><p>按住 ↑，落到文字上连续跳跃</p>'):(english?'<p><kbd>A D / ← →</kbd><span>Move</span></p><p><kbd>W / ↑</kbd><span>Hold to keep jumping</span></p><p><kbd>SPACE</kbd><span>Grow</span><kbd>R</kbd><span>Restart</span></p>':'<p><kbd>A D</kbd><span>或</span><kbd>← →</kbd><span>移动</span></p><p><kbd>W / ↑</kbd><span>按住连续跳跃</span></p><p><kbd>SPACE</kbd><span>变大</span><kbd>R</kbd><span>重来</span></p>'))+goal;
  document.querySelectorAll('[data-control]').forEach(b=>b.setAttribute('aria-label',(english?{left:'Move left',right:'Move right',grow:'Grow',jump:'Jump'}:{left:'向左',right:'向右',grow:'变大',jump:'跳跃'})[b.dataset.control]));
  languageSwitch.title=english?'Switch to Chinese':'切换到英文';languageSwitch.setAttribute('aria-label',languageSwitch.title);languageSwitch.setAttribute('aria-pressed',String(english));languageSwitch.dataset.language=project.language;
  languageSwitch.querySelectorAll('[data-language]').forEach(span=>span.classList.toggle('active',span.dataset.language===project.language));
}

try{const stored=await storage.load();if(stored){project=validate(stored);const changed=upgradeStockLayouts(project),campaign=installCampaign(project),layout=upgradeCampaignLayout(project),exits=alignExits(project);if(changed||campaign||layout||exits)await storage.save(project);}}catch{ /* A playable default world also works without browser storage. */ }
let requestedChapter=new URLSearchParams(location.search).get('chapter');
if(!requestedChapter)try{requestedChapter=sessionStorage.getItem('inkplay-chapter');}catch{}
const requestedIndex=project.levels.findIndex(l=>l.id===requestedChapter);if(requestedIndex>=0)levelIndex=requestedIndex;
document.documentElement.style.setProperty('--paper',project.theme.paper);document.documentElement.style.setProperty('--ink',project.theme.ink);document.documentElement.style.setProperty('--accent',project.theme.accent);
document.querySelector('meta[name="theme-color"]').content=project.theme.paper;
await Promise.all([document.fonts.load('19px "Inkplay Brush"'),document.fonts.load('19px "Inkplay Latin"')]).catch(()=>{});
updateLanguage();
sound.configure(project.audio);rebuild();canvas.focus({preventScroll:true});
document.getElementById('touch-controls').hidden=!matchMedia('(pointer:coarse)').matches;
languageSwitch.addEventListener('click',()=>{
  if(pageSlide)return;clearInput();project.language=project.language==='en'?'zh':'en';alignExits(project);engine.localize(level());updateLanguage();
  const snapshot=structuredClone(project);languageSave=languageSave.catch(()=>{}).then(()=>storage.save(snapshot)).catch(()=>{languageSwitch.title=project.language==='en'?'Language preference could not be saved':'语言偏好未能保存';});
  resume();canvas.focus({preventScroll:true});
});

window.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.target.closest?.('button,a'))return;
  if(['ArrowLeft','ArrowRight','ArrowUp',' '].includes(e.key))e.preventDefault();
  if(e.key==='Escape'){entry.click();return;}
  if(!['a','d','w','r','arrowleft','arrowright','arrowup',' '].includes(e.key.toLowerCase()))return;
  unlockAudio();keys[e.key.toLowerCase()]=true;
  if(['w','arrowup'].includes(e.key.toLowerCase())&&!e.repeat)pendingJump=true;
  if(e.key.toLowerCase()==='r'&&!e.repeat){clearInput();progress.clear(level().id);rebuild();}
});
window.addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;});
canvas.addEventListener('pointerdown',()=>{unlockAudio();canvas.focus({preventScroll:true});});
document.querySelectorAll('[data-control]').forEach(button=>{
  button.onpointerdown=e=>{e.preventDefault();button.setPointerCapture(e.pointerId);unlockAudio();keys[button.dataset.control]=true;if(button.dataset.control==='jump')pendingJump=true;};
  const release=()=>{keys[button.dataset.control]=false;};button.onpointerup=release;button.onpointercancel=release;button.onlostpointercapture=release;
});
window.addEventListener('blur',suspend);window.addEventListener('focus',resume);
document.addEventListener('visibilitychange',()=>document.hidden?suspend():resume());
window.addEventListener('pagehide',suspend);
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
entry.addEventListener('click',suspend);

function frame(now){
  const dt=Math.min((now-lastTime)/1000||0,1/15);lastTime=now;
  if(active&&!document.hidden){
    if(pageSlide){
      pageSlide.advance(dt);
      if(pageSlide.done){levelIndex=turnTarget.index;engine=turnTarget.engine;pendingJump=false;accumulator=0;finishTurn();publishChapter();}
    }else{
      accumulator+=dt;
      while(accumulator>=1/120){engine.update(1/120,{left:keys.a||keys.arrowleft||keys.left,right:keys.d||keys.arrowright||keys.right,jump:pendingJump||keys.w||keys.arrowup||keys.jump,grow:keys[' ']||keys.grow});pendingJump=false;if(pageSlide){accumulator=0;break;}accumulator-=1/120;}
    }
  }else accumulator=0;
  renderer.draw(project,level(),engine,{mode:'play',grid:false,selected:null,immersive:true},now);
  if(pageSlide){
    turnRenderer.draw(project,turnTarget.engine.level,turnTarget.engine,{mode:'play',grid:false,selected:null,immersive:true},now);
    const {outgoing,incoming}=pageSlide.offsets;
    canvas.style.transform=`translate3d(${outgoing}%,0,0)`;turn.style.transform=`translate3d(${incoming}%,0,0)`;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
