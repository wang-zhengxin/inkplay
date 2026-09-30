import { random, groupedGlyphs } from './layout.js';
import { scatterRoute } from './route-layout.js';
export const CAMPAIGN_SEED=20260930;
export const CAMPAIGN_COUNT=100;
export const CAMPAIGN_LAYOUT=4;
const scenes=[['风','breeze'],['月光','moonlight'],['晨雾','mist'],['星光','starlight'],['溪流','stream'],['落叶','leaves'],['细雨','rain'],['山影','mountains'],['潮声','tide'],['花香','flowers']];
const beginnings=[['沿着','Follow'],['听见','Hear'],['迎着','Meet'],['追随','Chase'],['寻找','Find'],['记住','Remember'],['拥抱','Embrace'],['等待','Await'],['走近','Approach'],['留住','Keep']];
const middle=[['慢一点，也没关系','Take your time'],['越过纸上的留白','Cross the blank'],['收集一点微光','Gather small sparks'],['每一步，都是故事','Each step tells'],['停一停，再向前','Pause then go'],['把梦轻轻收好','Keep your dreams'],['听见字间的回声','Hear the echo'],['带上一点勇气','Carry some courage'],['让心跟上脚步','Trust your steps'],['走向新的句子','Seek new words'],['在转弯处微笑','Smile at turns'],['把夜色读完','Read the night'],['带一点墨和梦','Bring ink and dreams'],['沿字句慢慢走','Walk through words'],['穿过长长的留白','Pass the silence']];
const endings=[['下一页，遇见自己','Meet yourself next'],['故事还没有结束','The story goes on'],['未完待续，下页见','See the next page'],['等天亮，翻新页','Turn toward dawn'],['答案就在下一页','Answers lie ahead'],['把故事写给远方','Write to the horizon'],['在这里，留下回声','Leave an echo'],['向前，还有微光','More light ahead'],['让风翻开下一页','Let wind turn pages'],['新的旅途，开始了','A new path begins']];
const types=['zigzag','leftward','column','scattered','arch'];
export function generateCampaign(seed=CAMPAIGN_SEED,{layoutVersion=CAMPAIGN_LAYOUT}={}){
  const rng=random(seed);
  return Array.from({length:CAMPAIGN_COUNT},(_,index)=>{
    const prefix=`random-${seed}-${index+1}`,scene=scenes[index%10],begin=beginnings[Math.floor(index/10)],last=endings[Math.floor(rng()*endings.length)];
    const pool=[...middle],chosen=[0,1,2].map(()=>pool.splice(Math.floor(rng()*pool.length),1)[0]);
    const rows=[[begin[0]+scene[0]+'，出发',`${begin[1]} the ${scene[1]}`],...chosen,last];
    let y=178+Math.floor(rng()*16);
    let platforms=rows.map(([text,textEn],i)=>{
      if(i)y+=53+Math.floor(rng()*14);
      return {id:`${prefix}-text-${i}`,type:'platform',x:90+i*180+Math.floor(rng()*6),y,width:158+Math.floor(rng()*7),fontSize:19,text,textEn,letterGap:2,spacing:'grouped',seed:Math.floor(rng()*4294967296),groupMin:1,groupMax:10,gapMin:18+Math.floor(rng()*5),gapMax:30+Math.floor(rng()*9)};
    });
    if(layoutVersion>=2){
      const layout=random((seed+Math.imul(index+1,2654435761))>>>0),start=80+layout()*24,budget=948+layout()*26-start;
      const widths=platforms.map(()=>140+layout()*34),sum=widths.reduce((a,b)=>a+b,0),widthScale=Math.min(1,(budget-56)/sum);
      const extras=platforms.slice(1).map(()=>layout()*38),extraSum=extras.reduce((a,b)=>a+b,0),gapScale=extraSum?Math.min(1,(budget-sum*widthScale-56)/extraSum):1;
      const first=178+layout()*16,second=first+76+layout()*32;
      const heights=[first,second,second-28-layout()*34,second+74+layout()*28,0];
      heights[4]=Math.max(430+layout()*26,heights[3]+42+layout()*28);
      let x=start;
      platforms.forEach((o,i)=>{Object.assign(o,{x:Math.round(x),y:Math.round(heights[i]),width:Math.round(widths[i]*widthScale)});x+=widths[i]*widthScale+14+(extras[i]??0)*gapScale;});
    }
    if(layoutVersion>=3){
      const overlap=random((seed^Math.imul(index+1,2246822519))>>>0);
      if(overlap()<.6){
        const lower=platforms[1],upper=platforms[2];
        upper.x=Math.round(lower.x+lower.width-24-overlap()*24);
        upper.y=Math.round(lower.y-14-overlap()*4);
      }
    }
    if(layoutVersion>=4)platforms=scatterRoute(platforms,(seed^Math.imul(index+1,3266489917))>>>0);
    const attached=(type,i,ratio,dy)=>{
      const platform=platforms[i],gs=groupedGlyphs(platform),g=gs[Math.floor((gs.length-1)*ratio)];
      return {id:`${prefix}-${type}-${i}`,type,x:g.x+g.width/2,y:platform.y+dy,width:20,fontSize:18,text:'',letterGap:10,anchor:{platformId:platform.id,ratio,dy}};
    };
    const gs=groupedGlyphs(platforms[4]),end=gs.at(-1);
    return {id:`chapter-${prefix}`,layoutPattern:types[index%5],name:`${String(index+1).padStart(3,'0')} · ${begin[0]}${scene[0]}`,nameEn:`${String(index+1).padStart(3,'0')} · ${begin[1]} ${scene[1]}`,subtitle:'在字句间，找到自己的节奏。',subtitleEn:'Find your rhythm between the words.',objects:[...platforms,attached('spawn',0,.35,-16),...platforms.slice(1,4).map((_,i)=>attached('collectible',i+1,.5,-16)),attached('ink',2,.8,-20),{id:`${prefix}-exit`,type:'exit',x:end.x+end.width+28,y:platforms[4].y+9.5,width:28,fontSize:18,text:'',letterGap:10}]};
  });
}
