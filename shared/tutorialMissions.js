// Colonize Mars tutorial missions. Rewards are amounts of EACH of four resources.
const missions = [
  {
    "id": 1,
    "title": "Марсиански добив",
    "description": "Надстрой четирите ресурсни съоръжения до ниво 3.",
    "titleEn": "Martian Mining",
    "descriptionEn": "Upgrade all four resource facilities to level 3.",
    "reward": 3000,
    "kind": "mines",
    "target": 3,
    "level": null
  },
  {
    "id": 2,
    "title": "Първи защитници",
    "description": "Построй Учебен център ниво 1 и обучи общо 10 войници.",
    "titleEn": "First Defenders",
    "descriptionEn": "Build a level 1 Training Center and train a total of 10 troops.",
    "reward": 5000,
    "kind": "army",
    "target": 10,
    "level": null
  },
  {
    "id": 3,
    "title": "Военни технологии",
    "description": "Построй Лаборатория за подобрения до ниво 1.",
    "titleEn": "Military Technology",
    "descriptionEn": "Build the Upgrade Lab to level 1.",
    "reward": 3500,
    "kind": "building",
    "target": "Upgrade Lab",
    "level": 1
  },
  {
    "id": 4,
    "title": "Жилищен сектор",
    "description": "Изгради Биолаборатория до ниво 1 — първата стъпка към колонистки капацитет.",
    "titleEn": "Habitation Sector",
    "descriptionEn": "Build the Bio-Lab to level 1 to begin expanding colony capacity.",
    "reward": 3500,
    "kind": "building",
    "target": "Bio-Lab",
    "level": 1
  },
  {
    "id": 5,
    "title": "Защитени запаси",
    "description": "Надстрой Товарно депо до ниво 3.",
    "titleEn": "Protected Supplies",
    "descriptionEn": "Upgrade the Cargo Depot to level 3.",
    "reward": 5000,
    "kind": "building",
    "target": "Cargo Depot",
    "level": 3
  },
  {
    "id": 6,
    "title": "Развита ресурсна мрежа",
    "description": "Надстрой всички ресурсни съоръжения до ниво 5.",
    "titleEn": "Expanded Resource Network",
    "descriptionEn": "Upgrade all resource facilities to level 5.",
    "reward": 7000,
    "kind": "mines",
    "target": 5,
    "level": null
  },
  {
    "id": 8,
    "title": "Мобилни сили",
    "description": "Построй Хангар за машини до ниво 1.",
    "titleEn": "Mobile Forces",
    "descriptionEn": "Build the Vehicle Bay to level 1.",
    "reward": 4500,
    "kind": "building",
    "target": "Vehicle Bay",
    "level": 1
  },
  {
    "id": 9,
    "title": "Тежка техника",
    "description": "Построй Фабрика за дронове до ниво 1.",
    "titleEn": "Heavy Machinery",
    "descriptionEn": "Build the Drone Factory to level 1.",
    "reward": 5000,
    "kind": "building",
    "target": "Drone Factory",
    "level": 1
  },
  {
    "id": 10,
    "title": "Индустриална експанзия",
    "description": "Надстрой всички ресурсни съоръжения до ниво 8.",
    "titleEn": "Industrial Expansion",
    "descriptionEn": "Upgrade all resource facilities to level 8.",
    "reward": 10000,
    "kind": "mines",
    "target": 8,
    "level": null
  },
  {
    "id": 11,
    "title": "Голям логистичен център",
    "description": "Надстрой Товарно депо до ниво 6.",
    "titleEn": "Major Logistics Hub",
    "descriptionEn": "Upgrade the Cargo Depot to level 6.",
    "reward": 8500,
    "kind": "building",
    "target": "Cargo Depot",
    "level": 6
  },
  {
    "id": 12,
    "title": "Елитна пехота",
    "description": "Надстрой Учебен център до ниво 4 за достъп до по-силни сухопътни части.",
    "titleEn": "Elite Infantry",
    "descriptionEn": "Upgrade the Training Center to level 4 to unlock stronger ground troops.",
    "reward": 7000,
    "kind": "building",
    "target": "Training Center",
    "level": 4
  },
  {
    "id": 13,
    "title": "Бойна формация",
    "description": "Създай формация с име от поне 3 символа и я запази в един от петте слота.",
    "titleEn": "Battle Formation",
    "descriptionEn": "Create a formation with a name of at least three characters and save it in one of the five slots.",
    "reward": 6500,
    "kind": "formation",
    "target": null,
    "level": null
  },
  {
    "id": 14,
    "title": "Тактическа симулация",
    "description": "Построй Бойния симулатор до ниво 1 и проведи симулация срещу извънземна база.",
    "titleEn": "Tactical Simulation",
    "descriptionEn": "Build the Combat Simulator to level 1 and run a battle simulation against an alien base.",
    "reward": 6500,
    "kind": "simulation",
    "target": 2,
    "level": null
  },
  {
    "id": 15,
    "title": "Логистика за експанзия",
    "description": "Надстрой Товарно депо до ниво 9.",
    "titleEn": "Expansion Logistics",
    "descriptionEn": "Upgrade the Cargo Depot to level 9.",
    "reward": 10000,
    "kind": "building",
    "target": "Cargo Depot",
    "level": 9
  },
  {
    "id": 16,
    "title": "Марсианска борса",
    "description": "Развий търговския модул на Товарно депо до ниво 3 и отключи междубазова търговия.",
    "titleEn": "Martian Exchange",
    "descriptionEn": "Upgrade the Cargo Depot trade module to level 3 and unlock trade between bases.",
    "reward": 8000,
    "kind": "trade",
    "target": "Cargo Depot",
    "level": 3
  },
  {
    "id": 17,
    "title": "Самостоятелна колония",
    "description": "Надстрой четирите ресурсни съоръжения до ниво 12.",
    "titleEn": "Self-Sufficient Colony",
    "descriptionEn": "Upgrade all four resource facilities to level 12.",
    "reward": 18000,
    "kind": "mines",
    "target": 12,
    "level": null
  },
  {
    "id": 18,
    "title": "Усъвършенствано въоръжение",
    "description": "Развий Лаборатория за подобрения до ниво 4 и направи едно реално подобрение на войска.",
    "titleEn": "Advanced Weapons",
    "descriptionEn": "Upgrade the Upgrade Lab to level 4 and complete one troop upgrade.",
    "reward": 12000,
    "kind": "future",
    "target": null,
    "level": null
  },
  {
    "id": 19,
    "title": "Планетарна защита",
    "description": "Надстрой Отбранителна мрежа до ниво 3.",
    "titleEn": "Planetary Defense",
    "descriptionEn": "Upgrade the Defense Grid to level 3.",
    "reward": 10000,
    "kind": "building",
    "target": "Defense Grid",
    "level": 3
  },
  {
    "id": 20,
    "title": "Мобилизация",
    "description": "Обучи поне 25 войници изследователи, 25 плазмени мечоносци и 25 релсови стрелци.",
    "titleEn": "Mobilization",
    "descriptionEn": "Train at least 25 Explorer Troopers, 25 Plasma Bladesmen and 25 Railgunners.",
    "reward": 12000,
    "kind": "units",
    "target": 25,
    "level": null
  },
  {
    "id": 21,
    "title": "Умения на командир",
    "description": "Разпредели точки за таланти на Киберрицаря в икономика, бой или разузнаване.",
    "titleEn": "Commander Skills",
    "descriptionEn": "Spend Cyber Knight talent points on economy, combat or reconnaissance.",
    "reward": 9000,
    "kind": "future",
    "target": null,
    "level": null
  },
  {
    "id": 22,
    "title": "Марсиански алианс",
    "description": "Създай или се присъедини към алианс.",
    "titleEn": "Martian Alliance",
    "descriptionEn": "Create or join an alliance.",
    "reward": 12000,
    "kind": "future",
    "target": null,
    "level": null
  },
  {
    "id": 23,
    "title": "Край на началната подготовка",
    "description": "Завърши предходните 21 мисии и премини към активния сезон.",
    "titleEn": "Training Complete",
    "descriptionEn": "Complete the previous 21 missions to enter the active season.",
    "reward": 25000,
    "kind": "final",
    "target": null,
    "level": null
  }
];
module.exports = missions;
