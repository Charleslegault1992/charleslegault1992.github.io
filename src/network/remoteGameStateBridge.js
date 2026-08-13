const REPLICATED_ENTITY_TYPES = Object.freeze(["players", "monsters", "npcs", "worldItems", "groundEffects"]);

const copyFieldsInto = (target, source) => {
  if (!target || !source) {
    return false;
  }
  for (const [key, value] of Object.entries(source)) {
    target[key] = structuredClone(value);
  }
  return true;
};

const synchronizeEntityMap = (targetMap, replicatedEntities) => {
  const visibleUids = new Set();
  for (const replicatedEntity of replicatedEntities) {
    visibleUids.add(replicatedEntity.uid);
    const currentEntity = targetMap.get(replicatedEntity.uid) ?? null;
    if (currentEntity) {
      copyFieldsInto(currentEntity, replicatedEntity);
    } else {
      const nextEntity = structuredClone(replicatedEntity);
      nextEntity.renderX = nextEntity.x;
      nextEntity.renderY = nextEntity.y;
      nextEntity.walkFrame = 1;
      targetMap.set(replicatedEntity.uid, nextEntity);
    }
  }
  for (const entityUid of targetMap.keys()) {
    if (!visibleUids.has(entityUid)) {
      targetMap.delete(entityUid);
    }
  }
};

export const createRemoteGameStateBridge = ({
  transport,
  playerState,
  entityMaps,
  onStateApplied = null,
  onEvents = null,
  onConnectionStateChanged = null,
}) => {
  const replicationStore = transport?.getReplicationStore?.();
  if (!replicationStore || !playerState || !entityMaps) {
    throw new TypeError("The remote state bridge requires a transport, player state and entity maps.");
  }
  for (const entityType of REPLICATED_ENTITY_TYPES) {
    if (!(entityMaps[entityType] instanceof Map)) {
      throw new TypeError(`Missing replicated entity map: ${entityType}`);
    }
  }

  const applyReplicatedState = (event) => {
    const nextSelf = event.predictedSelf ?? replicationStore.getSelf();
    copyFieldsInto(playerState, nextSelf);
    if (event.type === "server.snapshot" || !Number.isFinite(playerState.renderX) || !Number.isFinite(playerState.renderY)) {
      playerState.renderX = playerState.x;
      playerState.renderY = playerState.y;
    }
    for (const entityType of REPLICATED_ENTITY_TYPES) {
      synchronizeEntityMap(entityMaps[entityType], replicationStore.getEntities(entityType));
    }
    onStateApplied?.({
      revision: replicationStore.getRevision(),
      chunks: replicationStore.getChunks(),
      event,
    });
    if (Array.isArray(event.result?.events) && event.result.events.length > 0) {
      onEvents?.(event.result.events);
    }
  };

  const unsubscribe = transport.subscribe((event) => {
    if (event.type === "server.snapshot" || event.type === "server.delta" || event.type === "prediction-updated") {
      applyReplicatedState(event);
      return;
    }
    if (event.type === "connection-state") {
      onConnectionStateChanged?.(event);
    }
  });

  return Object.freeze({
    applyReplicatedState,
    disconnect: unsubscribe,
  });
};
