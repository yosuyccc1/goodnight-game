import {viewToWorld,worldToView} from './scene-motion.mjs?v=random-round-52';

export const SUGARCANE_SOURCE=[452,8,122,1516];
export const SUGARCANE_START_SECONDS=0;
const TAU=Math.PI*2;
const SUGARCANE_DRIFT_SPEED=1.38;
const SUGARCANE_ENTRY_GAP_SECONDS=2;
function sugarcaneFlow(sampleFlow,game,x,y,time){
  const flow=sampleFlow(game,x,y,time);
  return {...flow,x:flow.x*SUGARCANE_DRIFT_SPEED,y:flow.y*SUGARCANE_DRIFT_SPEED};
}
export function createSugarcaneDrift(random=Math.random){return {items:[],timer:0,entryTimer:0,serial:0,random};}

function inWater(game,item){
  // Use the same Taiwan-only coast for spawn routes and live collisions.
  if(game.isSugarcaneLand)return !sugarcaneContact(item,game.isSugarcaneLand);
  const water=game.isOpenWater??(()=>true),half=item.length/2;
  // Check the whole rotated stalk, including both tips, against the coast.
  for(let d=-half;d<=half;d+=half/10){
    if(!water(item.x-Math.sin(item.angle)*d,item.y+Math.cos(item.angle)*d,item.width/2))return false;
  }
  return true;
}
// A sampled capsule follows the rotating stalk, including its two end caps.
export function sugarcaneContact(item,isLand){
  if(!isLand)return null;
  const sx=-Math.sin(item.angle),sy=Math.cos(item.angle),radius=item.width/2;
  const count=Math.max(1,Math.ceil(item.length));
  for(let i=0;i<=count;i++){
    const d=item.length*(i/count-.5),x=item.x+sx*d,y=item.y+sy*d;
    if(isLand(x,y))return {x,y};
    for(let j=0;j<8;j++){
      const a=j*Math.PI/4,px=x+Math.cos(a)*radius,py=y+Math.sin(a)*radius;
      if(isLand(px,py))return {x:px,y:py};
    }
  }
  return null;
}
function shoreNormal(hit,item,isLand){
  // Estimate the direction toward water without treating map edges as land.
  for(const radius of [2,5,10]){
    let x=0,y=0;
    for(let i=0;i<16;i++){
      const a=i*TAU/16,dx=Math.cos(a),dy=Math.sin(a);
      if(!isLand(hit.x+dx*radius,hit.y+dy*radius)){x+=dx;y+=dy;}
    }
    const size=Math.hypot(x,y);if(size>.1)return {x:x/size,y:y/size};
  }
  const dx=item.x-hit.x,dy=item.y-hit.y,size=Math.hypot(dx,dy)||1;
  return {x:dx/size,y:dy/size};
}
export function advanceSugarcane(item,game,dt,sampleFlow){
  const isLand=game.isSugarcaneLand;
  // Bound translation plus tip travel to prevent fast rotation tunneling.
  const initial=sugarcaneFlow(sampleFlow,game,item.x,item.y);
  const speed=Math.hypot(initial.x,initial.y)+Math.hypot(item.kickX??0,item.kickY??0)+60;
  const steps=Math.max(1,Math.ceil(dt*(speed+Math.max(Math.abs(item.spin),14)*item.length/2)/.8));
  const h=dt/steps;
  for(let i=0;i<steps;i++){
    const flow=sugarcaneFlow(sampleFlow,game,item.x,item.y);
    // Keep a short, collision-checked retreat when a rotating stalk wedges
    // against several coast samples. Resume the ambient flow afterward.
    if(item.retreatTime>0){
      item.retreatTime=Math.max(0,item.retreatTime-h);
      const retreat={...item,x:item.x+item.retreatX*42*h,y:item.y+item.retreatY*42*h};
      if(!sugarcaneContact(retreat,isLand)){
        item.x=retreat.x;item.y=retreat.y;continue;
      }
      item.retreatTime=0;
    }
    item.rollTime=Math.max(0,(item.rollTime??0)-h);
    item.shoreQuietTime=(item.shoreQuietTime??0)+h;
    if(item.shoreQuietTime>3)item.shoreDirection=0;
    item.impactCooldown=Math.max(0,(item.impactCooldown??0)-h);
    const decay=Math.exp(-2.4*h);
    item.kickX=(item.kickX??0)*decay;item.kickY=(item.kickY??0)*decay;
    const rolling=Math.min(1,item.rollTime/.8);
    const spin=item.spin*(1-rolling)+(item.rollSpin??item.spin)*rolling;
    const next={...item,x:item.x+(flow.x+item.kickX)*h,y:item.y+(flow.y+item.kickY)*h,
      angle:game.sceneReducedMotion?item.angle:(item.angle+spin*h)%TAU};
    const hit=sugarcaneContact(next,isLand);
    if(!hit){item.x=next.x;item.y=next.y;item.angle=next.angle;continue;}
    const normal=shoreNormal(hit,item,isLand);
    item.shoreQuietTime=0;
    let resolved=false;
    // Resolve a shallow rotating-tip contact outward while preserving rotation.
    for(let distance=.5;distance<=3;distance+=.5){
      const corrected={...next,x:next.x+normal.x*distance,y:next.y+normal.y*distance};
      if(!sugarcaneContact(corrected,isLand)){
        item.x=corrected.x;item.y=corrected.y;item.angle=corrected.angle;resolved=true;break;
      }
    }
    if(item.impactCooldown<=0){
      const torque=(hit.x-item.x)*normal.y-(hit.y-item.y)*normal.x;
      const direction=Math.abs(torque)>.3?Math.sign(torque):Math.sign(item.spin)||1;
      item.rollSpin=direction*Math.min(14,Math.abs(item.spin)*1.65);
      item.rollTime=1.4;item.impactCooldown=.18;item.impacts=(item.impacts??0)+1;
    }
    const tangent={x:-normal.y,y:normal.x};
    const along=flow.x*tangent.x+flow.y*tangent.y;
    // Keep a consistent alongshore direction through repeated tip impacts.
    const sign=item.shoreDirection|| (Math.abs(along)>2?Math.sign(along):Math.sign(item.rollSpin)||1);
    item.shoreDirection=sign;
    const inward=Math.min(0,flow.x*normal.x+flow.y*normal.y);
    // Short outward bounce and alongshore motion; both decay back to the flow.
    item.kickX=normal.x*(18-inward)+tangent.x*sign*16;
    item.kickY=normal.y*(18-inward)+tangent.y*sign*16;
    if(!resolved){
      // A blocked turn must not block translation. Try a small waterward slide
      // at the last safe angle, checking the complete stalk before accepting it.
      for(const alongSpeed of [16,0]){
        const slide={...item,x:item.x+(normal.x*18+tangent.x*sign*alongSpeed)*h,
          y:item.y+(normal.y*18+tangent.y*sign*alongSpeed)*h};
        if(!sugarcaneContact(slide,isLand)){item.x=slide.x;item.y=slide.y;resolved=true;break;}
      }
      if(!resolved){
        // A normal estimated at one tip can point into land at the other tip.
        // Search around the whole stalk instead of retrying that same normal.
        const base=Math.atan2(normal.y,normal.x),distance=42*h;
        for(const turn of [0,1,-1,2,-2,3,-3,4,-4,5,-5,6,-6,7,-7,8]){
          const a=base+turn*Math.PI/8,dx=Math.cos(a),dy=Math.sin(a);
          const escape={...item,x:item.x+dx*distance,y:item.y+dy*distance};
          if(sugarcaneContact(escape,isLand))continue;
          item.x=escape.x;item.y=escape.y;
          item.retreatX=dx;item.retreatY=dy;item.retreatTime=.5;
          item.kickX=0;item.kickY=0;item.rollTime=0;
          break;
        }
      }
    }
  }
}
export function updateSugarcaneDrift(game,dt,sampleFlow){
  const drift=game.sugarcaneDrift;if(!drift||!(dt>0))return;
  drift.entryTimer=Math.max(0,drift.entryTimer-dt);
  for(const item of drift.items){
    if(game.isSugarcaneLand)advanceSugarcane(item,game,dt,sampleFlow);
    else{
      const flow=sugarcaneFlow(sampleFlow,game,item.x,item.y);
      item.x+=flow.x*dt;item.y+=flow.y*dt;
      if(!game.sceneReducedMotion)item.angle=(item.angle+item.spin*dt)%TAU;
    }
    item.age+=dt;
    const p=game.scene?worldToView(item.x,item.y,game.scene,game.width,game.height):item;
    const radius=Math.hypot(item.length,item.width)/2*(game.scene?.zoom??1);
    const visible=p.x+radius>=0&&p.x-radius<=game.width&&p.y+radius>=0&&p.y-radius<=game.height;
    if(visible)item.entered=true;
    // Start the spacing clock once the center is on screen, rather than when
    // the stalk is created outside it or its rotation radius grazes an edge.
    if(!item.entryStarted&&p.x>=0&&p.x<=game.width&&p.y>=0&&p.y<=game.height){
      item.entryStarted=true;drift.entryTimer=SUGARCANE_ENTRY_GAP_SECONDS;
    }
    // Measure progress in viewport space so rotating and zooming maps use
    // the same one-third threshold the player sees. Remember once it is crossed.
    if(item.entryStarted&&item.entryDirection){
      const {x:nx,y:ny}=item.entryDirection;
      const progress=nx>0?p.x/game.width:nx<0?1-p.x/game.width:ny>0?p.y/game.height:1-p.y/game.height;
      if(progress>=1/3)item.releasedEntrySlot=true;
    }
    item.hiddenAge=visible?0:item.hiddenAge+dt;
  }
  // Never expire or fade a visible stalk. Allow a short offscreen grace period
  // for camera movement; unsuccessful entries can be retried while still hidden.
  drift.items=drift.items.filter(item=>item.hiddenAge<(item.entered?2:15));
  drift.timer-=dt;
  spawnSugarcane(game,sampleFlow);
}
function spawnSugarcane(game,sampleFlow){
  const drift=game.sugarcaneDrift;
  if(game.elapsed<SUGARCANE_START_SECONDS||drift.timer>0||drift.entryTimer>1e-9||drift.items.length>=2)return;
  const newest=drift.items.reduce((latest,item)=>!latest||item.id>latest.id?item:latest,null);
  if(newest&&!newest.releasedEntrySlot)return;
  drift.timer=1;
  const r=drift.random,length=(43.875+r()*13.5)*1.7424;
  const prototype={length,width:length*SUGARCANE_SOURCE[2]/SUGARCANE_SOURCE[3],angle:r()*TAU,
    spin:(r()<.5?-1:1)*(4.86+r()*4.86),age:0,hiddenAge:0,entered:false};
  const pose=game.scene,zoom=pose?.zoom??1;
  // Keep the entire sprite outside the viewport even while it rotates.
  const margin=Math.hypot(length,prototype.width)*zoom/2+3,sites=[];
  const toView=(x,y)=>pose?worldToView(x,y,pose,game.width,game.height):{x,y};
  for(const [vertical,fixed,nx,ny,span] of [
    [true,-margin,1,0,game.height],[true,game.width+margin,-1,0,game.height],
    [false,-margin,0,1,game.width],[false,game.height+margin,0,-1,game.width],
  ]){
    const count=Math.max(1,Math.ceil(span/40));
    for(let i=0;i<count;i++){
      const along=span*(i+.5)/count,view={x:vertical?fixed:along,y:vertical?along:fixed};
      const center=pose?viewToWorld(view.x,view.y,pose,game.width,game.height):view;
      const flow=sugarcaneFlow(sampleFlow,game,center.x,center.y),ahead=toView(center.x+flow.x,center.y+flow.y);
      const vx=ahead.x-view.x,vy=ahead.y-view.y;
      if(vx*nx+vy*ny<Math.max(8,Math.hypot(vx,vy)*.25))continue;
      // Reject coasts along the approach, including the rotating tips.
      const probe={...prototype,...center};let clear=true;
      for(let step=0;step<=30;step++){
        if(!inWater(game,probe)){clear=false;break;}
        const f=sugarcaneFlow(sampleFlow,game,probe.x,probe.y,game.elapsed+step*.1);
        probe.x+=f.x*.1;probe.y+=f.y*.1;
        if(!game.sceneReducedMotion)probe.angle+=probe.spin*.1;
      }
      if(!clear)continue;
      // Forecast the same time-varying flow used by live movement. Prefer
      // routes reaching central water, never steer toward the player.
      let closest=Infinity,centralTime=0;
      for(let t=3.1;t<=21;t+=.25){
        const point=toView(probe.x,probe.y);
        if(point.x>=0&&point.x<=game.width&&point.y>=0&&point.y<=game.height&&inWater(game,probe)){
          const distance=Math.hypot((point.x-game.width/2)/(game.width/2),(point.y-game.height/2)/(game.height/2));
          closest=Math.min(closest,distance);
          if(distance<.6)centralTime+=.25;
        }
        const f=sugarcaneFlow(sampleFlow,game,probe.x,probe.y,game.elapsed+t);
        probe.x+=f.x*.25;probe.y+=f.y*.25;
        if(!game.sceneReducedMotion)probe.angle+=probe.spin*.25;
      }
      if(Number.isFinite(closest))sites.push({...center,entryDirection:{x:nx,y:ny},score:closest-Math.min(centralTime,6)*.025});
    }
  }
  const separated=sites.filter(site=>drift.items.every(item=>Math.hypot(site.x-item.x,site.y-item.y)>(length+item.length)/2+12));
  if(separated.length){
    const best=Math.min(...separated.map(site=>site.score));
    const preferred=separated.filter(site=>site.score<=best+.12);
    const {x,y,entryDirection}=preferred[Math.min(preferred.length-1,Math.floor(r()*preferred.length))];
    const center={x,y};
    drift.items.push({...prototype,...center,entryDirection,releasedEntrySlot:false,id:++drift.serial});
  }
}

export function drawSugarcanes(context,image,drift){
  if(!image.complete||!image.naturalWidth)return;
  const source=SUGARCANE_SOURCE.map(v=>v*image.naturalWidth/1024);
  for(const item of drift?.items??[]){
    context.save();context.globalAlpha=1;
    context.translate(item.x,item.y);context.rotate(item.angle);
    context.drawImage(image,...source,-item.width/2,-item.length/2,item.width,item.length);
    context.restore();
  }
}
