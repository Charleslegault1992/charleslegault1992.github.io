import { TILE_SIZE } from "../src/core/gameConstants.js";
import { groundEffectsDatabase, GROUND_EFFECT_DECAY_STAGE_MS } from "../src/data/groundEffectsDatabase.js";
import { createItemCooldownState, getUseCooldownGroup } from "../src/items/itemCooldown.js";
import { getItemData } from "../src/items/itemModel.js";
import { startPlayerRegenerationTimers } from "../src/player/playerRegeneration.js";
import { playerClassesDatabase } from "../src/data/playerClassesDatabase.js";
import { allocateGroundEffectUid } from "../src/state/uidAllocator.js";
import { hasLineOfSightBetweenTiles } from "../src/world/pathfinding.js";
import { getWorldChunkForTilePosition, isWorldCollisionAtTile } from "../src/world/worldCoordinates.js";

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
  onFieldCreated = () => {},
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
    const groundEffectData = groundEffectsDatabase[groundEffectId];
    if (!groundEffectData) {
      return null;
    }
    const existing = groundEffects
      .getAllAt(x, y, z)
      .find((effect) => groundEffectsDatabase[effect.groundEffectId]?.kind === groundEffectData.kind);
    if (existing) {
      existing.groundEffectId = groundEffectId;
      existing.decayStage = 0;
      existing.isPermanent = false;
      existing.ownerUid = groundEffectData.kind === "field" ? player.uid : null;
      existing.nextDecayAt = now + (groundEffectData.decayStageMs ?? GROUND_EFFECT_DECAY_STAGE_MS);
      return existing;
    }
    const groundEffect = {
      uid: allocateGroundEffectUid(),
      groundEffectId,
      x,
      y,
      z,
      decayStage: 0,
      isPermanent: false,
      ownerUid: groundEffectData.kind === "field" ? player.uid : null,
      nextDecayAt: now + (groundEffectData.decayStageMs ?? GROUND_EFFECT_DECAY_STAGE_MS),
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
        isWorldCollisionAtTile(worldMap, col, row)
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
        {
          type: "item-use-resolved",
          action: "attackRune",
          itemUid: item.uid,
          cooldownGroup: useData.cooldownGroup,
          damageType: useData.damageType ?? "fire",
        },
        ...(damageResult.events ?? []).map((event) => ({
          ...event,
          attackKind: "rune",
          damageType: useData.damageType ?? "fire",
        })),
      ],
    };
  };

  const getValidRuneTileTarget = (target, useData) => {
    if (target?.targetType !== "tile" || !isNear(player, target, useData.range)) {
      return null;
    }
    const worldMap = worldMapsByZ.get(target.z);
    const col = target.x / TILE_SIZE;
    const row = target.y / TILE_SIZE;
    if (
      !worldMap ||
      !Number.isInteger(col) ||
      !Number.isInteger(row) ||
      !getWorldChunkForTilePosition(worldMap, col, row) ||
      isWorldCollisionAtTile(worldMap, col, row) ||
      !hasLineOfSightBetweenTiles(
        worldMap,
        { col: player.x / TILE_SIZE, row: player.y / TILE_SIZE },
        { col, row },
      )
    ) {
      return null;
    }
    return { worldMap, col, row };
  };

  const consumeRuneCharge = (item, source) => {
    item.charges--;
    return item.charges > 0 || Boolean(inventory.removeItem(source));
  };

  const executeHealingRune = (item, source, useData, target) => {
    const targetPlayer = target?.targetType === "self"
      ? player
      : target?.targetType === "player"
        ? players.get(target.playerUid)
        : null;
    if (
      !targetPlayer ||
      targetPlayer.hp <= 0 ||
      !Number.isFinite(targetPlayer.maxHp) ||
      !Number.isFinite(useData.healAmount) ||
      useData.healAmount <= 0 ||
      !isNear(player, targetPlayer, useData.range)
    ) {
      return { success: false, reason: "target-out-of-range" };
    }
    if (targetPlayer.hp >= targetPlayer.maxHp) {
      return { success: false, reason: "fullHealth" };
    }
    const worldMap = worldMapsByZ.get(player.z);
    if (!hasLineOfSightBetweenTiles(
      worldMap,
      { col: player.x / TILE_SIZE, row: player.y / TILE_SIZE },
      { col: targetPlayer.x / TILE_SIZE, row: targetPlayer.y / TILE_SIZE },
    )) {
      return { success: false, reason: "line-of-sight-blocked" };
    }
    if (!consumeRuneCharge(item, source)) {
      return { success: false, reason: "item-consume-failed" };
    }
    const restoredAmount = Math.min(useData.healAmount, targetPlayer.maxHp - targetPlayer.hp);
    targetPlayer.hp += restoredAmount;
    return {
      success: true,
      changes: {
        itemUid: item.uid,
        charges: Math.max(item.charges, 0),
        targetPlayerUid: targetPlayer.uid,
        hp: targetPlayer.hp,
        restoredAmount,
      },
      events: [{
        type: "item-use-resolved",
        action: "healRune",
        itemUid: item.uid,
        targetPlayerUid: targetPlayer.uid,
        restoredAmount,
        floatingTextType: "heal",
        cooldownGroup: useData.cooldownGroup,
        sfx: "RuneUse",
      }],
    };
  };

  const executeCreateFieldRune = (item, source, useData, target, requestedAt) => {
    if (!getValidRuneTileTarget(target, useData) || groundEffectsDatabase[useData.groundEffectId]?.kind !== "field") {
      return { success: false, reason: "target-out-of-range" };
    }
    const existingField = groundEffects
      .getAllAt(target.x, target.y, target.z)
      .some((effect) => groundEffectsDatabase[effect.groundEffectId]?.kind === "field");
    if (existingField) {
      return { success: false, reason: "field-occupied" };
    }
    if (!consumeRuneCharge(item, source)) {
      return { success: false, reason: "item-consume-failed" };
    }
    const groundEffect = addOrRefreshGroundEffect(useData.groundEffectId, target.x, target.y, target.z, requestedAt);
    if (!groundEffect) {
      return { success: false, reason: "field-create-failed" };
    }
    onFieldCreated(groundEffect, requestedAt);
    return {
      success: true,
      changes: { itemUid: item.uid, charges: Math.max(item.charges, 0), groundEffectUid: groundEffect.uid },
      events: [{
        type: "item-use-resolved",
        action: "createField",
        itemUid: item.uid,
        groundEffectUid: groundEffect.uid,
        damageType: groundEffectsDatabase[useData.groundEffectId].damageType,
        x: target.x,
        y: target.y,
        z: target.z,
      }],
    };
  };

  const executeDispelFieldRune = (item, source, useData, target) => {
    if (!getValidRuneTileTarget(target, useData)) {
      return { success: false, reason: "target-out-of-range" };
    }
    const groundEffect = groundEffects
      .getAllAt(target.x, target.y, target.z)
      .find((effect) => groundEffectsDatabase[effect.groundEffectId]?.kind === "field");
    if (groundEffectsDatabase[groundEffect?.groundEffectId]?.kind !== "field") {
      return { success: false, reason: "field-not-found" };
    }
    if (!consumeRuneCharge(item, source)) {
      return { success: false, reason: "item-consume-failed" };
    }
    if (!groundEffects.remove(groundEffect.uid)) {
      return { success: false, reason: "field-remove-failed" };
    }
    return {
      success: true,
      changes: { itemUid: item.uid, charges: Math.max(item.charges, 0), removedGroundEffectUid: groundEffect.uid },
      events: [{
        type: "item-use-resolved",
        action: "dispelField",
        itemUid: item.uid,
        removedGroundEffectUid: groundEffect.uid,
        x: target.x,
        y: target.y,
        z: target.z,
      }],
    };
  };

  const execute = (item, useData, payload) => {
    const cooldownGroup = getUseCooldownGroup(useData);
    if (cooldownGroup && !cooldowns.isReady(cooldownGroup, payload.requestedAt)) {
      return { success: false, reason: "cooldown" };
    }
    const worldRootUid = inventory.getWorldRootUidForLocation(payload.source);
    let result = null;
    if (useData.action === "eat" && payload.target === null) {
      result = executeFood(item, payload.source, useData, payload.requestedAt);
    } else if (useData.action === "toggleTorch" && payload.target === null) {
      result = executeTorch(item, payload.requestedAt);
    } else if (useData.action === "drinkPotion") {
      result = executePotion(item, useData, payload.target, payload.requestedAt);
    } else if (useData.action === "attackRune") {
      result = executeRune(item, payload.source, useData, payload.target);
    } else if (useData.action === "healRune") {
      result = executeHealingRune(item, payload.source, useData, payload.target);
    } else if (useData.action === "createField") {
      result = executeCreateFieldRune(item, payload.source, useData, payload.target, payload.requestedAt);
    } else if (useData.action === "dispelField") {
      result = executeDispelFieldRune(item, payload.source, useData, payload.target);
    } else {
      result = { success: false, reason: "unsupported-item-action" };
    }
    if (result.success && cooldownGroup) {
      cooldowns.begin(cooldownGroup, payload.requestedAt);
    }
    if (result.success) {
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
