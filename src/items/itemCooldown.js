import { USE_COOLDOWN_MS } from "../core/gameConstants.js";
import { clamp } from "../core/mathUtils.js";

export const createItemCooldownState = (cooldownEndTimes = null) => {
  const nextUseCooldownByGroup = cooldownEndTimes ??
    Object.fromEntries(Object.keys(USE_COOLDOWN_MS).map((group) => [group, 0]));

  const isReady = (cooldownGroup, now = Date.now()) => {
    if (cooldownGroup === null) {
      return true;
    }
    return (nextUseCooldownByGroup[cooldownGroup] ?? 0) <= now;
  };

  const begin = (cooldownGroup, now = Date.now()) => {
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

  const getRemainingRatio = (cooldownGroup, now) => {
    const cooldownDuration = USE_COOLDOWN_MS[cooldownGroup];
    const cooldownEndTime = nextUseCooldownByGroup[cooldownGroup];
    if (!Number.isFinite(cooldownDuration) || cooldownDuration <= 0 || !Number.isFinite(cooldownEndTime)) {
      return 0;
    }
    return clamp((cooldownEndTime - now) / cooldownDuration, 0, 1);
  };

  return Object.freeze({
    begin,
    getEndTimes: () => structuredClone(nextUseCooldownByGroup),
    getRemainingRatio,
    isReady,
  });
};

const defaultItemCooldownState = createItemCooldownState();

export const getUseCooldownGroup = (useData) => {
  return useData?.cooldownGroup ?? null;
};

export const isUseCooldownReady = (cooldownGroup, now = Date.now()) => {
  return defaultItemCooldownState.isReady(cooldownGroup, now);
};

export const beginUseCooldown = (cooldownGroup, now = Date.now()) => {
  return defaultItemCooldownState.begin(cooldownGroup, now);
};

export const getUseCooldownRemainingRatio = (cooldownGroup, now) => {
  return defaultItemCooldownState.getRemainingRatio(cooldownGroup, now);
};
