import { MinHeap } from "../core/MinHeap.js";
import { MONSTER_RESPAWN_CONFIG, TILE_SIZE } from "../core/gameConstants.js";
import { getRandomInt } from "../core/mathUtils.js";
import { playerState } from "../state/playerState.js";
import {
  monsterSpawnDefinitionsById,
  monsterSpawnStateById,
} from "../state/worldState.js";
import { respawnTimingState } from "../state/clientRuntimeState.js";
import { isTiledCollisionAtTile } from "../world/worldCoordinates.js";

const compareRespawnEvents = (firstEvent, secondEvent) => {
  if (firstEvent.dueAt !== secondEvent.dueAt) {
    return firstEvent.dueAt - secondEvent.dueAt;
  }
  return firstEvent.order - secondEvent.order;
};

export const createMonsterRespawnSystem = ({
  createMonster,
  addMonsterToState,
  isBlockingItemAtPosition,
  isMonsterAtPosition,
  isNpcAtPosition,
  isPlayerAtPosition,
  refreshMonsterHp,
  renderMonsters,
}) => {
  const eventQueue = new MinHeap(compareRespawnEvents);

  const getOrCreateSpawnState = (spawnId) => {
    if (typeof spawnId !== "string" || spawnId === "") {
      return null;
    }
    if (!monsterSpawnStateById.has(spawnId)) {
      monsterSpawnStateById.set(spawnId, { aliveCount: 0, pendingRespawnCount: 0 });
    }
    return monsterSpawnStateById.get(spawnId);
  };

  const getRandomTileInZone = (spawnZone) => {
    if (!Number.isInteger(spawnZone?.col) || !Number.isInteger(spawnZone?.row)) {
      return null;
    }
    const widthTiles = Math.max(Math.ceil((spawnZone.width || TILE_SIZE) / TILE_SIZE), 1);
    const heightTiles = Math.max(Math.ceil((spawnZone.height || TILE_SIZE) / TILE_SIZE), 1);
    return {
      col: spawnZone.col + getRandomInt(0, widthTiles - 1),
      row: spawnZone.row + getRandomInt(0, heightTiles - 1),
    };
  };

  const isPlayerBlockingAtTile = (player, worldMap, col, row) => {
    if (!player || player.z !== worldMap?.z || player.hp <= 0 || !Number.isInteger(col) || !Number.isInteger(row)) {
      return false;
    }
    const playerCol = Math.floor(player.x / TILE_SIZE);
    const playerRow = Math.floor(player.y / TILE_SIZE);
    return (
      Math.abs(playerCol - col) <= MONSTER_RESPAWN_CONFIG.playerBlockRangeX &&
      Math.abs(playerRow - row) <= MONSTER_RESPAWN_CONFIG.playerBlockRangeY
    );
  };

  const canSpawnAtTile = (worldMap, col, row, blockNearPlayers = false) => {
    if (!(worldMap?.chunksByKey instanceof Map) || !Number.isInteger(col) || !Number.isInteger(row)) {
      return false;
    }
    if (isTiledCollisionAtTile(worldMap, col, row)) {
      return false;
    }
    const x = col * TILE_SIZE;
    const y = row * TILE_SIZE;
    if (
      isBlockingItemAtPosition(x, y, worldMap.z) ||
      isMonsterAtPosition(x, y, worldMap.z) ||
      isNpcAtPosition(x, y, worldMap.z) ||
      isPlayerAtPosition(x, y, worldMap.z)
    ) {
      return false;
    }
    return !blockNearPlayers || !isPlayerBlockingAtTile(playerState, worldMap, col, row);
  };

  const getRandomSpawnTile = (worldMap, spawnZone, maxAttempts = 20, blockNearPlayers = false) => {
    if (!(worldMap?.chunksByKey instanceof Map) || !spawnZone || !Number.isInteger(maxAttempts) || maxAttempts <= 0) {
      return null;
    }
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const tile = getRandomTileInZone(spawnZone);
      if (!tile) {
        return null;
      }
      if (canSpawnAtTile(worldMap, tile.col, tile.row, blockNearPlayers)) {
        return tile;
      }
    }
    return null;
  };

  const spawnFromZone = (worldMap, spawnZone, { blockNearPlayers = false } = {}) => {
    const spawnId = spawnZone?.properties?.spawnId;
    const monsterId = spawnZone?.properties?.monsterId;
    const maxCount = spawnZone?.properties?.maxCount;
    if (
      !(worldMap?.chunksByKey instanceof Map) ||
      typeof spawnId !== "string" ||
      spawnId === "" ||
      typeof monsterId !== "string" ||
      monsterId === "" ||
      !Number.isInteger(maxCount) ||
      maxCount <= 0
    ) {
      return null;
    }
    const spawnState = getOrCreateSpawnState(spawnId);
    if (!spawnState || spawnState.aliveCount >= maxCount) {
      return null;
    }
    const tile = getRandomSpawnTile(worldMap, spawnZone, 20, blockNearPlayers);
    if (!tile) {
      return null;
    }
    const monster = createMonster(monsterId, tile.col * TILE_SIZE, tile.row * TILE_SIZE, worldMap.z);
    if (!monster) {
      return null;
    }
    monster.spawnId = spawnId;
    if (!addMonsterToState(monster)) {
      return null;
    }
    spawnState.aliveCount++;
    refreshMonsterHp(monster);
    renderMonsters([monster]);
    return monster;
  };

  const decreaseAliveCount = (monster) => {
    const state = monsterSpawnStateById.get(monster?.spawnId);
    if (!state) {
      return false;
    }
    state.aliveCount = Math.max(state.aliveCount - 1, 0);
    return true;
  };

  const registerSpawnDefinition = (worldMap, spawnZone) => {
    const spawnId = spawnZone?.properties?.spawnId;
    const monsterId = spawnZone?.properties?.monsterId;
    const maxCount = spawnZone?.properties?.maxCount;
    const respawnMs = spawnZone?.properties?.respawnMs;
    if (
      !(worldMap?.chunksByKey instanceof Map) ||
      typeof spawnId !== "string" ||
      spawnId === "" ||
      typeof monsterId !== "string" ||
      monsterId === "" ||
      !Number.isInteger(maxCount) ||
      maxCount <= 0 ||
      !Number.isInteger(respawnMs) ||
      respawnMs <= 0
    ) {
      return null;
    }
    const existing = monsterSpawnDefinitionsById.get(spawnId);
    if (existing) {
      if (existing.z !== worldMap.z || existing.monsterId !== monsterId) {
        console.error(`Duplicate monster spawnId with conflicting data: ${spawnId}`);
        return null;
      }
      return existing;
    }
    const definition = { spawnId, monsterId, maxCount, respawnMs, z: worldMap.z, worldMap, spawnZone };
    monsterSpawnDefinitionsById.set(spawnId, definition);
    getOrCreateSpawnState(spawnId);
    return definition;
  };

  const scheduleAt = (spawnId, dueAt) => {
    const definition = monsterSpawnDefinitionsById.get(spawnId);
    const state = getOrCreateSpawnState(spawnId);
    if (!definition || !state || !Number.isFinite(dueAt)) {
      return false;
    }
    if (state.aliveCount + state.pendingRespawnCount >= definition.maxCount) {
      return false;
    }
    state.pendingRespawnCount++;
    eventQueue.push({ spawnId, dueAt, order: respawnTimingState.nextEventOrder++ });
    return true;
  };

  const schedule = (spawnId, now) => {
    const definition = monsterSpawnDefinitionsById.get(spawnId);
    return definition && Number.isFinite(now) ? scheduleAt(spawnId, now + definition.respawnMs) : false;
  };

  const processEvent = (event, now) => {
    const definition = monsterSpawnDefinitionsById.get(event?.spawnId);
    const state = monsterSpawnStateById.get(event?.spawnId);
    if (!definition || !state) {
      return false;
    }
    if (state.aliveCount >= definition.maxCount) {
      state.pendingRespawnCount = Math.max(state.pendingRespawnCount - 1, 0);
      return false;
    }
    const monster = spawnFromZone(definition.worldMap, definition.spawnZone, { blockNearPlayers: true });
    if (monster) {
      state.pendingRespawnCount = Math.max(state.pendingRespawnCount - 1, 0);
      return true;
    }
    event.dueAt = now + MONSTER_RESPAWN_CONFIG.blockedRetryMs;
    event.order = respawnTimingState.nextEventOrder++;
    eventQueue.push(event);
    return false;
  };

  const update = (now) => {
    if (!Number.isFinite(now)) {
      return;
    }
    let processedCount = 0;
    while (
      eventQueue.size > 0 &&
      eventQueue.peek().dueAt <= now &&
      processedCount < MONSTER_RESPAWN_CONFIG.maxEventsPerLogicStep
    ) {
      processEvent(eventQueue.pop(), now);
      processedCount++;
    }
  };

  const getSpawnZones = (worldMap) => {
    if (!(worldMap?.chunksByKey instanceof Map)) {
      return [];
    }
    const zones = [];
    for (const chunk of worldMap.chunksByKey.values()) {
      if (!Array.isArray(chunk.spawns)) {
        continue;
      }
      for (const spawn of chunk.spawns) {
        if (spawn.properties?.spawnType === "monster") {
          zones.push(spawn);
        }
      }
    }
    return zones;
  };

  return {
    canSpawnAtTile,
    decreaseAliveCount,
    getOrCreateSpawnState,
    getSpawnZones,
    registerSpawnDefinition,
    schedule,
    scheduleAt,
    spawnFromZone,
    update,
  };
};
