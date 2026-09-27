import {GOAL_SECONDS} from './timeline.mjs?v=aurora-amber-30';

export const FLOOD_START=10;
export const FLOOD_END=GOAL_SECONDS;
const DIAGONAL=Math.SQRT2;
const clamp01=value=>Math.max(0,Math.min(1,value));
const timeAt=elapsed=>Number.isFinite(elapsed)?Math.max(0,elapsed):0;
const progressAt=elapsed=>clamp01((timeAt(elapsed)-FLOOD_START)/(FLOOD_END-FLOOD_START));

// A separate Taiwan mask keeps this field independent of mainland terrain.
// Eight-neighbor chamfer distance approximates coast distance in raster cells.
export function createFloodField(taiwanMask,width,height){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||taiwanMask.length!==width*height){
    throw new RangeError('Flood mask dimensions must match a positive raster size');
  }
  const distance=new Float32Array(width*height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    // Cells immediately outside the raster also count as water, so even an
    // all-land input has a finite coast distance without a special fallback.
    distance[y*width+x]=taiwanMask[y*width+x]?Math.min(x+1,y+1,width-x,height-y):0;
  }
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=y*width+x;
    if(!distance[i])continue;
    let d=distance[i];
    if(x>0)d=Math.min(d,distance[i-1]+1);
    if(y>0){
      d=Math.min(d,distance[i-width]+1);
      if(x>0)d=Math.min(d,distance[i-width-1]+DIAGONAL);
      if(x<width-1)d=Math.min(d,distance[i-width+1]+DIAGONAL);
    }
    distance[i]=d;
  }
  let maxDistance=0;
  for(let y=height-1;y>=0;y--)for(let x=width-1;x>=0;x--){
    const i=y*width+x;
    if(!distance[i])continue;
    let d=distance[i];
    if(x<width-1)d=Math.min(d,distance[i+1]+1);
    if(y<height-1){
      d=Math.min(d,distance[i+width]+1);
      if(x>0)d=Math.min(d,distance[i+width-1]+DIAGONAL);
      if(x<width-1)d=Math.min(d,distance[i+width+1]+DIAGONAL);
    }
    distance[i]=d;maxDistance=Math.max(maxDistance,distance[i]);
  }
  return {distance,maxDistance,width,height};
}

export function floodState(elapsed){
  const time=timeAt(elapsed);
  return {
    progress:progressAt(time),
    active:time>=FLOOD_START&&time<FLOOD_END,
    remaining:Math.max(0,FLOOD_END-Math.max(FLOOD_START,time)),
  };
}

export function floodCoverage(field,index,elapsed){
  const distance=field.distance[index];
  // Water cells and out-of-range indexes never gain Taiwan flood coverage.
  if(!(distance>0))return 0;
  const progress=progressAt(elapsed);
  if(progress===0||progress===1)return progress;
  // The first coastal cell starts flooding immediately; the deepest cell
  // finishes at the goal. A one-cell smooth edge gives continuous opacity.
  const amount=clamp01(progress*field.maxDistance-(distance-1));
  return amount*amount*(3-2*amount);
}
