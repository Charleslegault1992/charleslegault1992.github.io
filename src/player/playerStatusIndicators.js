export const PLAYER_STATUS_INDICATOR = Object.freeze({
  whiteSkull: "white-skull",
  redSkull: "red-skull",
  poison: "poison",
  fire: "fire",
  combat: "combat",
  protection: "protection",
});

export const MAX_PLAYER_STATUS_INDICATORS = 8;

const isStatusEffectActive = (statusEffect, now) => {
  if (statusEffect === true || statusEffect?.active === true) {
    return true;
  }
  return Number.isFinite(statusEffect?.expiresAt) && statusEffect.expiresAt > now;
};

export const getActivePlayerStatusIndicators = (player, now, { isInProtectionZone = false } = {}) => {
  if (!player || !Number.isFinite(now)) {
    return [];
  }

  const indicators = [];
  const skullType = player.pvp?.skullType;
  const skullIsActive = Number.isFinite(player.pvp?.skullExpiresAt) && player.pvp.skullExpiresAt > now;
  if (skullIsActive && skullType === "red") {
    indicators.push(PLAYER_STATUS_INDICATOR.redSkull);
  } else if (skullIsActive && skullType === "white") {
    indicators.push(PLAYER_STATUS_INDICATOR.whiteSkull);
  }

  if (isStatusEffectActive(player.statusEffects?.poison, now)) {
    indicators.push(PLAYER_STATUS_INDICATOR.poison);
  }
  if (
    isStatusEffectActive(player.statusEffects?.fire, now) ||
    isStatusEffectActive(player.statusEffects?.burning, now)
  ) {
    indicators.push(PLAYER_STATUS_INDICATOR.fire);
  }
  if (Number.isFinite(player.combatLogoutExpiresAt) && player.combatLogoutExpiresAt > now) {
    indicators.push(PLAYER_STATUS_INDICATOR.combat);
  }
  if (isInProtectionZone) {
    indicators.push(PLAYER_STATUS_INDICATOR.protection);
  }

  return indicators.slice(0, MAX_PLAYER_STATUS_INDICATORS);
};
