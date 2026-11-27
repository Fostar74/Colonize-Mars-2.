import labelsBg from "./labelsBg";
import {protocolLabels} from "./shared/cyberKnightEquipment";
import React, {createContext, useCallback, useContext, useEffect, useState} from "react";
const protocolAliases={...protocolLabels,"Rapid Deployment":["Hyperdrive Navigation","Хипердвигателна навигация"],"Resource Management":["Quantum Logistics","Квантова логистика"],"Mining Operations":["Deep Core Extraction","Дълбочинен добив"],"Advanced Recon":["Quantum Intelligence","Квантово разузнаване"],"Accelerated Training":["Accelerated Training","Ускорено обучение"]};
const dynamicLabels = [
  [/^Day (\d+) reward collected!$/, day=>`Наградата за ден ${day} е получена!`],
  [/^Helped (\d+) alliance job\(s\)(?:; (\d+) failed)?\.$/, (helped,failed)=>
    `Помогна за ${helped} задачи на алианса${failed?` · ${failed} неуспешни`:""}.`],
  [/^Requires (.+) level (\d+)\.$/, (name,level)=>`Изисква ${localizedLabel(name,"bg")} на ниво ${level}.`],
  [/^Not enough (Gold|Iron|Water|Solar)\.$/, resource=>`Недостатъчен ресурс: ${localizedLabel(resource,"bg")}.`],
  [/^Alliance message sent to (\d+) members\.$/, count=>`Съобщението на алианса е изпратено до ${count} членове.`],
  [/^The alliance needs (\d+) donated (green|red) crystals\.$/, (count,color)=>`На алианса са нужни ${count} дарени ${color==="green"?"зелени":"червени"} кристала.`],
  [/^Upgrade requires Cyber Knight level (\d+)\.$/, level=>`Подобрението изисква ниво ${level} на Cyber Knight.`],
  [/^Equipment level (\d+) requires Cyber Knight level (\d+)\.$/, (equipment,knight)=>`Екипировката на ниво ${equipment} изисква ниво ${knight} на Cyber Knight.`],
  [/^All your mine gathering slots are occupied \((\d+)\)\.$/, count=>`Всички места за добив са заети (${count}).`],
  [/^PvP attacks require a level difference of less than 6 \(your level: (\d+), target: (\d+)\)\.$/, (own,target)=>`За атака срещу играч разликата трябва да е под 6 нива (твоето ниво: ${own}, цел: ${target}).`],
  [/^Each side of an offer is limited to ([\d,.\s]+) resources\.$/, amount=>`Всяка страна на офертата е ограничена до ${amount.replace(/[,\s]/g," ")} ресурса.`],
  [/^Daily transfer limit: 50,000 total resources \(UTC\)\. Remaining: (\d+)\.$/, amount=>`Дневен лимит за превод: 50 000 ресурса (UTC). Остават: ${amount}.`],
];
export function localizedLabel(value,language) {
  if (typeof value!=="string") return value;
  if (Object.hasOwn(protocolAliases,value)) return protocolAliases[value][language==="bg"?1:0];
  if (language!=="bg") return value;
  if (Object.hasOwn(labelsBg,value)) return labelsBg[value];
  const reward = value.match(/^(.+) × ([\d,]+)$/);
  if (reward && Object.hasOwn(labelsBg,reward[1])) return labelsBg[reward[1]]+" × "+Number(reward[2].replace(/,/g,"")).toLocaleString("bg-BG");
  for (const [pattern,translate] of dynamicLabels) {
    const match = value.match(pattern);
    if (match) return translate(...match.slice(1));
  }
  return value;
}

const LanguageContext = createContext(null);
const storageKey = "colonize-mars-language";

export function LanguageProvider({children}) {
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved === "en" || saved === "bg" ? saved : null;
  });

  useEffect(() => {
    if (language) document.documentElement.lang = language;
  }, [language]);

  const choose = value => {
    localStorage.setItem(storageKey, value);
    setLanguage(value);
  };

  if (!language) return <main style={{textAlign:"center",padding:32}}>
    <h1>Colonize Mars</h1>
    <p><span lang="bg">Избери език</span> / <span lang="en">Choose a language</span></p>
    <button lang="bg" onClick={() => choose("bg")}>Български</button>{" "}
    <button lang="en" onClick={() => choose("en")}>English</button>
  </main>;

  return <LanguageContext.Provider value={{language,choose}}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const {language,choose} = useContext(LanguageContext);
  const label = useCallback(value=>localizedLabel(value,language),[language]);
  return {language,choose,label,locale:language==="bg"?"bg-BG":"en-US",t:(english,bulgarian) => language === "bg" ? bulgarian : english};
}
