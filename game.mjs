import {createLoopAudio} from './loop-audio.mjs?v=prepared-audio-106';
import {createSoundEffects,createSoundFeedback} from './sound-effects.mjs?v=sfx-balanced-103';
import {createBackgroundMusic} from './music.mjs?v=entry-audio-98';
import {createSugarcaneDrift,drawSugarcanes} from './sugarcane.mjs?v=cane-mainland-only-121';
import { WORLD, STARTING_LIVES, START_DATE, TARGET_DATE, GOAL_DAYS, gameDate, normalize, createGame, randomizeRound, movePlayer, updateGame, sampleGameFlow, initializeScene, recordCurrentLabel } from './engine.mjs?v=cane-mainland-only-121';
import {measurePath,samplePath,layoutStableFlowText} from './path-layout.mjs?v=aurora-amber-30';
import {sceneAt,worldToView,viewToWorld,projectPaths} from './scene-motion.mjs?v=random-round-52';
import {createFloodField,floodState,floodCoverage} from './flood.mjs?v=aurora-amber-30';
import {blocksPlayer} from './terrain.mjs?v=islands-labels-56';
import {viewportFor,drawingRatio} from './viewport.mjs?v=fixed-world-107';
const $=id=>document.getElementById(id);
const canvas=$('canvas'),ctx=canvas.getContext('2d'),field=$('playfield'),slot=$('playfield-slot');
const compassNeedle=$('compass-needle');
const overlay=$('overlay'),panel=overlay.querySelector('.start-panel'),start=$('start'),pause=$('pause');
const help=$('help-dialog');
let musicStorage;try{musicStorage=window.localStorage;}catch{}
const effects=createSoundEffects({onCue:name=>{if(name==='shield')music.duck();}});
const musicElement=$('background-music');
const musicFormat=musicElement.canPlayType('audio/ogg; codecs=vorbis')?'ogg':'mp3';
const loopAudio=createLoopAudio(musicElement,`./assets/audio/ocean-bgm-v15.${musicFormat}`);
const music=createBackgroundMusic(loopAudio,$('music-toggle'),musicStorage,value=>effects.setEnabled(value),blocked=>{ $('audio-entry-note').hidden=!blocked; });
const feedback=createSoundFeedback(name=>effects.play(name));
// Retry music after a start gesture; dedicated buttons handle their own clicks.
function unlockMusic(event){
  effects.unlock();
  if(event.target?.closest?.('#music-toggle,#start'))return;
  music.retry();
}
document.addEventListener('pointerup',unlockMusic);
document.addEventListener('click',unlockMusic);
document.addEventListener('keydown',unlockMusic);
document.addEventListener('pointerdown',unlockMusic,{passive:true});
const labelFont='"PingFang TC","Noto Sans TC",system-ui,sans-serif';
const displayFont='"Game Serif","Songti TC",serif';
const W=WORLD.width,H=WORLD.height;
const heatW=W/8,heatH=H/8,maskW=W,maskH=H;
let renderScale=0,labelStates=new WeakMap();
let map,game,scale=1,dpr=1,tx=0,ty=0,last=0,pointer=null,origin=null,seenCurrents=new Set(),noticeUntil=0,visualTime=0,heatTime=-100;
const keys=new Set(),reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const merc=lat=>Math.log(Math.tan(Math.PI/4+lat*Math.PI/360));
const project=([lon,lat])=>[(lon-121)*WORLD.width/7.8+W/2,(merc(23.7)-merc(lat))*WORLD.width/7.8*180/Math.PI+H/2];
const layer=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
const land=layer(W,H),landCtx=land.getContext('2d'),trails=layer(W,H),trailCtx=trails.getContext('2d');
const nightSea=layer(W,H),nightSeaCtx=nightSea.getContext('2d');
const driftLayer=layer(W,H),driftCtx=driftLayer.getContext('2d');
const heat=layer(heatW,heatH),heatCtx=heat.getContext('2d'),heatImage=heatCtx.createImageData(heatW,heatH),mask=layer(maskW,maskH),maskCtx=mask.getContext('2d',{willReadFrequently:true});
const taiwanLand=layer(W,H),taiwanCtx=taiwanLand.getContext('2d'),floodLand=layer(W,H),floodLandCtx=floodLand.getContext('2d');
const islandFlow=layer(W,H),islandFlowCtx=islandFlow.getContext('2d');
const labels=layer(W,H),labelCtx=labels.getContext('2d'),landOcclusion=layer(maskW,maskH),landOcclusionCtx=landOcclusion.getContext('2d');
const taiwanMask=layer(maskW,maskH),taiwanMaskCtx=taiwanMask.getContext('2d',{willReadFrequently:true}),floodMask=layer(maskW,maskH),floodMaskCtx=floodMask.getContext('2d');
let seaMask,playerSeaMask,playerTaiwanPixels,taiwanPixels,sugarcanePixels,occlusionPixels,floodField,floodPixels,floodProgress=-1,taiwanCells=[],particles=[],landRings=[],taiwanRings=[],avatar,shieldRays=[];
const sugarcane=new Image();
function loadDeferredImages(){
  if(!sugarcane.getAttribute('src')){
    sugarcane.onerror=()=>{sugarcane.onerror=null;sugarcane.src='./assets/sugarcane.png?v=sugarcane-60';};
    sugarcane.src='./assets/sugarcane.webp';
  }
  const voting=panel.querySelector('.hero-voting');
  if(!voting.getAttribute('src')){
    voting.onerror=()=>{voting.onerror=null;voting.src='./assets/voting-box.png';};
    voting.src=voting.dataset.src;
  }
}
const runner=new Image();
runner.src='./assets/wanan-running-edited.webp';
let runnerSource;
function path(context,points,closed=true){context.beginPath();points.forEach(([x,y],i)=>i?context.lineTo(x,y):context.moveTo(x,y));if(closed)context.closePath();}
function taiwanPath(context){context.beginPath();for(const ring of taiwanRings){ring.forEach(([x,y],i)=>i?context.lineTo(x,y):context.moveTo(x,y));context.closePath();}}
function sea(x,y,elapsed=game?.elapsed??0,forPlayer=false){
  if(x<0||y<0||x>=W||y>=H)return false;
  const index=Math.floor(y)*maskW+Math.floor(x);
  const coast=forPlayer?playerSeaMask:seaMask;
  if(coast&&coast[index*4+3]>=100)return false;
  if(forPlayer&&playerTaiwanPixels?.[index*4+3]<100)return true;
  return !floodField||floodField.distance[index]===0||floodCoverage(floodField,index,elapsed)>=.5;
}
function openWater(x,y,radius,elapsed=game?.elapsed??0){
  if(!sea(x,y,elapsed))return false;if(!radius)return true;
  for(let i=0;i<8;i++){const a=i*Math.PI/4;if(!sea(x+Math.cos(a)*radius,y+Math.sin(a)*radius,elapsed))return false;}return true;
}
function sugarcaneLand(x,y,elapsed){
  if(x<0||y<0||x>=W||y>=H||!floodField)return false;
  const index=Math.floor(y)*maskW+Math.floor(x);
  return sugarcanePixels[index*4+3]>=100&&floodCoverage(floodField,index,elapsed)<.5;
}
function freshGame(){const g=createGame(W,H,[avatar.ring]);g.worldOrigin={x:(W-WORLD.width)/2,y:(H-WORLD.height)/2};randomizeRound(g);g.sugarcaneDrift=createSugarcaneDrift();g.isOpenWater=(x,y,r)=>openWater(x,y,r,g.elapsed);g.isPlayerWater=(x,y)=>sea(x,y,g.elapsed,true);g.isSugarcaneLand=(x,y)=>sugarcaneLand(x,y,g.elapsed);g.edgePadding={top:52};g.sceneMotion=true;g.sceneReducedMotion=reducedMotion;if(!initializeScene(g))throw new Error('No open-water starting position');g.minimumCurrentLength=minimumCurrentLength();return g;}
function createParticle(){for(let i=0;i<15;i++){const x=Math.random()*W,y=Math.random()*H;if(sea(x,y))return{x,y,age:Math.random()*4,life:3+Math.random()*4};}return{x:W*.75,y:H*.6,age:0,life:5};}
function clearParticles(){trailCtx.clearRect(0,0,W,H);particles=Array.from({length:Math.min(1800,Math.round((reducedMotion?180:640)*W*H/(400*720)))},createParticle);if(reducedMotion)for(let i=0;i<30;i++)updateParticles(.04);}
function landGradient(context){
  const gradient=context.createLinearGradient(0,0,W,H);
  gradient.addColorStop(0,'#252d50');gradient.addColorStop(.55,'#34345e');gradient.addColorStop(1,'#242d4a');
  return gradient;
}
function cacheNightSea(){
  nightSeaCtx.clearRect(0,0,W,H);
  // Static, cached light veils and faint stars sit below land and gameplay.
  for(const [x,y,r,color] of [[W*.72,H*.25,W*.7,'#8375c947'],[W*.35,H*.62,W*.8,'#31b6b43b']]){
    const glow=nightSeaCtx.createRadialGradient(x,y,0,x,y,r);
    glow.addColorStop(0,color);glow.addColorStop(1,'#00000000');
    nightSeaCtx.fillStyle=glow;nightSeaCtx.fillRect(0,0,W,H);
  }
  for(let i=0;i<72;i++){
    const x=((i*137.508+23)%W),y=((i*97.317+51)%H),radius=i%9===0?.7:.36;
    nightSeaCtx.beginPath();nightSeaCtx.arc(x,y,radius,0,Math.PI*2);
    nightSeaCtx.fillStyle=i%9===0?'#acd9e84a':'#acd9e822';nightSeaCtx.fill();
  }
}
function cacheMap(){
  cacheNightSea();
  landRings=[...map.land,...map.japan].map(r=>r.map(project)).filter(r=>{const xs=r.map(p=>p[0]),ys=r.map(p=>p[1]);return Math.max(...xs)>=0&&Math.min(...xs)<=W&&Math.max(...ys)>=0&&Math.min(...ys)<=H;});
  landCtx.clearRect(0,0,W,H);maskCtx.setTransform(1,0,0,1,0,0);maskCtx.clearRect(0,0,maskW,maskH);landCtx.fillStyle=landGradient(landCtx);maskCtx.setTransform(1,0,0,1,0,0);maskCtx.fillStyle='#fff';
  for(const ring of landRings){path(landCtx,ring);landCtx.fill();path(maskCtx,ring);maskCtx.fill();}
  seaMask=maskCtx.getImageData(0,0,maskW,maskH).data;
  maskCtx.clearRect(0,0,maskW,maskH);
  for(const ring of landRings.filter(blocksPlayer)){path(maskCtx,ring);maskCtx.fill();}
  playerSeaMask=maskCtx.getImageData(0,0,maskW,maskH).data;
  taiwanCtx.clearRect(0,0,W,H);taiwanCtx.fillStyle=landGradient(taiwanCtx);
  taiwanMaskCtx.setTransform(1,0,0,1,0,0);taiwanMaskCtx.clearRect(0,0,W,H);taiwanMaskCtx.fillStyle='#fff';
  taiwanRings=map.taiwan.map(r=>r.map(project));
  for(const ring of taiwanRings){path(taiwanCtx,ring);taiwanCtx.fill();path(taiwanMaskCtx,ring);taiwanMaskCtx.fill();}
  const pixels=taiwanMaskCtx.getImageData(0,0,maskW,maskH).data,cells=new Uint8Array(maskW*maskH);
  // map.json's audited ring 0 is Taiwan proper. Offshore islands remain
  // in the drawing/flood masks, but cannot obstruct sugarcane movement.
  taiwanMaskCtx.clearRect(0,0,maskW,maskH);
  path(taiwanMaskCtx,taiwanRings[0]);taiwanMaskCtx.fill();
  sugarcanePixels=taiwanMaskCtx.getImageData(0,0,maskW,maskH).data;
  taiwanMaskCtx.clearRect(0,0,maskW,maskH);
  for(const ring of taiwanRings.filter(blocksPlayer)){path(taiwanMaskCtx,ring);taiwanMaskCtx.fill();}
  playerTaiwanPixels=taiwanMaskCtx.getImageData(0,0,maskW,maskH).data;
  taiwanPixels=pixels;occlusionPixels=landOcclusionCtx.createImageData(maskW,maskH);
  for(let i=0;i<cells.length;i++){const k=i*4;occlusionPixels.data[k+3]=Math.max(seaMask[k+3],pixels[k+3]);}
  taiwanCells=[];for(let i=0;i<cells.length;i++)if(pixels[i*4+3]>=100){cells[i]=1;taiwanCells.push(i);}
  floodField=createFloodField(cells,maskW,maskH);floodPixels=floodMaskCtx.createImageData(maskW,maskH);floodProgress=-1;updateFloodLand(game?.elapsed??0);clearParticles();
}
function updateFloodLand(elapsed){
  const state=floodState(elapsed);if(state.progress===floodProgress)return;floodProgress=state.progress;
  floodLandCtx.clearRect(0,0,W,H);floodLandCtx.globalCompositeOperation='source-over';floodLandCtx.drawImage(taiwanLand,0,0,W,H);
  for(const i of taiwanCells){
    const k=i*4,coverage=floodCoverage(floodField,i,elapsed);
    floodPixels.data[k]=20;floodPixels.data[k+1]=147;floodPixels.data[k+2]=163;floodPixels.data[k+3]=Math.round(coverage*225);
    occlusionPixels.data[k+3]=Math.max(seaMask[k+3],Math.round((1-coverage)*taiwanPixels[k+3]));
  }
  landOcclusionCtx.putImageData(occlusionPixels,0,0);
  if(state.progress<=0){floodMaskCtx.clearRect(0,0,maskW,maskH);return;}
  floodMaskCtx.putImageData(floodPixels,0,0);
  floodLandCtx.save();floodLandCtx.globalAlpha=.6;taiwanPath(floodLandCtx);floodLandCtx.clip();floodLandCtx.drawImage(floodMask,0,0,W,H);floodLandCtx.restore();
}
function drawTaiwan(elapsed){
  ctx.drawImage(floodLand,0,0,W,H);
  if(floodState(elapsed).progress>0){
    islandFlowCtx.clearRect(0,0,W,H);islandFlowCtx.globalCompositeOperation='source-over';islandFlowCtx.drawImage(trails,0,0,W,H);
    islandFlowCtx.globalCompositeOperation='destination-in';islandFlowCtx.drawImage(floodMask,0,0,W,H);islandFlowCtx.drawImage(taiwanLand,0,0,W,H);islandFlowCtx.globalCompositeOperation='source-over';
    ctx.drawImage(islandFlow,0,0,W,H);
  }
}
const colors=[[5,34,67],[5,47,79],[4,60,89],[4,76,101],[3,94,115],[4,112,128],[9,134,145],[26,158,161]];
function updateHeat(time){
  if(Math.abs(time-heatTime)<.8)return;heatTime=time;
  const im=heatImage;
  for(let y=0;y<heatH;y++)for(let x=0;x<heatW;x++){
    const f=sampleGameFlow(game,x*W/heatW,y*H/heatH,time),v=Math.min(6.999,f.strength*6.5),i=Math.floor(v),t=v-i,k=(y*heatW+x)*4;
    for(let c=0;c<3;c++)im.data[k+c]=colors[i][c]*(1-t)+colors[i+1][c]*t;
    im.data[k+3]=255;
  }
  heatCtx.putImageData(im,0,0);
}
function updateParticles(dt){
  if(dt<=0)return;dt=Math.min(dt,.06);
  trailCtx.globalCompositeOperation='destination-out';trailCtx.fillStyle=`rgba(0,0,0,${1-Math.exp(-dt*3.2)})`;trailCtx.fillRect(0,0,W,H);trailCtx.globalCompositeOperation='source-over';trailCtx.lineWidth=.65;trailCtx.lineCap='round';
  for(let i=0;i<particles.length;i++){
    const p=particles[i],v=sampleGameFlow(game,p.x,p.y,visualTime),nx=p.x+v.x*dt,ny=p.y+v.y*dt;p.age+=dt;
    if(p.age>p.life||!sea(nx,ny)){particles[i]=createParticle();continue;}
    trailCtx.strokeStyle=`rgba(121,222,225,${.16+v.strength*.23})`;trailCtx.beginPath();trailCtx.moveTo(p.x,p.y);trailCtx.lineTo(nx,ny);trailCtx.stroke();p.x=nx;p.y=ny;
  }
}
// Text and hazards use the same world units on every display.
function minimumCurrentLength(){return 14*6/sceneAt(0,W,H,true).zoom;}
function resize(){
  if(pointer!==null)resetInput();const r=slot.getBoundingClientRect();if(!(r.width>0&&r.height>0))return;
  const view=viewportFor(r.width,r.height);
  scale=view.scale;dpr=drawingRatio(scale,devicePixelRatio);tx=ty=0;
  field.style.width=view.displayWidth+'px';field.style.height=view.displayHeight+'px';
  const pixelWidth=Math.round(view.displayWidth*dpr),pixelHeight=Math.round(view.displayHeight*dpr);
  if(canvas.width!==pixelWidth||canvas.height!==pixelHeight){canvas.width=pixelWidth;canvas.height=pixelHeight;}
  const nextScale=Math.min(2,Math.max(1,Math.ceil(dpr*scale*1.6*2)/2));
  if(renderScale!==nextScale){
    renderScale=nextScale;
    for(const [surface,context] of [[nightSea,nightSeaCtx],[land,landCtx],[trails,trailCtx],[taiwanLand,taiwanCtx],[floodLand,floodLandCtx],[islandFlow,islandFlowCtx],[labels,labelCtx],[driftLayer,driftCtx]]){
      surface.width=Math.ceil(W*renderScale);surface.height=Math.ceil(H*renderScale);context.setTransform(renderScale,0,0,renderScale,0,0);
    }
    if(map)cacheMap();
  }
}
function flowOffset(c){return reducedMotion?0:(c.distance??0)*.4;}
function drawCurrent(c,context=ctx){
  context.save();context.globalAlpha=1;
  let bandColor='#f5a020';
  // Anchor the color gradient to the complete ribbon, so coast
  // clipping cannot make its color shift between visible fragments.
  const first=c.points?.[0],last=c.points?.at(-1);
  if(first&&last&&Math.hypot(last[0]-first[0],last[1]-first[1])>.01){
    const gradient=context.createLinearGradient(first[0],first[1],last[0],last[1]);
    gradient.addColorStop(0,'#ffd96a');gradient.addColorStop(.24,'#f5a020');
    gradient.addColorStop(.76,'#f18a00');gradient.addColorStop(1,'#ffca4a');bandColor=gradient;
  }
  for(const points of c.points?.length?[c.points]:[]){
  context.lineJoin='round';context.lineCap='round';context.setLineDash([]);context.lineDashOffset=0;
  path(context,points,false);context.strokeStyle='#ef7e0026';context.lineWidth=c.radius*2+8;context.stroke();
  path(context,points,false);context.strokeStyle=bandColor;context.lineWidth=c.radius*2;context.stroke();context.setLineDash([]);context.lineDashOffset=0;
  context.strokeStyle='#f5b04466';context.lineWidth=.7;
  for(const side of [-1,1]){const edge=points.map((p,i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1;return[p[0]-dy/len*c.radius*side,p[1]+dx/len*c.radius*side];});path(context,edge,false);context.stroke();}
  context.strokeStyle='#ffffff';context.lineWidth=1.1;
  const route=measurePath(points),phase=flowOffset(c)%40;
  for(let d=phase+5;d<route.length;d+=40){const p=samplePath(route,d);if(!p)continue;context.save();context.translate(p.x,p.y);context.rotate(p.angle);context.beginPath();context.moveTo(-3,-2.5);context.lineTo(1,0);context.lineTo(-3,2.5);context.stroke();context.restore();}
  }
  context.restore();
}
function drawCurrentLabel(c,context){
  // Lay out the whole word before viewport clipping so it travels with the ribbon.
  const fullPaths=projectPaths(c.points?.length?[c.points]:[],game.scene,W,H);
  const anchor=worldToView(c.x,c.y,game.scene,W,H);
  const fontSize=14;
  const label=layoutStableFlowText(fullPaths,c.label,fontSize,anchor,game.elapsed,labelStates.get(c));
  labelStates.set(c,label);
  const {glyphs}=label,opacity=1;if(!glyphs.length||opacity<=0){recordCurrentLabel(game,c,false);return;}
  context.save();context.globalAlpha=opacity;context.font=`600 ${fontSize}px ${labelFont}`;context.textAlign='center';context.textBaseline='middle';
  context.strokeStyle='#f5a020';context.lineWidth=2.5;context.lineJoin='round';context.fillStyle='#202444';
  for(const glyph of glyphs){context.save();context.translate(glyph.x,glyph.y);context.rotate(glyph.angle);context.strokeText(glyph.letter,0,0);context.fillText(glyph.letter,0,0);context.restore();}
  context.restore();
  const readable=opacity>=.9&&glyphs.length===[...c.label].length&&glyphs.every(glyph=>{
    const margin=fontSize*.75;
    if(glyph.x<margin||glyph.x>W-margin||glyph.y<margin||glyph.y>H-margin)return false;
    const point=viewToWorld(glyph.x,glyph.y,game.scene,W,H);
    return openWater(point.x,point.y,fontSize*.55/game.scene.zoom);
  });
  recordCurrentLabel(game,c,readable);
  return readable;
}
function drawCurrentLabels(pose){
  labelCtx.clearRect(0,0,W,H);
  for(const current of game.currents)drawCurrentLabel(current,labelCtx);
  // Labels follow the complete current curve; land naturally covers them.
  labelCtx.save();labelCtx.globalCompositeOperation='destination-out';
  labelCtx.translate(W/2+pose.offsetX,H/2+pose.offsetY);labelCtx.rotate(pose.angle);labelCtx.scale(pose.zoom,pose.zoom);labelCtx.translate(-W/2,-H/2);
  labelCtx.drawImage(landOcclusion,0,0,W,H);labelCtx.restore();
  ctx.drawImage(labels,0,0,W,H);
}

