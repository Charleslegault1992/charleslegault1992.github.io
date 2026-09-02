import { isDeepStrictEqual } from "node:util";

import { createGameSimulation } from "../src/simulation/gameSimulation.js";
import { createWorldChangeJournal } from "../src/simulation/worldChangeJournal.js";
import {
  createWorldDelta,
  createWorldSnapshot,
  serializeGroundEffectState,
  serializeDoorState,
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
import { getNpcData } from "../src/npcs/npcModel.js";
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
  isWorldCollisionAtTile,
} from "../src/world/worldCoordinates.js";
import {
  findInteractableAtTile,
  findTransitionAtTile,
  isPlayerNearTiledObject,
} from "../src/world/tiledWorldObjects.js";
import { applyPlayerWorldTransitionState } from "../src/world/worldTransitions.js";
import { collectItemTreeUids, ensureUniquePlayerItemUids, hydratePlayerFromPersistence } from "./playerPersistence.js";
import { createCoalescingAsyncQueue } from "./persistence/coalescingAsyncQueue.js";
import { createServerWorldEntities } from "./serverWorldEntities.js";
import { createServerPlayerInventory } from "./serverPlayerInventory.js";
import { createServerPlayerItemUse } from "./serverPlayerItemUse.js";
import { spellsDatabase } from "../src/spellDatabase.js";
import { executePlayerSpellCast } from "../src/spells/spellCasting.js";
import { executeRewardChestTransaction } from "../src/quests/rewardChestTransaction.js";
import { createServerNpcConversationService } from "./serverNpcConversationService.js";
import { createServerNpcMovement } from "./serverNpcMovement.js";
import { createServerMonsterAi } from "./serverMonsterAi.js";
import { createServerFieldEffectSystem } from "./serverFieldEffectSystem.js";
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
import { getDoorInteriorPushTile, getDoorTiles } from "../src/world/doorModel.js";

const AUTOSAVE_INTERVAL_MS = 30000;
const AUTOSAVE_RETRY_DELAY_MS = 5000;
const MAX_AUTOSAVES_PER_TICK = 2;

const MAX_CONCURRENT_PERSISTENCE_SAVES = 2;
const FINAL_SAVE_BATCH_SIZE = 32;

const isPromiseLike = (value) => {
  return (
    value !== null && (typeof value === "object" || typeof value === "function") && typeof value.then === "function"
  );
};

const COMBAT_LOGOUT_DURATION_MS = 2 * 60 * 1000;
const NETWORK_MOVEMENT_COOLDOWN_TOLERANCE_MS = 50;
const PLAYER_SPAWN_TILE_OFFSETS = Object.freeze([
  Object.freeze({ col: 0, row: 0 }),
  Object.freeze({ col: 1, row: 0 }),
  Object.freeze({ col: 0, row: 1 }),
  Object.freeze({ col: 1, row: 1 }),
]);

const getPlayerDeathIdentity = (player) => ({
  entityType: "player",
  name: typeof player?.name === "string" && player.name !== "" ? player.name : "Unknown player",
});

const getMonsterDeathIdentity = (monster) => ({
  entityType: "monster",
  monsterId: monster?.monsterId ?? null,
  name: getMonsterData(monster?.monsterId)?.name ?? monster?.monsterId ?? "Unknown monster",
});

const getFieldDeathIdentity = (damageType) => ({
  entityType: "field",
  damageType: typeof damageType === "string" && damageType !== "" ? damageType : "magic",
});

