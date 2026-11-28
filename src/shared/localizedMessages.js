// Recognize stored game templates at display time. Ordinary player text stays intact.
const battleHead = "⚔️ Battle report / Боен доклад #";
const alienHead = "⚔️ Alien base report / Доклад за извънземна база #";
const scoutHead = "🔎 Espionage / Шпионаж #";
const shipHead = "ATTACK THE ALIEN COMMAND SHIP · FINAL RESULTS / АТАКУВАЙ КОМАНДНИЯ КОРАБ НА ИЗВЪНЗЕМНИТЕ · ФИНАЛНИ РЕЗУЛТАТИ";
const invasionHead = "ALIEN INVASION · FINAL RESULTS / ОКОНЧАТЕЛНО КЛАСИРАНЕ";

const reportFields = {
  "Alien Base level":"Ниво на извънземна база", Attackers:"Нападатели", "Attacker survivors":"Оцелели нападатели",
  "Defender survivors":"Оцелели защитници", Loot:"Плячка",
  "Unprotected resources":"Незащитени ресурси", Defenders:"Защитници", Buildings:"Сгради",
};
const systemFields = {
  "FINAL RANKING":"КЛАСИРАНЕ", REWARDS:"НАГРАДИ", Event:"Събитие",
  "ALLIANCE RANKING":"КЛАСИРАНЕ НА АЛИАНСИТЕ", "INDIVIDUAL RANKING":"ИНДИВИДУАЛНО КЛАСИРАНЕ",
  "YOUR RESULTS":"ТВОИТЕ РЕЗУЛТАТИ", Player:"Играч", "Individual rank":"Лично място",
  "Personal points":"Лични точки", Waves:"Вълни", Alliance:"Алианс", "Alliance rank":"Място на алианса",
  "Alliance points":"Алианс точки", "YOUR ALLIANCE REWARD":"ТВОЯТА НАГРАДА ОТ АЛИАНСА",
};

export function localizedMessageBody(body, kind, language, label) {
  const bg = language === "bg";
  const select = (en, translation) => bg ? translation : en;
  if (kind === "trade") {
    const marker = " / Получена търговия от ";
    const index = body.indexOf(marker);
    return body.startsWith("Trade received from ") && index >= 0
      ? select(body.slice(0,index),body.slice(index+3)) : body;
  }
  if (((body.startsWith(battleHead) || body.startsWith(alienHead)) && body.includes("\nAttacker survivors / Оцелели нападатели:")) ||
      (body.startsWith(scoutHead) && body.includes("\nDefenders / Защитници:"))) {
    return body.split("\n").map(line=>{
      if (line.startsWith(battleHead)) return select("⚔️ Battle report #","⚔️ Боен доклад №")+line.slice(battleHead.length);
      if (line.startsWith(alienHead)) return select("⚔️ Alien base report #","⚔️ Доклад за извънземна база №")+line.slice(alienHead.length);
      if (line.startsWith(scoutHead)) return select("🔎 Espionage #","🔎 Шпионаж №")+line.slice(scoutHead.length);
      for (const [en,translation] of Object.entries(reportFields)) {
        const prefix = en+" / "+translation+":";
        if (line.startsWith(prefix)) {
          const values = line.slice(prefix.length).split(/(,\s+(?=[^\d]))/).map(part=>
            part.replace(/^(\s*)([^:]+)(:\s*[\d.,\s]+)$/,(_,space,name,value)=>space+label(name)+value)).join("");
          return select(en,translation)+":"+values;
        }
      }
      return line.replace(/^Round (\d+) \/ Рунд \d+ · (Attacker desertion|Defender desertion) \/ (Дезертирали нападатели|Дезертирали защитници): (.*)$/,
        (_,round,en,bgLabel,units)=>select("Round","Рунд")+" "+round+" · "+select(en,bgLabel)+": "+units.split(", ").map(
          unit=>unit.replace(/^(.*): (\d+)$/,(_,name,count)=>label(name)+": "+count)).join(", "))
        .replace(/^(Victory \/ Победа|Defeat \/ Поражение) · Rounds \/ Рундове:/,
        (_,outcome)=>outcome.split(" / ")[bg?1:0]+" · "+select("Rounds","Рундове")+":")
        .replace(/^Scouts \/ Разузнавачи: (\d+) · Survivors \/ Оцелели:/,
          (_,count)=>select("Scouts","Разузнавачи")+": "+count+" · "+select("Survivors","Оцелели")+":");
    }).join("\n");
  }
  if (kind !== "system" || !(body.startsWith(shipHead) || body.startsWith(invasionHead))) return body;
  return body.split("\n").map(line=>{
    if (line===shipHead || line===invasionHead) return line.split(" / ")[bg?1:0];
    for (const [en,translation] of Object.entries(systemFields)) {
      const separator = en+" / ";
      if (!line.startsWith(separator)) continue;
      const names = en==="Alliance points" ? [translation,"Точки на алианса"] : [translation];
      const matched = names.find(name=>line.startsWith(separator+name+":"));
      if (matched) return select(en,translation)+line.slice(separator.length+matched.length);
    }
    if (/^\d+\. /.test(line)) {
      const shipRanking = line.match(/^(\d+\. .+ — [\d,.\s]+ damage · \d+ attacks) \/ (\d+\. .+ — [\d,.\s]+ щети · \d+ атаки)$/);
      if (shipRanking) return select(shipRanking[1],shipRanking[2]);
      return line.replace(/ points \/ точки$/,select(" points"," точки"));
    }
    if (line.includes(" Added to Inventory / Добавени в Инвентара.")) {
      const [reward,translation] = line.split(" / ");
      return select(reward+" Added to Inventory.",translation.replace(/ Added to Inventory$/,"")+" Добавени в Инвентара.");
    }
    if (line.startsWith("Top 10: ")) return select("Top 10","Първите 10")+": "+line.slice(8).split(" / ")[bg?1:0];
    return line.includes(" / ") ? line.split(" / ")[bg?1:0] : line;
  }).join("\n");
}

export function battleEventText(event,label,t) {
  if (event.deserted>0) {
    const force = event.contingentId != null ? t("Reinforcement","Подкрепление")+" #"+event.contingentId
      : event.side === "attacker" ? t("Attackers","Нападатели") : t("Defenders","Защитници");
    return label("Neural Command")+" · "+force+": "+event.deserted+" "+label(event.unit)+" "+t("deserted and returned alive","се оттеглиха и се върнаха живи");
  }
  if (event.restored>0) return label("Nano Regeneration")+": "+event.restored+" "+label(event.unit)+" "+t("restored","възстановени");
  return label(event.attacker)+": "+event.units+" "+label(event.unit)+" → "+label(event.target)
    +" · "+event.damage+" "+t("damage","щети")+(Number.isInteger(event.kills)?" · "+event.kills+" "+t("defeated","убити"):"")
    +(event.dodged?" · "+t("Evaded","Избегнат удар")+" "+event.evadedPercent+"%":"");
}
