// Decode once, then loop PCM on the audio clock without a media-element seek.
export function createLoopAudio(fallback, url, {Context=globalThis.AudioContext||globalThis.webkitAudioContext, fetcher=globalThis.fetch}={}) {
  if (!Context) return fallback;
  let context, gain;
  try { context=new Context();gain=context.createGain();gain.connect(context.destination); }
  catch { return fallback; }
  let source, offset=0, started=0, volume=1, muted=false, generation=0, failed=false;
  let ready;
  const load=()=>ready??=fetcher(url).then(r=>{if(!r.ok)throw Error('Music load failed');return r.arrayBuffer();})
    .then(bytes=>context.decodeAudioData(bytes)).catch(()=>{failed=true;return null;});
  function level() { gain.gain.setTargetAtTime(muted?0:volume,context.currentTime,.015); }
  function position() { return source ? (offset+context.currentTime-started)%source.buffer.duration : offset; }
  function stop() {
    if(source){offset=position();source.stop();source.disconnect();source=null;}
    fallback.dataset.loopPlayback='paused';
  }
  return {
    loop:true,
    prepare(){return muted?Promise.resolve(null):load();},
    get paused(){return failed?fallback.paused:!source;},
    get currentTime(){return failed?fallback.currentTime:position();},
    set currentTime(value){if(failed){fallback.currentTime=value;return;}const running=!!source;stop();offset=Math.max(0,value);if(running)this.play().catch(()=>{});},
    get volume(){return volume;},
    set volume(value){volume=value;fallback.volume=value;level();},
    get muted(){return muted;},
    set muted(value){muted=value;fallback.muted=value;level();},
    async play(){
      if(failed)return fallback.play();
      const id=++generation;
      // resume() must be invoked directly in the gesture, before awaiting decode.
      const resumed=context.resume().catch(()=>{});
      const buffer=await load();
      await resumed;
      if(id!==generation)return;
      if(!buffer){fallback.loop=true;return fallback.play();}
      if(context.state!=='running')throw Error('Audio gesture required');
      if(source)return;
      source=context.createBufferSource();source.buffer=buffer;source.loop=true;
      source.loopStart=0;source.loopEnd=buffer.duration;source.connect(gain);
      offset%=buffer.duration;started=context.currentTime;source.start(0,offset);
      fallback.dataset.loopPlayback='playing';fallback.dataset.loopDuration=String(buffer.duration);
    },
    pause(){generation++;if(failed)fallback.pause();else stop();}
  };
}