const setCorpseDeathInfo = (corpse, victim, killer) => {
  if (!corpse || !victim || !killer) {
    return;
  }
  corpse.deathInfo = { victim, killer };
};

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
  npcRandomInt = getRandomInt,
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
  const connectingPlayerUids = new Set();
  const reservedPlayerSpawnKeys = new Set();
  const journal = createWorldChangeJournal({ maxEntries: 512 });
  let currentServerTime = now();
  let isInitializingWorldEntities = true;
  let nextPlayerTileStackOrder = 1;
  let indexedPlayerRevision = -1;
  let nextWorldDecayAt = 0;
  let nextAutosaveSweepAt = Number.POSITIVE_INFINITY;
  let fieldEffectSystem = null;

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
    fieldEffectSystem?.applyFieldAtEntity(player, "player", currentServerTime);
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

  const serializePlayerRuntimePrivateState = (player) => {
    const serializedPlayer = serializePlayerPrivateState(player);
    if (!serializedPlayer) {
      return null;
    }
    serializedPlayer.combatLogoutExpiresAt = combatLogoutExpiresAtByPlayerUid.get(player.uid) ?? 0;
    return serializedPlayer;
  };

  const createPlayerRuntimePrivateStatePatch = (session, player, baseRevision, nextRevision) => {
    const serializedPlayer = serializePlayerRuntimePrivateState(player);
    if (!serializedPlayer) {
      return null;
    }
    let playerPatch = serializedPlayer;
    if (
      session.knownPrivatePlayerRevision === baseRevision &&
      session.knownPrivatePlayerState &&
      typeof session.knownPrivatePlayerState === "object"
    ) {
      playerPatch = {};
      for (const [field, value] of Object.entries(serializedPlayer)) {
        if (!isDeepStrictEqual(value, session.knownPrivatePlayerState[field])) {
          playerPatch[field] = value;
        }
      }
    }
    session.knownPrivatePlayerState = serializedPlayer;
    session.knownPrivatePlayerRevision = nextRevision;
    return Object.keys(playerPatch).length > 0 ? playerPatch : undefined;
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

  const removalRequestedPlayerUids = new Set();

  const pendingRemovalByPlayerUid = new Map();

  const applyPersistenceSaveResult = (task, saveResult) => {
    const { playerUid, persistenceSession, revision, savedAt } = task;

    const completedAt = Math.max(currentServerTime, savedAt);

    if (!saveResult?.success) {
      persistenceSession.isDirty = true;

      if (saveResult?.reason === "version-conflict") {
        persistenceSession.persistenceBlockedReason = "version-conflict";
        persistenceSession.nextSaveAttemptAt = Number.POSITIVE_INFINITY;
        console.error(
          `Character persistence version conflict for ${playerUid}; automatic retries are blocked to prevent overwriting newer data.`,
        );
        return false;
      }

      persistenceSession.nextSaveAttemptAt = completedAt + AUTOSAVE_RETRY_DELAY_MS;

      if (sessionsByPlayerUid.get(playerUid) === persistenceSession) {
        nextAutosaveSweepAt = Math.min(nextAutosaveSweepAt, persistenceSession.nextSaveAttemptAt);
      }

      return false;
    }

    persistenceSession.version = saveResult.version;
    persistenceSession.persistenceBlockedReason = null;

    persistenceSession.lastSavedAt = savedAt;

    persistenceSession.nextSaveAttemptAt = completedAt + AUTOSAVE_INTERVAL_MS;

    if (persistenceSession.dirtyRevision === revision) {
      persistenceSession.isDirty = false;
    } else {
      persistenceSession.isDirty = true;

      if (sessionsByPlayerUid.get(playerUid) === persistenceSession) {
        nextAutosaveSweepAt = Math.min(nextAutosaveSweepAt, persistenceSession.nextSaveAttemptAt);
      }
    }

    return true;
  };

  const handlePersistenceSaveError = (task, error) => {
    const { playerUid, persistenceSession, savedAt } = task;

    const completedAt = Math.max(currentServerTime, savedAt);

    persistenceSession.isDirty = true;

    persistenceSession.nextSaveAttemptAt = completedAt + AUTOSAVE_RETRY_DELAY_MS;

    if (sessionsByPlayerUid.get(playerUid) === persistenceSession) {
      nextAutosaveSweepAt = Math.min(nextAutosaveSweepAt, persistenceSession.nextSaveAttemptAt);
    }

    console.error(`Character persistence failed for ${playerUid}:`, error);

    return false;
  };

  const persistenceSaveQueue = createCoalescingAsyncQueue({
    maxConcurrency: MAX_CONCURRENT_PERSISTENCE_SAVES,

    worker(_playerUid, task) {
      if (task.persistenceSession.persistenceBlockedReason) {
        return false;
      }

      let operation;

      try {
        operation = characterRepository.save(
          task.persistenceSession.accountId,

          task.persistenceSession.characterId,

          task.snapshot,

          task.persistenceSession.version,

          task.savedAt,
        );
      } catch (error) {
        return handlePersistenceSaveError(task, error);
      }

      if (operation && typeof operation.then === "function") {
        return Promise.resolve(operation)
          .then((saveResult) => applyPersistenceSaveResult(task, saveResult))
          .catch((error) => handlePersistenceSaveError(task, error));
      }

      return applyPersistenceSaveResult(task, operation);
    },
  });

  const markPlayerPersistenceDirty = (playerUid) => {
    const persistenceSession = sessionsByPlayerUid.get(playerUid);

    if (!persistenceSession) {
      return;
    }

    persistenceSession.isDirty = true;

    persistenceSession.dirtyRevision += 1;

    nextAutosaveSweepAt = Math.min(nextAutosaveSweepAt, persistenceSession.nextSaveAttemptAt);
  };
  const npcConversationService = createServerNpcConversationService({
    npcs: worldEntities.npcs,
    playersByUid,
    getInventory: (playerUid) => inventoriesByPlayerUid.get(playerUid) ?? null,
  });
  const npcMovement = createServerNpcMovement({
    worldMapsByZ,
    playersByUid,
    monsters: worldEntities.monsters,
    npcs: worldEntities.npcs,
    worldItems: worldEntities.worldItems,
    conversationStatesByNpcUid: npcConversationService.statesByNpcUid,
    randomInt: npcRandomInt,
  });
  const monsterAi = createServerMonsterAi({
    worldMapsByZ,
    playersByUid,
    monsters: worldEntities.monsters,
    npcs: worldEntities.npcs,
    worldItems: worldEntities.worldItems,
  });

  const addOrRefreshGroundEffect = (groundEffectId, x, y, z, decayStage = 0) => {
    const groundEffectData = groundEffectsDatabase[groundEffectId];
    if (!groundEffectData) {
      return null;
    }
    const existing = worldEntities.groundEffects
      .getAllAt(x, y, z)
      .find((effect) => groundEffectsDatabase[effect.groundEffectId]?.kind === groundEffectData.kind);
    if (existing) {
      existing.groundEffectId = groundEffectId;
      existing.decayStage = decayStage;
      existing.isPermanent = false;
      existing.ownerUid = null;
      existing.nextDecayAt = currentServerTime + (groundEffectData.decayStageMs ?? GROUND_EFFECT_DECAY_STAGE_MS);
      return existing;
    }
    const groundEffect = {
      uid: allocateGroundEffectUid(),
      groundEffectId,
      x,
      y,
      z,
      decayStage,
      isPermanent: false,
      ownerUid: null,
      nextDecayAt: currentServerTime + (groundEffectData.decayStageMs ?? GROUND_EFFECT_DECAY_STAGE_MS),
    };
    return worldEntities.groundEffects.add(groundEffect) ? groundEffect : null;
  };

  const findAvailableSpawnPosition = (worldMap, spawn) => {
    const validSpawnPositions = PLAYER_SPAWN_TILE_OFFSETS.flatMap((offset) => {
      const col = spawn.col + offset.col;
      const row = spawn.row + offset.row;
      if (!getWorldChunkForTilePosition(worldMap, col, row) || isWorldCollisionAtTile(worldMap, col, row)) {
        return [];
      }
      return [{ x: col * TILE_SIZE, y: row * TILE_SIZE }];
    });
    for (const position of validSpawnPositions) {
      const positionKey = `${worldMap.z}:${position.x}:${position.y}`;

      if (reservedPlayerSpawnKeys.has(positionKey)) {
        continue;
      }

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
      validSpawnPositions.find((position) => {
        const positionKey = `${worldMap.z}:${position.x}:${position.y}`;

        return (
          !reservedPlayerSpawnKeys.has(positionKey) &&
          !worldEntities.monsters.getAt(position.x, position.y, worldMap.z) &&
          !worldEntities.npcs.getAt(position.x, position.y, worldMap.z)
        );
      }) ?? null
    );
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
      isWorldCollisionAtTile(worldMap, toTile.col, toTile.row)
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

  const createDoorClosingPushPlan = (door) => {
    const worldMap = worldMapsByZ.get(door.z);
    if (!worldMap) {
      return null;
    }
    const pushes = [];
    for (const tile of getDoorTiles(door)) {
      const x = tile.col * TILE_SIZE;
      const y = tile.row * TILE_SIZE;
      const targetTile = getDoorInteriorPushTile(door, tile);
      if (!targetTile) {
        return null;
      }
      for (const occupyingPlayer of playersByUid.values()) {
        if (occupyingPlayer.z !== tile.z || occupyingPlayer.x !== x || occupyingPlayer.y !== y) {
          continue;
        }
        pushes.push({
          entityType: "player",
          entity: occupyingPlayer,
          targetTile,
          direction: targetTile.row < tile.row ? "up" : "down",
        });
      }
      for (const monster of worldEntities.monsters.getAllAt(x, y, tile.z)) {
        pushes.push({
          entityType: "monster",
          entity: monster,
          targetTile,
          direction: targetTile.row < tile.row ? "up" : "down",
        });
      }
      for (const npc of worldEntities.npcs.getAllAt(x, y, tile.z)) {
        pushes.push({
          entityType: "npc",
          entity: npc,
          targetTile,
          direction: targetTile.row < tile.row ? "up" : "down",
        });
      }
    }

    const movingEntityKeys = new Set(pushes.map((push) => `${push.entityType}:${push.entity.uid}`));
    for (const push of pushes) {
      const targetX = push.targetTile.col * TILE_SIZE;
      const targetY = push.targetTile.row * TILE_SIZE;
      if (
        !getWorldChunkForTilePosition(worldMap, push.targetTile.col, push.targetTile.row) ||
        isWorldCollisionAtTile(worldMap, push.targetTile.col, push.targetTile.row)
      ) {
        return null;
      }
      const blockingPlayer = [...playersByUid.values()].find(
        (candidate) =>
          candidate.z === push.targetTile.z &&
          candidate.x === targetX &&
          candidate.y === targetY &&
          !movingEntityKeys.has(`player:${candidate.uid}`),
      );
      const blockingMonster = worldEntities.monsters
        .getAllAt(targetX, targetY, push.targetTile.z)
        .find((candidate) => !movingEntityKeys.has(`monster:${candidate.uid}`));
      const blockingNpc = worldEntities.npcs
        .getAllAt(targetX, targetY, push.targetTile.z)
        .find((candidate) => !movingEntityKeys.has(`npc:${candidate.uid}`));
      if (blockingPlayer || blockingMonster || blockingNpc) {
        return null;
      }
    }
    return pushes;
  };

  const applyDoorClosingPush = ({ entityType, entity, targetTile, direction }) => {
    const fromX = entity.x;
    const fromY = entity.y;
    const toX = targetTile.col * TILE_SIZE;
    const toY = targetTile.row * TILE_SIZE;
    entity.oldX = fromX;
    entity.oldY = fromY;
    entity.direction = direction;
    entity.moveStartTime = currentServerTime;

    if (entityType === "player") {
      entity.x = toX;
      entity.y = toY;
      entity.moveDuration = getPlayerMovementTiming(entity, { fromX, fromY, toX, toY })?.duration ?? 0;
      recordPlayerTileEntry(entity);
      return;
    }

    const store = entityType === "monster" ? worldEntities.monsters : worldEntities.npcs;
    store.updatePosition(entity.uid, toX, toY, entity.z);
    entity.moveDuration =
      entityType === "monster"
        ? (getMonsterData(entity.monsterId)?.moveCooldown ?? 0)
        : (getNpcData(entity.npcId)?.movement?.moveCooldownMs ?? 0);
    if (entityType === "monster") {
      entity.path = [];
      entity.nextPathRefreshTime = 0;
      fieldEffectSystem?.applyFieldAtEntity(entity, entityType, currentServerTime);
    }
  };

  const executeDoorInteraction = (player, interactable) => {
    const door = worldEntities.doors.get(interactable?.properties?.doorId);
    if (!door || door.locked || !isPlayerNearTiledObject(player, interactable, 1)) {
      return { success: false, reason: door?.locked ? "door-locked" : "unsupported-or-out-of-range" };
    }
    let closingPushes = [];
    if (door.isOpen) {
      closingPushes = createDoorClosingPushPlan(door);
      if (!closingPushes) {
        return { success: false, reason: "door-blocked" };
      }
      for (const push of closingPushes) {
        applyDoorClosingPush(push);
      }
    }
    door.isOpen = !door.isOpen;
    return {
      success: true,
      changes: {
        doorUid: door.uid,
        isOpen: door.isOpen,
        changedPlayerUids: closingPushes.filter((push) => push.entityType === "player").map((push) => push.entity.uid),
        changedMonsterUids: closingPushes
          .filter((push) => push.entityType === "monster")
          .map((push) => push.entity.uid),
        changedNpcUids: closingPushes.filter((push) => push.entityType === "npc").map((push) => push.entity.uid),
      },
      events: [
        {
          type: "door-state-changed",
          doorUid: door.uid,
          isOpen: door.isOpen,
          x: door.x,
          y: door.y,
          z: door.z,
        },
      ],
    };
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

  const createCombatPositionSnapshot = (entity) => {
    if (!entity || !Number.isFinite(entity.x) || !Number.isFinite(entity.y) || !Number.isInteger(entity.z)) {
      return null;
    }
    return {
      uid: entity.uid,
      ...(typeof entity.monsterId === "string" ? { monsterId: entity.monsterId } : {}),
      x: entity.x,
      y: entity.y,
      z: entity.z,
    };
  };

  const resolvePlayerDamageToMonster = (player, monster, attackResult, initialEvents = [], deathSource = null) => {
    const attackerRenderSnapshot = createCombatPositionSnapshot(player);
    const targetRenderSnapshot = createCombatPositionSnapshot(monster);
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
    if (player) {
      recordPlayerCombatActivity(player.uid);
    }
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
      setCorpseDeathInfo(
        corpse,
        getMonsterDeathIdentity(monster),
        deathSource ?? (player ? getPlayerDeathIdentity(player) : getFieldDeathIdentity(attackResult.textType)),
      );
      if (!corpse || !worldEntities.worldItems.add(corpse)) {
        corpse = null;
      }
      experienceReward = player ? applyMonsterExperienceReward(player, monsterData) : 0;
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
        playerUid: player?.uid ?? null,
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
        attackerRenderSnapshot,
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
    const weaponCombatData = getEquippedWeaponCombatData(player);
    const weaponType = weaponCombatData?.weaponType ?? "fist";
    return resolvePlayerDamageToMonster(player, monster, attackResult, [
      {
        type: "player-attack-resolved",
        playerUid: player.uid,
        monsterUid: monster.uid,
        attackResult,
        weaponType,
        projectileItemId: weaponCombatData?.projectileItemId ?? null,
        skillProgression,
        attackerRenderSnapshot: createCombatPositionSnapshot(player),
        targetRenderSnapshot: createCombatPositionSnapshot(monster),
      },
    ]);
  };

  const resolvePlayerDeath = (target, deathSource) => {
    const deathPosition = { x: target.x, y: target.y, z: target.z };
    const backpack = target.equipment.backpack;
    if (backpack) {
      target.equipment.backpack = null;
    }
    let corpse = createGroundItem("playerCorpse", 1, target.x, target.y, target.z, backpack ? [backpack] : [], {
      decayingItems: worldEntities.decayingItems,
      now: () => currentServerTime,
    });
    setCorpseDeathInfo(corpse, getPlayerDeathIdentity(target), deathSource ?? getFieldDeathIdentity("magic"));
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
    const attackerRenderSnapshot = createCombatPositionSnapshot(player);
    const targetRenderSnapshot = createCombatPositionSnapshot(target);
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
    const deathResult = target.hp <= 0 ? resolvePlayerDeath(target, getPlayerDeathIdentity(player)) : null;
    const groundEffect =
      attackResult.finalDamage > 0
        ? addOrRefreshGroundEffect(
            "blood",
            targetRenderSnapshot.x,
            targetRenderSnapshot.y,
            targetRenderSnapshot.z,
            deathResult ? 0 : 1,
          )
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
          didDie: deathResult !== null,
          isUnjustifiedAttack,
          attackerSkullType: player.pvp.skullType,
          attackerRenderSnapshot,
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
    const weaponCombatData = getEquippedWeaponCombatData(player);
    const result = resolvePlayerPvpDamage(player, target, attackResult, "player-pvp-attack-resolved");
    if (result?.events?.[0]) {
      result.events[0].skillProgression = skillProgression;
      result.events[0].weaponType = weaponCombatData?.weaponType ?? "fist";
      result.events[0].projectileItemId = weaponCombatData?.projectileItemId ?? null;
    }
    return result;
  };

  fieldEffectSystem = createServerFieldEffectSystem({
    groundEffects: worldEntities.groundEffects,
    players: playersByUid,
    monsters: worldEntities.monsters,
    applyDamageTick: ({ entity, entityType, damage, damageType, sourcePlayerUid }) => {
      const attackResult = {
        didHit: true,
        wasBlocked: false,
        finalDamage: damage,
        text: damage,
        textType: damageType,
      };
      if (entityType === "monster") {
        const sourcePlayer = playersByUid.get(sourcePlayerUid) ?? null;
        const deathSource = sourcePlayer ? getPlayerDeathIdentity(sourcePlayer) : getFieldDeathIdentity(damageType);
        const result = resolvePlayerDamageToMonster(sourcePlayer, entity, attackResult, [], deathSource);
        result.events = (result.events ?? []).map((event) => ({ ...event, attackKind: "fieldTick", damageType }));
        return result;
      }

      const sourcePlayer = playersByUid.get(sourcePlayerUid) ?? null;
      if (sourcePlayer && sourcePlayer !== entity) {
        if (!canInitiatePlayerPvpAttack(sourcePlayer, entity, currentServerTime)) {
          return { success: false, events: [] };
        }
        const result = resolvePlayerPvpDamage(sourcePlayer, entity, attackResult, "player-pvp-field-resolved");
        if (result.events?.[0]) {
          result.events[0].damageType = damageType;
          result.events[0].attackKind = "fieldTick";
        }
        return result;
      }

      const targetRenderSnapshot = createCombatPositionSnapshot(entity);
      const healthResult = applyDamageToPlayer(entity, damage);
      recordPlayerCombatActivity(entity.uid);
      const deathResult = entity.hp <= 0 ? resolvePlayerDeath(entity, getFieldDeathIdentity(damageType)) : null;
      return {
        success: true,
        events: [
          {
            type: "field-damage-resolved",
            playerUid: entity.uid,
            targetPlayerUid: entity.uid,
            damageApplied: healthResult.damageApplied,
            damageType,
            didDie: Boolean(deathResult),
            x: targetRenderSnapshot.x,
            y: targetRenderSnapshot.y,
            z: targetRenderSnapshot.z,
            targetRenderSnapshot,
          },
          ...(deathResult ? [deathResult.event] : []),
        ],
      };
    },
  });

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
      const attackerRenderSnapshot = createCombatPositionSnapshot(monster);
      const targetRenderSnapshot = createCombatPositionSnapshot(target);
      monster.nextAttackTime = currentServerTime + MONSTER_ATTACK_COOLDOWN_MS;
      if (attackResult.finalDamage > 0) {
        applyDamageToPlayer(target, attackResult.finalDamage);
        const bloodEffect = addOrRefreshGroundEffect("blood", target.x, target.y, target.z, target.hp <= 0 ? 0 : 1);
        if (bloodEffect) {
          changedGroundEffects.set(bloodEffect.uid, bloodEffect);
        }
      }
      recordPlayerCombatActivity(target.uid);
      let deathResult = null;
      if (target.hp <= 0) {
        deathResult = resolvePlayerDeath(target, getMonsterDeathIdentity(monster));
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
        didDie: Boolean(deathResult),
        skillProgression,
        attackerRenderSnapshot,
        targetRenderSnapshot,
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
      if (effect.isPermanent === true) {
        continue;
      }
      if (currentServerTime < effect.nextDecayAt) {
        continue;
      }
      if (effect.decayStage >= 2) {
        worldEntities.groundEffects.remove(effect.uid);
        removedGroundEffectUids.push(effect.uid);
      } else {
        effect.decayStage++;
        effect.nextDecayAt =
          currentServerTime +
          (groundEffectsDatabase[effect.groundEffectId]?.decayStageMs ?? GROUND_EFFECT_DECAY_STAGE_MS);
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
        canInsertItems: () => false,
        canPlayerAttackMonster,
        canPlayerAttackPlayer,
        canInitiatePlayerPvpAttack: (attacker, target) =>
          canInitiatePlayerPvpAttack(attacker, target, currentServerTime),
        canPlayerDisablePvp: (pvpPlayer) =>
          !hasActivePlayerSkull(pvpPlayer, currentServerTime) && !isPlayerInPvpCombat(pvpPlayer.uid),
        canPlayerMove: (payload) => isPlayerDestinationAvailable(player, payload),
        canPlayerUseWorldTransition: (movingPlayer, transition) => isPlayerNearTiledObject(movingPlayer, transition, 1),
        canUseItemSource: inventory.canUseItemSource,
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
        executeNpcSpeech: (payload) => npcConversationService.handleSpeech(payload.text, player, currentServerTime),
        executeSpell: (payload) =>
          executePlayerSpellCast({
            player,
            spellData: spellsDatabase[payload.spellId],
            now: payload.requestedAt,
            cooldowns: itemUse.cooldowns,
            random: combatRandom,
          }),
        executeWorldInteraction: (interactable, payload) => {
          if (payload.interactionType === "door") {
            return executeDoorInteraction(player, interactable);
          }
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

  const collectOccupiedItemUids = () => {
    const occupiedItemUids = new Set();
    for (const worldItem of worldEntities.worldItems.values()) {
      collectItemTreeUids(worldItem, occupiedItemUids);
    }
    for (const onlinePlayer of playersByUid.values()) {
      for (const equipmentItem of Object.values(onlinePlayer.equipment ?? {})) {
        collectItemTreeUids(equipmentItem, occupiedItemUids);
      }
    }
    return occupiedItemUids;
  };

  const resolvePlayerConnectionPosition = (player) => {
    const spawnWorldMap = worldMapsByZ.get(player.spawn.z);

    const savedWorldMap = worldMapsByZ.get(player.z);

    const spawn = findPlayerSpawn(spawnWorldMap, player.spawn.spawnId);

    const savedCol = Number.isInteger(player.x) ? player.x / TILE_SIZE : null;

    const savedRow = Number.isInteger(player.y) ? player.y / TILE_SIZE : null;

    const savedPositionKey =
      Number.isInteger(player.z) && Number.isInteger(player.x) && Number.isInteger(player.y)
        ? `${player.z}:${player.x}:${player.y}`
        : null;

    const savedPositionIsValid =
      Number.isInteger(player.z) &&
      Number.isInteger(savedCol) &&
      Number.isInteger(savedRow) &&
      getWorldChunkForTilePosition(savedWorldMap, savedCol, savedRow) &&
      !isWorldCollisionAtTile(savedWorldMap, savedCol, savedRow) &&
      !reservedPlayerSpawnKeys.has(savedPositionKey) &&
      ![...playersByUid.values()].some(
        (onlinePlayer) => onlinePlayer.z === player.z && onlinePlayer.x === player.x && onlinePlayer.y === player.y,
      );

    if (savedPositionIsValid) {
      return {
        x: player.x,
        y: player.y,
        z: player.z,
      };
    }

    if (!spawn) {
      return null;
    }

    const spawnPosition = findAvailableSpawnPosition(spawnWorldMap, spawn);

    if (!spawnPosition) {
      return null;
    }

    return {
      x: spawnPosition.x,
      y: spawnPosition.y,
      z: player.spawn.z,
    };
  };

  const applyPlayerConnectionPosition = (player, position) => {
    player.x = position.x;
    player.y = position.y;
    player.z = position.z;

    player.oldX = player.x;
    player.oldY = player.y;

    player.renderX = player.x;
    player.renderY = player.y;
  };

  const connectClient = (_session, hello) => {
    const accountId = typeof hello?.accountId === "string" ? hello.accountId.trim() : "";

    const characterId = typeof hello?.characterId === "string" ? hello.characterId.trim() : "";

    if (!/^[a-zA-Z0-9_-]{1,40}$/.test(accountId) || !/^[a-zA-Z0-9_-]{1,40}$/.test(characterId)) {
      return {
        success: false,
        reason: "invalid-account-or-character-id",
      };
    }

    const playerUid = `player:${accountId}:${characterId}`;

    const pendingRemoval = pendingRemovalByPlayerUid.get(playerUid);

    if (pendingRemoval) {
      return Promise.resolve(pendingRemoval).then(() => connectClient(_session, hello));
    }

    if (playersByUid.has(playerUid)) {
      if (offlineCombatExpiresAtByPlayerUid.has(playerUid) && !connectedPlayerUids.has(playerUid)) {
        removalRequestedPlayerUids.delete(playerUid);

        offlineCombatExpiresAtByPlayerUid.delete(playerUid);

        connectedPlayerUids.add(playerUid);

        return {
          success: true,
          playerUid,
        };
      }

      return {
        success: false,
        reason: "character-already-online",
      };
    }

    if (connectingPlayerUids.has(playerUid)) {
      return {
        success: false,
        reason: "character-connection-in-progress",
      };
    }

    connectingPlayerUids.add(playerUid);

    const releaseConnectionReservation = () => {
      connectingPlayerUids.delete(playerUid);
    };

    const publishPlayer = ({ player, inventory, itemUse, persistenceSession }) => {
      if (playersByUid.has(playerUid)) {
        return {
          success: false,
          reason: "character-already-online",
        };
      }

      recordPlayerTileEntry(player);

      playersByUid.set(playerUid, player);

      connectedPlayerUids.add(playerUid);

      inventoriesByPlayerUid.set(playerUid, inventory);

      sessionsByPlayerUid.set(playerUid, persistenceSession);

      simulationsByPlayerUid.set(playerUid, createSimulationForPlayer(player, inventory, itemUse, persistenceSession));

      if (persistenceSession.isDirty) {
        nextAutosaveSweepAt = Math.min(nextAutosaveSweepAt, persistenceSession.nextSaveAttemptAt);
      }

      journal.record({
        serverTime: currentServerTime,

        upserts: {
          players: [serializePlayerPublicState(player)],
        },
      });

      return {
        success: true,
        playerUid,
      };
    };

    const finishLoadedCharacter = (persistedCharacter) => {
      if (playersByUid.has(playerUid)) {
        return {
          success: false,
          reason: "character-already-online",
        };
      }

      if (characterRepository && !persistedCharacter && !allowCharacterAutoCreate) {
        return {
          success: false,
          reason: "character-not-found",
        };
      }

      const player = createPlayerState();

      if (persistedCharacter) {
        hydratePlayerFromPersistence(player, persistedCharacter.snapshot);
      }

      let itemUidStateChanged = ensureUniquePlayerItemUids(player, collectOccupiedItemUids());

      const starterKitStateChanged = applyPlayerStarterKit(player);

      player.uid = playerUid;

      player.language = hello?.language === "fr" ? "fr" : "en";

      if (!persistedCharacter) {
        player.name =
          typeof hello?.name === "string" && hello.name.trim() !== "" ? hello.name.trim().slice(0, 24) : characterId;
      }

      const resolvedPosition = resolvePlayerConnectionPosition(player);

      if (!resolvedPosition) {
        return {
          success: false,
          reason: "spawn-not-found",
        };
      }

      applyPlayerConnectionPosition(player, resolvedPosition);

      let persistenceVersion = persistedCharacter?.version ?? null;

      let persistenceIsDirty = starterKitStateChanged || itemUidStateChanged;

      let lastSavedAt = currentServerTime;

      const createRuntimeObjects = () => {
        const inventory = createServerPlayerInventory({
          player,
          worldMapsByZ,

          worldItems: worldEntities.worldItems,
        });

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
                return {
                  success: false,
                  reason: "pvp-disabled",
                };
              }

              return resolvePlayerPvpDamage(player, target, attackResult, "player-pvp-rune-resolved");
            }

            return resolvePlayerDamageToMonster(player, target, attackResult);
          },

          onFieldCreated: (field, requestedAt) => {
            for (const worldPlayer of playersByUid.values()) {
              if (worldPlayer.x === field.x && worldPlayer.y === field.y && worldPlayer.z === field.z) {
                fieldEffectSystem.applyFieldAtEntity(worldPlayer, "player", requestedAt);
              }
            }

            const monster = worldEntities.monsters.getAt(field.x, field.y, field.z);

            if (monster) {
              fieldEffectSystem.applyFieldAtEntity(monster, "monster", requestedAt);
            }
          },
        });

        const persistenceSession = {
          accountId,
          characterId,
          version: persistenceVersion,

          lastSavedAt,

          nextSaveAttemptAt: currentServerTime + AUTOSAVE_INTERVAL_MS,

          isDirty: persistenceIsDirty,
          persistenceBlockedReason: null,

          dirtyRevision: persistenceIsDirty ? 1 : 0,

          lastQueuedRevision: -1,
        };

        return publishPlayer({
          player,
          inventory,
          itemUse,
          persistenceSession,
        });
      };

      if (!characterRepository || persistenceVersion !== null) {
        return createRuntimeObjects();
      }

      const reservedSpawnKey = `${player.z}:${player.x}:${player.y}`;

      reservedPlayerSpawnKeys.add(reservedSpawnKey);

      const releaseSpawnReservation = () => {
        reservedPlayerSpawnKeys.delete(reservedSpawnKey);
      };

      const initialSaveAt = currentServerTime;

      const handleInitialSaveResult = (saveResult) => {
        if (!saveResult?.success) {
          return {
            success: false,
            reason: saveResult?.reason ?? "character-save-failed",
          };
        }

        persistenceVersion = saveResult.version;

        lastSavedAt = initialSaveAt;

        /*
         * Starter kit and the first UID
         * normalization were included in
         * this initial snapshot.
         */
        persistenceIsDirty = false;

        /*
         * Other characters may have joined
         * while PostgreSQL was writing.
         * Re-run UID collision repair before
         * this player enters the world.
         */
        itemUidStateChanged = ensureUniquePlayerItemUids(player, collectOccupiedItemUids());

        if (itemUidStateChanged) {
          persistenceIsDirty = true;
        }

        return createRuntimeObjects();
      };

      let saveOperation;

      try {
        saveOperation = characterRepository.save(
          accountId,
          characterId,

          serializePlayerPrivateState(player),

          null,
          initialSaveAt,
        );
      } catch (error) {
        releaseSpawnReservation();
        throw error;
      }

      if (isPromiseLike(saveOperation)) {
        return Promise.resolve(saveOperation).then(handleInitialSaveResult).finally(releaseSpawnReservation);
      }

      try {
        return handleInitialSaveResult(saveOperation);
      } finally {
        releaseSpawnReservation();
      }
    };

    const runConnection = () => {
      if (!characterRepository) {
        return finishLoadedCharacter(null);
      }

      const loadOperation = characterRepository.load(accountId, characterId);

      if (isPromiseLike(loadOperation)) {
        return Promise.resolve(loadOperation).then(finishLoadedCharacter);
      }

      return finishLoadedCharacter(loadOperation);
    };

    let connectionResult;

    try {
      connectionResult = runConnection();
    } catch (error) {
      releaseConnectionReservation();
      throw error;
    }

    if (isPromiseLike(connectionResult)) {
      return Promise.resolve(connectionResult).finally(releaseConnectionReservation);
    }

    releaseConnectionReservation();

    return connectionResult;
  };

  const enqueuePlayerPersistence = (playerUid, { waitForCompletion = false, force = false } = {}) => {
    const player = playersByUid.get(playerUid);

    const persistenceSession = sessionsByPlayerUid.get(playerUid);

    if (!player || !characterRepository || !persistenceSession) {
      return waitForCompletion ? Promise.resolve(true) : true;
    }

    if (persistenceSession.persistenceBlockedReason) {
      return waitForCompletion ? Promise.resolve(false) : false;
    }

    if (!force && !persistenceSession.isDirty) {
      return waitForCompletion ? Promise.resolve(true) : true;
    }

    const revision = persistenceSession.dirtyRevision;

    /*
     * Avoid repeatedly queueing the exact same
     * revision while it is already in-flight.
     */
    if (!force && persistenceSession.lastQueuedRevision === revision && persistenceSaveQueue.hasWork(playerUid)) {
      return waitForCompletion ? persistenceSaveQueue.flush().then(() => true) : true;
    }

    const task = {
      playerUid,
      persistenceSession,

      snapshot: serializePlayerPrivateState(player),

      revision,
      savedAt: currentServerTime,
    };

    persistenceSession.lastQueuedRevision = revision;

    /*
     * Prevent the autosave sweep from trying
     * the same revision again immediately.
     * Failure will replace this with the
     * shorter retry delay.
     */
    persistenceSession.nextSaveAttemptAt = currentServerTime + AUTOSAVE_INTERVAL_MS;

    if (waitForCompletion) {
      return persistenceSaveQueue.enqueueAndWait(playerUid, task);
    }

    persistenceSaveQueue.enqueue(playerUid, task);

    return true;
  };

  const saveAllPlayerPersistence = async () => {
    const playerUids = [...playersByUid.keys()];

    const failedPlayerUids = [];

    let savedCount = 0;

    for (let offset = 0; offset < playerUids.length; offset += FINAL_SAVE_BATCH_SIZE) {
      const batch = playerUids.slice(offset, offset + FINAL_SAVE_BATCH_SIZE);

      const results = await Promise.all(
        batch.map(async (playerUid) => {
          const success = await enqueuePlayerPersistence(playerUid, {
            waitForCompletion: true,

            force: true,
          });

          return {
            playerUid,
            success,
          };
        }),
      );

      for (const result of results) {
        if (result.success) {
          savedCount += 1;
        } else {
          failedPlayerUids.push(result.playerUid);
        }
      }
    }

    await persistenceSaveQueue.flush();

    return {
      success: failedPlayerUids.length === 0,

      savedCount,

      failedPlayerUids,
    };
  };

  const announceSystemMessage = ({ en, fr }) => {
    const events = [...playersByUid.values()].map((player) => ({
      type: "chat-system-message",
      channelId: "logs",
      recipientPlayerUid: player.uid,
      text: player.language === "fr" ? fr : en,
      createdAt: currentServerTime,
      visibility: "private",
    }));
    if (events.length > 0) {
      journal.record({ serverTime: currentServerTime, events });
    }
    return events.length;
  };

  const finalizePlayerRemoval = (playerUid) => {
    if (!playersByUid.has(playerUid)) {
      return false;
    }

    playersByUid.delete(playerUid);
    connectedPlayerUids.delete(playerUid);

    removalRequestedPlayerUids.delete(playerUid);

    offlineCombatExpiresAtByPlayerUid.delete(playerUid);

    combatLogoutExpiresAtByPlayerUid.delete(playerUid);

    clearPlayerPvpAggressions(playerUid);

    simulationsByPlayerUid.delete(playerUid);

    inventoriesByPlayerUid.delete(playerUid);

    sessionsByPlayerUid.delete(playerUid);

    journal.record({
      serverTime: currentServerTime,

      removals: {
        players: [playerUid],
      },
    });

    return true;
  };

  const persistAndRemovePlayer = (playerUid) => {
    if (!playersByUid.has(playerUid)) {
      return Promise.resolve(false);
    }

    const existingOperation = pendingRemovalByPlayerUid.get(playerUid);

    if (existingOperation) {
      return existingOperation;
    }

    let operation;

    operation = (async () => {
      const saved = await enqueuePlayerPersistence(playerUid, {
        waitForCompletion: true,
        force: true,
      });

      if (!saved) {
        return false;
      }

      /*
       * The player may have reconnected while
       * PostgreSQL was saving the snapshot.
       */
      if (connectedPlayerUids.has(playerUid)) {
        removalRequestedPlayerUids.delete(playerUid);

        return true;
      }

      return finalizePlayerRemoval(playerUid);
    })().finally(() => {
      if (pendingRemovalByPlayerUid.get(playerUid) === operation) {
        pendingRemovalByPlayerUid.delete(playerUid);
      }
    });

    pendingRemovalByPlayerUid.set(playerUid, operation);

    return operation;
  };
  const disconnectClient = async (session) => {
    const playerUid = session?.playerUid;

    const player = playersByUid.get(playerUid);

    if (!player) {
      return false;
    }

    connectedPlayerUids.delete(playerUid);

    const combatExpiresAt = combatLogoutExpiresAtByPlayerUid.get(playerUid) ?? 0;

    if (player.hp > 0 && combatExpiresAt > currentServerTime) {
      /*
       * Save the disconnect state, but keep
       * the combat avatar authoritative in RAM.
       */
      await enqueuePlayerPersistence(playerUid, {
        waitForCompletion: true,
        force: true,
      });

      offlineCombatExpiresAtByPlayerUid.set(playerUid, combatExpiresAt);

      return true;
    }

    removalRequestedPlayerUids.add(playerUid);

    return persistAndRemovePlayer(playerUid);
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
      const changedPlayerUids = new Set([
        result.changes?.targetPlayerUid,
        ...(Array.isArray(result.changes?.changedPlayerUids) ? result.changes.changedPlayerUids : []),
      ]);
      for (const changedPlayerUid of changedPlayerUids) {
        if (typeof changedPlayerUid !== "string" || changedPlayerUid === player.uid) {
          continue;
        }
        const changedPlayer = playersByUid.get(changedPlayerUid);
        if (changedPlayer) {
          markPlayerPersistenceDirty(changedPlayerUid);
          upserts.players.push(serializePlayerPublicState(changedPlayer));
        }
      }
      const changedMonsterUids = new Set([
        result.changes?.monsterUid,
        ...(Array.isArray(result.changes?.changedMonsterUids) ? result.changes.changedMonsterUids : []),
      ]);
      for (const changedMonsterUid of changedMonsterUids) {
        if (!Number.isInteger(changedMonsterUid)) {
          continue;
        }
        const changedMonster = worldEntities.monsters.get(changedMonsterUid);
        if (changedMonster) {
          upserts.monsters = [...(upserts.monsters ?? []), serializeMonsterState(changedMonster)];
        } else {
          removals.monsters = [...(removals.monsters ?? []), changedMonsterUid];
        }
      }
      const changedNpcUids = Array.isArray(result.changes?.changedNpcUids) ? result.changes.changedNpcUids : [];
      for (const changedNpcUid of changedNpcUids) {
        if (typeof changedNpcUid !== "string") {
          continue;
        }
        const changedNpc = worldEntities.npcs.get(changedNpcUid);
        if (changedNpc) {
          upserts.npcs = [...(upserts.npcs ?? []), serializeNpcState(changedNpc)];
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
      const removedGroundEffectUid = result.changes?.removedGroundEffectUid;
      if (Number.isInteger(removedGroundEffectUid)) {
        removals.groundEffects = [removedGroundEffectUid];
      }
      const changedDoorUid = result.changes?.doorUid;
      if (typeof changedDoorUid === "string") {
        const changedDoor = worldEntities.doors.get(changedDoorUid);
        if (changedDoor) {
          upserts.doors = [serializeDoorState(changedDoor)];
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
      visibleDoors: worldEntities.doors.getInChunkKeys(visibleChunkKeys),
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
    session.knownVisibleDoorUids = new Set(view.visibleDoors.map((door) => door.uid));
    const snapshot = createWorldSnapshot({
      revision: journal.getRevision(),
      serverTime: currentServerTime,
      selfPlayer: view.selfPlayer,
      players: view.visiblePlayers,
      monsters: view.visibleMonsters,
      npcs: view.visibleNpcs,
      worldItems: view.visibleWorldItems,
      groundEffects: view.visibleGroundEffects,
      doors: view.visibleDoors,
      chunks: view.visibleChunkKeys.map((key) => serializedWorldChunksByKey.get(key)),
      chunksAreSerialized: true,
      visibleChunkKeys: view.visibleChunkKeys,
      acknowledgedActionRequestId: session.lastProcessedActionRequestId ?? null,
      selfCombatLogoutExpiresAt: combatLogoutExpiresAtByPlayerUid.get(view.selfPlayer.uid) ?? 0,
    });
    if (snapshot) {
      session.knownPrivatePlayerState = snapshot.self;
      session.knownPrivatePlayerRevision = snapshot.revision;
    }
    return snapshot;
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
    const previousDoorUids = session.knownVisibleDoorUids ?? new Set();
    const currentChunkKeys = new Set(view.visibleChunkKeys);
    const currentPlayerUids = new Set(view.visiblePlayers.map((player) => player.uid));
    const currentMonsterUids = new Set(view.visibleMonsters.map((monster) => monster.uid));
    const currentNpcUids = new Set(view.visibleNpcs.map((npc) => npc.uid));
    const currentWorldItemUids = new Set(view.visibleWorldItems.map((item) => item.uid));
    const currentGroundEffectUids = new Set(view.visibleGroundEffects.map((effect) => effect.uid));
    const currentDoorUids = new Set(view.visibleDoors.map((door) => door.uid));
    const addedChunkKeys = view.visibleChunkKeys.filter((key) => !previousChunkKeys.has(key));
    const removedChunkKeys = [...previousChunkKeys].filter((key) => !currentChunkKeys.has(key));
    const removedPlayerUids = [...previousPlayerUids].filter((playerUid) => !currentPlayerUids.has(playerUid));
    const changedUidsByEntityType = new Map([
      ["players", new Set()],
      ["monsters", new Set()],
      ["npcs", new Set()],
      ["worldItems", new Set()],
      ["groundEffects", new Set()],
      ["doors", new Set()],
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
    const selfStatePatch = selfChanged
      ? createPlayerRuntimePrivateStatePatch(session, view.selfPlayer, knownRevision, latestRevision)
      : undefined;
    const delta = createWorldDelta({
      baseRevision: knownRevision,
      revision: latestRevision,
      serverTime: currentServerTime,
      acknowledgedActionRequestId: session.lastProcessedActionRequestId ?? null,
      upserts: {
        self: selfStatePatch,
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
        doors: getVisibleEntityUpserts(view.visibleDoors, previousDoorUids, "doors", serializeDoorState),
        chunks: addedChunkKeys.map((key) => serializedWorldChunksByKey.get(key)),
      },
      removals: {
        players: removedPlayerUids,
        monsters: [...previousMonsterUids].filter((uid) => !currentMonsterUids.has(uid)),
        npcs: [...previousNpcUids].filter((uid) => !currentNpcUids.has(uid)),
        worldItems: [...previousWorldItemUids].filter((uid) => !currentWorldItemUids.has(uid)),
        groundEffects: [...previousGroundEffectUids].filter((uid) => !currentGroundEffectUids.has(uid)),
        doors: [...previousDoorUids].filter((uid) => !currentDoorUids.has(uid)),
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
    session.knownVisibleDoorUids = currentDoorUids;
    return delta ? [delta] : null;
  };

  const isCharacterBusy = (accountId, characterId) => {
    if (typeof accountId !== "string" || typeof characterId !== "string") {
      return false;
    }

    const normalizedAccountId = accountId.trim();

    const normalizedCharacterId = characterId.trim();

    if (normalizedAccountId === "" || normalizedCharacterId === "") {
      return false;
    }

    const playerUid = `player:${normalizedAccountId}:${normalizedCharacterId}`;

    return (
      playersByUid.has(playerUid) || connectingPlayerUids.has(playerUid) || pendingRemovalByPlayerUid.has(playerUid)
    );
  };

  return Object.freeze({
    connectClient,
    disconnectClient,
    saveAllPlayerPersistence,
    isCharacterBusy,
    announceSystemMessage,
    dispatchAction,
    createSnapshotForClient,
    getDeltasForClient,
    update(serverTime) {
      if (Number.isFinite(serverTime)) {
        currentServerTime = serverTime;
      }
      worldEntities.respawnSystem.update(currentServerTime);
      const changedNpcs = npcMovement.update(currentServerTime);
      if (changedNpcs.length > 0) {
        journal.record({
          serverTime: currentServerTime,
          upserts: { npcs: changedNpcs.map(serializeNpcState) },
        });
      }
      if (currentServerTime >= nextWorldDecayAt) {
        nextWorldDecayAt = currentServerTime + DECAY_REFRESH_COOLDOWN_MS;
        updateWorldDecay();
      }
      const changedMonsters = monsterAi.update(currentServerTime);
      for (const monster of changedMonsters) {
        fieldEffectSystem.applyFieldAtEntity(monster, "monster", currentServerTime);
      }
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
      const fieldEffectResult = fieldEffectSystem.update(currentServerTime);
      if (
        fieldEffectResult.changedPlayers.length > 0 ||
        fieldEffectResult.changedMonsters.length > 0 ||
        fieldEffectResult.events.length > 0
      ) {
        for (const player of fieldEffectResult.changedPlayers) {
          markPlayerPersistenceDirty(player.uid);
        }
        const removedMonsterUids = fieldEffectResult.events
          .filter((event) => event.type === "monster-damage-resolved" && event.didDie)
          .map((event) => event.monsterUid);
        const changedWorldItemUids = fieldEffectResult.events.map((event) => event.corpseUid).filter(Number.isInteger);
        const changedGroundEffectUids = fieldEffectResult.events
          .map((event) => event.groundEffectUid)
          .filter(Number.isInteger);
        journal.record({
          serverTime: currentServerTime,
          upserts: {
            players: fieldEffectResult.changedPlayers.map(serializePlayerPublicState),
            monsters: fieldEffectResult.changedMonsters.map(serializeMonsterState),
            worldItems: changedWorldItemUids
              .map((uid) => worldEntities.worldItems.get(uid))
              .filter(Boolean)
              .map(serializeWorldItem),
            groundEffects: changedGroundEffectUids
              .map((uid) => worldEntities.groundEffects.get(uid))
              .filter(Boolean)
              .map(serializeGroundEffectState),
          },
          removals: { monsters: removedMonsterUids },
          events: fieldEffectResult.events,
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
          removalRequestedPlayerUids.add(playerUid);
        }
      }
      for (const playerUid of removalRequestedPlayerUids) {
        if (pendingRemovalByPlayerUid.has(playerUid)) {
          continue;
        }

        const persistenceSession = sessionsByPlayerUid.get(playerUid);

        if (persistenceSession && currentServerTime < persistenceSession.nextSaveAttemptAt) {
          continue;
        }

        void persistAndRemovePlayer(playerUid).catch((error) => {
          console.error(`Deferred player removal failed for ${playerUid}:`, error);
        });
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

          enqueuePlayerPersistence(playerUid);

          nextSweepAt = Math.min(nextSweepAt, persistenceSession.nextSaveAttemptAt);
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
