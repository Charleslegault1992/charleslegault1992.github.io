export const spellsDatabase = {
  luxAppare: {
    spellId: "luxAppare",
    incantation: "lux appare",
    allowedClassIds: null,
    requiredMagicLevel: 0,
    manaCost: 5,
    cooldownGroup: "magic",
    action: "lightSelf",
    durationMs: 180000,
    lightRadius: 340,
  },
  vitaSana: {
    spellId: "vitaSana",
    incantation: "vita sana",
    allowedClassIds: null,
    requiredMagicLevel: 1,
    manaCost: 20,
    cooldownGroup: "magic",
    action: "healSelf",
    power: {
      min: 14,
      max: 20,
      magicLevelMultiplier: 0.8,
      levelMultiplier: 0.2,
    },
    textType: "heal",
  },
};
