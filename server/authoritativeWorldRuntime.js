import { createGameSimulation } from "../src/simulation/gameSimulation.js";
import { createWorldChangeJournal } from "../src/simulation/worldChangeJournal.js";
import {
  createWorldDelta,
  createWorldSnapshot,
  serializeGroundEffectState,
  serializeMonsterState,
  serializeNpcState,
  serializePlayerPrivateState,
  serializePlayerPublicState,
  serializeWorldChunk,
  serializeWorldItem,
} from "../src/simulation/worldSnapshot.js";
import { createPlayerState } from "../src/state/playerState.js";
import {
  MONSTER_ATTACK_COOLDOWN_MS,
  CORPSE_DECAY_COOLDOWN_MS,
  DECAY_REFRESH_COOLDOWN_MS,
  PLAYER_ATTACK_COOLDOWN_MS,
  TILE_SIZE,
} from "../src/core/gameConstants.js";
import { getPlayerMovementTiming } from "../src/player/playerMovementTiming.js";
import { applyPlayerStarterKit } from "../src/player/playerStarterKit.js";
import {
  calculateMonsterAttackResult,
  calculatePlayerAttackResult,
  calculateRuneAttackResult,
  getEquippedWeaponCombatData,
  getPlayerAttackRange,
} from "../src/combat/playerCombatModel.js";
import { applyDamageToMonsterHealth } from "../src/combat/monsterHealth.js";
import { applyDamageToPlayer } from "../src/combat/playerHealth.js";
import { getRandomInt } from "../src/core/mathUtils.js";
import { createGroundItem, createItemInstance } from "../src/items/itemFactory.js";
import { getItemData } from "../src/items/itemModel.js";
import { getMonsterData } from "../src/monsters/monsterModel.js";
import { applyMonsterExperienceReward, generateMonsterLoot } from "../src/monsters/monsterRewards.js";
import {
  applyPlayerAttackSkillProgression,
  applyPlayerLevelProgression,
  applyPlayerShieldingSkillProgression,
} from "../src/player/playerProgressionModel.js";
import { getTileMovementCost, hasLineOfSightBetweenTiles } from "../src/world/pathfinding.js";
import {
  getChunkPositionFromWorldPosition,
  getWorldChunkForTilePosition,
  isTiledCollisionAtTile,
} from "../src/world/worldCoordinates.js";
import {
  findInteractableAtTile,
  findTransitionAtTile,
  isPlayerNearTiledObject,
} from "../src/world/tiledWorldObjects.js";
import { applyPlayerWorldTransitionState } from "../src/world/worldTransitions.js";
import { hydratePlayerFromPersistence } from "./playerPersistence.js";
import { createServerWorldEntities } from "./serverWorldEntities.js";
import { createServerPlayerInventory } from "./serverPlayerInventory.js";
import { createServerPlayerItemUse } from "./serverPlayerItemUse.js";
import { spellsDatabase } from "../src/spellDatabase.js";
import { executePlayerSpellCast } from "../src/spells/spellCasting.js";
import { executeRewardChestTransaction } from "../src/quests/rewardChestTransaction.js";
import { createServerNpcConversationService } from "./serverNpcConversationService.js";
import { createServerMonsterAi } from "./serverMonsterAi.js";
import { advancePlayerRegeneration } from "../src/player/playerRegeneration.js";
import { playerClassesDatabase } from "../src/data/playerClassesDatabase.js";
import { applyPlayerDeathState } from "../src/player/playerDeath.js";
import { GROUND_EFFECT_DECAY_STAGE_MS, groundEffectsDatabase } from "../src/data/groundEffectsDatabase.js";
import { allocateGroundEffectUid } from "../src/state/uidAllocator.js";
import {
  PVP_AGGRESSION_DURATION_MS,
  applyUnjustifiedPvpAggression,
  canInitiatePlayerPvpAttack,
  clearWhiteSkullOnDeath,
  expirePlayerPvpState,
  hasActivePlayerSkull,
  recordUnjustifiedPlayerKill,
} from "../src/combat/playerPvpState.js";

const AUTOSAVE_INTERVAL_MS = 30000;
const AUTOSAVE_RETRY_DELAY_MS = 5000;
const MAX_AUTOSAVES_PER_TICK = 2;
const COMBAT_LOGOUT_DURATION_MS = 2 * 60 * 1000;
const NETWORK_MOVEMENT_COOLDOWN_TOLERANCE_MS = 50;
const PLAYER_SPAWN_TILE_OFFSETS = Object.freeze([
  Object.freeze({ col: 0, row: 0 }),
  Object.freeze({ col: 1, row: 0 }),
  Object.freeze({ col: 0, row: 1 }),
  Object.freeze({ col: 1, row: 1 }),
]);

const findPlayerSpawn = (worldMap, spawnId) => {
  for (const chunk of worldMap?.chunksByKey?.values() ?? []) {
    const spawn = chunk.spawns?.find(
      (candidate) => candidate.properties?.spawnType === "player" && candidate.properties?.spawnId === spawnId,
    );
    if (spawn) {
      return spawn;
    }
  }
  return null;
};

const getVisibleChunkKeys = (worldMap, x, y, radius = 1) => {
  const center = getChunkPositionFromWorldPosition(x, y);
  if (!center || !(worldMap?.chunksByKey instanceof Map)) {
    return [];
  }
  const keys = [];
  for (let chunkY = center.chunkY - radius; chunkY <= center.chunkY + radius; chunkY++) {
    for (let chunkX = center.chunkX - radius; chunkX <= center.chunkX + radius; chunkX++) {
      const key = `${worldMap.z}:${chunkX}:${chunkY}`;
      if (worldMap.chunksByKey.has(key)) {
        keys.push(key);
      }
    }
  }
  return keys;
};

