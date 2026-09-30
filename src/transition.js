// Percent offsets keep both pages joined even when the viewport resizes.
export class PageSlide {
  constructor(direction=1,duration=.62){this.direction=direction<0?-1:1;this.duration=Math.max(.01,duration);this.elapsed=0;}
  advance(dt){this.elapsed=Math.min(this.duration,this.elapsed+Math.max(0,dt));return this.offsets;}
  get done(){return this.elapsed>=this.duration;}
  get offsets(){
    const t=this.elapsed/this.duration,eased=t*t*(3-2*t);
    return {outgoing:this.direction*eased*100,incoming:-this.direction*(1-eased)*100};
  }
}
