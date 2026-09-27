export function measurePath(points){
  const distances=[0];
  for(let i=1;i<points.length;i++)distances.push(distances[i-1]+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));
  return {points,distances,length:distances.at(-1)??0};
}

export function samplePath(path,distance){
  if(path.points.length<2||path.length<=0)return null;
  const d=Math.max(0,Math.min(distance,path.length));
  for(let i=1;i<path.points.length;i++){
    const span=path.distances[i]-path.distances[i-1];
    if(span<=0||path.distances[i]<d)continue;
    const a=path.points[i-1],b=path.points[i],t=(d-path.distances[i-1])/span;
    return {x:a[0]+(b[0]-a[0])*t,y:a[1]+(b[1]-a[1])*t,angle:Math.atan2(b[1]-a[1],b[0]-a[0])};
  }
  return null;
}

// Clip individual segments before choosing the visible route for a label.
// Both endpoints may be outside even when their segment crosses the viewport.
export function clipPathToRect(points,left,top,right,bottom){
  if(![left,top,right,bottom].every(Number.isFinite)||left>right||top>bottom)return [];
  const paths=[];let run=[];
  const same=(a,b)=>Math.abs(a[0]-b[0])<1e-8&&Math.abs(a[1]-b[1])<1e-8;
  const finish=()=>{if(run.length>1)paths.push(run);run=[];};
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1];
    let enter=0,leave=1,visible=true;
    for(const [p,q] of [[-dx,a[0]-left],[dx,right-a[0]],[-dy,a[1]-top],[dy,bottom-a[1]]]){
      if(p===0){if(q<0){visible=false;break;}continue;}
      const t=q/p;
      if(p<0)enter=Math.max(enter,t);else leave=Math.min(leave,t);
      if(enter>leave){visible=false;break;}
    }
    if(!visible){finish();continue;}
    const from=[a[0]+dx*enter,a[1]+dy*enter],to=[a[0]+dx*leave,a[1]+dy*leave];
    if(same(from,to))continue;
    if(run.length&&!same(run.at(-1),from))finish();
    if(!run.length)run.push(from);
    run.push(to);
    if(leave<1)finish();
  }
  finish();return paths;
}

// Move whole copies of the label downstream by arc length. Copies enter and
// leave at the endpoints; individual letters never wrap around within a word.
export function layoutFlowText(points,text,fontSize,offset=0){
  const path=measurePath(points),letters=[...text],spacing=fontSize*1.16;
  if(!letters.length||!Number.isFinite(fontSize)||fontSize<=0||!Number.isFinite(path.length)||path.length<=0)return [];
  const middle=samplePath(path,path.length/2),vertical=Math.abs(Math.sin(middle.angle))>.75;
  const reverse=vertical?Math.sin(middle.angle)<0:Math.cos(middle.angle)<0;
  const halfSpan=(letters.length-1)*spacing/2,period=Math.max(path.length,(letters.length+2)*spacing);
  const origin=path.length/2+(Number.isFinite(offset)?offset:0);
  const firstCopy=Math.ceil((-halfSpan-origin)/period),lastCopy=Math.floor((path.length+halfSpan-origin)/period),glyphs=[];
  for(let copy=firstCopy;copy<=lastCopy;copy++){
    for(let index=0;index<letters.length;index++){
      const distance=origin+copy*period+(index-(letters.length-1)/2)*spacing*(reverse?-1:1);
      if(distance<0||distance>path.length)continue;
      const position=samplePath(path,distance);
      // Near-vertical Chinese glyphs stay upright. On other tangents, rotate
      // only to the readable half-plane; reverse the word order as a group.
      let angle=Math.abs(Math.sin(position.angle))>.75?0:position.angle;
      if(Math.cos(angle)<0)angle+=Math.PI;
      glyphs.push({letter:letters[index],x:position.x,y:position.y,angle,distance,index,copy});
    }
  }
  return glyphs;
}

function nearestOnPath(path,point){
  let nearest=null;
  for(let i=1;i<path.points.length;i++){
    const a=path.points[i-1],b=path.points[i],dx=b[0]-a[0],dy=b[1]-a[1],squared=dx*dx+dy*dy;
    if(!squared)continue;
    const t=Math.max(0,Math.min(1,((point.x-a[0])*dx+(point.y-a[1])*dy)/squared));
    const x=a[0]+dx*t,y=a[1]+dy*t,gap=Math.hypot(x-point.x,y-point.y);
    if(!nearest||gap<nearest.gap)nearest={x,y,gap,distance:path.distances[i-1]+Math.sqrt(squared)*t};
  }
  return nearest;
}

function smoothTangent(path,distance,span){
  const a=samplePath(path,distance-span/2),b=samplePath(path,distance+span/2);
  return Math.atan2(b.y-a.y,b.x-a.x);
}

const limit=(value,low,high)=>Math.max(low,Math.min(high,value));
const angleDelta=(from,to)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));

