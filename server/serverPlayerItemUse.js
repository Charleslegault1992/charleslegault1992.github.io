import { TILE_SIZE } from "../src/core/gameConstants.js";
import { groundEffectsDatabase, GROUND_EFFECT_DECAY_STAGE_MS } from "../src/data/groundEffectsDatabase.js";
import { createItemCooldownState, getUseCooldownGroup } from "../src/items/itemCooldown.js";
import { getItemData } from "../src/items/itemModel.js";
import { startPlayerRegenerationTimers } from "../src/player/playerRegeneration.js";
import { playerClassesDatabase } from "../src/data/playerClassesDatabase.js";
import { allocateGroundEffectUid } from "../src/state/uidAllocator.js";
import { hasLineOfSightBetweenTiles } from "../src/world/pathfinding.js";
import { getWorldChunkForTilePosition, isTiledCollisionAtTile } from "../src/world/worldCoordinates.js";

const isNear = (source, target, range) => {
  if (!source || !target || source.z !== target.z) {
    return false;
  }
  return (
    Math.abs(source.x / TILE_SIZE - target.x / TILE_SIZE) <= range &&
    Math.abs(source.y / TILE_SIZE - target.y / TILE_SIZE) <= range
  );
};

export const createServerPlayerItemUse = ({
  player,
  inventory,
  worldMapsByZ,
  groundEffects,
  monsters,
  players,
  executeRuneDamage,
}) => {
  const cooldowns = createItemCooldownState(player.cooldowns);

  const consumeOne = (source, item) => {
    if (item.quantity > 1) {
      item.quantity--;
      return true;
    }
    return Boolean(inventory.removeItem(source));
  };

  const addOrRefreshGroundEffect = (groundEffectId, x, y, z, now) => {
    if (!(groundEffectId in groundEffectsDatabase)) {
      return null;
    }
    const existing = groundEffects.getAt(x, y, z);
    if (existing) {
      existing.groundEffectId = groundEffectId;
      existing.decayStage = 0;
      existing.nextDecayAt = now + GROUND_EFFECT_DECAY_STAGE_MS;
      return existing;
    }
    const groundEffect = {
      uid: allocateGroundEffectUid(),
      groundEffectId,
      x,
      y,
      z,
      decayStage: 0,
      nextDecayAt: now + GROUND_EFFECT_DECAY_STAGE_MS,
    };
    return groundEffects.add(groundEffect) ? groundEffect : null;
  };

  const executeFood = (item, source, useData, requestedAt) => {
    if (!Number.isFinite(useData.sanity) || player.sanity + useData.sanity > player.maxSanity) {
      return { success: false, reason: "sanity-full" };
    }
    if (!consumeOne(source, item)) {
      return { success: false, reason: "item-consume-failed" };
    }
    const shouldStartRegeneration = player.sanity <= 0 || player.regeneration.nextHealthRegenAt === 0;
    player.sanity += useData.sanity;
    if (shouldStartRegeneration) {
      const classData = playerClassesDatabase[player.classId] ?? playerClassesDatabase.noClass;
      startPlayerRegenerationTimers(player, classData.regeneration, requestedAt);
    }
    return {
      success: true,
      changes: { itemUid: item.uid, sanity: player.sanity },
      events: [{ type: "item-use-resolved", action: "eat", itemUid: item.uid, sfx: "eat" }],
    };
  };

  const executeTorch = (item, requestedAt) => {
    const lightSource = getItemData(item.itemId)?.lightSource;
    if (!lightSource || !Number.isFinite(item.fuelRemainingMs)) {
      return { success: false, reason: "invalid-torch" };
    }
    if (item.isLit) {
      const elapsed = Math.max(requestedAt - (item.lastFuelUpdateAt || requestedAt), 0);
      item.fuelRemainingMs = Math.max(item.fuelRemainingMs - elapsed, 0);
      item.isLit = false;
      item.lastFuelUpdateAt = 0;
    } else {
      if (item.fuelRemainingMs <= 0) {
        return { success: false, reason: "torch-burned-out" };
      }
      item.isLit = true;
      item.lastFuelUpdateAt = requestedAt;
    }
    return {
      success: true,
      changes: { itemUid: item.uid, isLit: item.isLit, fuelRemainingMs: item.fuelRemainingMs },
      events: [{ type: "item-use-resolved", action: "toggleTorch", itemUid: item.uid }],
    };
  };

  const executePotion = (item, useData, target, requestedAt) => {
    let restoredAmount = 0;
    let groundEffect = null;
    if (target?.targetType === "self" && target.playerUid === player.uid) {
      const maximumStat = useData.restoreStat === "hp" ? "maxHp" : "maxMana";
      if (!Number.isFinite(player[useData.restoreStat]) || player[useData.restoreStat] >= player[maximumStat]) {
        return { success: false, reason: useData.restoreStat === "hp" ? "fullHealth" : "fullMana" };
      }
      restoredAmount = Math.min(useData.restoreAmount, player[maximumStat] - player[useData.restoreStat]);
      player[useData.restoreStat] += restoredAmount;
    } else if (target?.targetType === "tile") {
      const worldMap = worldMapsByZ.get(target.z);
      const col = target.x / TILE_SIZE;
      const row = target.y / TILE_SIZE;
      if (
        !isNear(player, target, useData.range) ||
        !Number.isInteger(col) ||
        !Number.isInteger(row) ||
        !getWorldChunkForTilePosition(worldMap, col, row) ||
        isTiledCollisionAtTile(worldMap, col, row)
      ) {
        return { success: false, reason: "target-out-of-range" };
      }
      groundEffect = addOrRefreshGroundEffect(useData.groundEffectId, target.x, target.y, target.z, requestedAt);
      if (!groundEffect) {
        return { success: false, reason: "cannot-pour-potion" };
      }
    } else {
      return { success: false, reason: "invalid-target" };
    }
    if (!getItemData(useData.emptyItemId)) {
      return { success: false, reason: "invalid-empty-bottle" };
    }
    item.itemId = useData.emptyItemId;
    return {
      success: true,
      changes: {
        itemUid: item.uid,
        itemId: item.itemId,
        restoredAmount,
        restoreStat: useData.restoreStat,
        groundEffectUid: groundEffect?.uid ?? null,
      },
      events: [{
        type: "item-use-resolved",
        action: "drinkPotion",
        itemUid: item.uid,
        restoredAmount,
        groundEffectUid: groundEffect?.uid ?? null,
      }],
    };
  };

  const executeRune = (item, source, useData, target) => {
    const targetEntity = target?.targetType === "monster"
      ? monsters.get(target.monsterUid)
      : target?.targetType === "player"
        ? players.get(target.playerUid)
        : null;
    if (!targetEntity || targetEntity === player || targetEntity.hp <= 0 || !isNear(player, targetEntity, useData.range)) {
      return { success: false, reason: "target-out-of-range" };
    }
    const worldMap = worldMapsByZ.get(player.z);
    if (!hasLineOfSightBetweenTiles(
      worldMap,
      { col: player.x / TILE_SIZE, row: player.y / TILE_SIZE },
      { col: targetEntity.x / TILE_SIZE, row: targetEntity.y / TILE_SIZE },
    )) {
      return { success: false, reason: "line-of-sight-blocked" };
    }
    const damageResult = executeRuneDamage(targetEntity, useData, target.targetType);
    if (!damageResult?.success) {
      return damageResult ?? { success: false, reason: "damage-failed" };
    }
    item.charges--;
    if (item.charges <= 0 && !inventory.removeItem(source)) {
      return { success: false, reason: "item-consume-failed" };
    }
    return {
      ...damageResult,
      changes: { ...damageResult.changes, itemUid: item.uid, charges: Math.max(item.charges, 0) },
      events: [
        { type: "item-use-resolved", action: "attackRune", itemUid: item.uid, cooldownGroup: useData.cooldownGroup },
        ...(damageResult.events ?? []),
      ],
    };
  };

  const execute = (item, useData, payload) => {
    const cooldownGroup = getUseCooldownGroup(useData);
    if (cooldownGroup && !cooldowns.isReady(cooldownGroup, payload.requestedAt)) {
      return { success: false, reason: "cooldown" };
    }
    let result = null;
    if (useData.action === "eat" && payload.target === null) {
      result = executeFood(item, payload.source, useData, payload.requestedAt);
    } else if (useData.action === "toggleTorch" && payload.target === null) {
      result = executeTorch(item, payload.requestedAt);
    } else if (useData.action === "drinkPotion") {
      result = executePotion(item, useData, payload.target, payload.requestedAt);
    } else if (useData.action === "attackRune") {
      result = executeRune(item, payload.source, useData, payload.target);
    } else {
      result = { success: false, reason: "unsupported-item-action" };
    }
    if (result.success && cooldownGroup) {
      cooldowns.begin(cooldownGroup, payload.requestedAt);
    }
    if (result.success) {
      const worldRootUid = inventory.getWorldRootUidForLocation(payload.source);
      if (Number.isInteger(worldRootUid)) {
        result.changes = {
          ...(result.changes ?? {}),
          changedWorldContainerUids: [
            ...new Set([...(result.changes?.changedWorldContainerUids ?? []), worldRootUid]),
          ],
        };
      }
    }
    return result;
  };

  return Object.freeze({ cooldowns, execute });
};
