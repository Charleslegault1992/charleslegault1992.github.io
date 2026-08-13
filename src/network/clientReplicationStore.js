const createEntityMaps = () => ({
  players: new Map(),
  monsters: new Map(),
  npcs: new Map(),
  worldItems: new Map(),
  groundEffects: new Map(),
});

const replaceMapFromEntities = (targetMap, entities) => {
  targetMap.clear();
  for (const entity of entities ?? []) {
    targetMap.set(entity.uid, structuredClone(entity));
  }
};

const upsertEntities = (targetMap, entities) => {
  for (const entity of entities ?? []) {
    if (entity && (typeof entity.uid === "string" || Number.isInteger(entity.uid))) {
      targetMap.set(entity.uid, structuredClone(entity));
    }
  }
};

const removeEntities = (targetMap, entityUids) => {
  for (const entityUid of entityUids ?? []) {
    targetMap.delete(entityUid);
  }
};

export const createClientReplicationStore = () => {
  let revision = null;
  let self = null;
  let acknowledgedActionRequestId = null;
  const entities = createEntityMaps();
  const chunksByKey = new Map();

  const applySnapshot = (snapshot) => {
    if (!Number.isSafeInteger(snapshot?.revision) || !snapshot?.self || !snapshot?.entities) {
      return { success: false, reason: "invalid-snapshot" };
    }
    revision = snapshot.revision;
    self = structuredClone(snapshot.self);
    acknowledgedActionRequestId = snapshot.acknowledgedActionRequestId ?? null;
    for (const entityType of Object.keys(entities)) {
      replaceMapFromEntities(entities[entityType], snapshot.entities[entityType]);
    }
    chunksByKey.clear();
    for (const chunk of snapshot.chunks ?? []) {
      chunksByKey.set(chunk.key, structuredClone(chunk));
    }
    return { success: true, revision };
  };

  const applyDelta = (delta) => {
    if (!Number.isSafeInteger(revision)) {
      return { success: false, reason: "snapshot-required" };
    }
    if (!Number.isSafeInteger(delta?.baseRevision) || !Number.isSafeInteger(delta?.revision)) {
      return { success: false, reason: "invalid-delta" };
    }
    if (delta.revision <= revision) {
      return { success: true, stale: true, revision, events: [] };
    }
    if (delta.baseRevision !== revision) {
      return { success: false, reason: "revision-gap", expectedRevision: revision };
    }

    if (delta.upserts?.self) {
      self = structuredClone(delta.upserts.self);
    }
    acknowledgedActionRequestId = delta.acknowledgedActionRequestId ?? acknowledgedActionRequestId;
    for (const entityType of Object.keys(entities)) {
      upsertEntities(entities[entityType], delta.upserts?.[entityType]);
      removeEntities(entities[entityType], delta.removals?.[entityType]);
    }
    for (const chunk of delta.upserts?.chunks ?? []) {
      chunksByKey.set(chunk.key, structuredClone(chunk));
    }
    for (const chunkKey of delta.removals?.chunks ?? []) {
      chunksByKey.delete(chunkKey);
    }
    revision = delta.revision;
    return { success: true, revision, events: structuredClone(delta.events ?? []) };
  };

  return Object.freeze({
    applyDelta,
    applySnapshot,
    getRevision: () => revision,
    getSelf: () => cloneOrNull(self),
    getAcknowledgedActionRequestId: () => acknowledgedActionRequestId,
    getEntity: (entityType, uid) => cloneOrNull(entities[entityType]?.get(uid) ?? null),
    getEntities: (entityType) =>
      entities[entityType] instanceof Map
        ? [...entities[entityType].values()].map((entity) => structuredClone(entity))
        : [],
    getChunk: (chunkKey) => cloneOrNull(chunksByKey.get(chunkKey) ?? null),
    getChunks: () => [...chunksByKey.values()].map((chunk) => structuredClone(chunk)),
  });
};

const cloneOrNull = (value) => (value == null ? null : structuredClone(value));

export const getPlayerReconciliation = (predictedPlayer, authoritativePlayer) => {
  if (!predictedPlayer || !authoritativePlayer || predictedPlayer.uid !== authoritativePlayer.uid) {
    return { requiresCorrection: false, reason: "player-mismatch" };
  }
  const requiresCorrection =
    predictedPlayer.x !== authoritativePlayer.x ||
    predictedPlayer.y !== authoritativePlayer.y ||
    predictedPlayer.z !== authoritativePlayer.z;
  return {
    requiresCorrection,
    position: requiresCorrection
      ? { x: authoritativePlayer.x, y: authoritativePlayer.y, z: authoritativePlayer.z }
      : null,
  };
};
