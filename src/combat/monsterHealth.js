export const applyDamageToMonsterHealth = (monster, damageAmount) => {
  if (!monster || !Number.isFinite(monster.hp) || !Number.isFinite(damageAmount) || damageAmount <= 0) {
    return { success: false, damageApplied: 0, hp: monster?.hp ?? null, didDie: false };
  }

  const damageApplied = Math.min(Math.floor(damageAmount), Math.max(monster.hp, 0));
  monster.hp = Math.max(monster.hp - damageApplied, 0);

  return {
    success: damageApplied > 0,
    damageApplied,
    hp: monster.hp,
    didDie: monster.hp === 0,
  };
};
