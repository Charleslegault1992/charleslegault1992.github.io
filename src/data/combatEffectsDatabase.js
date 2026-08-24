export const EFFECT_ATLAS_FILE_NAME = "effects.png";
export const EFFECT_ATLAS_CELL_SIZE = 64;

const createElementEffects = (row) => Object.freeze({
  projectile: Object.freeze({ row, startCol: 0, frameCount: 1, frameMs: 0 }),
  impact: Object.freeze({ row, startCol: 1, frameCount: 4, frameMs: 70 }),
  statusTick: Object.freeze({ row, startCol: 1, frameCount: 4, frameMs: 55 }),
});

export const combatEffectsDatabase = Object.freeze({
  fire: createElementEffects(5),
  ice: createElementEffects(6),
  energy: createElementEffects(7),
  poison: createElementEffects(8),
  swordAttack: Object.freeze({ row: 9, startCol: 0, frameCount: 5, frameMs: 55 }),
  maceAttack: Object.freeze({ row: 10, startCol: 0, frameCount: 5, frameMs: 55 }),
  axeAttack: Object.freeze({ row: 11, startCol: 0, frameCount: 5, frameMs: 55 }),
  miss: Object.freeze({ row: 4, startCol: 0, frameCount: 5, frameMs: 70 }),
  block: Object.freeze({ row: 12, startCol: 0, frameCount: 5, frameMs: 70 }),
});

export const getElementCombatEffects = (damageType) => combatEffectsDatabase[damageType] ?? null;

export const getWeaponCombatEffectId = (weaponType) => {
  if (["sword", "axe", "mace"].includes(weaponType)) {
    return `${weaponType}Attack`;
  }
  return null;
};
