import { MONSTER_AI_CHUNK_RADIUS } from "../core/gameConstants.js";
import { playerState } from "../state/playerState.js";
import {
  monstersByUid,
  monsterUidByTileKey,
  monsterUidsByChunkKey,
} from "../state/worldState.js";
import { getChunkPositionFromWorldPosition } from "../world/worldCoordinates.js";
import { getWorldTileStackKey } from "../world/worldItemStacks.js";

export const getMonsterTileKey = (x, y, z) => {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isInteger(z)) {
    return null;
  }
  return getWorldTileStackKey(x, y, z);
};

export const getMonsterChunkKeyByGridPosition = (chunkX, chunkY, z) => {
  if (!Number.isInteger(chunkX) || !Number.isInteger(chunkY) || !Number.isInteger(z)) {
    return null;
  }
  return `${z}:${chunkX}:${chunkY}`;
};

export const getMonsterChunkKey = (x, y, z) => {
  if (!Number.isInteger(z)) {
    return null;
  }
  const chunkPosition = getChunkPositionFromWorldPosition(x, y);
  if (!chunkPosition) {
    return null;
  }
  return getMonsterChunkKeyByGridPosition(chunkPosition.chunkX, chunkPosition.chunkY, z);
};

export const addMonsterUidToChunkIndex = (monster) => {
  const chunkKey = getMonsterChunkKey(monster?.x, monster?.y, monster?.z);
  if (!Number.isInteger(monster?.uid) || !chunkKey) {
    return false;
  }
  let monsterUids = monsterUidsByChunkKey.get(chunkKey);
  if (!monsterUids) {
    monsterUids = new Set();
    monsterUidsByChunkKey.set(chunkKey, monsterUids);
  }
  monsterUids.add(monster.uid);
  return true;
};

export const removeMonsterUidFromChunkIndex = (monster) => {
  const chunkKey = getMonsterChunkKey(monster?.x, monster?.y, monster?.z);
  if (!Number.isInteger(monster?.uid) || !chunkKey) {
    return false;
  }
  const monsterUids = monsterUidsByChunkKey.get(chunkKey);
  if (!monsterUids || !monsterUids.delete(monster.uid)) {
    return false;
  }
  if (monsterUids.size === 0) {
    monsterUidsByChunkKey.delete(chunkKey);
  }
  return true;
};

export const getMonstersInChunkRadius = (x, y, z, radiusChunks) => {
  if (!Number.isInteger(z) || !Number.isInteger(radiusChunks) || radiusChunks < 0) {
    return [];
  }
  const centerChunk = getChunkPositionFromWorldPosition(x, y);
  if (!centerChunk) {
    return [];
  }

  const nearbyMonsters = [];
  for (let chunkY = centerChunk.chunkY - radiusChunks; chunkY <= centerChunk.chunkY + radiusChunks; chunkY++) {
    for (let chunkX = centerChunk.chunkX - radiusChunks; chunkX <= centerChunk.chunkX + radiusChunks; chunkX++) {
      const chunkKey = getMonsterChunkKeyByGridPosition(chunkX, chunkY, z);
      const monsterUids = monsterUidsByChunkKey.get(chunkKey);
      if (!monsterUids) {
        continue;
      }
      for (const monsterUid of monsterUids) {
        const monster = monstersByUid.get(monsterUid);
        if (monster) {
          nearbyMonsters.push(monster);
        }
      }
    }
  }
  return nearbyMonsters;
};

export const getActiveMonstersAroundPlayer = () => {
  return getMonstersInChunkRadius(playerState.x, playerState.y, playerState.z, MONSTER_AI_CHUNK_RADIUS);
};

export const addMonsterToState = (monster) => {
  const tileKey = getMonsterTileKey(monster?.x, monster?.y, monster?.z);
  const chunkKey = getMonsterChunkKey(monster?.x, monster?.y, monster?.z);
  if (
    !Number.isInteger(monster?.uid) ||
    !tileKey ||
    !chunkKey ||
    monstersByUid.has(monster.uid) ||
    monsterUidByTileKey.has(tileKey)
  ) {
    return false;
  }
  monstersByUid.set(monster.uid, monster);
  monsterUidByTileKey.set(tileKey, monster.uid);
  addMonsterUidToChunkIndex(monster);
  return true;
};

export const moveMonsterInTileIndex = (monster, nextX, nextY) => {
  const currentTileKey = getMonsterTileKey(monster?.x, monster?.y, monster?.z);
  const nextTileKey = getMonsterTileKey(nextX, nextY, monster?.z);
  const currentChunkKey = getMonsterChunkKey(monster?.x, monster?.y, monster?.z);
  const nextChunkKey = getMonsterChunkKey(nextX, nextY, monster?.z);
  if (!currentTileKey || !nextTileKey || !currentChunkKey || !nextChunkKey) {
    return false;
  }

  const occupyingMonsterUid = monsterUidByTileKey.get(nextTileKey);
  if (occupyingMonsterUid !== undefined && occupyingMonsterUid !== monster.uid) {
    return false;
  }
  if (monsterUidByTileKey.get(currentTileKey) === monster.uid) {
    monsterUidByTileKey.delete(currentTileKey);
  }
  monsterUidByTileKey.set(nextTileKey, monster.uid);

  if (currentChunkKey !== nextChunkKey) {
    removeMonsterUidFromChunkIndex(monster);
    let nextChunkMonsterUids = monsterUidsByChunkKey.get(nextChunkKey);
    if (!nextChunkMonsterUids) {
      nextChunkMonsterUids = new Set();
      monsterUidsByChunkKey.set(nextChunkKey, nextChunkMonsterUids);
    }
    nextChunkMonsterUids.add(monster.uid);
  }
  return true;
};

export const isMonsterAtPosition = (x, y, z = playerState.z) => {
  const tileKey = getMonsterTileKey(x, y, z);
  return tileKey ? monsterUidByTileKey.has(tileKey) : false;
};

export const findMonsterAtPosition = (x, y, z = playerState.z) => {
  const tileKey = getMonsterTileKey(x, y, z);
  if (!tileKey) {
    return null;
  }
  const monsterUid = monsterUidByTileKey.get(tileKey);
  return monsterUid === undefined ? null : (monstersByUid.get(monsterUid) ?? null);
};

export const removeMonsterFromState = (monsterUid) => {
  const monster = monstersByUid.get(monsterUid);
  if (!monster) {
    return false;
  }
  const tileKey = getMonsterTileKey(monster.x, monster.y, monster.z);
  if (tileKey && monsterUidByTileKey.get(tileKey) === monsterUid) {
    monsterUidByTileKey.delete(tileKey);
  }
  removeMonsterUidFromChunkIndex(monster);
  monstersByUid.delete(monsterUid);
  return true;
};
