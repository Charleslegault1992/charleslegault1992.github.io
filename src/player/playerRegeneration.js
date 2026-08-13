import { SANITY_DECAY_INTERVAL_MS } from "../core/gameConstants.js";

export const resetPlayerRegenerationTimers = (player) => {
  if (!player?.regeneration) {
    return false;
  }
  player.regeneration.nextHealthRegenAt = 0;
  player.regeneration.nextManaRegenAt = 0;
  player.regeneration.nextSanityDecayAt = 0;
  return true;
};

export const startPlayerRegenerationTimers = (player, regenerationData, now) => {
  if (!player?.regeneration || !Number.isFinite(now) || !regenerationData) {
    return false;
  }

  player.regeneration.nextHealthRegenAt = now + regenerationData.healthIntervalMs;
  player.regeneration.nextManaRegenAt = now + regenerationData.manaIntervalMs;
  player.regeneration.nextSanityDecayAt = now + SANITY_DECAY_INTERVAL_MS;
  return true;
};

export const advancePlayerRegeneration = (player, regenerationData, now) => {
  if (!player?.regeneration || !regenerationData || !Number.isFinite(now)) {
    return false;
  }
  if (player.sanity <= 0) {
    player.sanity = 0;
    resetPlayerRegenerationTimers(player);
    return false;
  }

  if (
    player.regeneration.nextHealthRegenAt === 0 ||
    player.regeneration.nextManaRegenAt === 0 ||
    player.regeneration.nextSanityDecayAt === 0
  ) {
    startPlayerRegenerationTimers(player, regenerationData, now);
    return false;
  }

  let didVitalChange = false;

  if (now >= player.regeneration.nextHealthRegenAt) {
    if (player.hp < player.maxHp) {
      player.hp = Math.min(player.hp + regenerationData.healthAmount, player.maxHp);
      didVitalChange = true;
    }
    player.regeneration.nextHealthRegenAt = now + regenerationData.healthIntervalMs;
  }

  if (now >= player.regeneration.nextManaRegenAt) {
    if (player.mana < player.maxMana) {
      player.mana = Math.min(player.mana + regenerationData.manaAmount, player.maxMana);
      didVitalChange = true;
    }
    player.regeneration.nextManaRegenAt = now + regenerationData.manaIntervalMs;
  }

  if (now >= player.regeneration.nextSanityDecayAt) {
    player.sanity = Math.max(player.sanity - 1, 0);
    didVitalChange = true;
    if (player.sanity > 0) {
      player.regeneration.nextSanityDecayAt = now + SANITY_DECAY_INTERVAL_MS;
    } else {
      resetPlayerRegenerationTimers(player);
    }
  }

  return didVitalChange;
};
