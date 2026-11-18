module.exports = Array.from({length:20},(_,index)=>{
    const level=index+1;
    const count=1; // One alien base per level (Lv1–Lv20), preserving each level's first position.
    const radius=level===20?0:3+(20-level)*2.25;
    return Array.from({length:count},(_,j)=>{
      const angle=2*Math.PI*(j/count+(level*0.61803398875)%1);
      return {x:Math.max(1,Math.min(100,Math.round(50+radius*Math.cos(angle)))),
              y:Math.max(1,Math.min(100,Math.round(50+radius*Math.sin(angle)))),level};
    });
  }).flat();
