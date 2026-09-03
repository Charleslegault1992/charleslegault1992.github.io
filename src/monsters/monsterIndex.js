import { MONSTER_AI_CHUNK_RADIUS, TILE_SIZE } from "../core/gameConstants.js";
import { monstersDatabase } from "../data/monstersDatabase.js";
import { playerState } from "../state/playerState.js";
import { monstersByUid, monsterUidByTileKey, monsterUidsByChunkKey } from "../state/worldState.js";
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

export const rebuildMonsterSpatialIndexes = () => {
  monsterUidByTileKey.clear();
  monsterUidsByChunkKey.clear();
  for (const monster of monstersByUid.values()) {
    const tileKey = getMonsterTileKey(monster?.x, monster?.y, monster?.z);
    if (!Number.isInteger(monster?.uid) || !tileKey || monsterUidByTileKey.has(tileKey)) {
      continue;
    }
    monsterUidByTileKey.set(tileKey, monster.uid);
    addMonsterUidToChunkIndex(monster);
  }
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

export const findTargetableMonsterAtPosition = (x, y, z = playerState.z) => {
  /*
   * Cas normal :
   * la case cliquee est directement la case logique du monstre.
   */
  const directMonster = findMonsterAtPosition(x, y, z);
  if (directMonster) {
    return directMonster;
  }

  /*
   * Boss 3x3 :
   *
   * La case logique du boss est la case milieu-bas.
   *
   * [ ][ ][ ]
   * [ ][X][ ] <- cette case doit aussi pouvoir cibler le boss
   * [ ][X][ ] <- vraie case logique / anchor
   *
   * Donc, si on clique la case du dessus, on regarde
   * s'il existe un monstre une tuile plus bas.
   */
  const monsterBelow = findMonsterAtPosition(x, y + TILE_SIZE, z);
  if (!monsterBelow) {
    return null;
  }

  const monsterData = monstersDatabase[monsterBelow.monsterId];
  if (!monsterData || !Array.isArray(monsterData.interactionHitboxes)) {
    return null;
  }

  /*
   * Position du carre clique dans le rectangle visuel du monstre.
   *
   * Boss:
   * drawOffsetX = -64
   * drawOffsetY = -128
   *
   * Pour la case milieu-milieu :
   * localX = 64
   * localY = 64
   */
  const visualX = monsterBelow.x + (monsterData.drawOffsetX ?? 0);
  const visualY = monsterBelow.y + (monsterData.drawOffsetY ?? 0);

  const localX = x - visualX;
  const localY = y - visualY;

  const canTarget = monsterData.interactionHitboxes.some((hitbox) => {
    return (
      localX >= hitbox.offsetX &&
      localX < hitbox.offsetX + hitbox.width &&
      localY >= hitbox.offsetY &&
      localY < hitbox.offsetY + hitbox.height
    );
  });

  return canTarget ? monsterBelow : null;
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
