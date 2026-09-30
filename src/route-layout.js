import { random, groupedGlyphs, wordGlyphs, isWordText } from './layout.js';

// Measure both languages at the original font size. A nominal platform width
// is not its visible extent, especially with long English words.
export function fragmentEnvelope(platform){
  const variants=[platform.text,platform.textEn||platform.text].map(text=>(isWordText(text)?wordGlyphs:groupedGlyphs)({...platform,x:0,text})).filter(gs=>gs.length);
  return {left:Math.min(...variants.map(gs=>gs[0].x)),right:Math.max(...variants.map(gs=>gs.at(-1).x+gs.at(-1).width))};
}

export function scatterRoute(platforms,seed){
  const rng=random(seed),rows=platforms.map(o=>({...o,width:Math.round(136+rng()*42)})),steps=rows.length-1;
  if(steps<1)return rows;
  const first=160+rng()*30,descent=235+rng()*40;
  // A bend can occur at either interior join; many routes have no upward bend.
  // Weighted downward steps give every route a different vertical rhythm.
  const bend=steps>=3&&rng()<.55?2+Math.floor(rng()*(steps-2)):-1;
  const rise=bend<0?0:28+rng()*17;
  let drops;
  for(let attempt=0;attempt<128;attempt++){
    const weights=Array.from({length:steps},(_,i)=>i+1===bend?0:.55+rng()*1.05),total=weights.reduce((a,b)=>a+b,0);
    drops=weights.map((w,i)=>i+1===bend?-rise:w/total*(descent+rise));
    if(drops.every(d=>d<0||(d>=36&&d<=132)))break;
    // Equal downward steps are a safe deterministic fallback.
    if(attempt===127)drops=weights.map((_,i)=>i+1===bend?-rise:(descent+rise)/(steps-(bend<0?0:1)));
  }
  let y=first;rows.forEach((o,i)=>{if(i)y+=drops[i-1];o.y=Math.round(y);});

  const spans=rows.map(fragmentEnvelope),start=72+rng()*24;
  const overlap=rng()<.4?Math.floor(rng()*steps):-1;
  const gaps=Array.from({length:steps},(_,i)=>i===overlap?-(12+rng()*22):12+rng()*32);
  const advances=spans.slice(0,-1).map((b,i)=>b.right-spans[i+1].left);
  // Keep editable platform origins inside the world without changing font size.
  // Only surplus whitespace is reduced when the bilingual route is long.
  const budget=990-start-advances.reduce((a,b)=>a+b,0);
  const overlapTotal=gaps.filter(g=>g<0).reduce((a,b)=>a+b,0),positive=gaps.filter(g=>g>0).reduce((a,b)=>a+b,0);
  const gapScale=Math.min(1,(budget-overlapTotal)/positive);
  let x=start;
  rows.forEach((o,i)=>{o.x=Math.round(x);if(i<steps)x+=advances[i]+(gaps[i]<0?gaps[i]:gaps[i]*Math.max(0,gapScale));});
  return rows;
}
