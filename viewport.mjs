// Every device sees the same world. Extra display space stays outside the canvas.
export function viewportFor(width,height){
  if(!Number.isFinite(width)||!Number.isFinite(height)||!(width>0&&height>0))throw new RangeError('Viewport dimensions must be positive');
  const scale=Math.min(width/400,height/720);
  return {width:400,height:720,scale,displayWidth:400*scale,displayHeight:720*scale};
}
// Bound both the device-pixel ratio and the total drawing work on large screens.
export function drawingRatio(scale,deviceRatio=1){
  return Math.min(Math.max(1,deviceRatio||1),2,2/scale);
}
