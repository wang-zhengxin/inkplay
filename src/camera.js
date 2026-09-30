import { WORLD } from './model.js';
export class Camera {
  constructor(){this.y=0;}
  target(player,settings,height=WORLD.height,limits){const y=(player.y-height*.55)*settings.follow;return limits?Math.max(limits.min,Math.min(limits.max,y)):y;}
  reset(player,settings,height,limits){this.y=this.target(player,settings,height,limits);}
  update(dt,player,settings,height,limits){this.y+=(this.target(player,settings,height,limits)-this.y)*(1-Math.exp(-settings.smoothing*dt));}
}
