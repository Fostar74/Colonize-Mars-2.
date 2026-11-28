import React from "react";
import {fireEvent,render,screen} from "@testing-library/react";
import {LanguageProvider,localizedLabel,useLanguage} from "../language";
import {battleEventText,localizedMessageBody} from "./localizedMessages";

const renderMessage = (body,kind,language) =>
  localizedMessageBody(body,kind,language,value=>localizedLabel(value,language));

test("switches game strings and dynamic labels without altering names or IDs",()=>{
  const Harness=()=>{
    const {choose,label,locale}=useLanguage();
    return <><button onClick={()=>choose("bg")}>BG</button><button onClick={()=>choose("en")}>EN</button>
      <p>{label("Requires Training Center level 3.")}</p><p>{label("Rapid Deployment")}</p>
      <p>{label("Cyber Knight")} · {label("Commander_A")}</p><p>{locale}</p></>;
  };
  localStorage.setItem("colonize-mars-language","en");
  render(<LanguageProvider><Harness /></LanguageProvider>);
  expect(screen.getByText("Requires Training Center level 3.")).toBeTruthy();
  fireEvent.click(screen.getByText("BG"));
  expect(screen.getByText("Изисква Учебен център на ниво 3.")).toBeTruthy();
  expect(screen.getByText("Хипердвигателна навигация")).toBeTruthy();
  expect(screen.getByText("Cyber Knight · Commander_A")).toBeTruthy();
  expect(document.documentElement.lang).toBe("bg");
  fireEvent.click(screen.getByText("EN"));
  expect(screen.getByText("Hyperdrive Navigation")).toBeTruthy();
  expect(document.documentElement.lang).toBe("en");
});

test("localizes old shared battle and espionage reports, including multiple unit and resource names",()=>{
  const battle = "⚔️ Battle report / Боен доклад #9\nMars / Pilot → Красимир (8:12)\nVictory / Победа · Rounds / Рундове: 1\nAttackers / Нападатели: Explorer Trooper: 1,200, Railgunner: 20\nAttacker survivors / Оцелели нападатели: Explorer Trooper: 300\nDefender survivors / Оцелели защитници: 0\nLoot / Плячка: Gold: 100, Iron: 50";
  const bg = renderMessage(battle,"private","bg");
  expect(bg).toContain("Mars / Pilot → Красимир");
  expect(bg).toContain("Нападатели: Войник изследовател: 1,200, Релсов стрелец: 20");
  expect(bg).toContain("Плячка: Злато: 100, Желязо: 50");
  expect(renderMessage(battle,"private","en")).not.toContain("Оцелели");
  const scout = "🔎 Espionage / Шпионаж #1 · Scout (1:2)\nScouts / Разузнавачи: 2 · Survivors / Оцелели: 1\nDefenders / Защитници: Railgunner: 2\nBuildings / Сгради: Cargo Depot: 3";
  expect(renderMessage(scout,"alliance","bg")).toContain("Сгради: Товарно депо: 3");
  expect(renderMessage("Gold / Злато · trade with Scout","private","bg")).toBe("Gold / Злато · trade with Scout");
});

test("localizes stored trade and event messages without translating player names",()=>{
  const trade="Trade received from Solar: 10 Gold. Resources were added to your base. / Получена търговия от Solar: 10 злато. Ресурсите са добавени към базата ти.";
  expect(renderMessage(trade,"trade","bg")).toBe("Получена търговия от Solar: 10 злато. Ресурсите са добавени към базата ти.");
  expect(renderMessage(trade,"trade","en")).toBe("Trade received from Solar: 10 Gold. Resources were added to your base.");
  const system="ALIEN INVASION · FINAL RESULTS / ОКОНЧАТЕЛНО КЛАСИРАНЕ\nPlayer / Играч: Solar / Sunny\nAlliance points / Точки на алианса: 1,200\n1. Solar / Sunny — 1,200 points / точки";
  expect(renderMessage(system,"system","en")).toContain("Player: Solar / Sunny\nAlliance points: 1,200");
  expect(renderMessage(system,"system","bg")).toContain("1. Solar / Sunny — 1,200 точки");
  const ship="ATTACK THE ALIEN COMMAND SHIP · FINAL RESULTS / АТАКУВАЙ КОМАНДНИЯ КОРАБ НА ИЗВЪНЗЕМНИТЕ · ФИНАЛНИ РЕЗУЛТАТИ\nFINAL RANKING / КЛАСИРАНЕ:\n1. Solar / Sunny — 1,200 damage · 2 attacks / 1. Solar / Sunny — 1,200 щети · 2 атаки";
  expect(renderMessage(ship,"system","en")).toContain("FINAL RANKING:\n1. Solar / Sunny — 1,200 damage · 2 attacks");
  expect(renderMessage(ship,"system","bg")).toContain("КЛАСИРАНЕ:\n1. Solar / Sunny — 1,200 щети · 2 атаки");
});

test("renders revived units and battle actor names from historic records",()=>{
  const t=(en,bg)=>bg, label=value=>localizedLabel(value,"bg");
  expect(battleEventText({unit:"Railgunner",restored:2},label,t)).toBe("Нанорегенерация: 2 Релсов стрелец възстановени");
  expect(battleEventText({attacker:"Player Defense",unit:"Railgunner",units:2,target:"Alien Infantry",damage:8},label,t))
    .toContain("Защита на играча: 2 Релсов стрелец → Извънземна пехота");
});

test("reports actual Neural Command desertion in both languages",()=>{
  const event={deserted:3,side:"defender",contingentId:7,unit:"Railgunner"};
  expect(battleEventText(event,value=>localizedLabel(value,"en"),(en,bg)=>en))
    .toBe("Neural Command · Reinforcement #7: 3 Railgunner deserted and returned alive");
  expect(battleEventText(event,value=>localizedLabel(value,"bg"),(en,bg)=>bg))
    .toBe("Невронно командване · Подкрепление #7: 3 Релсов стрелец се оттеглиха и се върнаха живи");
  const shared="⚔️ Battle report / Боен доклад #9\nAttacker survivors / Оцелели нападатели: 10\nRound 2 / Рунд 2 · Defender desertion / Дезертирали защитници: Railgunner: 3";
  expect(renderMessage(shared,"private","en")).toContain("Round 2 · Defender desertion: Railgunner: 3");
  expect(renderMessage(shared,"private","bg")).toContain("Рунд 2 · Дезертирали защитници: Релсов стрелец: 3");
});
