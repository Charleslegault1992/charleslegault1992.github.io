export const applyDamageToPlayer = (player, damageAmount) => {
  if (!player || !Number.isFinite(player.hp) || !Number.isFinite(damageAmount) || damageAmount <= 0) {
    return { success: false, damageApplied: 0, hp: player?.hp ?? null, didDie: false };
  }
  const damageApplied = Math.min(Math.floor(damageAmount), Math.max(player.hp, 0));
  player.hp = Math.max(player.hp - damageApplied, 0);
  return {
    success: damageApplied > 0,
    damageApplied,
    hp: player.hp,
    didDie: player.hp === 0,
  };
};
