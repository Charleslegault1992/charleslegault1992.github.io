import { playerState } from "../state/playerState.js";
import {
  npcConversationStatesByUid,
  npcsByUid,
  npcUidByTileKey,
  npcUidsByChunkKey,
} from "../state/worldState.js";
import { getChunkPositionFromWorldPosition } from "../world/worldCoordinates.js";
import { getWorldTileStackKey } from "../world/worldItemStacks.js";
import { createNpcFromWorldObject } from "./npcModel.js";

export const getNpcTileKey = (x, y, z) => {
  return getWorldTileStackKey(x, y, z);
};

export const getNpcChunkKeyByGridPosition = (chunkX, chunkY, z) => {
  if (!Number.isInteger(chunkX) || !Number.isInteger(chunkY) || !Number.isInteger(z)) {
    return null;
  }
  return `${z}:${chunkX}:${chunkY}`;
};

export const getNpcChunkKey = (x, y, z) => {
  const chunkPosition = getChunkPositionFromWorldPosition(x, y);
  if (!chunkPosition || !Number.isInteger(z)) {
    return null;
  }
  return getNpcChunkKeyByGridPosition(chunkPosition.chunkX, chunkPosition.chunkY, z);
};

const addNpcUidToChunkIndex = (npc) => {
  const chunkKey = getNpcChunkKey(npc?.x, npc?.y, npc?.z);
  if (typeof npc?.uid !== "string" || !chunkKey) {
    return false;
  }
  let npcUids = npcUidsByChunkKey.get(chunkKey);
  if (!npcUids) {
    npcUids = new Set();
    npcUidsByChunkKey.set(chunkKey, npcUids);
  }
  npcUids.add(npc.uid);
  return true;
};

const removeNpcUidFromChunkIndex = (npc) => {
  const chunkKey = getNpcChunkKey(npc?.x, npc?.y, npc?.z);
  const npcUids = chunkKey ? npcUidsByChunkKey.get(chunkKey) : null;
  if (!npcUids || !npcUids.delete(npc?.uid)) {
    return false;
  }
  if (npcUids.size === 0) {
    npcUidsByChunkKey.delete(chunkKey);
  }
  return true;
};

export const createNpcConversationState = () => {
  return {
    activePlayerUid: null,
    waitingPlayerUids: [],
    queuedReplies: [],
    pendingAction: null,
    activeMenu: null,
    activeShopCategory: null,
    nextReplyAt: 0,
    lastInteractionAt: 0,
  };
};

export const addNpcToState = (npc) => {
  const tileKey = getNpcTileKey(npc?.x, npc?.y, npc?.z);
  if (!npc || typeof npc.uid !== "string" || !tileKey || npcsByUid.has(npc.uid) || npcUidByTileKey.has(tileKey)) {
    return false;
  }
  npcsByUid.set(npc.uid, npc);
  npcUidByTileKey.set(tileKey, npc.uid);
  addNpcUidToChunkIndex(npc);
  npcConversationStatesByUid.set(npc.uid, createNpcConversationState());
  return true;
};

export const moveNpcInTileIndex = (npc, nextX, nextY) => {
  const currentTileKey = getNpcTileKey(npc?.x, npc?.y, npc?.z);
  const nextTileKey = getNpcTileKey(nextX, nextY, npc?.z);
  const currentChunkKey = getNpcChunkKey(npc?.x, npc?.y, npc?.z);
  const nextChunkKey = getNpcChunkKey(nextX, nextY, npc?.z);
  if (!currentTileKey || !nextTileKey || !currentChunkKey || !nextChunkKey) {
    return false;
  }
  const occupyingNpcUid = npcUidByTileKey.get(nextTileKey);
  if (occupyingNpcUid !== undefined && occupyingNpcUid !== npc.uid) {
    return false;
  }
  if (npcUidByTileKey.get(currentTileKey) === npc.uid) {
    npcUidByTileKey.delete(currentTileKey);
  }
  npcUidByTileKey.set(nextTileKey, npc.uid);

  if (currentChunkKey !== nextChunkKey) {
    removeNpcUidFromChunkIndex(npc);
    let nextChunkNpcUids = npcUidsByChunkKey.get(nextChunkKey);
    if (!nextChunkNpcUids) {
      nextChunkNpcUids = new Set();
      npcUidsByChunkKey.set(nextChunkKey, nextChunkNpcUids);
    }
    nextChunkNpcUids.add(npc.uid);
  }
  return true;
};

export const getNpcsInChunkRadius = (x, y, z, radiusChunks) => {
  const centerChunk = getChunkPositionFromWorldPosition(x, y);
  if (!centerChunk || !Number.isInteger(z) || !Number.isInteger(radiusChunks) || radiusChunks < 0) {
    return [];
  }
  const nearbyNpcs = [];
  for (let chunkY = centerChunk.chunkY - radiusChunks; chunkY <= centerChunk.chunkY + radiusChunks; chunkY++) {
    for (let chunkX = centerChunk.chunkX - radiusChunks; chunkX <= centerChunk.chunkX + radiusChunks; chunkX++) {
      const chunkKey = getNpcChunkKeyByGridPosition(chunkX, chunkY, z);
      const npcUids = npcUidsByChunkKey.get(chunkKey);
      if (!npcUids) {
        continue;
      }
      for (const npcUid of npcUids) {
        const npc = npcsByUid.get(npcUid);
        if (npc) {
          nearbyNpcs.push(npc);
        }
      }
    }
  }
  return nearbyNpcs;
};

export const rebuildNpcSpatialIndexes = () => {
  npcUidByTileKey.clear();
  npcUidsByChunkKey.clear();
  for (const npc of npcsByUid.values()) {
    const tileKey = getNpcTileKey(npc?.x, npc?.y, npc?.z);
    if (typeof npc?.uid !== "string" || !tileKey || npcUidByTileKey.has(tileKey)) {
      continue;
    }
    npcUidByTileKey.set(tileKey, npc.uid);
    addNpcUidToChunkIndex(npc);
    if (!npcConversationStatesByUid.has(npc.uid)) {
      npcConversationStatesByUid.set(npc.uid, createNpcConversationState());
    }
  }
  for (const npcUid of npcConversationStatesByUid.keys()) {
    if (!npcsByUid.has(npcUid)) {
      npcConversationStatesByUid.delete(npcUid);
    }
  }
};

export const initializeNpcsForWorldMaps = (worldMapsByZ) => {
  if (!(worldMapsByZ instanceof Map)) {
    return false;
  }

  for (const worldMap of worldMapsByZ.values()) {
    for (const chunk of worldMap.chunksByKey.values()) {
      if (!Array.isArray(chunk.npcs)) {
        continue;
      }
      for (const worldNpcObject of chunk.npcs) {
        const npc = createNpcFromWorldObject(worldNpcObject);
        if (npc) {
          addNpcToState(npc);
        }
      }
    }
  }
  return true;
};

export const findNpcAtPosition = (x, y, z = playerState.z) => {
  const tileKey = getNpcTileKey(x, y, z);
  const npcUid = tileKey ? npcUidByTileKey.get(tileKey) : null;
  return npcUid ? (npcsByUid.get(npcUid) ?? null) : null;
};

export const isNpcAtPosition = (x, y, z = playerState.z) => {
  return findNpcAtPosition(x, y, z) !== null;
};