// A fixed label follows one connected visible route. The returned state belongs
// to one current and is advanced only by simulation time, never by draw calls.
export function layoutStableFlowText(paths,text,fontSize,anchor,time,previous){
  if(previous&&time===previous.time&&text===previous.text&&fontSize===previous.fontSize)return previous;
  const letters=[...text],valid=Number.isFinite(fontSize)&&fontSize>0&&Number.isFinite(time)&&Number.isFinite(anchor?.x)&&Number.isFinite(anchor?.y);
  if(!valid||!letters.length)return {glyphs:[],opacity:0,time,text,fontSize};
  if(previous&&time<previous.time)previous=null;
  const reflow=previous&&time===previous.time&&fontSize!==previous.fontSize;
  // Five-character labels retain readable type on the shortest mobile ribbon.
  // Use fixed spacing, never a frame-dependent font or width adjustment.
  const compact=letters.length>4;
  const dt=previous?limit(time-previous.time,0,.1):0,spacing=fontSize*(compact?1:1.16),half=(letters.length-1)*spacing/2+fontSize*.55;
  const routes=paths.map(measurePath).filter(route=>Number.isFinite(route.length)&&route.length>0);
  const adequate=routes.filter(route=>route.length>=half*2);
  const choose=point=>(adequate.length?adequate:routes).map(route=>({route,near:nearestOnPath(route,point)})).sort((a,b)=>a.near.gap-b.near.gap)[0];
  const moved=previous?.center?{x:previous.center.x+anchor.x-previous.anchor.x,y:previous.center.y+anchor.y-previous.anchor.y}:anchor;
  let tracked=previous?.center?routes.map(route=>({route,near:nearestOnPath(route,moved)})).sort((a,b)=>a.near.gap-b.near.gap)[0]:null;
  let switched=!tracked||tracked.near.gap>Math.max(18,fontSize*1.2);
  if(!switched&&tracked.route.length<half*2&&adequate.length)switched=true;
  if(switched)tracked=choose(anchor);
  const base={time,text,fontSize,anchor:{...anchor},glyphs:[],opacity:0,visibility:0,pending:null};
  if(!tracked)return base;
  const route=tracked.route,target=nearestOnPath(route,anchor),fits=route.length>=half*2;
  if(!fits)return {...base,center:samplePath(route,route.length/2),route};
  const preferred=limit(target.distance,half,route.length-half);
  let distance=switched?preferred:tracked.near.distance+(preferred-tracked.near.distance)*(1-Math.exp(-dt*12));
  distance=limit(distance,half,route.length-half);
  // If a coast clips away the old word position, re-enter on a valid route at
  // zero opacity. Never interpolate through the gap between disconnected runs.
  if(!switched&&Math.abs(distance-tracked.near.distance)>Math.max(8,fontSize*.35))switched=true;
  const center=samplePath(route,distance),tangent=smoothTangent(route,distance,spacing*1.5),sine=Math.abs(Math.sin(tangent));
  let vertical=switched||previous?.vertical===undefined?sine>.75:previous.vertical;
  let reverse=switched||previous?.reverse===undefined?(vertical?Math.sin(tangent)<0:Math.cos(tangent)<0):previous.reverse;
  const desiredVertical=vertical?sine>=.64:sine>.82;
  const desiredReverse=desiredVertical?Math.sin(tangent)<0:Math.cos(tangent)<0;
  let pending=switched?null:previous?.pending??null,visibility=switched?0:previous?.visibility??0,fadeOut=false;
  if(desiredReverse!==reverse){
    if(!pending||pending.reverse!==desiredReverse)pending={reverse:desiredReverse,vertical:desiredVertical,since:time};
    fadeOut=time-pending.since>=.12;
  }else{pending=null;vertical=desiredVertical;}
  visibility=limit(visibility+(fadeOut?-1:1)*dt/.2,0,1);
  if(fadeOut&&visibility===0){reverse=desiredReverse;vertical=desiredVertical;pending=null;}
  if(switched)visibility=0;
  // A paused resize is a layout change, not a newly entering label.
  if(reflow)visibility=previous.glyphs?.length?(previous.visibility??1):1;
  const geometryOpacity=limit((route.length-half*2)/(fontSize*(compact ? .25 : .75)),0,1);
  const glyphs=letters.map((letter,index)=>{
    const at=distance+(index-(letters.length-1)/2)*spacing*(reverse?-1:1),position=samplePath(route,at);
    let angle=vertical?0:smoothTangent(route,at,spacing);
    if(Math.cos(angle)<0)angle+=Math.PI;
    const old=!switched&&previous?.reverse===reverse?previous?.glyphs?.[index]:null;
    if(old)angle=old.angle+limit(angleDelta(old.angle,angle)*(1-Math.exp(-dt*14)),-6*dt,6*dt);
    return {letter,x:position.x,y:position.y,angle,distance:at,index};
  });
  return {...base,center,route,vertical,reverse,pending,visibility,glyphs,opacity:visibility*geometryOpacity};
}
