const {fight}=require("./combatEngine");

describe("Commander Protocol battle accounting",()=>{
  afterEach(()=>jest.restoreAllMocks());
  test("dodge is applied only to incoming alien volleys",()=>{
    jest.spyOn(Math,"random").mockReturnValue(0);
    const result=fight({"Explorer Trooper":100},{"Alien Scout":20},null,{dodge:15});
    const alienShots=result.report.flatMap(r=>r.events).filter(e=>e.attacker==="Alien Base");
    expect(alienShots.length).toBeGreaterThan(0);
    expect(alienShots.every(e=>e.dodged&&e.damage===0)).toBe(true);
    expect(result.survivors["Explorer Trooper"]).toBe(100);
  });
  test("regeneration never exceeds initial deployed army",()=>{
    jest.spyOn(Math,"random").mockReturnValue(0.9);
    const initial=20;
    const result=fight({"Explorer Trooper":initial},{"Alien Scout":50},null,{revive:15});
    expect(result.survivors["Explorer Trooper"]).toBeLessThanOrEqual(initial);
    for(const round of result.report)for(const event of round.events){
      if(event.attacker==="Nano Regeneration")expect(event.restored).toBeGreaterThan(0);
    }
  });
  test("casualty events never claim more than the original target group",()=>{
    jest.spyOn(Math,"random").mockReturnValue(0.5);
    const result=fight({"Explorer Trooper":100},{"Alien Scout":3});
    const losses=result.report.flatMap(r=>r.events).filter(e=>e.event==="casualties"&&e.unit==="Alien Scout").reduce((n,e)=>n+e.kills,0);
    expect(losses).toBeLessThanOrEqual(3);
  });
});
