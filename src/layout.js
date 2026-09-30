// Seeded layouts are identical in the renderer, engine and exported project.
import { latinWidth } from './latin-metrics.js';
export function random(seed){let state=seed>>>0;return()=>{state+=0x6D2B79F5;let t=state;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export const isWordText=text=>/[A-Za-z]/.test(text)&&!/[\u3400-\u9fff]/.test(text);
export function wordGlyphs(o){
  const words=o.text.match(/\S+/gu)||[],rng=random(o.seed??1);
  const widths=words.map(word=>latinWidth(word)*o.fontSize);
  const gaps=words.slice(1).map(()=>o.spacing==='uniform'?(o.letterGap??20):(o.gapMin??18)+rng()*((o.gapMax??40)-(o.gapMin??18)));
  const total=gaps.reduce((a,b)=>a+b,0),gapScale=total?Math.min(1,o.width*.18/total):1;
  const natural=widths.reduce((a,b)=>a+b,0);
  let x=o.x+Math.max(0,(o.width-natural-total*gapScale)/2);
  return words.map((char,i)=>{const glyph={char,x,width:widths[i],group:i,word:true};x+=glyph.width+(gaps[i]??0)*gapScale;return glyph;});
}
export function groupedGlyphs(o){
  const chars=Array.from(o.text),rng=random(o.seed??1),sizes=[],gaps=[];
  const min=Math.max(1,Math.min(10,Math.round(o.groupMin??1))),max=Math.max(min,Math.min(10,Math.round(o.groupMax??10)));
  let remaining=chars.length;
  while(remaining){const size=Math.min(remaining,min+Math.floor(rng()*(max-min+1)));sizes.push(size);remaining-=size;}
  let group=0,within=0;
  for(let i=0;i<chars.length-1;i++){
    within++;if(within===sizes[group]){gaps.push((o.gapMin??18)+rng()*((o.gapMax??40)-(o.gapMin??18)));group++;within=0;}
    else gaps.push((o.letterGap??2)*(.6+rng()*.8));
  }
  // Reduce spacing only when the authored width cannot accommodate it.
  const gapTotal=gaps.reduce((a,b)=>a+b,0),gapScale=gapTotal?Math.min(1,o.width*.45/gapTotal):1;
  const width=o.fontSize;
  const extent=width*chars.length+gapTotal*gapScale;
  let x=o.x+Math.max(0,(o.width-extent)/2);group=0;within=0;
  return chars.map((char,i)=>{const glyph={char,x,width,group};x+=width+(gaps[i]??0)*gapScale;within++;if(within===sizes[group]){group++;within=0;}return glyph;});
}
