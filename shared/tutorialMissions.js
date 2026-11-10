// Colonize Mars tutorial missions. Rewards are amounts of EACH of four resources.
const missions = [
  {
    "id": 1,
    "title": "Марсиански добив",
    "description": "Надстрой четирите ресурсни съоръжения до ниво 3.",
    "reward": 3000,
    "kind": "mines",
    "target": 3,
    "level": null
  },
  {
    "id": 2,
    "title": "Първи защитници",
    "description": "Построй Training Center ниво 1 и обучи общо 10 войници.",
    "reward": 5000,
    "kind": "army",
    "target": 10,
    "level": null
  },
  {
    "id": 3,
    "title": "Военни технологии",
    "description": "Построй Upgrade Lab до ниво 1.",
    "reward": 3500,
    "kind": "building",
    "target": "Upgrade Lab",
    "level": 1
  },
  {
    "id": 4,
    "title": "Жилищен сектор",
    "description": "Изгради Bio-Lab до ниво 1 — първата стъпка към колонистки капацитет.",
    "reward": 3500,
    "kind": "building",
    "target": "Bio-Lab",
    "level": 1
  },
  {
    "id": 5,
    "title": "Защитени запаси",
    "description": "Надстрой Cargo Depot до ниво 3.",
    "reward": 5000,
    "kind": "building",
    "target": "Cargo Depot",
    "level": 3
  },
  {
    "id": 6,
    "title": "Развита ресурсна мрежа",
    "description": "Надстрой всички ресурсни съоръжения до ниво 5.",
    "reward": 7000,
    "kind": "mines",
    "target": 5,
    "level": null
  },
  {
    "id": 7,
    "title": "Разузнаване на Марс",
    "description": "Изпрати Rover Scout да разузнае извънземна база от картата.",
    "reward": 4500,
    "kind": "recon",
    "target": null,
    "level": null
  },
  {
    "id": 8,
    "title": "Мобилни сили",
    "description": "Построй Vehicle Bay до ниво 1.",
    "reward": 4500,
    "kind": "building",
    "target": "Vehicle Bay",
    "level": 1
  },
  {
    "id": 9,
    "title": "Тежка техника",
    "description": "Построй Drone Factory до ниво 1.",
    "reward": 5000,
    "kind": "building",
    "target": "Drone Factory",
    "level": 1
  },
  {
    "id": 10,
    "title": "Индустриална експанзия",
    "description": "Надстрой всички ресурсни съоръжения до ниво 8.",
    "reward": 10000,
    "kind": "mines",
    "target": 8,
    "level": null
  },
  {
    "id": 11,
    "title": "Голям логистичен център",
    "description": "Надстрой Cargo Depot до ниво 6.",
    "reward": 8500,
    "kind": "building",
    "target": "Cargo Depot",
    "level": 6
  },
  {
    "id": 12,
    "title": "Елитна пехота",
    "description": "Надстрой Training Center до ниво 4 за достъп до по-силни сухопътни части.",
    "reward": 7000,
    "kind": "building",
    "target": "Training Center",
    "level": 4
  },
  {
    "id": 13,
    "title": "Бойна формация",
    "description": "Създай формация с име от поне 3 символа и я запази като Default.",
    "reward": 6500,
    "kind": "future",
    "target": null,
    "level": null
  },
  {
    "id": 14,
    "title": "Тактическа симулация",
    "description": "Проведи симулация срещу разузната извънземна база в Combat Simulator.",
    "reward": 6500,
    "kind": "future",
    "target": null,
    "level": null
  },
  {
    "id": 15,
    "title": "Логистика за експанзия",
    "description": "Надстрой Cargo Depot до ниво 9.",
    "reward": 10000,
    "kind": "building",
    "target": "Cargo Depot",
    "level": 9
  },
  {
    "id": 16,
    "title": "Марсианска борса",
    "description": "Развий търговския модул на Cargo Depot до ниво 3 и отключи междубазова търговия.",
    "reward": 8000,
    "kind": "future",
    "target": null,
    "level": null
  },
  {
    "id": 17,
    "title": "Самостоятелна колония",
    "description": "Надстрой четирите ресурсни съоръжения до ниво 12.",
    "reward": 18000,
    "kind": "mines",
    "target": 12,
    "level": null
  },
  {
    "id": 18,
    "title": "Усъвършенствано въоръжение",
    "description": "Развий Upgrade Lab до ниво 4 и направи едно реално подобрение на войска.",
    "reward": 12000,
    "kind": "future",
    "target": null,
    "level": null
  },
  {
    "id": 19,
    "title": "Планетарна защита",
    "description": "Надстрой Defense Grid до ниво 3.",
    "reward": 10000,
    "kind": "building",
    "target": "Defense Grid",
    "level": 3
  },
  {
    "id": 20,
    "title": "Мобилизация",
    "description": "Обучи поне 25 Explorer Trooper, 25 Plasma Bladesman и 25 Railgunner.",
    "reward": 12000,
    "kind": "units",
    "target": 25,
    "level": null
  },
  {
    "id": 21,
    "title": "Умения на командир",
    "description": "Разпредели точки за таланти на Cyber Knight в икономика, бой или разузнаване.",
    "reward": 9000,
    "kind": "future",
    "target": null,
    "level": null
  },
  {
    "id": 22,
    "title": "Марсиански алианс",
    "description": "Създай или се присъедини към Alliance.",
    "reward": 12000,
    "kind": "future",
    "target": null,
    "level": null
  },
  {
    "id": 23,
    "title": "Край на началната подготовка",
    "description": "Завърши предходните 22 мисии и премини към активния сезон.",
    "reward": 25000,
    "kind": "final",
    "target": null,
    "level": null
  }
];
module.exports = missions;
