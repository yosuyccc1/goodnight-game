// Ignore isolated islands smaller than the character for player movement.
// Rings use the fixed map projection, so resizing cannot change passability.
export function blocksPlayer(ring){
  if(ring.length<3)return false;
  let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity,twiceArea=0;
  for(let i=0;i<ring.length;i++){
    const [x,y]=ring[i],[nx,ny]=ring[(i+1)%ring.length];
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
    twiceArea+=x*ny-nx*y;
  }
  return Math.abs(twiceArea)/2>200||Math.max(right-left,bottom-top)>32;
}
