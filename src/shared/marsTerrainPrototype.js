// Deterministic, seamless world-space Mars terrain. Visual layer only: no game objects.
const fract=v=>v-Math.floor(v);
const hash=(x,y)=>fract(Math.sin(x*127.1+y*311.7+19.19)*43758.5453);
const smooth=t=>t*t*(3-2*t);
function noise(x,y){
  const ix=Math.floor(x),iy=Math.floor(y),fx=smooth(x-ix),fy=smooth(y-iy);
  const a=hash(ix,iy),b=hash(ix+1,iy),c=hash(ix,iy+1),d=hash(ix+1,iy+1);
  return (a+(b-a)*fx)*(1-fy)+(c+(d-c)*fx)*fy;
}
function relief(x,y){
  let height=0,weight=0,amplitude=1;
  for(let octave=0;octave<6;octave++){
    const scale=Math.pow(2,octave);
    height+=noise(x*scale,y*scale)*amplitude;
    weight+=amplitude;amplitude*=.53;
  }
  return height/weight;
}
const craters=[
  [15,21,6.3],[74,16,8.2],[42,57,4.1],[84,72,5.7],[20,83,3.2],
  [63,39,2.7],[9,53,3.1],[56,88,4.8]
];
function sample(x,y){
  const n=relief(x*.082,y*.082);
  const ridges=Math.abs(noise(x*.042+31,y*.042-17)-.5);
  let h=n*.83+ridges*.22;
  for(const [cx,cy,r] of craters){
    const d=Math.hypot(x-cx,y-cy)/r;
    if(d<1.5){
      const bowl=Math.max(0,1-d*d);
      const rim=Math.exp(-Math.pow((d-1)/.17,2));
      h-=bowl*.17;h+=rim*.13;
    }
  }
  return h;
}
export function createMarsTerrain(size=1024){
  const canvas=document.createElement("canvas");
  canvas.width=size;canvas.height=size;
  const ctx=canvas.getContext("2d",{willReadFrequently:false});
  const frame=ctx.createImageData(size,size);
  for(let py=0;py<size;py++){
    const y=py/size*100;
    for(let px=0;px<size;px++){
      const x=px/size*100,h=sample(x,y);
      const shadow=Math.max(-.18,Math.min(.18,(h-sample(x+.23,y+.33))*1.4));
      const dust=noise(x*.8,y*.8)*.12;
      const tone=Math.max(0,Math.min(1,(h-.28)*1.6+shadow+dust));
      const basalt=Math.max(0,Math.min(1,(relief(x*.035+60,y*.035-20)-.55)*3));
      const k=(py*size+px)*4;
      frame.data[k]=Math.round(160+67*tone-48*basalt);
      frame.data[k+1]=Math.round(78+58*tone-29*basalt);
      frame.data[k+2]=Math.round(52+38*tone-18*basalt);
      frame.data[k+3]=255;
    }
  }
  ctx.putImageData(frame,0,0);
  return canvas;
}
