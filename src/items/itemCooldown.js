import { USE_COOLDOWN_MS } from "../core/gameConstants.js";
import { clamp } from "../core/mathUtils.js";

const nextUseCooldownByGroup = Object.fromEntries(Object.keys(USE_COOLDOWN_MS).map((group) => [group, 0]));

export const getUseCooldownGroup = (useData) => {
  return useData?.cooldownGroup ?? null;
};

export const isUseCooldownReady = (cooldownGroup, now = Date.now()) => {
  if (cooldownGroup === null) {
    return true;
  }
  return (nextUseCooldownByGroup[cooldownGroup] ?? 0) <= now;
};

export const beginUseCooldown = (cooldownGroup, now = Date.now()) => {
  if (cooldownGroup === null) {
    return false;
  }
  const duration = USE_COOLDOWN_MS[cooldownGroup];
  if (!Number.isFinite(duration) || duration < 0) {
    return false;
  }
  nextUseCooldownByGroup[cooldownGroup] = now + duration;
  return true;
};

export const getUseCooldownRemainingRatio = (cooldownGroup, now) => {
  const cooldownDuration = USE_COOLDOWN_MS[cooldownGroup];
  const cooldownEndTime = nextUseCooldownByGroup[cooldownGroup];
  if (!Number.isFinite(cooldownDuration) || cooldownDuration <= 0 || !Number.isFinite(cooldownEndTime)) {
    return 0;
  }
  return clamp((cooldownEndTime - now) / cooldownDuration, 0, 1);
};
