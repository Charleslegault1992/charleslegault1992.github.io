import { DECAY_REFRESH_COOLDOWN_MS, SPRITE_SIZE } from "../core/gameConstants.js";
import { getAtlasSource } from "../core/atlasUtils.js";
import { GROUND_EFFECT_DECAY_STAGE_MS, groundEffectsDatabase } from "../data/groundEffectsDatabase.js";
import {
  clearPixiGroundEffectVisuals,
  removePixiGroundEffectVisual,
  upsertPixiGroundEffectVisual,
} from "../pixiRendererFacade.js";
import { gameplayTimingState } from "../state/clientRuntimeState.js";
import { playerState } from "../state/playerState.js";
import { allocateGroundEffectUid } from "../state/uidAllocator.js";
import { groundEffectsByUid, groundEffectUidByTileKey } from "../state/worldState.js";
import { getWorldTileStackKey } from "./worldItemStacks.js";

export const getGroundEffectData = (groundEffectId) => {
  return groundEffectsDatabase[groundEffectId] ?? null;
};

export const renderGroundEffect = (groundEffect) => {
  if (!groundEffect || groundEffect.z !== playerState.z) {
    return false;
  }

  const groundEffectData = getGroundEffectData(groundEffect.groundEffectId);
  if (!groundEffectData) {
    return false;
  }

  const source = getAtlasSource(
    groundEffectData.atlasCol + groundEffect.decayStage,
    groundEffectData.atlasRow,
    SPRITE_SIZE,
  );
  return upsertPixiGroundEffectVisual({
    uid: groundEffect.uid,
    ...source,
    x: groundEffect.x,
    y: groundEffect.y,
  });
};

export const removeGroundEffect = (groundEffectUid) => {
  const groundEffect = groundEffectsByUid.get(groundEffectUid);
  if (!groundEffect) {
    return false;
  }

  const tileKey = getWorldTileStackKey(groundEffect.x, groundEffect.y, groundEffect.z);
  if (groundEffectUidByTileKey.get(tileKey) === groundEffectUid) {
    groundEffectUidByTileKey.delete(tileKey);
  }
  groundEffectsByUid.delete(groundEffectUid);
  removePixiGroundEffectVisual(groundEffectUid);
  return true;
};

export const addOrRefreshGroundEffect = (groundEffectId, x, y, z, decayStage = 0, now = Date.now()) => {
  if (
    !getGroundEffectData(groundEffectId) ||
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    !Number.isInteger(z) ||
    !Number.isInteger(decayStage) ||
    decayStage < 0 ||
    decayStage > 2 ||
    !Number.isFinite(now)
  ) {
    return null;
  }

  const tileKey = getWorldTileStackKey(x, y, z);
  const existingUid = groundEffectUidByTileKey.get(tileKey) ?? null;
  let groundEffect = groundEffectsByUid.get(existingUid) ?? null;

  if (!groundEffect) {
    groundEffect = {
      uid: allocateGroundEffectUid(),
      groundEffectId,
      x,
      y,
      z,
      decayStage,
      nextDecayAt: now + GROUND_EFFECT_DECAY_STAGE_MS,
    };
    groundEffectsByUid.set(groundEffect.uid, groundEffect);
    groundEffectUidByTileKey.set(tileKey, groundEffect.uid);
  } else {
    groundEffect.groundEffectId = groundEffectId;
    groundEffect.decayStage = decayStage;
    groundEffect.nextDecayAt = now + GROUND_EFFECT_DECAY_STAGE_MS;
  }

  renderGroundEffect(groundEffect);
  return groundEffect;
};

export const syncGroundEffectRenderForCurrentZ = () => {
  clearPixiGroundEffectVisuals();
  for (const groundEffect of groundEffectsByUid.values()) {
    renderGroundEffect(groundEffect);
  }
};

export const updateGroundEffectDecay = (now) => {
  if (now < gameplayTimingState.nextGroundEffectDecayRefresh) {
    return;
  }
  gameplayTimingState.nextGroundEffectDecayRefresh = now + DECAY_REFRESH_COOLDOWN_MS;

  for (const groundEffect of [...groundEffectsByUid.values()]) {
    if (now < groundEffect.nextDecayAt) {
      continue;
    }
    if (groundEffect.decayStage >= 2) {
      removeGroundEffect(groundEffect.uid);
      continue;
    }
    groundEffect.decayStage += 1;
    groundEffect.nextDecayAt = now + GROUND_EFFECT_DECAY_STAGE_MS;
    renderGroundEffect(groundEffect);
  }
};
