// Synthesized game cues plus the user-provided, processed sugarcane voice.
// Calibrated to approximately -26 LUFS per cue (including its release tail).
// See output/sfx-levels/levels.json for the offline reference measurements.
const CUE_GAIN=Object.freeze({start:4.0041,shield:1.9387,over:2.7071,won:1.6255,cane:.3859,fallback:5.7876});
export function createSoundFeedback(play) {
  let previous;
  const snapshot = g => ({status:g.status,lives:g.lives,message:g.sugarcaneMessage});
  return {
    reset(g) { previous=snapshot(g); },
    update(g) {
      if (!previous) { previous=snapshot(g); return; }
      if (previous.status==='playing') {
        if (g.status==='over') play('over');
        else if (g.status==='won') play('won');
        else if (g.status==='playing') {
          if (g.lives<previous.lives) play('shield');
          else if (g.sugarcaneMessage && g.sugarcaneMessage!==previous.message) play('cane');
        }
      }
      previous=snapshot(g);
    }
  };
}
export function createSoundEffects({onCue=()=>{},Context=globalThis.AudioContext||globalThis.webkitAudioContext,fetchAudio=globalThis.fetch}={}) {
  let context,master,enabled=true,lastCane=-Infinity;
  const sources=new Set();
  let caneBuffer,caneLoad;
  function loadCane() {
    if(caneBuffer||caneLoad||!context||!fetchAudio)return;
    caneLoad=Promise.resolve().then(()=>fetchAudio(new URL('./assets/audio/cane-ho-elder-v1.wav',import.meta.url)))
      .then(response=>{if(!response.ok)throw new Error('Voice unavailable');return response.arrayBuffer();})
      .then(bytes=>context.decodeAudioData(bytes))
      .then(buffer=>{caneBuffer=buffer;})
      .catch(()=>{})
      .finally(()=>{caneLoad=null;});
  }
  function playCane() {
    if(!caneBuffer){loadCane();voice(740,.11,.10,0,510,'triangle',CUE_GAIN.fallback);return;}
    const source=context.createBufferSource(),gain=context.createGain();source.buffer=caneBuffer;
    gain.gain.value=CUE_GAIN.cane;source.connect(gain);gain.connect(master);sources.add(source);
    source.onended=()=>{sources.delete(source);source.disconnect();gain.disconnect();};source.start();
  }
  function unlock() {
    if (!Context) return;
    try {
      if (!context) { context=new Context();master=context.createGain();master.gain.value=enabled?1:0;master.connect(context.destination); }
      loadCane();
      if (context.state==='suspended') context.resume().catch(()=>{});
    } catch {}
  }
  function stop() { for (const source of sources) { try { source.stop(); } catch {} } sources.clear(); }
  function voice(frequency,duration,level,delay=0,end=frequency,type='sine',levelScale=1) {
    const t=context.currentTime+delay,osc=context.createOscillator(),gain=context.createGain();
    osc.type=type;osc.frequency.setValueAtTime(frequency,t);osc.frequency.exponentialRampToValueAtTime(end,t+duration);
    gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(level*levelScale,t+.008);gain.gain.exponentialRampToValueAtTime(.0001*levelScale,t+duration);
    osc.connect(gain);gain.connect(master);sources.add(osc);
    osc.onended=()=>{sources.delete(osc);osc.disconnect();gain.disconnect();};osc.start(t);osc.stop(t+duration+.02);
  }
  function splash() {
    const length=Math.ceil(context.sampleRate*.28),buffer=context.createBuffer(1,length,context.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*Math.min(1,i/(context.sampleRate*.008))*Math.exp(-i/(context.sampleRate*.055));
    const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
    source.buffer=buffer;filter.type='lowpass';filter.frequency.value=1300;gain.gain.value=.16*CUE_GAIN.over;
    source.connect(filter);filter.connect(gain);gain.connect(master);sources.add(source);
    source.onended=()=>{sources.delete(source);source.disconnect();filter.disconnect();gain.disconnect();};source.start();
  }
  return {
    unlock,stop,
    setEnabled(value) { enabled=value;if(!enabled)stop();if(master)master.gain.value=enabled?1:0; },
    play(name) {
      if(!enabled||!context||context.state!=='running')return;
      if(name==='cane' && context.currentTime-lastCane<Math.max(.6,caneBuffer?.duration??0))return;
      if(name==='cane')lastCane=context.currentTime;
      if(name==='over'||name==='won')stop();
      const tone=(f,d,l,delay=0,end=f,type='sine')=>voice(f,d,l,delay,end,type,CUE_GAIN[name]??1);
      if(name==='start'){tone(660,.12,.09);tone(880,.13,.065,.07);}
      if(name==='shield'){tone(1350,.23,.12);tone(2050,.16,.035,.025);tone(460,.25,.10,.04,850);}
      if(name==='over'){splash();tone(180,.48,.17,0,55,'triangle');}
      if(name==='won'){[523.25,659.25,783.99].forEach((f,i)=>tone(f,.5,.12,i*.19));}
      if(name==='cane')playCane();
      onCue(name);
    }
  };
}