export const createAuthoritativeWorldRuntime = ({
  worldMapsByZ,
  characterRepository = null,
  chatModerationService = null,
  allowCharacterAutoCreate = false,
  now = () => Date.now(),
  combatRandom = null,
}) => {
  if (!(worldMapsByZ instanceof Map) || typeof now !== "function") {
    throw new TypeError("The authoritative world requires loaded maps and a clock.");
  }

  const playersByUid = new Map();
  const visiblePlayersByChunkKey = new Map();
  const serializedWorldChunksByKey = new Map();
  const pvpAggressionExpiresAtByPair = new Map();
  const combatLogoutExpiresAtByPlayerUid = new Map();
  const offlineCombatExpiresAtByPlayerUid = new Map();
  const connectedPlayerUids = new Set();
  const journal = createWorldChangeJournal({ maxEntries: 512 });
  let currentServerTime = now();
  let isInitializingWorldEntities = true;
  let nextPlayerTileStackOrder = 1;
  let indexedPlayerRevision = -1;
  let nextWorldDecayAt = 0;
  let nextAutosaveSweepAt = Number.POSITIVE_INFINITY;

  for (const worldMap of worldMapsByZ.values()) {
    for (const chunk of worldMap.chunksByKey.values()) {
      const serializedChunk = serializeWorldChunk(chunk);
      if (serializedChunk) {
        serializedWorldChunksByKey.set(serializedChunk.key, serializedChunk);
      }
    }
  }

  const recordPlayerTileEntry = (player) => {
    if (!player) {
      return false;
    }
    player.tileStackOrder = nextPlayerTileStackOrder++;
    return true;
  };

  const executePlayerWorldTransition = (player, transition) => {
    const result = applyPlayerWorldTransitionState(player, transition, worldMapsByZ);
    if (result.success) {
      recordPlayerTileEntry(player);
    }
    return result;
  };

  const getPvpAggressionKey = (attackerUid, targetUid) => `${attackerUid}\u0000${targetUid}`;

  const hasActivePvpAggression = (attackerUid, targetUid) => {
    const aggressionKey = getPvpAggressionKey(attackerUid, targetUid);
    const expiresAt = pvpAggressionExpiresAtByPair.get(aggressionKey) ?? 0;
    if (expiresAt <= currentServerTime) {
      pvpAggressionExpiresAtByPair.delete(aggressionKey);
      return false;
    }
    return true;
  };

  const recordPvpAggression = (attackerUid, targetUid) => {
    pvpAggressionExpiresAtByPair.set(
      getPvpAggressionKey(attackerUid, targetUid),
      currentServerTime + PVP_AGGRESSION_DURATION_MS,
    );
  };

  const recordPlayerCombatActivity = (playerUid) => {
    if (typeof playerUid !== "string" || !playersByUid.has(playerUid)) {
      return false;
    }
    const expiresAt = currentServerTime + COMBAT_LOGOUT_DURATION_MS;
    combatLogoutExpiresAtByPlayerUid.set(playerUid, expiresAt);
    if (offlineCombatExpiresAtByPlayerUid.has(playerUid)) {
      offlineCombatExpiresAtByPlayerUid.set(playerUid, expiresAt);
    }
    return true;
  };

  const isPlayerInPvpCombat = (playerUid) => {
    for (const [aggressionKey, expiresAt] of pvpAggressionExpiresAtByPair) {
      if (expiresAt <= currentServerTime) {
        pvpAggressionExpiresAtByPair.delete(aggressionKey);
        continue;
      }
      const [attackerUid, targetUid] = aggressionKey.split("\u0000");
      if (attackerUid === playerUid || targetUid === playerUid) {
        return true;
      }
    }
    return false;
  };

  const clearPlayerPvpAggressions = (playerUid) => {
    for (const aggressionKey of pvpAggressionExpiresAtByPair.keys()) {
      const [attackerUid, targetUid] = aggressionKey.split("\u0000");
      if (attackerUid === playerUid || targetUid === playerUid) {
        pvpAggressionExpiresAtByPair.delete(aggressionKey);
      }
    }
  };

  const pruneExpiredPvpAggressions = () => {
    for (const [aggressionKey, expiresAt] of pvpAggressionExpiresAtByPair) {
      if (expiresAt <= currentServerTime) {
        pvpAggressionExpiresAtByPair.delete(aggressionKey);
      }
    }
  };
  const worldEntities = createServerWorldEntities(worldMapsByZ, {
    playersByUid,
    now,
    onMonsterSpawned: (monster) => {
      if (!isInitializingWorldEntities) {
        journal.record({
          serverTime: currentServerTime,
          upserts: { monsters: [serializeMonsterState(monster)] },
          events: [
            {
              type: "monster-respawned",
              monsterUid: monster.uid,
              x: monster.x,
              y: monster.y,
              z: monster.z,
            },
          ],
        });
      }
    },
  });
  isInitializingWorldEntities = false;
  const simulationsByPlayerUid = new Map();
  const inventoriesByPlayerUid = new Map();
  const sessionsByPlayerUid = new Map();
  const markPlayerPersistenceDirty = (playerUid) => {
    const persistenceSession = sessionsByPlayerUid.get(playerUid);
    if (persistenceSession) {
      persistenceSession.isDirty = true;
      nextAutosaveSweepAt = Math.min(nextAutosaveSweepAt, persistenceSession.nextSaveAttemptAt);
    }
  };
  const npcConversationService = createServerNpcConversationService({
    npcs: worldEntities.npcs,
    playersByUid,
    getInventory: (playerUid) => inventoriesByPlayerUid.get(playerUid) ?? null,
  });
  const monsterAi = createServerMonsterAi({
    worldMapsByZ,
    playersByUid,
    monsters: worldEntities.monsters,
    npcs: worldEntities.npcs,
    worldItems: worldEntities.worldItems,
  });

  const addOrRefreshGroundEffect = (groundEffectId, x, y, z, decayStage = 0) => {
    if (!(groundEffectId in groundEffectsDatabase)) {
      return null;
    }
    const existing = worldEntities.groundEffects.getAt(x, y, z);
    if (existing) {
      existing.groundEffectId = groundEffectId;
      existing.decayStage = decayStage;
      existing.nextDecayAt = currentServerTime + GROUND_EFFECT_DECAY_STAGE_MS;
      return existing;
    }
    const groundEffect = {
      uid: allocateGroundEffectUid(),
      groundEffectId,
      x,
      y,
      z,
      decayStage,
      nextDecayAt: currentServerTime + GROUND_EFFECT_DECAY_STAGE_MS,
    };
    return worldEntities.groundEffects.add(groundEffect) ? groundEffect : null;
  };

  const findAvailableSpawnPosition = (worldMap, spawn) => {
    const validSpawnPositions = PLAYER_SPAWN_TILE_OFFSETS.flatMap((offset) => {
      const col = spawn.col + offset.col;
      const row = spawn.row + offset.row;
      if (!getWorldChunkForTilePosition(worldMap, col, row) || isTiledCollisionAtTile(worldMap, col, row)) {
        return [];
      }
      return [{ x: col * TILE_SIZE, y: row * TILE_SIZE }];
    });
    for (const position of validSpawnPositions) {
      const occupiedByPlayer = [...playersByUid.values()].some(
        (player) => player.z === worldMap.z && player.x === position.x && player.y === position.y,
      );
      const occupiedByWorldCreature =
        worldEntities.monsters.getAt(position.x, position.y, worldMap.z) ||
        worldEntities.npcs.getAt(position.x, position.y, worldMap.z);
      if (!occupiedByPlayer && !occupiedByWorldCreature) {
        return position;
      }
    }
    return (
      validSpawnPositions.find(
        (position) =>
          !worldEntities.monsters.getAt(position.x, position.y, worldMap.z) &&
          !worldEntities.npcs.getAt(position.x, position.y, worldMap.z),
      ) ?? null
    );
  };

  const isPlayerDestinationAvailable = (movingPlayer, payload) => {
    const worldMap = worldMapsByZ.get(movingPlayer.z);
    const fromTile = { col: payload.fromX / TILE_SIZE, row: payload.fromY / TILE_SIZE };
    const toTile = { col: payload.toX / TILE_SIZE, row: payload.toY / TILE_SIZE };
    if (
      !Number.isInteger(fromTile.col) ||
      !Number.isInteger(fromTile.row) ||
      !Number.isInteger(toTile.col) ||
      !Number.isInteger(toTile.row) ||
      getTileMovementCost(fromTile, toTile) === null ||
      !getWorldChunkForTilePosition(worldMap, toTile.col, toTile.row) ||
      isTiledCollisionAtTile(worldMap, toTile.col, toTile.row)
    ) {
      return false;
    }
    for (const player of playersByUid.values()) {
      if (
        player.uid !== movingPlayer.uid &&
        player.z === movingPlayer.z &&
        player.x === payload.toX &&
        player.y === payload.toY
      ) {
        return false;
      }
    }
    return (
      !worldEntities.monsters.getAt(payload.toX, payload.toY, movingPlayer.z) &&
      !worldEntities.npcs.getAt(payload.toX, payload.toY, movingPlayer.z)
    );
  };

  const canPlayerAttackTarget = (player, target) => {
    if (!player || !target || player.uid === target.uid || player.z !== target.z) {
      return false;
    }
    const range = getPlayerAttackRange(player);
    const playerCol = player.x / TILE_SIZE;
    const playerRow = player.y / TILE_SIZE;
    const monsterCol = target.x / TILE_SIZE;
    const monsterRow = target.y / TILE_SIZE;
    if (
      !Number.isInteger(playerCol) ||
      !Number.isInteger(playerRow) ||
      !Number.isInteger(monsterCol) ||
      !Number.isInteger(monsterRow) ||
      Math.abs(playerCol - monsterCol) > range ||
      Math.abs(playerRow - monsterRow) > range
    ) {
      return false;
    }
    if (!getEquippedWeaponCombatData(player)?.projectileItemId) {
      return true;
    }
    return hasLineOfSightBetweenTiles(
      worldMapsByZ.get(player.z),
      { col: playerCol, row: playerRow },
      { col: monsterCol, row: monsterRow },
    );
  };

  const canPlayerAttackMonster = (player, monster) => canPlayerAttackTarget(player, monster);
  const canPlayerAttackPlayer = (player, target) => canPlayerAttackTarget(player, target);

  const resolvePlayerDamageToMonster = (player, monster, attackResult, initialEvents = []) => {
    const targetRenderSnapshot = {
      uid: monster.uid,
      monsterId: monster.monsterId,
      x: monster.x,
      y: monster.y,
      z: monster.z,
      renderX: monster.renderX,
      renderY: monster.renderY,
    };
    const healthResult =
      attackResult.finalDamage > 0
        ? applyDamageToMonsterHealth(monster, attackResult.finalDamage)
        : { success: false, damageApplied: 0, hp: monster.hp, didDie: false };
    const monsterData = getMonsterData(monster.monsterId);
    let corpse = null;
    let lootContent = [];
    let experienceReward = 0;
    let levelProgression = null;
    let groundEffect = null;
    recordPlayerCombatActivity(player.uid);
    if (healthResult.success) {
      groundEffect = addOrRefreshGroundEffect(
        monsterData?.bloodEffectId,
        monster.x,
        monster.y,
        monster.z,
        healthResult.didDie ? 0 : 1,
      );
    }
    if (healthResult.didDie) {
      const randomInt = combatRandom?.getInt ?? getRandomInt;
      const itemOptions = {
        decayingItems: worldEntities.decayingItems,
        now: () => currentServerTime,
      };
      lootContent = generateMonsterLoot(monsterData, {
        randomInt,
        createItem: (itemId, quantity) => createItemInstance(itemId, quantity, [], itemOptions),
      });
      corpse = createGroundItem(
        monsterData?.corpseItemId,
        1,
        monster.x,
        monster.y,
        monster.z,
        lootContent,
        itemOptions,
      );
      if (!corpse || !worldEntities.worldItems.add(corpse)) {
        corpse = null;
      }
      experienceReward = applyMonsterExperienceReward(player, monsterData);
      if (experienceReward > 0) {
        levelProgression = applyPlayerLevelProgression(player);
      }
      worldEntities.respawnSystem.decreaseAliveCount(monster);
      worldEntities.respawnSystem.schedule(monster.spawnId, currentServerTime);
      worldEntities.monsters.remove(monster.uid);
    }
    const events = [...initialEvents];
    if (healthResult.success) {
      events.push({
        type: "monster-damage-resolved",
        playerUid: player.uid,
        monsterUid: monster.uid,
        monsterId: monster.monsterId,
        damageApplied: healthResult.damageApplied,
        hp: healthResult.hp,
        textType: attackResult.textType,
        didDie: healthResult.didDie,
        corpseUid: corpse?.uid ?? null,
        lootContent,
        experienceReward,
        levelProgression,
        groundEffectUid: groundEffect?.uid ?? null,
        targetRenderSnapshot,
      });
    }
    return {
      success: true,
      changes: {
        monsterUid: monster.uid,
        finalDamage: attackResult.finalDamage,
        hp: healthResult.hp,
        didHit: attackResult.didHit,
        didDie: healthResult.didDie,
        corpseUid: corpse?.uid ?? null,
        experienceReward,
        levelProgression,
        groundEffectUid: groundEffect?.uid ?? null,
      },
      events,
    };
  };

  const consumePlayerAttackAmmunition = (player) => {
    const ammunitionItemId = getEquippedWeaponCombatData(player)?.ammunitionItemId;
    if (!ammunitionItemId) {
      return true;
    }
    const ammunition = player.equipment.shield;
    if (ammunition?.itemId !== ammunitionItemId || ammunition.quantity <= 0) {
      return false;
    }
    if (ammunition.quantity > 1) {
      ammunition.quantity -= 1;
    } else {
      player.equipment.shield = null;
    }
    return true;
  };

  const executePlayerAttack = (player, monster) => {
    if (!consumePlayerAttackAmmunition(player)) {
      return { success: false, reason: "ammunition-required" };
    }
    const attackResult = calculatePlayerAttackResult(monster, player, combatRandom ?? undefined);
    const skillProgression = applyPlayerAttackSkillProgression(player, attackResult, currentServerTime);
    return resolvePlayerDamageToMonster(player, monster, attackResult, [
      {
        type: "player-attack-resolved",
        playerUid: player.uid,
        monsterUid: monster.uid,
        attackResult,
        skillProgression,
        targetRenderSnapshot: {
          uid: monster.uid,
          monsterId: monster.monsterId,
          x: monster.x,
          y: monster.y,
          z: monster.z,
          renderX: monster.renderX,
          renderY: monster.renderY,
        },
      },
    ]);
  };

  const resolvePlayerDeath = (target) => {
    const deathPosition = { x: target.x, y: target.y, z: target.z };
    const backpack = target.equipment.backpack;
    if (backpack) {
      target.equipment.backpack = null;
    }
    let corpse = createGroundItem("playerCorpse", 1, target.x, target.y, target.z, backpack ? [backpack] : [], {
      decayingItems: worldEntities.decayingItems,
      now: () => currentServerTime,
    });
    if (!corpse || !worldEntities.worldItems.add(corpse)) {
      target.equipment.backpack = backpack;
      corpse = null;
    }
    const spawnWorldMap = worldMapsByZ.get(target.spawn.z);
    const spawn = findPlayerSpawn(spawnWorldMap, target.spawn.spawnId);
    const spawnPosition = spawn ? findAvailableSpawnPosition(spawnWorldMap, spawn) : null;
    if (spawnPosition) {
      const deathStateResult = applyPlayerDeathState(target, { ...spawnPosition, z: target.spawn.z });
      if (deathStateResult.success) {
        recordPlayerTileEntry(target);
      }
    }
    for (const monster of worldEntities.monsters.values()) {
      if (monster.targetUid === target.uid) {
        monster.targetUid = null;
        monster.path = [];
        monster.state = "wander";
      }
    }
    clearWhiteSkullOnDeath(target);
    clearPlayerPvpAggressions(target.uid);
    combatLogoutExpiresAtByPlayerUid.delete(target.uid);
    if (offlineCombatExpiresAtByPlayerUid.has(target.uid)) {
      offlineCombatExpiresAtByPlayerUid.set(target.uid, currentServerTime);
    }
    return {
      corpse,
      event: {
        type: "player-died",
        playerUid: target.uid,
        corpseUid: corpse?.uid ?? null,
        deathPosition,
        spawnPosition: { x: target.x, y: target.y, z: target.z },
      },
    };
  };

  const resolvePlayerPvpDamage = (player, target, attackResult, eventType) => {
    const targetRenderSnapshot = {
      uid: target.uid,
      x: target.x,
      y: target.y,
      z: target.z,
      renderX: target.renderX,
      renderY: target.renderY,
    };
    const isRetaliation = hasActivePvpAggression(target.uid, player.uid);
    const isOpenPvpTarget = hasActivePlayerSkull(target, currentServerTime);
    const isUnjustifiedAttack = !isRetaliation && !isOpenPvpTarget;
    recordPvpAggression(player.uid, target.uid);
    recordPlayerCombatActivity(player.uid);
    recordPlayerCombatActivity(target.uid);
    if (isUnjustifiedAttack) {
      applyUnjustifiedPvpAggression(player, currentServerTime);
    }
    if (attackResult.finalDamage > 0) {
      applyDamageToPlayer(target, attackResult.finalDamage);
    }
    if (target.hp <= 0 && isUnjustifiedAttack) {
      recordUnjustifiedPlayerKill(player, currentServerTime);
    }
    const deathResult = target.hp <= 0 ? resolvePlayerDeath(target) : null;
    const groundEffect = attackResult.finalDamage > 0
      ? addOrRefreshGroundEffect("blood", targetRenderSnapshot.x, targetRenderSnapshot.y, targetRenderSnapshot.z, deathResult ? 0 : 1)
      : null;
    return {
      success: true,
      changes: {
        targetPlayerUid: target.uid,
        finalDamage: attackResult.finalDamage,
        hp: target.hp,
        didHit: attackResult.didHit,
        didDie: deathResult !== null,
        corpseUid: deathResult?.corpse?.uid ?? null,
        pvp: structuredClone(player.pvp),
        groundEffectUid: groundEffect?.uid ?? null,
      },
      events: [
        {
          type: eventType,
          playerUid: player.uid,
          targetPlayerUid: target.uid,
          attackResult,
          isUnjustifiedAttack,
          attackerSkullType: player.pvp.skullType,
          targetRenderSnapshot,
          groundEffectUid: groundEffect?.uid ?? null,
        },
        ...(deathResult ? [deathResult.event] : []),
      ],
    };
  };

  const executePlayerPvpAttack = (player, target) => {
    if (!consumePlayerAttackAmmunition(player)) {
      return { success: false, reason: "ammunition-required" };
    }
    const attackResult = calculatePlayerAttackResult(target, player, combatRandom ?? undefined);
    const skillProgression = applyPlayerAttackSkillProgression(player, attackResult, currentServerTime);
    const result = resolvePlayerPvpDamage(
      player,
      target,
      attackResult,
      "player-pvp-attack-resolved",
    );
    if (result?.events?.[0]) {
      result.events[0].skillProgression = skillProgression;
    }
    return result;
  };

  const updateMonsterCombat = () => {
    const changedPlayers = new Map();
    const createdWorldItems = [];
    const changedGroundEffects = new Map();
    const events = [];
    for (const monster of worldEntities.monsters.values()) {
      const target = playersByUid.get(monster.targetUid);
      if (!target || monster.state !== "combat" || monster.z !== target.z || target.hp <= 0) {
        continue;
      }
      const isAdjacent = Math.abs(monster.x - target.x) <= TILE_SIZE && Math.abs(monster.y - target.y) <= TILE_SIZE;
      if (!isAdjacent || currentServerTime < monster.nextAttackTime) {
        continue;
      }
      const monsterData = getMonsterData(monster.monsterId);
      const attackResult = calculateMonsterAttackResult(monsterData?.combat, target, combatRandom ?? undefined);
      const skillProgression = applyPlayerShieldingSkillProgression(target, attackResult, currentServerTime);
      monster.nextAttackTime = currentServerTime + MONSTER_ATTACK_COOLDOWN_MS;
      if (attackResult.finalDamage > 0) {
        applyDamageToPlayer(target, attackResult.finalDamage);
        const bloodEffect = addOrRefreshGroundEffect("blood", target.x, target.y, target.z, target.hp <= 0 ? 0 : 1);
        if (bloodEffect) {
          changedGroundEffects.set(bloodEffect.uid, bloodEffect);
        }
      }
      recordPlayerCombatActivity(target.uid);
      if (target.hp <= 0) {
        const deathResult = resolvePlayerDeath(target);
        if (deathResult.corpse) {
          createdWorldItems.push(deathResult.corpse);
        }
        events.push(deathResult.event);
      }
      changedPlayers.set(target.uid, target);
      markPlayerPersistenceDirty(target.uid);
      events.push({
        type: "monster-attack-resolved",
        monsterUid: monster.uid,
        playerUid: target.uid,
        attackResult,
        skillProgression,
      });
    }
    return {
      changedPlayers: [...changedPlayers.values()],
      createdWorldItems,
      changedGroundEffects: [...changedGroundEffects.values()],
      events,
    };
  };

  const updateWorldDecay = () => {
    const upsertedWorldItems = [];
    const removedWorldItemUids = [];
    const upsertedGroundEffects = [];
    const removedGroundEffectUids = [];

    for (const effect of worldEntities.groundEffects.values()) {
      if (currentServerTime < effect.nextDecayAt) {
        continue;
      }
      if (effect.decayStage >= 2) {
        worldEntities.groundEffects.remove(effect.uid);
        removedGroundEffectUids.push(effect.uid);
      } else {
        effect.decayStage++;
        effect.nextDecayAt = currentServerTime + GROUND_EFFECT_DECAY_STAGE_MS;
        upsertedGroundEffects.push(effect);
      }
    }

    for (let index = worldEntities.decayingItems.length - 1; index >= 0; index--) {
      const item = worldEntities.decayingItems[index];
      if (!Number.isFinite(item?.nextDecayAt) || currentServerTime < item.nextDecayAt) {
        continue;
      }
      const profile = CORPSE_DECAY_COOLDOWN_MS[getItemData(item.itemId)?.decayType];
      if (!profile) {
        continue;
      }
      if (item.decayStage === 0) {
        item.decayStage = 1;
        item.nextDecayAt = currentServerTime + profile.stage1;
      } else if (item.decayStage === 1) {
        item.decayStage = 2;
        item.nextDecayAt = currentServerTime + profile.stage2;
      } else {
        if (worldEntities.worldItems.remove(item.uid)) {
          removedWorldItemUids.push(item.uid);
        } else {
          for (const inventory of inventoriesByPlayerUid.values()) {
            const location = inventory.findItemLocationByUid(item.uid);
            if (location) {
              inventory.removeItem(location);
              break;
            }
          }
        }
        worldEntities.decayingItems.splice(index, 1);
        continue;
      }
      if (worldEntities.worldItems.has(item.uid)) {
        upsertedWorldItems.push(item);
      }
    }

    if (
      upsertedWorldItems.length > 0 ||
      removedWorldItemUids.length > 0 ||
      upsertedGroundEffects.length > 0 ||
      removedGroundEffectUids.length > 0
    ) {
      journal.record({
        serverTime: currentServerTime,
        upserts: {
          worldItems: upsertedWorldItems.map(serializeWorldItem),
          groundEffects: upsertedGroundEffects.map(serializeGroundEffectState),
        },
        removals: {
          worldItems: removedWorldItemUids,
          groundEffects: removedGroundEffectUids,
        },
      });
    }
  };

  const createSimulationForPlayer = (player, inventory, itemUse, chatSession) => {
    const timing = { nextPlayerMoveTime: 0, nextPlayerAttackTime: 0, nextChatMessageTime: 0 };
    return createGameSimulation({
      state: { player, playersByUid, monstersByUid: worldEntities.monsters.getMap(), timing },
      rules: {
        canPlayerAttackMonster,
        canPlayerAttackPlayer,
        canInitiatePlayerPvpAttack: (attacker, target) =>
          canInitiatePlayerPvpAttack(attacker, target, currentServerTime),
        canPlayerDisablePvp: (pvpPlayer) =>
          !hasActivePlayerSkull(pvpPlayer, currentServerTime) && !isPlayerInPvpCombat(pvpPlayer.uid),
        canPlayerMove: (payload) => isPlayerDestinationAvailable(player, payload),
        canPlayerUseWorldTransition: (movingPlayer, transition) => isPlayerNearTiledObject(movingPlayer, transition, 1),
        getPlayerMoveTiming: (payload) => getPlayerMovementTiming(player, payload),
        getMovementCooldownToleranceMs: () => NETWORK_MOVEMENT_COOLDOWN_TOLERANCE_MS,
        getPlayerAttackCooldownMs: () => PLAYER_ATTACK_COOLDOWN_MS,
      },
      commands: {
        recordPlayerTileEntry,
        executeAttackMonster: (monster) => executePlayerAttack(player, monster),
        executeAttackPlayer: (target) => executePlayerPvpAttack(player, target),
        executeSetCombatMode: (combatMode) => {
          player.combatMode = combatMode;
          return { success: true, changes: { combatMode } };
        },
        executeSetLanguage: (language) => {
          player.language = language;
          return { success: true, changes: { language } };
        },
        executeSetPvpEnabled: (enabled) => {
          player.pvp.enabled = enabled;
          return {
            success: true,
            changes: { pvp: structuredClone(player.pvp) },
            events: [{ type: "player-pvp-state-changed", playerUid: player.uid, pvp: structuredClone(player.pvp) }],
          };
        },
        executeChatMessage: (payload) => {
          const moderationResult =
            chatModerationService?.handleMessage({
              session: chatSession,
              player,
              payload,
              playersByUid,
              sessionsByPlayerUid,
              now: currentServerTime,
            }) ?? null;
          if (moderationResult) {
            return moderationResult;
          }
          return {
            success: true,
            changes: { channelId: payload.channelId },
            events: [
              {
                type: "chat-message",
                channelId: payload.channelId,
                text: payload.text,
                playerUid: player.uid,
                speakerName: player.name,
                speakerLevel: player.level,
                x: player.x,
                y: player.y,
                z: player.z,
                createdAt: currentServerTime,
                visibility: payload.channelId === "local" ? "local" : "channel",
              },
            ],
          };
        },
        executeItemUse: itemUse.execute,
        executeNpcSpeech: (payload) => npcConversationService.handleSpeech(payload.text, player, payload.requestedAt),
        executeSpell: (payload) =>
          executePlayerSpellCast({
            player,
            spellData: spellsDatabase[payload.spellId],
            now: payload.requestedAt,
            cooldowns: itemUse.cooldowns,
            random: combatRandom,
          }),
        executeWorldInteraction: (interactable, payload) => {
          if (payload.interactionType !== "rewardChest" || !isPlayerNearTiledObject(player, interactable, 1)) {
            return { success: false, reason: "unsupported-or-out-of-range" };
          }
          const backpackUid = player.equipment.backpack?.uid;
          return executeRewardChestTransaction({
            player,
            interactable,
            requestedAt: payload.requestedAt,
            insertRewardItems: (items) => inventory.insertItems(backpackUid, items),
          });
        },
        executeMoveItem: inventory.executeMove,
        executeSplitItemStack: inventory.splitItemStack,
        executeWorldTransition: (transition) => executePlayerWorldTransition(player, transition),
        findAutomaticWorldTransition: (movingPlayer) => {
          const worldMap = worldMapsByZ.get(movingPlayer.z);
          return findTransitionAtTile(worldMap, movingPlayer.x / TILE_SIZE, movingPlayer.y / TILE_SIZE);
        },
        findWorldTransition: (payload) => {
          const worldMap = worldMapsByZ.get(payload.z);
          const transition = findTransitionAtTile(worldMap, payload.col, payload.row);
          return transition?.properties?.transitionType === payload.transitionType ? transition : null;
        },
        findWorldInteractable: (payload) => {
          const worldMap = worldMapsByZ.get(payload.z);
          const interactable = findInteractableAtTile(worldMap, payload.col, payload.row);
          return interactable?.properties?.interactableId === payload.interactableId &&
            interactable?.properties?.interactableType === payload.interactionType
            ? interactable
            : null;
        },
        findContainerByUid: inventory.findContainerByUid,
        getRemainingCapacity: inventory.getRemainingCapacity,
        getItemFromLocation: inventory.getItem,
        getItemUseData: (item) => getItemData(item?.itemId)?.use ?? null,
        getPlayerByUid: (playerUid) => (playerUid === player.uid ? player : null),
        getSpellById: (spellId) => spellsDatabase[spellId] ?? null,
      },
    });
  };

  const connectClient = (_session, hello) => {
    const accountId = typeof hello?.accountId === "string" ? hello.accountId.trim() : "";
    const characterId = typeof hello?.characterId === "string" ? hello.characterId.trim() : "";
    if (!/^[a-zA-Z0-9_-]{1,40}$/.test(accountId) || !/^[a-zA-Z0-9_-]{1,40}$/.test(characterId)) {
      return { success: false, reason: "invalid-account-or-character-id" };
    }
    const playerUid = `player:${accountId}:${characterId}`;
    if (playersByUid.has(playerUid)) {
      if (offlineCombatExpiresAtByPlayerUid.has(playerUid) && !connectedPlayerUids.has(playerUid)) {
        offlineCombatExpiresAtByPlayerUid.delete(playerUid);
        connectedPlayerUids.add(playerUid);
        return { success: true, playerUid };
      }
      return { success: false, reason: "character-already-online" };
    }
    const player = createPlayerState();
    const persistedCharacter = characterRepository?.load(accountId, characterId) ?? null;
    if (characterRepository && !persistedCharacter && !allowCharacterAutoCreate) {
      return { success: false, reason: "character-not-found" };
    }
    if (persistedCharacter) {
      hydratePlayerFromPersistence(player, persistedCharacter.snapshot);
    }
    const starterKitStateChanged = applyPlayerStarterKit(player);
    const spawnWorldMap = worldMapsByZ.get(player.spawn.z);
    const savedWorldMap = worldMapsByZ.get(player.z);
    const spawn = findPlayerSpawn(spawnWorldMap, player.spawn.spawnId);
    const savedCol = Number.isInteger(player.x) ? player.x / TILE_SIZE : null;
    const savedRow = Number.isInteger(player.y) ? player.y / TILE_SIZE : null;
    const savedPositionIsValid =
      Number.isInteger(player.z) &&
      Number.isInteger(savedCol) &&
      Number.isInteger(savedRow) &&
      getWorldChunkForTilePosition(savedWorldMap, savedCol, savedRow) &&
      !isTiledCollisionAtTile(savedWorldMap, savedCol, savedRow) &&
      ![...playersByUid.values()].some(
        (onlinePlayer) => onlinePlayer.z === player.z && onlinePlayer.x === player.x && onlinePlayer.y === player.y,
      );
    const spawnPosition = savedPositionIsValid
      ? { x: player.x, y: player.y }
      : spawn
        ? findAvailableSpawnPosition(spawnWorldMap, spawn)
        : null;
    if (!spawnPosition) {
      return { success: false, reason: "spawn-not-found" };
    }
    player.uid = playerUid;
    player.language = hello?.language === "fr" ? "fr" : "en";
    if (!persistedCharacter) {
      player.name =
        typeof hello?.name === "string" && hello.name.trim() !== "" ? hello.name.trim().slice(0, 24) : characterId;
    }
    player.x = spawnPosition.x;
    player.y = spawnPosition.y;
    if (!savedPositionIsValid) {
      player.z = player.spawn.z;
    }
    player.oldX = player.x;
    player.oldY = player.y;
    player.renderX = player.x;
    player.renderY = player.y;
    recordPlayerTileEntry(player);
    playersByUid.set(playerUid, player);
    connectedPlayerUids.add(playerUid);
    const inventory = createServerPlayerInventory({ player, worldMapsByZ, worldItems: worldEntities.worldItems });
    const itemUse = createServerPlayerItemUse({
      player,
      inventory,
      worldMapsByZ,
      groundEffects: worldEntities.groundEffects,
      monsters: worldEntities.monsters,
      players: playersByUid,
      executeRuneDamage: (target, useData, targetType) => {
        const attackResult = calculateRuneAttackResult(useData, player, combatRandom ?? undefined);
        if (targetType === "player") {
          if (!canInitiatePlayerPvpAttack(player, target, currentServerTime)) {
            return { success: false, reason: "pvp-disabled" };
          }
          return resolvePlayerPvpDamage(player, target, attackResult, "player-pvp-rune-resolved");
        }
        return resolvePlayerDamageToMonster(player, target, attackResult);
      },
    });
    inventoriesByPlayerUid.set(playerUid, inventory);
    const persistenceSession = {
      accountId,
      characterId,
      version: persistedCharacter?.version ?? null,
      lastSavedAt: currentServerTime,
      nextSaveAttemptAt: currentServerTime + AUTOSAVE_INTERVAL_MS,
      isDirty: starterKitStateChanged,
    };
    sessionsByPlayerUid.set(playerUid, persistenceSession);
    simulationsByPlayerUid.set(playerUid, createSimulationForPlayer(player, inventory, itemUse, persistenceSession));
    if (characterRepository && persistenceSession.version === null) {
      const saveResult = characterRepository.save(
        accountId,
        characterId,
        serializePlayerPrivateState(player),
        null,
        currentServerTime,
      );
      if (!saveResult.success) {
        playersByUid.delete(playerUid);
        simulationsByPlayerUid.delete(playerUid);
        inventoriesByPlayerUid.delete(playerUid);
        sessionsByPlayerUid.delete(playerUid);
        return { success: false, reason: saveResult.reason };
      }
      persistenceSession.version = saveResult.version;
    }
    journal.record({ serverTime: currentServerTime, upserts: { players: [serializePlayerPublicState(player)] } });
    return { success: true, playerUid };
  };

  const savePlayerPersistence = (playerUid) => {
    const player = playersByUid.get(playerUid);
    const persistenceSession = sessionsByPlayerUid.get(playerUid);
    if (!player || !characterRepository || !persistenceSession) {
      return true;
    }
    const saveResult = characterRepository.save(
      persistenceSession.accountId,
      persistenceSession.characterId,
      serializePlayerPrivateState(player),
      persistenceSession.version,
      currentServerTime,
    );
    if (saveResult.success) {
      persistenceSession.version = saveResult.version;
    }
    return saveResult.success;
  };

  const removePlayerFromWorld = (playerUid) => {
    if (!playersByUid.has(playerUid)) {
      return false;
    }
    savePlayerPersistence(playerUid);
    playersByUid.delete(playerUid);
    connectedPlayerUids.delete(playerUid);
    offlineCombatExpiresAtByPlayerUid.delete(playerUid);
    combatLogoutExpiresAtByPlayerUid.delete(playerUid);
    clearPlayerPvpAggressions(playerUid);
    simulationsByPlayerUid.delete(playerUid);
    inventoriesByPlayerUid.delete(playerUid);
    sessionsByPlayerUid.delete(playerUid);
    journal.record({ serverTime: currentServerTime, removals: { players: [playerUid] } });
    return true;
  };

  const disconnectClient = (session) => {
    const playerUid = session?.playerUid;
    const player = playersByUid.get(playerUid);
    if (!player) {
      return false;
    }
    connectedPlayerUids.delete(playerUid);
    const combatExpiresAt = combatLogoutExpiresAtByPlayerUid.get(playerUid) ?? 0;
    if (player.hp > 0 && combatExpiresAt > currentServerTime) {
      savePlayerPersistence(playerUid);
      offlineCombatExpiresAtByPlayerUid.set(playerUid, combatExpiresAt);
      return true;
    }
    return removePlayerFromWorld(playerUid);
  };

  const dispatchAction = (session, action) => {
    const simulation = simulationsByPlayerUid.get(session.playerUid);
    if (!simulation || !action?.payload) {
      return { success: false, reason: "invalid-session-or-action" };
    }
    const authoritativeAction = structuredClone(action);
    const receivedAt = now();
    authoritativeAction.payload.requestedAt = Number.isFinite(receivedAt)
      ? Math.max(currentServerTime, receivedAt)
      : currentServerTime;
    const result = simulation.dispatch(authoritativeAction);
    session.lastProcessedActionRequestId = action.requestId;
    if (result?.success) {
      const player = playersByUid.get(session.playerUid);
      markPlayerPersistenceDirty(player.uid);
      const upserts = { players: [serializePlayerPublicState(player)] };
      const removals = {};
      const changedPlayerUid = result.changes?.targetPlayerUid;
      if (typeof changedPlayerUid === "string" && changedPlayerUid !== player.uid) {
        const changedPlayer = playersByUid.get(changedPlayerUid);
        if (changedPlayer) {
          markPlayerPersistenceDirty(changedPlayerUid);
          upserts.players.push(serializePlayerPublicState(changedPlayer));
        }
      }
      const changedMonsterUid = result.changes?.monsterUid;
      if (Number.isInteger(changedMonsterUid)) {
        const changedMonster = worldEntities.monsters.get(changedMonsterUid);
        if (changedMonster) {
          upserts.monsters = [serializeMonsterState(changedMonster)];
        } else {
          removals.monsters = [changedMonsterUid];
        }
      }
      const changedItemUid = result.changes?.itemUid;
      if (Number.isInteger(changedItemUid)) {
        const changedWorldItem = worldEntities.worldItems.get(changedItemUid);

        if (changedWorldItem) {
          upserts.worldItems = [...(upserts.worldItems ?? []), serializeWorldItem(changedWorldItem)];
        } else if (action.payload?.source?.locationType === "worldItem") {
          removals.worldItems = [...(removals.worldItems ?? []), changedItemUid];
        }
      }
      const createdWorldItemUid = result.changes?.createdWorldItemUid;
      if (Number.isInteger(createdWorldItemUid)) {
        const createdWorldItem = worldEntities.worldItems.get(createdWorldItemUid);
        if (createdWorldItem) {
          upserts.worldItems = [...(upserts.worldItems ?? []), serializeWorldItem(createdWorldItem)];
        }
      }
      const corpseUid = result.changes?.corpseUid;
      const corpse = Number.isInteger(corpseUid) ? worldEntities.worldItems.get(corpseUid) : null;
      if (corpse) {
        upserts.worldItems = [serializeWorldItem(corpse)];
      }
      const changedWorldContainerUids = Array.isArray(result.changes?.changedWorldContainerUids)
        ? result.changes.changedWorldContainerUids
        : [];

      for (const containerUid of changedWorldContainerUids) {
        if (!Number.isInteger(containerUid)) {
          continue;
        }

        const changedWorldContainer = worldEntities.worldItems.get(containerUid);
        if (!changedWorldContainer) {
          continue;
        }

        upserts.worldItems = [...(upserts.worldItems ?? []), serializeWorldItem(changedWorldContainer)];
      }
      const changedGroundEffectUid = result.changes?.groundEffectUid;
      if (Number.isInteger(changedGroundEffectUid)) {
        const changedGroundEffect = worldEntities.groundEffects.get(changedGroundEffectUid);
        if (changedGroundEffect) {
          upserts.groundEffects = [serializeGroundEffectState(changedGroundEffect)];
        }
      }
      journal.record({
        serverTime: currentServerTime,
        upserts,
        removals,
        events: (result.events ?? []).map((event) => ({ ...event, actorPlayerUid: session.playerUid })),
      });
    }
    return result;
  };

  const getReplicationView = (session) => {
    const selfPlayer = playersByUid.get(session.playerUid);
    const worldMap = worldMapsByZ.get(selfPlayer?.z);
    if (!selfPlayer || !worldMap) {
      return null;
    }
    const visibleChunkKeys = getVisibleChunkKeys(worldMap, selfPlayer.x, selfPlayer.y);
    const currentRevision = journal.getRevision();
    if (indexedPlayerRevision !== currentRevision) {
      visiblePlayersByChunkKey.clear();
      for (const player of playersByUid.values()) {
        const chunk = getChunkPositionFromWorldPosition(player.x, player.y);
        if (!chunk) {
          continue;
        }
        const chunkKey = `${player.z}:${chunk.chunkX}:${chunk.chunkY}`;
        let chunkPlayers = visiblePlayersByChunkKey.get(chunkKey);
        if (!chunkPlayers) {
          chunkPlayers = [];
          visiblePlayersByChunkKey.set(chunkKey, chunkPlayers);
        }
        chunkPlayers.push(player);
      }
      indexedPlayerRevision = currentRevision;
    }
    const visiblePlayers = [];
    for (const chunkKey of visibleChunkKeys) {
      for (const player of visiblePlayersByChunkKey.get(chunkKey) ?? []) {
        if (player.uid !== selfPlayer.uid) {
          visiblePlayers.push(player);
        }
      }
    }
    return {
      selfPlayer,
      worldMap,
      visibleChunkKeys,
      visiblePlayers,
      visibleMonsters: worldEntities.monsters.getInChunkKeys(visibleChunkKeys),
      visibleNpcs: worldEntities.npcs.getInChunkKeys(visibleChunkKeys),
      visibleWorldItems: worldEntities.worldItems.getInChunkKeys(visibleChunkKeys),
      visibleGroundEffects: worldEntities.groundEffects.getInChunkKeys(visibleChunkKeys),
    };
  };

  const createSnapshotForClient = (session) => {
    const view = getReplicationView(session);
    if (!view) {
      return null;
    }
    session.knownVisibleChunkKeys = new Set(view.visibleChunkKeys);
    session.knownVisiblePlayerUids = new Set(view.visiblePlayers.map((player) => player.uid));
    session.knownVisibleMonsterUids = new Set(view.visibleMonsters.map((monster) => monster.uid));
    session.knownVisibleNpcUids = new Set(view.visibleNpcs.map((npc) => npc.uid));
    session.knownVisibleWorldItemUids = new Set(view.visibleWorldItems.map((item) => item.uid));
    session.knownVisibleGroundEffectUids = new Set(view.visibleGroundEffects.map((effect) => effect.uid));
    return createWorldSnapshot({
      revision: journal.getRevision(),
      serverTime: currentServerTime,
      selfPlayer: view.selfPlayer,
      players: view.visiblePlayers,
      monsters: view.visibleMonsters,
      npcs: view.visibleNpcs,
      worldItems: view.visibleWorldItems,
      groundEffects: view.visibleGroundEffects,
      chunks: view.visibleChunkKeys.map((key) => serializedWorldChunksByKey.get(key)),
      chunksAreSerialized: true,
      visibleChunkKeys: view.visibleChunkKeys,
      acknowledgedActionRequestId: session.lastProcessedActionRequestId ?? null,
    });
  };

  const getDeltasForClient = (session, knownRevision) => {
    const sourceDeltas = journal.readDeltasAfter(knownRevision);
    if (sourceDeltas === null || sourceDeltas.length === 0) {
      return sourceDeltas;
    }
    const view = getReplicationView(session);
    if (!view) {
      return null;
    }
    const previousChunkKeys = session.knownVisibleChunkKeys ?? new Set();
    const previousPlayerUids = session.knownVisiblePlayerUids ?? new Set();
    const previousMonsterUids = session.knownVisibleMonsterUids ?? new Set();
    const previousNpcUids = session.knownVisibleNpcUids ?? new Set();
    const previousWorldItemUids = session.knownVisibleWorldItemUids ?? new Set();
    const previousGroundEffectUids = session.knownVisibleGroundEffectUids ?? new Set();
    const currentChunkKeys = new Set(view.visibleChunkKeys);
    const currentPlayerUids = new Set(view.visiblePlayers.map((player) => player.uid));
    const currentMonsterUids = new Set(view.visibleMonsters.map((monster) => monster.uid));
    const currentNpcUids = new Set(view.visibleNpcs.map((npc) => npc.uid));
    const currentWorldItemUids = new Set(view.visibleWorldItems.map((item) => item.uid));
    const currentGroundEffectUids = new Set(view.visibleGroundEffects.map((effect) => effect.uid));
    const addedChunkKeys = view.visibleChunkKeys.filter((key) => !previousChunkKeys.has(key));
    const removedChunkKeys = [...previousChunkKeys].filter((key) => !currentChunkKeys.has(key));
    const removedPlayerUids = [...previousPlayerUids].filter((playerUid) => !currentPlayerUids.has(playerUid));
    const changedUidsByEntityType = new Map([
      ["players", new Set()],
      ["monsters", new Set()],
      ["npcs", new Set()],
      ["worldItems", new Set()],
      ["groundEffects", new Set()],
    ]);
    const sourceEvents = [];
    for (const sourceDelta of sourceDeltas) {
      for (const [entityType, changedUids] of changedUidsByEntityType) {
        for (const entity of sourceDelta.upserts?.[entityType] ?? []) {
          changedUids.add(entity.uid);
        }
      }
      sourceEvents.push(...sourceDelta.events);
    }
    const getVisibleEntityUpserts = (entities, previousUids, entityType, serializer) => {
      const changedUids = changedUidsByEntityType.get(entityType);
      return entities
        .filter((entity) => !previousUids.has(entity.uid) || changedUids.has(entity.uid))
        .map(serializer)
        .filter(Boolean);
    };
    const selfChanged = changedUidsByEntityType.get("players").has(view.selfPlayer.uid);
    const visibleEventPlayerUids = new Set([view.selfPlayer.uid, ...previousPlayerUids, ...currentPlayerUids]);
    const visibleEventMonsterUids = new Set([...previousMonsterUids, ...currentMonsterUids]);
    const visibleEventNpcUids = new Set([...previousNpcUids, ...currentNpcUids]);
    const isEventVisible = (event) => {
      if (event?.recipientPlayerUid && event.recipientPlayerUid !== view.selfPlayer.uid) {
        return false;
      }
      if (event?.visibility === "global") {
        return true;
      }
      if (event?.type === "npc-spoke" && event.playerUid !== view.selfPlayer.uid) {
        return false;
      }
      if (event?.type === "chat-message" && ["global", "trade"].includes(event.channelId)) {
        return true;
      }
      if (
        visibleEventPlayerUids.has(event?.actorPlayerUid) ||
        visibleEventPlayerUids.has(event?.playerUid) ||
        visibleEventMonsterUids.has(event?.monsterUid) ||
        visibleEventNpcUids.has(event?.npcUid)
      ) {
        return true;
      }
      const eventChunk = getChunkPositionFromWorldPosition(event?.x, event?.y);
      return eventChunk ? currentChunkKeys.has(`${event.z}:${eventChunk.chunkX}:${eventChunk.chunkY}`) : false;
    };
    const latestRevision = sourceDeltas.at(-1).revision;
    const delta = createWorldDelta({
      baseRevision: knownRevision,
      revision: latestRevision,
      serverTime: currentServerTime,
      acknowledgedActionRequestId: session.lastProcessedActionRequestId ?? null,
      upserts: {
        self: selfChanged ? serializePlayerPrivateState(view.selfPlayer) : undefined,
        players: getVisibleEntityUpserts(
          view.visiblePlayers,
          previousPlayerUids,
          "players",
          serializePlayerPublicState,
        ),
        monsters: getVisibleEntityUpserts(view.visibleMonsters, previousMonsterUids, "monsters", serializeMonsterState),
        npcs: getVisibleEntityUpserts(view.visibleNpcs, previousNpcUids, "npcs", serializeNpcState),
        worldItems: getVisibleEntityUpserts(
          view.visibleWorldItems,
          previousWorldItemUids,
          "worldItems",
          serializeWorldItem,
        ),
        groundEffects: getVisibleEntityUpserts(
          view.visibleGroundEffects,
          previousGroundEffectUids,
          "groundEffects",
          serializeGroundEffectState,
        ),
        chunks: addedChunkKeys.map((key) => serializedWorldChunksByKey.get(key)),
      },
      removals: {
        players: removedPlayerUids,
        monsters: [...previousMonsterUids].filter((uid) => !currentMonsterUids.has(uid)),
        npcs: [...previousNpcUids].filter((uid) => !currentNpcUids.has(uid)),
        worldItems: [...previousWorldItemUids].filter((uid) => !currentWorldItemUids.has(uid)),
        groundEffects: [...previousGroundEffectUids].filter((uid) => !currentGroundEffectUids.has(uid)),
        chunks: removedChunkKeys,
      },
      events: sourceEvents.filter(isEventVisible),
    });
    session.knownVisibleChunkKeys = currentChunkKeys;
    session.knownVisiblePlayerUids = currentPlayerUids;
    session.knownVisibleMonsterUids = currentMonsterUids;
    session.knownVisibleNpcUids = currentNpcUids;
    session.knownVisibleWorldItemUids = currentWorldItemUids;
    session.knownVisibleGroundEffectUids = currentGroundEffectUids;
    return delta ? [delta] : null;
  };

  return Object.freeze({
    connectClient,
    disconnectClient,
    dispatchAction,
    createSnapshotForClient,
    getDeltasForClient,
    update(serverTime) {
      if (Number.isFinite(serverTime)) {
        currentServerTime = serverTime;
      }
      worldEntities.respawnSystem.update(currentServerTime);
      if (currentServerTime >= nextWorldDecayAt) {
        nextWorldDecayAt = currentServerTime + DECAY_REFRESH_COOLDOWN_MS;
        updateWorldDecay();
      }
      const changedMonsters = monsterAi.update(currentServerTime);
      if (changedMonsters.length > 0) {
        journal.record({
          serverTime: currentServerTime,
          upserts: { monsters: changedMonsters.map(serializeMonsterState) },
        });
      }
      const monsterCombatResult = updateMonsterCombat();
      if (monsterCombatResult.changedPlayers.length > 0) {
        journal.record({
          serverTime: currentServerTime,
          upserts: {
            players: monsterCombatResult.changedPlayers.map(serializePlayerPublicState),
            worldItems: monsterCombatResult.createdWorldItems.map(serializeWorldItem),
            groundEffects: monsterCombatResult.changedGroundEffects.map(serializeGroundEffectState),
          },
          events: monsterCombatResult.events,
        });
      }
      const regeneratedPlayers = [];
      for (const player of playersByUid.values()) {
        const classData = playerClassesDatabase[player.classId] ?? playerClassesDatabase.noClass;
        let didChange = advancePlayerRegeneration(player, classData.regeneration, currentServerTime);
        if (player.spellEffects.light.expiresAt > 0 && currentServerTime >= player.spellEffects.light.expiresAt) {
          player.spellEffects.light.radius = 0;
          player.spellEffects.light.expiresAt = 0;
          didChange = true;
        }
        if (didChange) {
          regeneratedPlayers.push(player);
        }
      }
      if (regeneratedPlayers.length > 0) {
        for (const player of regeneratedPlayers) {
          markPlayerPersistenceDirty(player.uid);
        }
        journal.record({
          serverTime: currentServerTime,
          upserts: { players: regeneratedPlayers.map(serializePlayerPublicState) },
        });
      }
      const pvpStateChangedPlayers = [];
      for (const player of playersByUid.values()) {
        if (expirePlayerPvpState(player, currentServerTime)) {
          pvpStateChangedPlayers.push(player);
        }
      }
      if (pvpStateChangedPlayers.length > 0) {
        for (const player of pvpStateChangedPlayers) {
          markPlayerPersistenceDirty(player.uid);
        }
        journal.record({
          serverTime: currentServerTime,
          upserts: { players: pvpStateChangedPlayers.map(serializePlayerPublicState) },
          events: pvpStateChangedPlayers.map((player) => ({
            type: "player-pvp-state-changed",
            playerUid: player.uid,
            pvp: structuredClone(player.pvp),
          })),
        });
      }
      pruneExpiredPvpAggressions();
      for (const [playerUid, expiresAt] of offlineCombatExpiresAtByPlayerUid) {
        const currentCombatExpiry = combatLogoutExpiresAtByPlayerUid.get(playerUid) ?? expiresAt;
        if (currentCombatExpiry > expiresAt) {
          offlineCombatExpiresAtByPlayerUid.set(playerUid, currentCombatExpiry);
          continue;
        }
        if (currentServerTime >= expiresAt) {
          removePlayerFromWorld(playerUid);
        }
      }
      const npcEvents = npcConversationService.update(currentServerTime);
      if (npcEvents.length > 0) {
        journal.record({ serverTime: currentServerTime, events: npcEvents });
      }
      if (!characterRepository) {
        return;
      }
      if (currentServerTime >= nextAutosaveSweepAt) {
        let autosavesThisTick = 0;
        let nextSweepAt = Number.POSITIVE_INFINITY;
        for (const [playerUid, persistenceSession] of sessionsByPlayerUid.entries()) {
          if (!persistenceSession.isDirty) {
            continue;
          }
          if (currentServerTime < persistenceSession.nextSaveAttemptAt) {
            nextSweepAt = Math.min(nextSweepAt, persistenceSession.nextSaveAttemptAt);
            continue;
          }
          if (autosavesThisTick >= MAX_AUTOSAVES_PER_TICK) {
            nextSweepAt = currentServerTime;
            continue;
          }
          const player = playersByUid.get(playerUid);
          if (!player) {
            continue;
          }
          autosavesThisTick++;
          const saveResult = characterRepository.save(
            persistenceSession.accountId,
            persistenceSession.characterId,
            serializePlayerPrivateState(player),
            persistenceSession.version,
            currentServerTime,
          );
          if (saveResult.success) {
            persistenceSession.version = saveResult.version;
            persistenceSession.lastSavedAt = currentServerTime;
            persistenceSession.nextSaveAttemptAt = currentServerTime + AUTOSAVE_INTERVAL_MS;
            persistenceSession.isDirty = false;
          } else {
            persistenceSession.nextSaveAttemptAt = currentServerTime + AUTOSAVE_RETRY_DELAY_MS;
            nextSweepAt = Math.min(nextSweepAt, persistenceSession.nextSaveAttemptAt);
          }
        }
        nextAutosaveSweepAt = nextSweepAt;
      }
    },
    getPlayer: (playerUid) => playersByUid.get(playerUid) ?? null,
    getPlayerCount: () => playersByUid.size,
    getWorldEntities: () => worldEntities,
    getRevision: () => journal.getRevision(),
  });
};
