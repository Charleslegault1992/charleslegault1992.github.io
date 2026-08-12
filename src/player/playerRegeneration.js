import { SANITY_DECAY_INTERVAL_MS } from "../core/gameConstants.js";
import { playerState } from "../state/playerState.js";
import { getPlayerClassRegenerationData } from "./playerProgression.js";

export const resetPlayerRegenerationTimers = () => {
  playerState.regeneration.nextHealthRegenAt = 0;
  playerState.regeneration.nextManaRegenAt = 0;
  playerState.regeneration.nextSanityDecayAt = 0;
};

export const startPlayerRegenerationTimers = (now) => {
  const regenerationData = getPlayerClassRegenerationData();
  if (!Number.isFinite(now) || !regenerationData) {
    return false;
  }

  playerState.regeneration.nextHealthRegenAt = now + regenerationData.healthIntervalMs;
  playerState.regeneration.nextManaRegenAt = now + regenerationData.manaIntervalMs;
  playerState.regeneration.nextSanityDecayAt = now + SANITY_DECAY_INTERVAL_MS;
  return true;
};

export const advancePlayerRegeneration = (now) => {
  if (!Number.isFinite(now) || !playerState.regeneration) {
    return false;
  }
  if (playerState.sanity <= 0) {
    playerState.sanity = 0;
    resetPlayerRegenerationTimers();
    return false;
  }

  const regenerationData = getPlayerClassRegenerationData();
  if (!regenerationData) {
    return false;
  }
  if (
    playerState.regeneration.nextHealthRegenAt === 0 ||
    playerState.regeneration.nextManaRegenAt === 0 ||
    playerState.regeneration.nextSanityDecayAt === 0
  ) {
    startPlayerRegenerationTimers(now);
    return false;
  }

  let didVitalChange = false;

  if (now >= playerState.regeneration.nextHealthRegenAt) {
    if (playerState.hp < playerState.maxHp) {
      playerState.hp = Math.min(playerState.hp + regenerationData.healthAmount, playerState.maxHp);
      didVitalChange = true;
    }
    playerState.regeneration.nextHealthRegenAt = now + regenerationData.healthIntervalMs;
  }

  if (now >= playerState.regeneration.nextManaRegenAt) {
    if (playerState.mana < playerState.maxMana) {
      playerState.mana = Math.min(playerState.mana + regenerationData.manaAmount, playerState.maxMana);
      didVitalChange = true;
    }
    playerState.regeneration.nextManaRegenAt = now + regenerationData.manaIntervalMs;
  }

  if (now >= playerState.regeneration.nextSanityDecayAt) {
    playerState.sanity = Math.max(playerState.sanity - 1, 0);
    didVitalChange = true;
    if (playerState.sanity > 0) {
      playerState.regeneration.nextSanityDecayAt = now + SANITY_DECAY_INTERVAL_MS;
    } else {
      resetPlayerRegenerationTimers();
    }
  }

  return didVitalChange;
};
