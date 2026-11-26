const {fight}=require("./combatEngine");

describe("Commander Protocol battle accounting",()=>{
  afterEach(()=>jest.restoreAllMocks());
  test("evasion reduces incoming alien volleys without reducing outgoing damage",()=>{
    const army={"Explorer Trooper":100};
    const aliens={"Alien Infantry":20};
    const options={random:()=>0};
    const baseline=fight(army,aliens,null,{},options).report[0].events;
    const evasion=fight(army,aliens,null,{dodge:15},options).report[0].events;
    const incoming=baseline.find(event=>event.attacker==="Alien Base");
    expect(evasion.find(event=>event.attacker==="Alien Base")).toMatchObject({
      damage:Math.round(incoming.damage*0.9), dodged:true, evadedPercent:10
    });
    expect(evasion.find(event=>event.attacker==="Player"))
      .toEqual(baseline.find(event=>event.attacker==="Player"));
  });
  test("regeneration never exceeds initial deployed army",()=>{
    jest.spyOn(Math,"random").mockReturnValue(0.9);
    const initial=20;
    const result=fight({"Explorer Trooper":initial},{"Alien Infantry":50},null,{revive:15});
    expect(result.survivors["Explorer Trooper"]).toBeLessThanOrEqual(initial);
    for(const round of result.report)for(const event of round.events){
      if(event.attacker==="Nano Regeneration")expect(event.restored).toBeGreaterThan(0);
    }
  });
  test("casualty events never claim more than the original target group",()=>{
    jest.spyOn(Math,"random").mockReturnValue(0.5);
    const result=fight({"Explorer Trooper":100},{"Alien Infantry":3});
    const losses=result.report.flatMap(r=>r.events).filter(e=>e.event==="casualties"&&e.unit==="Alien Infantry").reduce((n,e)=>n+e.kills,0);
    expect(losses).toBeLessThanOrEqual(3);
  });
});
