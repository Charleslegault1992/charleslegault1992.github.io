export const playerClassesDatabase = {
  noClass: {
    classId: "noClass",
    name: "Classless",
    skillExperienceMultipliers: {
      fist: 0.5,
      sword: 0.5,
      mace: 0.5,
      axe: 0.5,
      distance: 0.5,
      shielding: 0.5,
      magic: 0.25,
    },
    levelUpGains: {
      hp: 5,
      mana: 5,
      capacity: 10,
    },
    regeneration: {
      healthAmount: 1,
      healthIntervalMs: 6000,
      manaAmount: 1,
      manaIntervalMs: 6000,
    },
  },
  knight: {
    classId: "knight",
    name: "Knight",
    skillExperienceMultipliers: {
      fist: 1,
      sword: 1.35,
      mace: 1.35,
      axe: 1.35,
      distance: 0.7,
      shielding: 1.35,
      magic: 0.25,
    },
    levelUpGains: {
      hp: 15,
      mana: 5,
      capacity: 25,
    },
    regeneration: {
      healthAmount: 1,
      healthIntervalMs: 3000,
      manaAmount: 1,
      manaIntervalMs: 6000,
    },
  },

  archer: {
    classId: "archer",
    name: "Archer",
    skillExperienceMultipliers: {
      fist: 1,
      sword: 0.7,
      mace: 0.7,
      axe: 0.7,
      distance: 1.35,
      shielding: 0.85,
      magic: 0.25,
    },
    levelUpGains: {
      hp: 10,
      mana: 7,
      capacity: 20,
    },
    regeneration: {
      healthAmount: 1,
      healthIntervalMs: 4000,
      manaAmount: 1,
      manaIntervalMs: 4000,
    },
  },

  mage: {
    classId: "mage",
    name: "Mage",
    skillExperienceMultipliers: {
      fist: 1,
      sword: 0.5,
      mace: 0.5,
      axe: 0.5,
      distance: 0.5,
      shielding: 0.5,
      magic: 1.45,
    },
    levelUpGains: {
      hp: 5,
      mana: 30,
      capacity: 10,
    },
    regeneration: {
      healthAmount: 1,
      healthIntervalMs: 6000,
      manaAmount: 1,
      manaIntervalMs: 3000,
    },
  },

  priest: {
    classId: "priest",
    name: "Priest",
    skillExperienceMultipliers: {
      fist: 1,
      sword: 0.5,
      mace: 0.7,
      axe: 0.5,
      distance: 0.5,
      shielding: 0.6,
      magic: 1.35,
    },
    levelUpGains: {
      hp: 7,
      mana: 30,
      capacity: 10,
    },
    regeneration: {
      healthAmount: 1,
      healthIntervalMs: 4000,
      manaAmount: 1,
      manaIntervalMs: 3000,
    },
  },
};
