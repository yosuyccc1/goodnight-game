import {GOAL_SECONDS} from './timeline.mjs?v=aurora-amber-30';
// Camera time is simulation time: pausing and replaying need no separate clock.
const END_TIME=GOAL_SECONDS,DEG=Math.PI/180,TAU=Math.PI*2;

function coverZoom(width,height){
  // Cover every viewport corner even at 12 degrees and an 8% translation.
  // Keep this zoom constant for the whole game, including reduced motion.
  const ratio=Math.max(width/height,height/width);
  return Math.max(1.6,1.16*(Math.cos(12*DEG)+ratio*Math.sin(12*DEG))+1e-6);
}

export function createSceneProfile(random=Math.random){
  return {
    rotationPhase:random()*TAU,rotationPeriod:32+random()*10,
    xPhase:random()*TAU,xPeriod:27+random()*10,
    yPhase:random()*TAU,yPeriod:35+random()*12,
  };
}

export function sceneAt(elapsed,width=400,height=720,reducedMotion=false,profile=null){
  const time=Number.isFinite(elapsed)?Math.max(0,Math.min(END_TIME,elapsed)):0;
  const zoom=coverZoom(width,height);
  if(reducedMotion)return {angle:0,offsetX:0,offsetY:0,zoom,active:false,nextAt:null};
  // Different periods keep rotation and both translations moving together
  // without scheduled rests. The analytic envelope starts with zero velocity
  // and approaches full amplitude without a join or snap.
  const envelope=1-Math.exp(-time*time/4);
  const {rotationPhase=0,rotationPeriod=34,xPhase=0,xPeriod=29,yPhase=0,yPeriod=41}=profile??{};
  return {
    angle:9*DEG*Math.sin(TAU*time/rotationPeriod+rotationPhase)*envelope,
    offsetX:.05*width*Math.sin(TAU*time/xPeriod+xPhase)*envelope,
    offsetY:.04*height*Math.sin(TAU*time/yPeriod+yPhase)*envelope,
    zoom,active:time<END_TIME,nextAt:null,
  };
}

export function worldToView(x,y,pose,width=400,height=720){
  const dx=x-width/2,dy=y-height/2,c=Math.cos(pose.angle),s=Math.sin(pose.angle);
  return {
    x:width/2+pose.offsetX+pose.zoom*(c*dx-s*dy),
    y:height/2+pose.offsetY+pose.zoom*(s*dx+c*dy),
  };
}

export function viewToWorld(x,y,pose,width=400,height=720){
  const dx=(x-width/2-pose.offsetX)/pose.zoom,dy=(y-height/2-pose.offsetY)/pose.zoom;
  const c=Math.cos(pose.angle),s=Math.sin(pose.angle);
  return {x:width/2+c*dx+s*dy,y:height/2-s*dx+c*dy};
}

export function projectPaths(paths,pose,width=400,height=720){
  return paths.map(path=>path.map(([x,y])=>{
    const point=worldToView(x,y,pose,width,height);
    return [point.x,point.y];
  }));
}
