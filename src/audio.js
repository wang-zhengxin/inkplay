export class Sound {
  constructor(){this.context=null;this.config=null;this.music=null;this.voices=new Set();}
  configure(config){this.config=config;if(this.music){this.music.volume=config.volume*.45;if(!config.enabled)this.music.pause();}}
  unlock(){try{this.context ||= new (window.AudioContext||window.webkitAudioContext)();this.context.resume().catch(()=>{});}catch{}}
  startMusic(){this.stopMusic();if(!this.config.enabled||!this.config.music)return;this.music=new Audio(this.config.music);this.music.loop=true;this.music.volume=this.config.volume*.45;this.music.play().catch(()=>{});}
  stopMusic(){if(this.music){this.music.pause();this.music=null;}}
  stop(){this.stopMusic();for(const voice of this.voices){if(voice instanceof HTMLAudioElement)voice.pause();else try{voice.stop();}catch{}}this.voices.clear();}
  play(event){
    const c=this.config;if(!c?.enabled)return;this.unlock();
    if(c.events[event]){const audio=new Audio(c.events[event]);audio.volume=c.volume;this.voices.add(audio);const remove=()=>this.voices.delete(audio);audio.onended=remove;audio.onerror=remove;audio.play().catch(remove);return;}
    if(!this.context)return;const ctx=this.context,now=ctx.currentTime;
    const frequencies={jump:[392,587],land:[146.83],collect:[659.25,783.99,987.77],death:[220,164.81,110],win:[523.25,659.25,783.99,1046.5]};
    (frequencies[event]||[440]).forEach((f,i)=>{const osc=ctx.createOscillator(),gain=ctx.createGain(),time=now+i*.075;osc.type=c.preset==='chiptune'?'square':c.preset==='soft'?'sine':'triangle';osc.frequency.setValueAtTime(f,time);gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(c.volume*(c.preset==='chiptune'?.12:.3),time+.008);gain.gain.exponentialRampToValueAtTime(.001,time+.35);osc.connect(gain).connect(ctx.destination);osc.start(time);osc.stop(time+.4);this.voices.add(osc);osc.onended=()=>this.voices.delete(osc);});
  }
}