function cacheShieldRays(){
  // Begin each ray beyond the silhouette, including the extended arms and feet.
  shieldRays=Array.from({length:24},(_,i)=>{
    const angle=i*Math.PI/12,dx=Math.cos(angle),dy=Math.sin(angle);let radius=0;
    avatar.ring.forEach(([x,y],j)=>{
      const next=avatar.ring[(j+1)%avatar.ring.length],sx=next[0]-x,sy=next[1]-y,den=dx*sy-dy*sx;
      if(Math.abs(den)<1e-8)return;
      const t=(x*sy-y*sx)/den,u=(x*dy-y*dx)/den;
      if(t>0&&u>=0&&u<=1)radius=Math.max(radius,t);
    });
    return {dx,dy,radius,weight:i%3===0?1:.65};
  });
}
function drawMilkShield(pulse){
  ctx.save();ctx.translate(game.player.x,game.player.y);ctx.scale(game.facing??1,1);
  ctx.lineJoin='round';ctx.lineCap='round';ctx.shadowColor='#BFFFE8';ctx.shadowBlur=(10+8*pulse)*dpr;
  for(const ray of shieldRays){
    const {dx,dy,radius,weight}=ray,start=radius+3,end=start+(10+14*pulse)*weight,halfWidth=.9+.8*pulse;
    const x=dx*start,y=dy*start,tipX=dx*end,tipY=dy*end;
    const light=ctx.createLinearGradient(x,y,tipX,tipY);
    light.addColorStop(0,'#EFFFF8B3');light.addColorStop(.25,'#FFFDECC7');light.addColorStop(1,'#BFFFE800');
    ctx.fillStyle=light;ctx.beginPath();ctx.moveTo(x-dy*halfWidth,y+dx*halfWidth);ctx.lineTo(tipX,tipY);ctx.lineTo(x+dy*halfWidth,y-dx*halfWidth);ctx.closePath();ctx.fill();
  }
  path(ctx,avatar.ring);ctx.strokeStyle='#BFFFE8A6';ctx.lineWidth=6+3*pulse;ctx.stroke();
  ctx.shadowBlur=4*dpr;ctx.strokeStyle='#F5FFEBCF';ctx.lineWidth=2.5;ctx.stroke();
  ctx.restore();
}
function drawSugarcaneMessage(){
  const message=game.sugarcaneMessage;
  if(!message||game.elapsed>=message.until)return;
  const cane=game.sugarcaneDrift.items.find(item=>item.id===message.id)??message;
  const p=worldToView(cane.x,cane.y,game.scene,W,H);
  ctx.save();ctx.font=`500 ${13/scale}px ${displayFont}`;
  ctx.textAlign='center';ctx.textBaseline='bottom';ctx.lineJoin='round';
  const text='＼去選總統／',half=ctx.measureText(text).width/2;
  const x=Math.max(half+8/scale,Math.min(W-half-8/scale,p.x));
  const rise=reducedMotion?0:8*(game.elapsed-message.startedAt)/scale;
  const y=Math.max(28/scale,Math.min(H-8/scale,p.y-42/scale-rise,game.player.y-avatar.height/2-42/scale));
  ctx.lineWidth=3/scale;ctx.strokeStyle='#152949';ctx.fillStyle='#EEE04C';
  ctx.strokeText(text,x,y);ctx.fillText(text,x,y);ctx.restore();
}
function draw(){
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#06344e';ctx.fillRect(0,0,canvas.width/dpr,canvas.height/dpr);
  ctx.setTransform(dpr*scale,0,0,dpr*scale,tx*dpr,ty*dpr);ctx.save();ctx.beginPath();ctx.rect(0,0,W,H);ctx.clip();
  if(!map||!game){ctx.restore();return;}
  updateFloodLand(game.elapsed);
  const pose=game.scene;
  compassNeedle.setAttribute('transform',`rotate(${pose.angle*180/Math.PI} 20 29)`);
  ctx.save();ctx.translate(W/2+pose.offsetX,H/2+pose.offsetY);ctx.rotate(pose.angle);ctx.scale(pose.zoom,pose.zoom);ctx.translate(-W/2,-H/2);
  ctx.imageSmoothingEnabled=true;ctx.drawImage(heat,0,0,W,H);ctx.drawImage(nightSea,0,0,W,H);ctx.drawImage(trails,0,0,W,H);ctx.drawImage(land,0,0,W,H);
  drawTaiwan(game.elapsed);
  // All dry land visually hides debris; only Taiwan proper affects cane collisions.
  driftCtx.clearRect(0,0,W,H);
  drawSugarcanes(driftCtx,sugarcane,game.sugarcaneDrift);
  for(const c of game.currents)drawCurrent(c,driftCtx);
  driftCtx.save();driftCtx.globalCompositeOperation='destination-out';
  driftCtx.drawImage(landOcclusion,0,0,W,H);driftCtx.restore();
  ctx.drawImage(driftLayer,0,0,W,H);
  ctx.restore();
  drawCurrentLabels(pose);
  const protectedNow=game.lives>0&&game.reviveUntil>game.elapsed&&game.status!=='won';
  const shoreProtectedNow=game.sceneMotion&&game.lives>0&&game.shoreGraceUntil>game.elapsed&&game.status!=='won'&&game.status!=='over';
  const shieldPulse=reducedMotion?.5:.5+.5*Math.cos((game.elapsed-game.lastDamageAt)*Math.PI*2/.8);
  if(protectedNow)drawMilkShield(shieldPulse);
  const glowBlur=protectedNow?(10+16*shieldPulse)*dpr:5;
  ctx.save();ctx.translate(game.player.x,game.player.y);ctx.shadowColor=protectedNow?'#E7FFD3':'#061424';ctx.shadowBlur=glowBlur;
  ctx.save();ctx.scale(game.facing??1,1);ctx.drawImage(runner,...runnerSource,-avatar.width/2,-avatar.height/2,avatar.width,avatar.height);ctx.restore();ctx.shadowBlur=0;
  if(shoreProtectedNow){
    ctx.save();ctx.scale(game.facing??1,1);path(ctx,avatar.ring);
    ctx.lineJoin='round';ctx.lineCap='round';ctx.lineWidth=1.5/scale;
    ctx.strokeStyle='#A7E5E5';ctx.stroke();ctx.restore();
  }
  ctx.font=`500 ${13/scale}px ${displayFont}`;ctx.textAlign='center';ctx.lineWidth=3/scale;ctx.strokeStyle='#152949';ctx.fillStyle='#d8eff2';
  const nameX=8*(game.facing??1),nameY=Math.max(-avatar.height/2-6/scale,(protectedNow?35:15)/scale-game.player.y);
  ctx.strokeText('萬安',nameX,nameY);ctx.fillText('萬安',nameX,nameY);
  if(protectedNow){ctx.fillStyle='#EEE04C';const text='鮮奶護體',half=ctx.measureText(text).width/2,x=Math.max(half+8/scale,Math.min(W-half-8/scale,game.player.x+nameX))-game.player.x,y=nameY-19/scale;ctx.strokeText(text,x,y);ctx.fillText(text,x,y);}
  ctx.restore();
  drawSugarcaneMessage();
  if(game.status==='over'){ctx.fillStyle='#061d391a';ctx.fillRect(0,0,W,H);}ctx.restore();
}
function updateLifeDisplay(){
  const meter=$('life-meter'),protectedNow=game.reviveUntil>game.elapsed;
  const protectionsRemaining=Math.max(0,game.lives-1),lifeText='鮮奶護體剩餘 '+protectionsRemaining+' 次';
  if(meter.getAttribute('aria-label')!==lifeText){meter.setAttribute('aria-label',lifeText);meter.title=lifeText;}
  meter.querySelectorAll('.milk-bottle').forEach(bottle=>{
    const empty=protectionsRemaining===0;
    if(bottle.classList.contains('empty')!==empty){
      bottle.classList.toggle('empty',empty);bottle.src=empty?'./assets/milk-life-empty.png':'./assets/milk-life.png';
    }
  });
  const showNotice=game.lives>0&&protectedNow&&game.status==='playing',notice=$('protection-label');
  if(showNotice&&notice.hidden)notice.textContent='鮮奶護體';
  notice.hidden=!showNotice;
  if(!showNotice&&notice.textContent)notice.textContent='';
}
function resetInput(){const captured=pointer;pointer=null;origin=null;keys.clear();if(game)game.input={x:0,y:0};canvas.classList.remove('dragging');if(captured!==null&&canvas.hasPointerCapture(captured))canvas.releasePointerCapture(captured);}
function setPanel(mode){
  if(mode==='paused')effects.stop();
  overlay.hidden=false;panel.className='start-panel '+mode;
  if(mode==='paused'){$('panel-label').textContent='PAUSED';$('panel-title').textContent='已暫停';$('panel-text').textContent='萬安與洋流已停止移動。';start.innerHTML='繼續挑戰<span aria-hidden="true">↗</span>';$('panel-note').textContent='目標：撐到 11月28日';}
  if(mode==='over'){$('panel-label').textContent='CHALLENGE OVER';$('panel-title').textContent=gameDate(game.elapsed)+' 挑戰結束';$('panel-text').textContent='萬安碰到了「'+game.currents.find(c=>c.id===game.hit)?.label+'」急流。';start.innerHTML='再試一次<span aria-hidden="true">↗</span>';$('panel-note').textContent='';}
  if(mode==='won'){$('panel-label').textContent='MISSION COMPLETE';$('panel-title').textContent='恭喜萬安成功撐到 11月28日';$('panel-text').innerHTML='11月28日<br>記得去投票 .ᐟ.ᐟ';start.innerHTML='再玩一次<span aria-hidden="true">↗</span>';$('panel-note').textContent='';}
  updateLifeDisplay();pause.disabled=true;resetInput();start.focus({preventScroll:true});
}
function begin(){
  if(!map||help.open||game.status==='playing')return false;
  effects.unlock();
  music.start();
  if(game.status!=='paused'){game=freshGame();labelStates=new WeakMap();seenCurrents=new Set();visualTime=0;heatTime=-100;clearParticles();$('notice').classList.remove('visible');$('notice').textContent='';}
  loadDeferredImages();game.status='playing';last=performance.now();overlay.hidden=true;pause.disabled=false;resetInput();start.blur();updateLifeDisplay();feedback.reset(game);effects.play('start');return true;
}
function pauseGame(){if(game?.status==='playing'){game.status='paused';setPanel('paused');return true;}return false;}
function frame(now){
  const dt=last?Math.min((now-last)/1000,1):0;last=now;
  if(game){
    const previous=game.status,beforeElapsed=game.elapsed;updateGame(game,dt);feedback.update(game);
    if(previous==='playing'){visualTime=game.elapsed;if(!reducedMotion)updateParticles(game.elapsed-beforeElapsed);}
    else if(game.status==='ready'&&!reducedMotion){visualTime+=Math.min(dt,.06);updateParticles(dt);}
    updateHeat(visualTime);if(previous==='playing'&&(game.status==='over'||game.status==='won'))setPanel(game.status);
    const date=gameDate(game.elapsed);if($('game-date').textContent!==date)$('game-date').textContent=date;
    updateLifeDisplay();
    for(const c of game.currents){if(c.entered&&!seenCurrents.has(c.id)){seenCurrents.add(c.id);$('notice').textContent='「'+c.label+'」急流進入海域';$('notice').classList.add('visible');noticeUntil=game.elapsed+2.4;}}
    if(game.elapsed>noticeUntil)$('notice').classList.remove('visible');
  }
  draw();requestAnimationFrame(frame);
}
function movePointer(e){
  if(pointer!==e.pointerId||!origin||game.status!=='playing')return;
  e.preventDefault();
  const dx=(e.clientX-origin.x)/scale,dy=(e.clientY-origin.y)/scale;
  origin={x:e.clientX,y:e.clientY};movePlayer(game,dx,dy);feedback.update(game);
  if(game.status==='over')setPanel('over');
  updateLifeDisplay();
}
canvas.addEventListener('pointerdown',e=>{
  if(!game||game.status!=='playing'||pointer!==null||!e.isPrimary||(e.pointerType==='mouse'&&e.button!==0))return;
  e.preventDefault();resetInput();pointer=e.pointerId;origin={x:e.clientX,y:e.clientY};canvas.setPointerCapture(pointer);canvas.classList.add('dragging');
});
canvas.addEventListener('pointermove',movePointer);
canvas.addEventListener('pointerup',e=>{if(e.pointerId!==pointer)return;movePointer(e);resetInput();});
for(const event of ['pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{if(e.pointerId===pointer)resetInput();});
const movementKeys=new Set(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d']);
function keyboardInput(){if(!game||pointer!==null)return;game.input=normalize(Number(keys.has('arrowright')||keys.has('d'))-Number(keys.has('arrowleft')||keys.has('a')),Number(keys.has('arrowdown')||keys.has('s'))-Number(keys.has('arrowup')||keys.has('w')));}
window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(k==='escape'){pauseGame();return;}if(game?.status!=='playing'||!movementKeys.has(k)||help.open)return;e.preventDefault();keys.add(k);keyboardInput();});
window.addEventListener('keyup',e=>{keys.delete(e.key.toLowerCase());if(game?.status==='playing')keyboardInput();});
start.addEventListener('click',begin);pause.addEventListener('click',pauseGame);$('help').addEventListener('click',()=>{pauseGame();help.showModal();});$('close-help').addEventListener('click',()=>help.close());
function clearTrail(){if(reducedMotion)clearParticles();else trailCtx.clearRect(0,0,W,H);}
document.addEventListener('visibilitychange',()=>{if(document.hidden){pauseGame();music.pause();effects.stop();}});window.addEventListener('blur',()=>{pauseGame();effects.stop();resetInput();});
new ResizeObserver(()=>{resize();clearTrail();}).observe(slot);
window.addEventListener('resize',resize);
function state(){return {status:game?.status??'loading',startDate:START_DATE,currentDate:gameDate(game?.elapsed??0),targetDate:TARGET_DATE,lives:game?.lives??STARTING_LIVES,milkProtectionsRemaining:game?Math.max(0,game.lives-1):STARTING_LIVES-1,protectionSeconds:game?Math.max(0,game.reviveUntil-game.elapsed):0,activeCurrents:game?.currents.length??0,currentLabels:game?.currents.map(c=>c.label)??[],player:game?{name:'萬安',x:game.player.x,y:game.player.y,facing:game.facing===-1?'left':'right'}:null,controlMode:'direct-drag',dragging:pointer!==null,flood:game?floodState(game.elapsed):null,mapMotion:game?.scene?{angleDegrees:game.scene.angle*180/Math.PI,offsetX:game.scene.offsetX,offsetY:game.scene.offsetY,zoom:game.scene.zoom,active:game.scene.active}:null,shoreProtection:!!game&&(game.shoreGraceUntil??0)>game.elapsed,sugarcanes:game?.sugarcaneDrift?.items.map(({id,x,y,angle,spin})=>({id,x,y,angle,spin}))??[],dataMode:'simulated'};}
function registerTools(){if(!document.modelContext?.registerTool)return;const life=new AbortController();window.addEventListener('pagehide',()=>life.abort(),{once:true});
  for(const [name,description,fn,readOnlyHint] of [['read_game_status','讀取洋流遊戲狀態、目前日期與11月28日過關進度。',state,true],['start_or_resume_game','開始新局或繼續暫停中的洋流遊戲。',()=>{if(!begin())throw new Error('目前無法開始，請關閉說明或等待地圖載入。');return state();},false],['pause_game','暫停進行中的遊戲。',()=>{if(!pauseGame())throw new Error('遊戲目前沒有進行。');return state();},false]]){
    try{Promise.resolve(document.modelContext.registerTool({name,description,inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint},execute(input){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw new Error('此操作不接受參數。');return fn();}},{signal:life.signal})).catch(()=>{});}catch{}
  }
}
resize();requestAnimationFrame(frame);
const loadJSON=url=>fetch(url).then(r=>{if(!r.ok)throw new Error('asset');return r.json();});
Promise.all([loadJSON('./map.json?v=aurora-amber-30'),loadJSON('./assets/wanan-avatar.json?v=runner-mask-37'),runner.decode()]).then(([data,character])=>{if(!data.land?.length||!character.ring?.length)throw new Error('asset');map=data;avatar={...character,width:character.width*1.1,height:character.height*1.1,ring:character.ring.map(([x,y])=>[x*1.1,y*1.1])};runnerSource=avatar.source.map(v=>v*runner.naturalWidth/1208);cacheShieldRays();cacheMap();game=freshGame();updateHeat(0);resize();start.disabled=false;start.innerHTML='開始挑戰<span aria-hidden="true">↗</span>';registerTools();setTimeout(()=>{if(!loopAudio.muted){if(loopAudio.prepare)void loopAudio.prepare();else{musicElement.preload='auto';musicElement.load();}}},0);}).catch(()=>{$('panel-title').textContent='遊戲素材未載入';$('panel-text').textContent='請確認網路連線，再重新整理頁面。';start.textContent='重新載入';start.disabled=false;start.addEventListener('click',()=>location.reload(),{once:true});});
