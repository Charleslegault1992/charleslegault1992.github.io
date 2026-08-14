export const PLAYER_SKULL_TYPE = Object.freeze({
  none: "none",
  white: "white",
  red: "red",
});

export const PVP_AGGRESSION_DURATION_MS = 60 * 1000;
export const WHITE_SKULL_DURATION_MS = 15 * 60 * 1000;
export const RED_SKULL_DURATION_MS = 24 * 60 * 60 * 1000;
export const UNJUSTIFIED_KILL_WINDOW_MS = 24 * 60 * 60 * 1000;
export const RED_SKULL_KILL_COUNT = 3;

export const createPlayerPvpState = () => ({
  enabled: false,
  skullType: PLAYER_SKULL_TYPE.none,
  skullExpiresAt: 0,
  unjustifiedKillTimestamps: [],
});

const isKnownSkullType = (skullType) => Object.values(PLAYER_SKULL_TYPE).includes(skullType);

export const normalizePlayerPvpState = (pvpState, now = Date.now()) => {
  const normalized = createPlayerPvpState();
  if (!pvpState || typeof pvpState !== "object") {
    return normalized;
  }
  normalized.enabled = pvpState.enabled === true;
  normalized.skullType = isKnownSkullType(pvpState.skullType) ? pvpState.skullType : PLAYER_SKULL_TYPE.none;
  normalized.skullExpiresAt = Number.isFinite(pvpState.skullExpiresAt) ? pvpState.skullExpiresAt : 0;
  normalized.unjustifiedKillTimestamps = Array.isArray(pvpState.unjustifiedKillTimestamps)
    ? pvpState.unjustifiedKillTimestamps.filter(
        (timestamp) => Number.isFinite(timestamp) && timestamp > now - UNJUSTIFIED_KILL_WINDOW_MS,
      )
    : [];
  if (normalized.skullType === PLAYER_SKULL_TYPE.none || normalized.skullExpiresAt <= now) {
    normalized.skullType = PLAYER_SKULL_TYPE.none;
    normalized.skullExpiresAt = 0;
  }
  return normalized;
};

export const hasActivePlayerSkull = (player, now) => {
  return (
    player?.pvp?.skullType !== PLAYER_SKULL_TYPE.none &&
    Number.isFinite(player.pvp.skullExpiresAt) &&
    player.pvp.skullExpiresAt > now
  );
};

export const applyUnjustifiedPvpAggression = (player, now) => {
  if (!player?.pvp || !Number.isFinite(now)) {
    return false;
  }
  player.pvp.enabled = true;
  if (player.pvp.skullType === PLAYER_SKULL_TYPE.red && player.pvp.skullExpiresAt > now) {
    return false;
  }
  player.pvp.skullType = PLAYER_SKULL_TYPE.white;
  player.pvp.skullExpiresAt = Math.max(player.pvp.skullExpiresAt ?? 0, now + WHITE_SKULL_DURATION_MS);
  return true;
};

export const recordUnjustifiedPlayerKill = (player, now) => {
  if (!player?.pvp || !Number.isFinite(now)) {
    return false;
  }
  player.pvp.unjustifiedKillTimestamps = player.pvp.unjustifiedKillTimestamps.filter(
    (timestamp) => Number.isFinite(timestamp) && timestamp > now - UNJUSTIFIED_KILL_WINDOW_MS,
  );
  player.pvp.unjustifiedKillTimestamps.push(now);
  if (player.pvp.unjustifiedKillTimestamps.length >= RED_SKULL_KILL_COUNT) {
    player.pvp.skullType = PLAYER_SKULL_TYPE.red;
    player.pvp.skullExpiresAt = Math.max(player.pvp.skullExpiresAt ?? 0, now + RED_SKULL_DURATION_MS);
  } else {
    applyUnjustifiedPvpAggression(player, now);
  }
  player.pvp.enabled = true;
  return true;
};

export const expirePlayerPvpState = (player, now) => {
  if (!player?.pvp || !Number.isFinite(now)) {
    return false;
  }
  const previousSkullType = player.pvp.skullType;
  const previousSkullExpiresAt = player.pvp.skullExpiresAt;
  const previousKillCount = Array.isArray(player.pvp.unjustifiedKillTimestamps)
    ? player.pvp.unjustifiedKillTimestamps.length
    : 0;
  const normalized = normalizePlayerPvpState(player.pvp, now);
  Object.assign(player.pvp, normalized);
  return (
    previousSkullType !== normalized.skullType ||
    previousSkullExpiresAt !== normalized.skullExpiresAt ||
    previousKillCount !== normalized.unjustifiedKillTimestamps.length
  );
};

export const clearWhiteSkullOnDeath = (player) => {
  if (player?.pvp?.skullType !== PLAYER_SKULL_TYPE.white) {
    return false;
  }
  player.pvp.skullType = PLAYER_SKULL_TYPE.none;
  player.pvp.skullExpiresAt = 0;
  return true;
};
