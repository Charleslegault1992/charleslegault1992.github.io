import { getChunkPositionFromWorldPosition } from "../src/world/worldCoordinates.js";

const getEntityChunkKey = (entity) => {
  const chunk = getChunkPositionFromWorldPosition(entity?.x, entity?.y);
  return chunk && Number.isInteger(entity?.z) ? `${entity.z}:${chunk.chunkX}:${chunk.chunkY}` : null;
};

export const createSpatialEntityStore = () => {
  const entitiesByUid = new Map();
  const entityUidsByChunkKey = new Map();

  const addToChunk = (entity, chunkKey) => {
    let uids = entityUidsByChunkKey.get(chunkKey);
    if (!uids) {
      uids = new Set();
      entityUidsByChunkKey.set(chunkKey, uids);
    }
    uids.add(entity.uid);
  };

  const removeFromChunk = (entity, chunkKey) => {
    const uids = entityUidsByChunkKey.get(chunkKey);
    if (!uids) {
      return;
    }
    uids.delete(entity.uid);
    if (uids.size === 0) {
      entityUidsByChunkKey.delete(chunkKey);
    }
  };

  return Object.freeze({
    add(entity) {
      const chunkKey = getEntityChunkKey(entity);
      if ((typeof entity?.uid !== "string" && !Number.isInteger(entity?.uid)) || !chunkKey || entitiesByUid.has(entity.uid)) {
        return false;
      }
      entitiesByUid.set(entity.uid, entity);
      addToChunk(entity, chunkKey);
      return true;
    },
    remove(uid) {
      const entity = entitiesByUid.get(uid);
      if (!entity) {
        return false;
      }
      removeFromChunk(entity, getEntityChunkKey(entity));
      entitiesByUid.delete(uid);
      return true;
    },
    updatePosition(uid, x, y, z) {
      const entity = entitiesByUid.get(uid);
      if (!entity || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isInteger(z)) {
        return false;
      }
      const previousChunkKey = getEntityChunkKey(entity);
      entity.x = x;
      entity.y = y;
      entity.z = z;
      const nextChunkKey = getEntityChunkKey(entity);
      if (!nextChunkKey) {
        return false;
      }
      if (nextChunkKey !== previousChunkKey) {
        removeFromChunk(entity, previousChunkKey);
        addToChunk(entity, nextChunkKey);
      }
      return true;
    },
    get: (uid) => entitiesByUid.get(uid) ?? null,
    has: (uid) => entitiesByUid.has(uid),
    getAt(x, y, z) {
      const chunkKey = getEntityChunkKey({ x, y, z });
      for (const uid of entityUidsByChunkKey.get(chunkKey) ?? []) {
        const entity = entitiesByUid.get(uid);
        if (entity?.x === x && entity?.y === y && entity?.z === z) {
          return entity;
        }
      }
      return null;
    },
    getAllAt(x, y, z) {
      const chunkKey = getEntityChunkKey({ x, y, z });
      const entities = [];
      for (const uid of entityUidsByChunkKey.get(chunkKey) ?? []) {
        const entity = entitiesByUid.get(uid);
        if (entity?.x === x && entity?.y === y && entity?.z === z) {
          entities.push(entity);
        }
      }
      return entities;
    },
    getMap: () => entitiesByUid,
    values: () => entitiesByUid.values(),
    getInChunkKeys(chunkKeys) {
      const entities = [];
      const visitedUids = new Set();
      for (const chunkKey of chunkKeys ?? []) {
        for (const uid of entityUidsByChunkKey.get(chunkKey) ?? []) {
          if (!visitedUids.has(uid)) {
            visitedUids.add(uid);
            entities.push(entitiesByUid.get(uid));
          }
        }
      }
      return entities.filter(Boolean);
    },
    getSize: () => entitiesByUid.size,
  });
};
