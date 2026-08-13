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
  PLAYER_ATTACK_COOLDOWN_MS,
  PLAYER_MOVE_COOLDOWN_MS,
  TILE_SIZE,
} from "../src/core/gameConstants.js";
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
  getTileMovementAnimationMultiplier,
  getTileMovementCost,
  hasLineOfSightBetweenTiles,
} from "../src/world/pathfinding.js";
import {
  getChunkPositionFromWorldPosition,
  getWorldChunkForTilePosition,
  isTiledCollisionAtTile,
} from "../src/world/worldCoordinates.js";
import { findInteractableAtTile, findTransitionAtTile, isPlayerNearTiledObject } from "../src/world/tiledWorldObjects.js";
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
import { GROUND_EFFECT_DECAY_STAGE_MS } from "../src/data/groundEffectsDatabase.js";

const AUTOSAVE_INTERVAL_MS = 30000;

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
  now = () => Date.now(),
  combatRandom = null,
}) => {
  if (!(worldMapsByZ instanceof Map) || typeof now !== "function") {
    throw new TypeError("The authoritative world requires loaded maps and a clock.");
  }

  const playersByUid = new Map();
  const journal = createWorldChangeJournal({ maxEntries: 512 });
  let currentServerTime = now();
  let isInitializingWorldEntities = true;
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

  const findAvailableSpawnPosition = (worldMap, spawn) => {
    for (let radius = 0; radius <= 5; radius++) {
      for (let rowOffset = -radius; rowOffset <= radius; rowOffset++) {
        for (let colOffset = -radius; colOffset <= radius; colOffset++) {
          if (radius > 0 && Math.abs(colOffset) !== radius && Math.abs(rowOffset) !== radius) {
            continue;
          }
          const col = spawn.col + colOffset;
          const row = spawn.row + rowOffset;
          const x = col * TILE_SIZE;
          const y = row * TILE_SIZE;
          if (!getWorldChunkForTilePosition(worldMap, col, row) || isTiledCollisionAtTile(worldMap, col, row)) {
            continue;
          }
          const occupied = [...playersByUid.values()].some(
            (player) => player.z === worldMap.z && player.x === x && player.y === y,
          ) || worldEntities.monsters.getAt(x, y, worldMap.z) || worldEntities.npcs.getAt(x, y, worldMap.z);
          if (!occupied) {
            return { x, y };
          }
        }
      }
    }
    return null;
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
      if (player.uid !== movingPlayer.uid && player.z === movingPlayer.z && player.x === payload.toX && player.y === payload.toY) {
        return false;
      }
    }
    return !worldEntities.monsters.getAt(payload.toX, payload.toY, movingPlayer.z) &&
      !worldEntities.npcs.getAt(payload.toX, payload.toY, movingPlayer.z);
  };

  const canPlayerAttackMonster = (player, monster) => {
    if (!player || !monster || player.z !== monster.z) {
      return false;
    }
    const range = getPlayerAttackRange(player);
    const playerCol = player.x / TILE_SIZE;
    const playerRow = player.y / TILE_SIZE;
    const monsterCol = monster.x / TILE_SIZE;
    const monsterRow = monster.y / TILE_SIZE;
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
    let corpse = null;
    let lootContent = [];
    let experienceReward = 0;
    if (healthResult.didDie) {
      const monsterData = getMonsterData(monster.monsterId);
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
      },
      events,
    };
  };

  const executePlayerAttack = (player, monster) => {
    const attackResult = calculatePlayerAttackResult(monster, player, combatRandom ?? undefined);
    return resolvePlayerDamageToMonster(player, monster, attackResult, [
      {
        type: "player-attack-resolved",
        playerUid: player.uid,
        monsterUid: monster.uid,
        attackResult,
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

  const updateMonsterCombat = () => {
    const changedPlayers = new Map();
    const createdWorldItems = [];
    const events = [];
    for (const monster of worldEntities.monsters.values()) {
      const target = playersByUid.get(monster.targetUid);
      if (!target || monster.state !== "combat" || monster.z !== target.z || target.hp <= 0) {
        continue;
      }
      const isAdjacent =
        Math.abs(monster.x - target.x) <= TILE_SIZE && Math.abs(monster.y - target.y) <= TILE_SIZE;
      if (!isAdjacent || currentServerTime < monster.nextAttackTime) {
        continue;
      }
      const monsterData = getMonsterData(monster.monsterId);
      const attackResult = calculateMonsterAttackResult(monsterData?.combat, target, combatRandom ?? undefined);
      monster.nextAttackTime = currentServerTime + MONSTER_ATTACK_COOLDOWN_MS;
      if (attackResult.finalDamage > 0) {
        applyDamageToPlayer(target, attackResult.finalDamage);
      }
      if (target.hp <= 0) {
        const deathPosition = { x: target.x, y: target.y, z: target.z };
        const backpack = target.equipment.backpack;
        let corpse = null;
        if (backpack) {
          target.equipment.backpack = null;
        }
        corpse = createGroundItem("playerCorpse", 1, target.x, target.y, target.z, backpack ? [backpack] : [], {
          decayingItems: worldEntities.decayingItems,
          now: () => currentServerTime,
        });
        if (corpse && worldEntities.worldItems.add(corpse)) {
          createdWorldItems.push(corpse);
        } else {
          target.equipment.backpack = backpack;
          corpse = null;
        }
        const spawnWorldMap = worldMapsByZ.get(target.spawn.z);
        const spawn = findPlayerSpawn(spawnWorldMap, target.spawn.spawnId);
        const spawnPosition = spawn ? findAvailableSpawnPosition(spawnWorldMap, spawn) : null;
        if (spawnPosition) {
          applyPlayerDeathState(target, { ...spawnPosition, z: target.spawn.z });
        }
        for (const otherMonster of worldEntities.monsters.values()) {
          if (otherMonster.targetUid === target.uid) {
            otherMonster.targetUid = null;
            otherMonster.path = [];
            otherMonster.state = "wander";
          }
        }
        events.push({
          type: "player-died",
          playerUid: target.uid,
          corpseUid: corpse?.uid ?? null,
          deathPosition,
          spawnPosition: { x: target.x, y: target.y, z: target.z },
        });
      }
      changedPlayers.set(target.uid, target);
      events.push({
        type: "monster-attack-resolved",
        monsterUid: monster.uid,
        playerUid: target.uid,
        attackResult,
      });
    }
    return { changedPlayers: [...changedPlayers.values()], createdWorldItems, events };
  };

  const updateWorldDecay = () => {
    const upsertedWorldItems = [];
    const removedWorldItemUids = [];
    const upsertedGroundEffects = [];
    const removedGroundEffectUids = [];

    for (const effect of [...worldEntities.groundEffects.values()]) {
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

  const createSimulationForPlayer = (player, inventory, itemUse) => {
    const timing = { nextPlayerMoveTime: 0, nextPlayerAttackTime: 0 };
    return createGameSimulation({
      state: { player, monstersByUid: worldEntities.monsters.getMap(), timing },
      rules: {
        canPlayerAttackMonster,
        canPlayerMove: (payload) => isPlayerDestinationAvailable(player, payload),
        canPlayerUseWorldTransition: (movingPlayer, transition) => isPlayerNearTiledObject(movingPlayer, transition, 1),
        getPlayerMoveTiming: (payload) => {
          const fromTile = { col: payload.fromX / TILE_SIZE, row: payload.fromY / TILE_SIZE };
          const toTile = { col: payload.toX / TILE_SIZE, row: payload.toY / TILE_SIZE };
          const movementCost = getTileMovementCost(fromTile, toTile);
          const animationMultiplier = getTileMovementAnimationMultiplier(fromTile, toTile);
          return movementCost === null || animationMultiplier === null
            ? null
            : {
                duration: PLAYER_MOVE_COOLDOWN_MS * animationMultiplier,
                cooldown: PLAYER_MOVE_COOLDOWN_MS * movementCost,
              };
        },
        getPlayerAttackCooldownMs: () => PLAYER_ATTACK_COOLDOWN_MS,
      },
      commands: {
        executeAttackMonster: (monster) => executePlayerAttack(player, monster),
        executeItemUse: itemUse.execute,
        executeNpcSpeech: (payload) => npcConversationService.handleSpeech(payload.text, player, payload.requestedAt),
        executeSpell: (payload) => executePlayerSpellCast({
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
        executeWorldTransition: (transition) => applyPlayerWorldTransitionState(player, transition, worldMapsByZ),
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
        getPlayerByUid: (playerUid) => playerUid === player.uid ? player : null,
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
      return { success: false, reason: "character-already-online" };
    }
    const player = createPlayerState();
    const persistedCharacter = characterRepository?.load(accountId, characterId) ?? null;
    if (persistedCharacter) {
      hydratePlayerFromPersistence(player, persistedCharacter.snapshot);
    }
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
      : (spawn ? findAvailableSpawnPosition(spawnWorldMap, spawn) : null);
    if (!spawnPosition) {
      return { success: false, reason: "spawn-not-found" };
    }
    player.uid = playerUid;
    player.language = hello?.language === "fr" ? "fr" : "en";
    player.name = typeof hello?.name === "string" && hello.name.trim() !== "" ? hello.name.trim().slice(0, 24) : characterId;
    player.x = spawnPosition.x;
    player.y = spawnPosition.y;
    if (!savedPositionIsValid) {
      player.z = player.spawn.z;
    }
    player.oldX = player.x;
    player.oldY = player.y;
    player.renderX = player.x;
    player.renderY = player.y;
    playersByUid.set(playerUid, player);
    const inventory = createServerPlayerInventory({ player, worldMapsByZ, worldItems: worldEntities.worldItems });
    const itemUse = createServerPlayerItemUse({
      player,
      inventory,
      worldMapsByZ,
      groundEffects: worldEntities.groundEffects,
      monsters: worldEntities.monsters,
      executeRuneDamage: (monster, useData) =>
        resolvePlayerDamageToMonster(
          player,
          monster,
          calculateRuneAttackResult(useData, player, combatRandom ?? undefined),
        ),
    });
    inventoriesByPlayerUid.set(playerUid, inventory);
    simulationsByPlayerUid.set(playerUid, createSimulationForPlayer(player, inventory, itemUse));
    const persistenceSession = {
      accountId,
      characterId,
      version: persistedCharacter?.version ?? null,
      lastSavedAt: currentServerTime,
    };
    sessionsByPlayerUid.set(playerUid, persistenceSession);
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

  const disconnectClient = (session) => {
    const player = playersByUid.get(session.playerUid);
    const persistenceSession = sessionsByPlayerUid.get(session.playerUid);
    if (!player) {
      return false;
    }
    if (characterRepository && persistenceSession) {
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
    }
    playersByUid.delete(session.playerUid);
    simulationsByPlayerUid.delete(session.playerUid);
    inventoriesByPlayerUid.delete(session.playerUid);
    sessionsByPlayerUid.delete(session.playerUid);
    journal.record({ serverTime: currentServerTime, removals: { players: [session.playerUid] } });
    return true;
  };

  const dispatchAction = (session, action) => {
    const simulation = simulationsByPlayerUid.get(session.playerUid);
    if (!simulation || !action?.payload) {
      return { success: false, reason: "invalid-session-or-action" };
    }
    const authoritativeAction = structuredClone(action);
    authoritativeAction.payload.requestedAt = currentServerTime;
    const result = simulation.dispatch(authoritativeAction);
    session.lastProcessedActionRequestId = action.requestId;
    if (result?.success) {
      const player = playersByUid.get(session.playerUid);
      const upserts = { players: [serializePlayerPublicState(player)] };
      const removals = {};
      const changedMonsterUid = result.changes?.monsterUid;
      if (Number.isInteger(changedMonsterUid)) {
        const changedMonster = worldEntities.monsters.get(changedMonsterUid);
        if (changedMonster) {
          upserts.monsters = [serializeMonsterState(changedMonster)];
        } else {
          removals.monsters = [changedMonsterUid];
        }
      }
      const corpseUid = result.changes?.corpseUid;
      const corpse = Number.isInteger(corpseUid) ? worldEntities.worldItems.get(corpseUid) : null;
      if (corpse) {
        upserts.worldItems = [serializeWorldItem(corpse)];
      }
      const changedItemUid = result.changes?.itemUid;
      if (Number.isInteger(changedItemUid)) {
        const changedWorldItem = worldEntities.worldItems.get(changedItemUid);
        if (changedWorldItem) {
          upserts.worldItems = [...(upserts.worldItems ?? []), serializeWorldItem(changedWorldItem)];
        } else if (action.payload?.source?.locationType === "worldItem") {
          removals.worldItems = [changedItemUid];
        }
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
    const visibleChunkKeySet = new Set(visibleChunkKeys);
    const visiblePlayers = [...playersByUid.values()].filter((player) => {
      if (player.uid === selfPlayer.uid || player.z !== selfPlayer.z) {
        return false;
      }
      const chunk = getChunkPositionFromWorldPosition(player.x, player.y);
      return chunk ? visibleChunkKeySet.has(`${player.z}:${chunk.chunkX}:${chunk.chunkY}`) : false;
    });
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
      chunks: view.visibleChunkKeys.map((key) => view.worldMap.chunksByKey.get(key)),
      visibleChunkKeys: view.visibleChunkKeys,
      acknowledgedActionRequestId: session.lastProcessedActionRequestId ?? null,
    });
  };

  const getDeltasForClient = (session, knownRevision) => {
    const sourceDeltas = journal.getDeltasAfter(knownRevision);
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
    const getChangedUids = (entityType) => {
      return new Set(
        sourceDeltas.flatMap((sourceDelta) => sourceDelta.upserts?.[entityType] ?? []).map((entity) => entity.uid),
      );
    };
    const getVisibleEntityUpserts = (entities, previousUids, entityType, serializer) => {
      const changedUids = getChangedUids(entityType);
      return entities
        .filter((entity) => !previousUids.has(entity.uid) || changedUids.has(entity.uid))
        .map(serializer)
        .filter(Boolean);
    };
    const selfChanged = getChangedUids("players").has(view.selfPlayer.uid);
    const visibleEventPlayerUids = new Set([view.selfPlayer.uid, ...previousPlayerUids, ...currentPlayerUids]);
    const visibleEventMonsterUids = new Set([...previousMonsterUids, ...currentMonsterUids]);
    const visibleEventNpcUids = new Set([...previousNpcUids, ...currentNpcUids]);
    const isEventVisible = (event) => {
      if (
        visibleEventPlayerUids.has(event?.actorPlayerUid) ||
        visibleEventPlayerUids.has(event?.playerUid) ||
        visibleEventMonsterUids.has(event?.monsterUid) ||
        visibleEventNpcUids.has(event?.npcUid)
      ) {
        return true;
      }
      const eventChunk = getChunkPositionFromWorldPosition(event?.x, event?.y);
      return eventChunk
        ? currentChunkKeys.has(`${event.z}:${eventChunk.chunkX}:${eventChunk.chunkY}`)
        : false;
    };
    const latestRevision = sourceDeltas.at(-1).revision;
    const delta = createWorldDelta({
      baseRevision: knownRevision,
      revision: latestRevision,
      serverTime: currentServerTime,
      acknowledgedActionRequestId: session.lastProcessedActionRequestId ?? null,
      upserts: {
        self: selfChanged ? serializePlayerPrivateState(view.selfPlayer) : undefined,
        players: getVisibleEntityUpserts(view.visiblePlayers, previousPlayerUids, "players", serializePlayerPublicState),
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
        chunks: addedChunkKeys.map((key) => serializeWorldChunk(view.worldMap.chunksByKey.get(key))),
      },
      removals: {
        players: removedPlayerUids,
        monsters: [...previousMonsterUids].filter((uid) => !currentMonsterUids.has(uid)),
        npcs: [...previousNpcUids].filter((uid) => !currentNpcUids.has(uid)),
        worldItems: [...previousWorldItemUids].filter((uid) => !currentWorldItemUids.has(uid)),
        groundEffects: [...previousGroundEffectUids].filter((uid) => !currentGroundEffectUids.has(uid)),
        chunks: removedChunkKeys,
      },
      events: sourceDeltas.flatMap((sourceDelta) => sourceDelta.events).filter(isEventVisible),
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
      updateWorldDecay();
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
        journal.record({
          serverTime: currentServerTime,
          upserts: { players: regeneratedPlayers.map(serializePlayerPublicState) },
        });
      }
      const npcEvents = npcConversationService.update(currentServerTime);
      if (npcEvents.length > 0) {
        journal.record({ serverTime: currentServerTime, events: npcEvents });
      }
      if (!characterRepository) {
        return;
      }
      for (const [playerUid, persistenceSession] of sessionsByPlayerUid.entries()) {
        if (currentServerTime - persistenceSession.lastSavedAt < AUTOSAVE_INTERVAL_MS) {
          continue;
        }
        const player = playersByUid.get(playerUid);
        persistenceSession.lastSavedAt = currentServerTime;
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
      }
    },
    getPlayer: (playerUid) => playersByUid.get(playerUid) ?? null,
    getPlayerCount: () => playersByUid.size,
    getWorldEntities: () => worldEntities,
    getRevision: () => journal.getRevision(),
  });
};
