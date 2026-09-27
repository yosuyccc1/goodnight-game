import {updateSugarcaneDrift} from './sugarcane.mjs?v=cane-mainland-only-121';
import {createSceneProfile,sceneAt,worldToView,viewToWorld,projectPaths} from './scene-motion.mjs?v=random-round-52';
import {START_DATE,TARGET_DATE,GOAL_DAYS,DAYS_PER_SECOND,GOAL_SECONDS,gameDate} from './timeline.mjs?v=date-copy-39';

export const MAX_CURRENTS=4;
export const FLOW_SPEED_MULTIPLIER=1.8216;
export const CURRENT_SPEED_MULTIPLIER=1.4419166666666667;
export const CURRENT_LIFETIME=14;
export const LABEL_READ_SECONDS=4;
export const STARTING_LIVES=2;
export const REVIVE_SECONDS=5;
export const WORLD = { width: 400, height: 720 };
export {START_DATE,TARGET_DATE,GOAL_DAYS,DAYS_PER_SECOND,GOAL_SECONDS,gameDate};
export const CURRENT_LABELS = ['兒虐問題', '雙城辯論', '法律博士', '利益迴避', '英語口說', '食安風波', '王偉忠專訪', '安鼠之亂', '北市古阿明', '問Ａ答Ｂ', '讀稿機', '砍樹爭議', '殷語演蔣'];
const FLOW_VORTICES = [[90,405,1],[320,125,-1],[115,145,-.55]];
const CURRENT_VIEWS = new WeakMap();
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export function normalize(x, y) { const m = Math.max(1, Math.hypot(x, y)); return { x: x / m, y: y / m }; }
export function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[i], [bx, by] = ring[j];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}
function pointSegmentDistance(p, a, b) {
  const dx=b[0]-a[0], dy=b[1]-a[1], length=dx*dx+dy*dy;
  const t=length?clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length,0,1):0;
  return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t);
}
function cross(a,b,c){return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);}
function segmentsIntersect(a,b,c,d){
  const c1=cross(a,b,c),c2=cross(a,b,d),c3=cross(c,d,a),c4=cross(c,d,b);
  if(((c1>0&&c2<0)||(c1<0&&c2>0))&&((c3>0&&c4<0)||(c3<0&&c4>0)))return true;
  return pointSegmentDistance(a,c,d)<1e-8||pointSegmentDistance(b,c,d)<1e-8||pointSegmentDistance(c,a,b)<1e-8||pointSegmentDistance(d,a,b)<1e-8;
}
export function ribbonHitsRing(points,radius,ring){
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    if(pointInRing(a[0],a[1],ring)||pointInRing(b[0],b[1],ring))return true;
    for(let j=0,k=ring.length-1;j<ring.length;k=j++){
      const c=ring[k],d=ring[j];
      if(segmentsIntersect(a,b,c,d)||Math.min(pointSegmentDistance(a,c,d),pointSegmentDistance(b,c,d),pointSegmentDistance(c,a,b),pointSegmentDistance(d,a,b))<=radius)return true;
    }
  }
  return false;
}
export function clipRibbon(points,radius,isOpenWater){
  if(!isOpenWater)return [points];
  if(points.length<2)return [];
  const paths=[],spacing=.5,minLength=4;let run=[];
  const open=p=>isOpenWater(p[0],p[1],radius+1);
  const edge=(water,land)=>{
    // Always return the water side of the boundary: visual and collision paths
    // share this endpoint, so interpolation must never extend a ribbon on land.
    let a=water,b=land;
    for(let i=0;i<8;i++){
      const middle=[(a[0]+b[0])/2,(a[1]+b[1])/2];
      if(open(middle))a=middle;else b=middle;
    }
    return a;
  };
  const finish=()=>{
    let length=0;for(let i=1;i<run.length;i++)length+=Math.hypot(run[i][0]-run[i-1][0],run[i][1]-run[i-1][1]);
    if(length>=minLength-1e-8){
      // Remove only collinear sampling points. Keep every actual streamline
      // bend; unlike alternating-point thinning, this cannot cut across a coast.
      const compact=[run[0]];
      for(let i=1;i<run.length-1;i++){
        const a=compact.at(-1),b=run[i],c=run[i+1];
        if(Math.abs(cross(a,b,c))>1e-8*Math.max(1,Math.hypot(c[0]-a[0],c[1]-a[1])))compact.push(b);
      }
      if(Math.hypot(run.at(-1)[0]-compact.at(-1)[0],run.at(-1)[1]-compact.at(-1)[1])>1e-8)compact.push(run.at(-1));
      if(compact.length>1)paths.push(compact);
    }
    run=[];
  };
  let previous=points[0],previousOpen=open(previous);
  if(previousOpen)run.push(previous);
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    // The tolerance avoids alternating 8/9 samples when a computed four-unit
    // streamline segment differs from four by floating-point roundoff.
    const steps=Math.max(1,Math.ceil(length/spacing-1e-9));
    for(let k=1;k<=steps;k++){
      const t=k/steps,p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],isOpen=open(p);
      if(isOpen){if(!previousOpen)run.push(edge(p,previous));run.push(p);}
      else if(previousOpen){run.push(edge(previous,p));finish();}
      previous=p;previousOpen=isOpen;
    }
  }
  finish();return paths;
}
export function sampleFlow(x,y,time,phase=0){
  const jetX=276+26*Math.sin(y/145+time*.025),jet=Math.exp(-(((x-jetX)/48)**2));
  let vx=6+7*Math.sin(y/130+time*.02)+jet*7,vy=-30-22*jet;
  for(const [cx,cy,sign] of FLOW_VORTICES){
    const dx=x-cx,dy=y-cy,weight=Math.exp(-(dx*dx+dy*dy)/18000)*.12*sign;
    vx-=dy*weight;vy+=dx*weight;
  }
  // Rotate the entire shared vector field continuously: one turn per 72 seconds.
  // Both particles and dangerous ribbons sample this same space/time function.
  const angle=time*Math.PI/36+phase,cos=Math.cos(angle),sin=Math.sin(angle),speed=Math.hypot(vx,vy),scale=Math.min(1,60/speed);
  return {x:(vx*cos-vy*sin)*scale*FLOW_SPEED_MULTIPLIER,y:(vx*sin+vy*cos)*scale*FLOW_SPEED_MULTIPLIER,strength:clamp(speed/60,0,1)};
}
export function traceStreamline(x,y,time,length,phase=0){
  // Trace a fixed arc length in each direction through the current flow field.
  const trace=sign=>{
    const out=[];let px=x,py=y,left=length/2;
    while(left>1e-9){
      const step=Math.min(4,left),f=sampleFlow(px,py,time,phase),speed=Math.hypot(f.x,f.y);
      if(speed<1e-6)break;
      const mid=sampleFlow(px+sign*f.x/speed*step/2,py+sign*f.y/speed*step/2,time,phase),midSpeed=Math.hypot(mid.x,mid.y);
      if(midSpeed<1e-6)break;
      px+=sign*mid.x/midSpeed*step;py+=sign*mid.y/midSpeed*step;out.push([px,py]);left-=step;
    }
    return out;
  };
  return [...trace(-1).reverse(),[x,y],...trace(1)];
}
export function sampleGameFlow(game,x,y,time=game?.elapsed??0){
  return sampleFlow(x-(game?.worldOrigin?.x??0),y-(game?.worldOrigin?.y??0),time,game?.flowPhase??0);
}
function sampleCurrentFlow(game,x,y,time){
  const flow=sampleGameFlow(game,x,y,time);
  return {x:flow.x*CURRENT_SPEED_MULTIPLIER,y:flow.y*CURRENT_SPEED_MULTIPLIER};
}
export function traceGameStreamline(game,x,y,time,length){
  const {x:ox=0,y:oy=0}=game.worldOrigin??{};
  return traceStreamline(x-ox,y-oy,time,length,game.flowPhase).map(([px,py])=>[px+ox,py+oy]);
}
function currentScene(game){return game.sceneMotion?(game.scene??sceneAt(game.sceneTime??0,game.width,game.height,game.sceneReducedMotion,game.sceneProfile)):null;}
function currentView(current,game,pose=currentScene(game)){
  if(!game.sceneMotion)return {paths:current.paths,radius:current.radius};
  const cached=CURRENT_VIEWS.get(current);
  if(cached?.pose===pose&&cached.source===current.paths)return cached;
  const result={pose,source:current.paths,paths:projectPaths(current.paths,pose,game.width,game.height),radius:current.radius*pose.zoom};
  if(pose===game.scene){CURRENT_VIEWS.set(current,result);current.viewPaths=result.paths;}
  return result;
}
function visibleCurrent(current,game,pose=currentScene(game)){
  const {paths,radius}=currentView(current,game,pose);
  if(!game.sceneMotion)return paths.some(path=>path.some(([x,y])=>x+radius>=0&&x-radius<=game.width&&y+radius>=0&&y-radius<=game.height));
  return paths.some(path=>ribbonHitsRing(path,radius,[[0,0],[game.width,0],[game.width,game.height],[0,game.height]]));
}
function currentOnScreen(current,game){
  const pose=currentScene(game),points=current.points??[],radius=(current.radius+5)*(pose?.zoom??1);
  const paths=pose?projectPaths([points],pose,game.width,game.height):[points];
  return paths.some(path=>ribbonHitsRing(path,radius,[[0,0],[game.width,0],[game.width,game.height],[0,game.height]]));
}
function spawnSites(game,radius,separation=90){
  const sites=[],{width,height,elapsed}=game,pose=game.sceneMotion?currentScene(game):null,inset=radius*(pose?.zoom??1)+2;
  const inView=(x,y)=>pose?worldToView(x,y,pose,width,height):{x,y};
  for(const [vertical,fixed,nx,ny,span] of [[true,inset,1,0,height],[true,width-inset,-1,0,height],[false,inset,0,1,width],[false,height-inset,0,-1,width]]){
    const count=Math.ceil(span/28);
    for(let i=0;i<count;i++){
      const along=inset+(span-2*inset)*(i+.5)/count,viewX=vertical?fixed:along,viewY=vertical?along:fixed;
      const {x,y}=pose?viewToWorld(viewX,viewY,pose,width,height):{x:viewX,y:viewY},f=sampleCurrentFlow(game,x,y,elapsed);
      const ahead=inView(x+f.x,y+f.y),fx=ahead.x-viewX,fy=ahead.y-viewY;
      if(fx*nx+fy*ny<Math.max(2,Math.hypot(fx,fy)*.15))continue;
      if(game.currents.some(c=>!c.releasedEntrySlot&&Math.hypot((c.entryX??c.x)-x,(c.entryY??c.y)-y)<separation))continue;
      // An inward vector alone is insufficient near a coast: require an open
      // two-second approach so new hazards cannot spawn directly into land.
      let px=x,py=y,clear=true;
      for(let step=0;step<=20;step++){
        const view=inView(px,py);
        if(view.x<inset-1||view.x>width-inset+1||view.y<inset-1||view.y>height-inset+1||(game.isOpenWater&&!game.isOpenWater(px,py,radius+1))){clear=false;break;}
        if(step<20){const flow=sampleCurrentFlow(game,px,py,elapsed+step*.1);px+=flow.x*.1;py+=flow.y*.1;}
      }
      if(!clear)continue;
      // Prefer boundary entries whose future advection crosses the fixed map
      // center and spend time in central water. This route forecast never reads or follows the player's position.
      let view=inView(px,py),distance=Math.hypot(view.x-width/2,view.y-height/2),centralTime=0;
      for(let t=2;t<=18;t+=.25){
        view=inView(px,py);
        if(view.x<inset||view.x>width-inset||view.y<inset||view.y>height-inset||(game.isOpenWater&&!game.isOpenWater(px,py,radius+1)))break;
        distance=Math.min(distance,Math.hypot(view.x-width/2,view.y-height/2));
        if(Math.hypot((view.x-width/2)/(width/2),(view.y-height/2)/(height/2))<.6)centralTime+=.25;
        const flow=sampleCurrentFlow(game,px,py,elapsed+t);px+=flow.x*.25;py+=flow.y*.25;
      }
      sites.push([x,y,distance-Math.min(centralTime,4)*8]);
    }
  }
  return sites.sort((a,b)=>a[2]-b[2]);
}
export function createGame(width,height,rings,random=Math.random){
  const points=rings.flat();
  return {width,height,rings,random,status:'ready',elapsed:0,elapsedError:0,flowPhase:0,worldOrigin:{x:0,y:0},currents:[],serial:0,labelQueue:[...CURRENT_LABELS],shownLabels:[],spawnTimer:2,input:{x:0,y:0},player:{x:width/2,y:height/2},facing:1,hit:null,lives:STARTING_LIVES,reviveUntil:0,lastDamageAt:null,safePositions:[],
    sceneMotion:false,sceneReducedMotion:false,sceneProfile:null,scene:null,sceneTime:0,sceneBlocked:false,shoreGraceUntil:0,shoreCooldownUntil:0,
    bounds:{left:Math.min(...points.map(p=>p[0])),right:Math.max(...points.map(p=>p[0])),top:Math.min(...points.map(p=>p[1])),bottom:Math.max(...points.map(p=>p[1]))}};
}
export function randomizeRound(game){
  // Sample once per new game; every frame and paused resume reuse this profile.
  if(game.status!=='ready')return;
  game.flowPhase=game.random()*Math.PI*2;
  game.sceneProfile=createSceneProfile(game.random);
}
function playerBounds(game,facing=game.facing??1){
  const b=game.bounds;
  return facing<0?{left:-b.right,right:-b.left,top:b.top,bottom:b.bottom}:b;
}
function withinPlayerBounds(game,x,y,facing=game.facing??1){
  const b=playerBounds(game,facing);
  return x>=8-b.left&&x<=game.width-8-b.right&&y>=(game.edgePadding?.top??8)-b.top&&y<=game.height-8-b.bottom;
}
function blockedPlayerPoints(game,x,y,pose){
  const water=game.isPlayerWater??game.isOpenWater;
  if(!water)return [];
  const blocked=[],facing=game.facing??1;let index=0;
  for(const ring of game.rings)for(const [a,b] of ring){
    const world=game.sceneMotion?viewToWorld(x+a*facing,y+b,pose,game.width,game.height):{x:x+a*facing,y:y+b};
    if(!water(world.x,world.y,0))blocked.push(index);index++;
  }
  return blocked;
}
function clearPlayerAt(game,x,y,pose=currentScene(game),facing=game.facing??1){
  if(!withinPlayerBounds(game,x,y,facing))return false;
  const water=game.isPlayerWater??game.isOpenWater;
  if(!water)return true;
  return game.rings.every(ring=>ring.every(([a,b])=>{
    const point=game.sceneMotion?viewToWorld(x+a*facing,y+b,pose,game.width,game.height):{x:x+a*facing,y:y+b};
    return water(point.x,point.y,0);
  }));
}
export function initializeScene(game){
  game.sceneTime=0;game.sceneBlocked=false;game.shoreGraceUntil=0;game.shoreCooldownUntil=0;
  game.scene=game.sceneMotion?sceneAt(0,game.width,game.height,game.sceneReducedMotion,game.sceneProfile):null;
  const start={...game.player};
  if(clearPlayerAt(game,start.x,start.y)){rememberSafePosition(game);return true;}
  // This one-time starting position search may move farther than shore recovery.
  // Equal-distance candidates begin on the east side of the map's center.
  for(let radius=2;radius<=Math.hypot(game.width,game.height);radius+=2){
    for(let direction=0;direction<64;direction++){
      const angle=direction*Math.PI/32,x=start.x+Math.cos(angle)*radius,y=start.y+Math.sin(angle)*radius;
      if(clearPlayerAt(game,x,y)){game.player={x,y};rememberSafePosition(game);return true;}
    }
  }
  return false;
}
export function resizeGame(game,width,height){
  if(!(width>0&&height>0))throw new RangeError('Game dimensions must be positive');
  if(width===game.width&&height===game.height)return;
  const dx=(width-game.width)/2,dy=(height-game.height)/2;
  const world=game.sceneMotion?viewToWorld(game.player.x,game.player.y,currentScene(game),game.width,game.height):game.player;
  game.width=width;game.height=height;game.worldOrigin.x+=dx;game.worldOrigin.y+=dy;
  for(const c of game.currents){
    c.x+=dx;c.y+=dy;if(c.entryX!==undefined){c.entryX+=dx;c.entryY+=dy;}c.points=c.points?.map(([x,y])=>[x+dx,y+dy]);c.paths=c.paths?.map(path=>path.map(([x,y])=>[x+dx,y+dy]));
    CURRENT_VIEWS.delete(c);delete c.viewPaths;
  }
  for(const item of game.sugarcaneDrift?.items??[]){item.x+=dx;item.y+=dy;}
  game.safePositions=game.safePositions.map(p=>({x:p.x+dx,y:p.y+dy}));
  game.scene=game.sceneMotion?sceneAt(game.sceneTime,width,height,game.sceneReducedMotion,game.sceneProfile):null;
  game.sceneBlocked=false;
  const point=game.sceneMotion?worldToView(world.x+dx,world.y+dy,game.scene,width,height):{x:world.x+dx,y:world.y+dy};
  const b=playerBounds(game),x=clamp(point.x,8-b.left,width-8-b.right),y=clamp(point.y,(game.edgePadding?.top??8)-b.top,height-8-b.bottom);
  game.player={x,y};
  // A smaller window may hide the previous position. Relocate to clear water
  // without restarting the round, advancing its clock, or consuming a life.
  if(x!==point.x||y!==point.y||!clearPlayerAt(game,x,y))recoverPlayer(game);
  for(const c of game.currents)currentView(c,game);
}
function assignCurrentLabel(game,current){
  const active=new Set(game.currents.filter(c=>c!==current).map(c=>c.label));
  const index=game.labelQueue.findIndex(label=>!active.has(label));
  if(index<0)return false;
  current.label=game.labelQueue.splice(index,1)[0];
  current.labelReadTime=0;current.labelCheckedAt=game.elapsed;
  return true;
}
// Count only complete, readable on-screen labels. A clipped or land-covered
// label remains pending, and drawing a paused frame never advances this timer.
export function recordCurrentLabel(game,current,readable){
  if(game.status!=='playing'||!CURRENT_LABELS.includes(current.label))return false;
  const dt=clamp(game.elapsed-(current.labelCheckedAt??game.elapsed),0,.1);
  current.labelCheckedAt=game.elapsed;
  if(!readable)return false;
  current.labelReadTime=(current.labelReadTime??0)+dt;
  if(current.labelReadTime<LABEL_READ_SECONDS)return false;
  if(!game.shownLabels.includes(current.label))game.shownLabels.push(current.label);
  if(game.shownLabels.length===CURRENT_LABELS.length){
    game.shownLabels=[];
    const active=new Set(game.currents.map(c=>c.label));
    game.labelQueue=CURRENT_LABELS.filter(label=>!active.has(label));
    for(const c of game.currents)c.labelReadTime=0;
  }
  // The label stays attached to this current for its entire lifetime.
  return false;
}
function returnUnreadLabels(game,removed){
  for(const current of removed){
    if(CURRENT_LABELS.includes(current.label)&&!game.shownLabels.includes(current.label)&&!game.labelQueue.includes(current.label))game.labelQueue.unshift(current.label);
  }
}
export function spawnCurrent(game){
  if(game.currents.length>=MAX_CURRENTS)return null;
  const r=game.random,radius=(6+r()*3)*1.2,baseLength=70+r()*25,length=Math.max(baseLength,game.minimumCurrentLength??0);
  let sites=spawnSites(game,radius);
  // A rotated flow can leave fewer open entry edges; fill the wave with a
  // smaller, still separated gap when the wider spacing has no usable site.
  if(!sites.length&&game.currents.length)sites=spawnSites(game,radius,60);
  if(!sites.length)return null;
  let x,y,entryX,entryY,offscreen=false;
  const pose=currentScene(game),padding=(radius+5)*(pose?.zoom??1);
  const preferred=sites.filter(site=>site[2]<=sites[0][2]+28);
  const offset=Math.min(preferred.length-1,Math.floor(r()*preferred.length));
  sites=[...preferred.slice(offset),...preferred.slice(0,offset),...sites.slice(preferred.length)];
  // Try alternate entries if an upstream eddy cannot reach the outer boundary.
  for(const site of sites){
    [entryX,entryY]=site;x=entryX;y=entryY;offscreen=false;
    for(let step=0;step<100;step++){
      const points=traceGameStreamline(game,x,y,game.elapsed,length);
      const view=pose?projectPaths([points],pose,game.width,game.height)[0]:points;
      offscreen=view.every(p=>p[0]<-padding)||view.every(p=>p[0]>game.width+padding)||
        view.every(p=>p[1]<-padding)||view.every(p=>p[1]>game.height+padding);
      if(offscreen)break;
      const f=sampleCurrentFlow(game,x,y);x-=f.x*.1;y-=f.y*.1;
    }
    if(offscreen&&!game.currents.some(c=>Math.hypot(c.x-x,c.y-y)<c.radius+radius+18))break;
    offscreen=false;
  }
  if(!offscreen)return null;
  const flow=sampleCurrentFlow(game,x,y);
  const entryView=pose?worldToView(entryX,entryY,pose,game.width,game.height):{x:entryX,y:entryY};
  const edgeDistances=[entryView.x,game.width-entryView.x,entryView.y,game.height-entryView.y];
  const entryEdge=edgeDistances.indexOf(Math.min(...edgeDistances));
  const entryDirection=[{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}][entryEdge];
  const current={entryDirection,releasedEntrySlot:false,id:game.serial+1,x,y,entryX,entryY,vx:flow.x,vy:flow.y,speed:Math.hypot(flow.x,flow.y),distance:0,baseLength,length,radius,age:0,visibleAge:0,hiddenAge:0,entered:false,life:CURRENT_LIFETIME};
  current.points=traceGameStreamline(game,x,y,game.elapsed,length);current.paths=clipRibbon(current.points,radius,game.isOpenWater);
  if(!assignCurrentLabel(game,current))return null;
  game.serial++;game.currents.push(current);return current;
}
function pathsHitPlayer(game,paths,radius,x,y){
  const b=playerBounds(game),facing=game.facing??1;
  return paths.some(path=>{
    const xs=path.map(p=>p[0]),ys=path.map(p=>p[1]);
    if(Math.max(...xs)+radius<x+b.left||Math.min(...xs)-radius>x+b.right||Math.max(...ys)+radius<y+b.top||Math.min(...ys)-radius>y+b.bottom)return false;
    // Reflect the hazard into the unchanged source outline. This preserves the
    // runner's asymmetric limbs and transparent gaps without rewriting assets.
    const local=path.map(([px,py])=>[(px-x)*facing,py-y]);return game.rings.some(ring=>ribbonHitsRing(local,radius,ring));
  });
}
function safeRecoveryAt(game,x,y,hazards){
  return clearPlayerAt(game,x,y)&&!hazards.some(h=>pathsHitPlayer(game,h.paths,h.radius+8,x,y));
}
function recoveryHazards(game){return game.currents.filter(c=>c.entered).map(c=>currentView(c,game));}
function rememberSafePosition(game){
  if(game.lives<=1)return;
  const {x,y}=game.player;
  if(!safeRecoveryAt(game,x,y,recoveryHazards(game)))return;
  // Keep map coordinates so old positions follow the moving coastline.
  const point=game.sceneMotion?viewToWorld(x,y,currentScene(game),game.width,game.height):{x,y};
  const previous=game.safePositions.at(-1);
  if(previous&&Math.hypot(point.x-previous.x,point.y-previous.y)<1)return;
  game.safePositions.push(point);
  if(game.safePositions.length>180)game.safePositions.shift();
}
function recoverPlayer(game){
  const hazards=recoveryHazards(game),pose=currentScene(game);
  // Recheck recent safe positions against today's coast and every active ribbon.
  for(let i=game.safePositions.length-1;i>=0;i--){
    const saved=game.safePositions[i],point=game.sceneMotion?worldToView(saved.x,saved.y,pose,game.width,game.height):saved;
    if(safeRecoveryAt(game,point.x,point.y,hazards)){game.player={...point};return;}
  }
  // A newly arrived current may cover all saved points. Find nearby open water.
  const start=game.player;
  for(let radius=2;radius<=Math.hypot(game.width,game.height);radius+=2){
    for(let direction=0;direction<64;direction++){
      const angle=direction*Math.PI/32,x=start.x+Math.cos(angle)*radius,y=start.y+Math.sin(angle)*radius;
      if(safeRecoveryAt(game,x,y,hazards)){game.player={x,y};return;}
    }
  }
  // If the entire viewport is blocked, retain the position and the fixed grace
  // interval; never place the character on land or consume another life here.
}
function currentHitsPlayer(game,current){
  if(game.elapsed<game.reviveUntil||!current.entered||(game.sceneMotion&&game.elapsed<game.shoreGraceUntil)||!visibleCurrent(current,game))return false;
  const {paths,radius}=currentView(current,game);
  if(!pathsHitPlayer(game,paths,radius,game.player.x,game.player.y))return false;
  game.lives--;game.hit=current.id;game.lastDamageAt=game.elapsed;
  if(game.lives===0){game.status='over';game.input={x:0,y:0};}
  else {game.reviveUntil=game.elapsed+REVIVE_SECONDS;recoverPlayer(game);game.safePositions=[];}
  return true;
}
function shoreEscape(game,oldPose,newPose){
  const start=game.player,initial=blockedPlayerPoints(game,start.x,start.y,newPose);
  const hazards=game.currents.filter(c=>c.entered).flatMap(c=>[currentView(c,game,oldPose),currentView(c,game,newPose)]);
  for(let radius=.5;radius<=4;radius+=.5)for(let direction=0;direction<32;direction++){
    const angle=direction*Math.PI/16,x=start.x+Math.cos(angle)*radius,y=start.y+Math.sin(angle)*radius;
    if(!clearPlayerAt(game,x,y,newPose))continue;
    let prior=initial,clear=true;
    for(let step=1;step<=Math.ceil(radius/.5);step++){
      const t=step/Math.ceil(radius/.5),px=start.x+(x-start.x)*t,py=start.y+(y-start.y)*t;
      const blocked=blockedPlayerPoints(game,px,py,newPose);
      if(!clearPlayerAt(game,px,py,oldPose)||blocked.some(index=>!prior.includes(index))||hazards.some(h=>pathsHitPlayer(game,h.paths,h.radius,px,py))){clear=false;break;}
      prior=blocked;
    }
    if(clear)return {x,y};
  }
  return null;
}
function advanceScene(game,dt){
  if(!game.sceneMotion)return;
  const oldPose=currentScene(game),nextTime=game.sceneTime+dt,newPose=sceneAt(nextTime,game.width,game.height,game.sceneReducedMotion,game.sceneProfile);
  let pushed=null;
  if(!clearPlayerAt(game,game.player.x,game.player.y,newPose)){
    pushed=shoreEscape(game,oldPose,newPose);
    if(!pushed){game.scene=oldPose;game.sceneBlocked=true;return;}
  }
  game.scene=newPose;game.sceneTime=nextTime;game.sceneBlocked=false;
  for(const current of game.currents)currentView(current,game);
  if(pushed){
    game.player=pushed;
    if(game.elapsed>=game.shoreCooldownUntil){game.shoreGraceUntil=game.elapsed+.65;game.shoreCooldownUntil=game.elapsed+3;}
  }
}
// Debris feedback is independent of current damage and milk protection.
export function updateSugarcaneContact(game){
  if(game.status!=='playing')return;
  const pose=currentScene(game);
  for(const cane of game.sugarcaneDrift?.items??[]){
    const dx=-Math.sin(cane.angle)*cane.length/2,dy=Math.cos(cane.angle)*cane.length/2;
    const points=[[cane.x-dx,cane.y-dy],[cane.x+dx,cane.y+dy]].map(([x,y])=>{
      const p=pose?worldToView(x,y,pose,game.width,game.height):{x,y};return [p.x,p.y];
    });
    const touching=pathsHitPlayer(game,[points],cane.width/2*(pose?.zoom??1),game.player.x,game.player.y);
    if(touching&&!cane.playerTouching&&game.elapsed>=(cane.messageCooldown??0)){
      game.sugarcaneMessage={id:cane.id,x:cane.x,y:cane.y,startedAt:game.elapsed,until:game.elapsed+1};
      cane.messageCooldown=game.elapsed+1.2;
    }
    cane.playerTouching=touching;
  }
}
export function movePlayer(game,dx,dy){
  if(game.status!=='playing'||!Number.isFinite(dx)||!Number.isFinite(dy))return;
  rememberSafePosition(game);
  if(game.currents.some(current=>currentHitsPlayer(game,current)))return;
  const p=game.player,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/2)),stepX=dx/steps,stepY=dy/steps;
  const desiredFacing=Math.abs(dx)>.05?Math.sign(dx):game.facing??1;
  const clear=(x,y)=>clearPlayerAt(game,x,y);
  const turn=()=>{
    if(desiredFacing!==(game.facing??1)&&clearPlayerAt(game,p.x,p.y,currentScene(game),desiredFacing)){
      game.facing=desiredFacing;
      return game.currents.some(current=>currentHitsPlayer(game,current));
    }
    return false;
  };
  if(turn())return;
  // Pointer events can span the entire map. Keep collision checks on the path
  // between events without advancing time or leaving a persistent movement input.
  for(let i=0;i<steps;i++){
    const b=playerBounds(game);
    const nextX=clamp(p.x+stepX,8-b.left,game.width-8-b.right),nextY=clamp(p.y+stepY,(game.edgePadding?.top??8)-b.top,game.height-8-b.bottom);
    if(clear(nextX,p.y))p.x=nextX;
    if(clear(p.x,nextY))p.y=nextY;
    if(game.currents.some(current=>currentHitsPlayer(game,current)))return;
    if(turn())return;
    updateSugarcaneContact(game);
    rememberSafePosition(game);
  }
}
export function updateGame(game,dt){
  const duration=clamp(dt,0,1);
  if(game.status!=='playing'||!(duration>0))return;
  // Compensate frame-time addition separately from collision substeps so a
  // fractional-second calendar goals finish exactly without an early-win epsilon.
  const corrected=duration-game.elapsedError,total=game.elapsed+corrected;
  game.elapsedError=(total-game.elapsed)-corrected;
  const end=Math.min(GOAL_SECONDS,total),steps=Math.ceil(Math.min(duration,GOAL_SECONDS-game.elapsed)/.02);
  for(let i=0;i<steps&&game.elapsed<end&&game.status==='playing';i++){
    const next=i===steps-1?end:Math.min(end,game.elapsed+.02),step=next-game.elapsed;
    stepGame(game,step,next);
  }
}
function stepGame(game,dt,nextElapsed){
  game.elapsed=nextElapsed;
  advanceScene(game,dt);
  updateSugarcaneDrift(game,dt,sampleGameFlow);
  const dir=normalize(game.input.x,game.input.y);
  movePlayer(game,dir.x*104*dt,dir.y*104*dt);
  updateSugarcaneContact(game);
  if(game.status==='over')return;
  game.spawnTimer-=dt;
  for(const c of game.currents){
    c.length=Math.max(c.baseLength??c.length,game.minimumCurrentLength??0);
    const flow=sampleCurrentFlow(game,c.x,c.y);c.vx=flow.x;c.vy=flow.y;c.speed=Math.hypot(flow.x,flow.y);
    c.age+=dt;c.x+=flow.x*dt;c.y+=flow.y*dt;c.distance+=c.speed*dt;c.points=traceGameStreamline(game,c.x,c.y,game.elapsed,c.length);
    c.paths=clipRibbon(c.points,c.radius,game.isOpenWater);
    const visible=visibleCurrent(c,game);
    if(visible){c.entered=true;c.visibleAge+=dt;}
    if(c.entered&&c.entryDirection&&!c.releasedEntrySlot){
      const pose=currentScene(game),p=pose?worldToView(c.x,c.y,pose,game.width,game.height):c;
      const {x:nx,y:ny}=c.entryDirection;
      const progress=nx>0?p.x/game.width:nx<0?1-p.x/game.width:ny>0?p.y/game.height:1-p.y/game.height;
      if(progress>=1/3)c.releasedEntrySlot=true;
    }
    if(currentOnScreen(c,game)){c.hasBeenOnScreen=true;c.hiddenAge=0;}
    else {
      c.hiddenAge+=dt;
      // A departed ribbon must not reserve an incoming slot during cleanup.
      if(c.hasBeenOnScreen||c.entered)c.releasedEntrySlot=true;
    }
  }
  // Update all ribbons before recovery searches, so safety uses one scene/time.
  game.currents.some(c=>currentHitsPlayer(game,c));
  if(game.status==='over')return;
  const survivors=game.currents.filter(c=>currentOnScreen(c,game)||((c.hasBeenOnScreen||c.entered?c.hiddenAge<.15:c.hiddenAge<15)&&c.x>-200&&c.x<game.width+200&&c.y>-200&&c.y<game.height+200));
  returnUnreadLabels(game,game.currents.filter(c=>!survivors.includes(c)));
  game.currents=survivors;
  if(game.spawnTimer<=0&&game.currents.length<MAX_CURRENTS){
    // Recompute entry sites after each addition so one wave uses distinct
    // open-water approaches. Retry later when the coast leaves no safe entry.
    // Fill the opening wave; replace departed ribbons at half-second intervals.
    const slotsAvailable=game.currents.length?1:MAX_CURRENTS;
    for(let slots=slotsAvailable;slots>0;slots--){
      const current=spawnCurrent(game);
      if(!current)break;
      currentHitsPlayer(game,current);
      if(game.status==='over')return;
    }
    game.spawnTimer=.5;
  }
  rememberSafePosition(game);
  if(game.elapsed===GOAL_SECONDS){game.status='won';game.input={x:0,y:0};}
}
