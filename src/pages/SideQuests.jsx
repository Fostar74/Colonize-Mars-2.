import React, {useEffect,useState} from "react";
import {useLanguage} from "../language";

const api=(process.env.REACT_APP_API_URL||(window.location.hostname==="localhost"?"http://localhost:3001":window.location.origin)).replace(/\/$/,"");
export default function SideQuests(){
  const {language,t,label}=useLanguage();
  const [missions,setMissions]=useState(null);
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const userId=sessionStorage.getItem("userId");
  const headers={"Content-Type":"application/json",Authorization:"Bearer "+sessionStorage.getItem("authToken")};
  useEffect(()=>{
    let active=true;
    const refresh=async()=>{
      try{
        const response=await fetch(api+"/side-quests/"+encodeURIComponent(userId),{
          headers:{Authorization:"Bearer "+sessionStorage.getItem("authToken")},cache:"no-store"
        });
        if(response.ok&&active){const data=await response.json();if(active)setMissions(data.missions);}
      }catch{}
    };
    refresh();
    const timer=setInterval(refresh,5000);
    window.addEventListener("game-progress-updated",refresh);
    return ()=>{active=false;clearInterval(timer);window.removeEventListener("game-progress-updated",refresh);};
  },[userId]);

  const claim=async missionId=>{
    setBusy(true);setNotice("");
    try{
      const response=await fetch(api+"/side-quests/claim",{method:"POST",headers,body:JSON.stringify({userId,missionId})});
      const data=await response.json();
      if(!response.ok)throw Error(data.message);
      setMissions(data.missions);
      setNotice(t("Reward collected.","Наградата е взета."));
    }catch(error){setNotice(label(error.message));}
    finally{setBusy(false);}
  };

  const condition=quest=>{
    const {kind,target,detail}=quest;
    const descriptions={
      train:t("Train and manually mobilize "+target+" "+label(detail)+". Only units mobilized from training during this mission count.","Обучи и мобилизирай ръчно "+target+" "+label(detail)+". Зачитат се войските от обучение, мобилизирани по време на тази мисия."),
      mine:t("Before departing for the Red Planet, secure expedition supplies. Every unit brings us closer to the stars. Personally deplete one external mine.","Преди да отпътуваш към Червената планета, осигури запаси за експедицията. Всяка единица ни приближава до звездите. Изчерпай лично една външна мина."),
      alienAttack:t("Attack alien base level "+detail+". Victory is optional.","Атакувай извънземна база ниво "+detail+". Победата е по избор."),
      alienVictory:t("Defeat alien base level "+detail+".","Победи извънземна база ниво "+detail+"."),
      spy:t("Complete an espionage mission against an eligible player.","Завърши шпионска мисия срещу допустим играч."),
      donate:t("Make 10 alliance resource donations.","Направи 10 дарения на ресурси за алианса."),
      avatar:t("Change your avatar.","Промени аватара си."),
      mothership:t("Participate in the Alien Command Ship event.","Участвай в събитието „Команден кораб на извънземните“."),
      labyrinthStart:t("Begin a battle in the Underground Labyrinth.","Започни битка в Подземния лабиринт."),
      equipment:t("Equip six Cyber Knight items of level 12 or higher.","Екипирай шест предмета на Киберрицаря на ниво 12 или по-високо."),
      path:t("Choose your path with your first eligible dispatch. Send reinforcements to an ally as Defender or launch PvP as Conqueror.","Избери път с първия си допустим поход. Изпрати подкрепления на съюзник като Защитник или атакувай играч като Завоевател."),
      knight:t("Reach Cyber Knight level 20.","Достигни ниво 20 на Киберрицаря."),
      labyrinthFloor:t("Clear floor 20 of the Underground Labyrinth.","Премини етаж 20 на Подземния лабиринт."),
      population:t("Grow a small military base into a powerful army that protects humanity’s future. Reach 100,000 military population in base. Mars awaits.","Превърни малката военна база в мощна армия, която защитава бъдещето на човечеството. Достигни 100 000 военна популация в базата. Марс те очаква."),
      heal:t("A true commander cares for wounded soldiers. Heal and manually mobilize 10,000 individual troops from the field hospital.","Истинският командир се грижи за ранените войници. Излекувай и мобилизирай ръчно 10 000 отделни войници от полевата болница."),
    };
    return descriptions[kind];
  };

  const reward=([kind,name,amount,count])=>{
    if(kind==="items")return amount+" × "+({attack:t("+10% attack for 1 hour","+10% атака за 1 час"),health:t("+10% defense for 1 hour","+10% защита за 1 час"),protection:t("24h attack and espionage protection","24 ч. защита от атаки и шпионаж")}[name]);
    if(kind==="allResources")return amount.toLocaleString()+" "+t("of each resource","от всеки ресурс");
    if(kind==="forge")return amount+" "+t("Universal Forge","Универсални ковашки точки");
    if(kind==="missions")return amount+" "+t("extra Alien Base missions","допълнителни мисии срещу извънземни бази");
    if(kind==="equipment"){
      const slots={BOOTS:t("boots","ботуши"),GLOVES:t("gloves","ръкавици"),WEAPON:t("weapon","оръжие"),HELMET:t("helmet","шлем"),SHIELD:t("shield","щит"),ARMOR:t("armor","броня")};
      return count+" × "+(slots[name]||t("random equipment","случайна екипировка"))+" · "+amount+"★ · "+amount+" "+t("random bonuses per item","случайни бонуса на предмет");
    }
    return amount.toLocaleString()+" "+label(name);
  };
  const pathName=path=>path==="defender"?t("Defender","Защитник"):t("Conqueror","Завоевател");
  return <section className="quest-section">
    <h3>{t("Side Quests","Странични мисии")}</h3>
    <p>{t("Prepare Earth’s expedition to Mars. Claim each reward to unlock the next mission.","Подготви експедицията от Земята до Марс. Вземи всяка награда, за да отключиш следващата мисия.")}</p>
    {notice&&<p role="status">{notice}</p>}
    {missions===null?<p>{t("Loading side quests…","Зареждане на страничните мисии…")}</p>:<ol>
      {missions.map(quest=><li key={quest.id}>
        {quest.status==="locked"?t("Locked","Заключена"):<strong>{quest.title[language]}</strong>}
        {quest.status==="claimed"&&" · "+t("Reward claimed","Наградата е взета")}
        {["active","complete"].includes(quest.status)&&<>
          <p>{condition(quest)}</p>
          <p>{quest.progress.toLocaleString()} / {quest.target.toLocaleString()}</p>
          {quest.choices
            ? quest.path?<p>{pathName(quest.path)} · {quest.choices[quest.path].map(reward).join(" · ")}</p>
              : Object.entries(quest.choices).map(([path,rewards])=><p key={path}>{pathName(path)} · {rewards.map(reward).join(" · ")}</p>)
            : <p>{t("Reward","Награда")} · {quest.rewards.map(reward).join(" · ")}</p>}
          {quest.status==="complete"&&<button type="button" disabled={busy} onClick={()=>claim(quest.id)}>{t("Claim reward","Вземи наградата")}</button>}
        </>}
      </li>)}
    </ol>}
  </section>;
}
