const products = {
  landing_pack: {cost:100, tokens:50, label:"Mars Landing Pack (50 tokens)", bg:"Пакет за кацане на Марс (50 жетона)"},
  attack: {cost:80, label:"Army Attack +10% (1h)", bg:"Атака на армията +10% (1 ч.)"},
  health: {cost:80, label:"Army Health +10% (1h)", bg:"Здраве на армията +10% (1 ч.)"},
  protection: {cost:150, label:"Plasma Shield (24h)", bg:"Плазмен щит (24 ч.)"},
  external_10: {cost:500, effect:"external", percent:10, label:"External mine gathering +10% (8h)", bg:"Добив от външни мини +10% (8 ч.)"},
  external_25: {cost:1000, effect:"external", percent:25, label:"External mine gathering +25% (8h)", bg:"Добив от външни мини +25% (8 ч.)"},
  production_10: {cost:500, effect:"production", percent:10, label:"Base resource production +10% (8h)", bg:"Производство на ресурси в базата +10% (8 ч.)"},
  production_25: {cost:1000, effect:"production", percent:25, label:"Base resource production +25% (8h)", bg:"Производство на ресурси в базата +25% (8 ч.)"},
  alien_attempt: {cost:1000, effect:"alien", label:"One additional Alien Base mission", bg:"Една допълнителна мисия срещу извънземна база"},
  labyrinth_attempt: {cost:1000, effect:"labyrinth", label:"One additional Labyrinth battle", bg:"Една допълнителна битка в Лабиринта"},
  protocol_reset: {cost:50000, label:"Protocol Reset", bg:"Нулиране на протоколите"},
};

module.exports = products;
