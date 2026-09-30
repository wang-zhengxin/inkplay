// A damped visual spring. The collision circle always keeps its real radius.
export class BounceShape {
  constructor(){this.value=0;this.velocity=0;}
  jump(){this.value=.28;this.velocity=1.8;}
  land(impact){const strength=Math.max(.25,Math.min(1,impact/520));this.value=-.32*strength;this.velocity=-1.4*strength;}
  update(dt,player){
    const target=player.grounded?0:Math.min(.18,Math.abs(player.vy)/700*.18);
    this.velocity+=(190*(target-this.value)-17*this.velocity)*dt;
    this.value=Math.max(-.35,Math.min(.42,this.value+this.velocity*dt));
    return this.value;
  }
}
export function bounceScale(stretch=0){const y=1+Math.max(-.35,Math.min(.42,stretch));return{x:1/y,y};}
