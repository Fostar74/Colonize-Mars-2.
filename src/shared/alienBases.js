module.exports = Array.from({length:20},(_,index)=>{
    const level=index+1;
    // Keep Lv19 clear of alliance station 3 (50:44); Lv20 remains at (50:50).
    if (level === 19) return [{x:49,y:35,level}];
    // Move Lv17 west to leave the central alliance-base area clear.
    if (level === 17) return [{x:32,y:50,level}];
    const count=1; // One alien base per level (Lv1–Lv20), preserving each level's first position.
    const radius=level===20?0:3+(20-level)*2.25;
    return Array.from({length:count},(_,j)=>{
      const angle=2*Math.PI*(j/count+(level*0.61803398875)%1);
      return {x:Math.max(1,Math.min(100,Math.round(50+radius*Math.cos(angle)))),
              y:Math.max(1,Math.min(100,Math.round(50+radius*Math.sin(angle)))),level};
    });
  }).flat();
