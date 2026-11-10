module.exports = Array.from({length:20},(_,index)=>{
    const level=index+1;
    const count=level===20?1:level>=16?2:level>=11?3:level>=6?4:5;
    const radius=level===20?0:3+(20-level)*2.25;
    return Array.from({length:count},(_,j)=>{
      const angle=2*Math.PI*(j/count+(level*0.61803398875)%1);
      return {x:Math.max(1,Math.min(100,Math.round(50+radius*Math.cos(angle)))),
              y:Math.max(1,Math.min(100,Math.round(50+radius*Math.sin(angle)))),level};
    });
  }).flat();
