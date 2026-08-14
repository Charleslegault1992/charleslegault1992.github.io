import { getItemData } from "../items/itemModel.js";
import { activeLitTorchesByUid } from "../state/worldState.js";

const REPLICATED_ENTITY_TYPES = Object.freeze(["players", "monsters", "npcs", "worldItems", "groundEffects"]);

const isItemState = (value) => Number.isInteger(value?.uid) && typeof value?.itemId === "string";

const collectItemReferences = (item, itemsByUid) => {
  if (!isItemState(item)) {
    return;
  }
  itemsByUid.set(item.uid, item);
  for (const child of item.content ?? []) {
    collectItemReferences(child, itemsByUid);
  }
};

const syncTorchStateFromItem = (item) => {
  if (!isItemState(item)) {
    return;
  }
  const itemData = getItemData(item.itemId);
  if (!itemData?.lightSource) {
    activeLitTorchesByUid.delete(item.uid);
    return;
  }
  if (item.isLit === true && item.fuelRemainingMs > 0) {
    activeLitTorchesByUid.set(item.uid, item);
  } else {
    activeLitTorchesByUid.delete(item.uid);
  }
};

const syncTorchStatesFromContainer = (item) => {
  if (!item) {
    return;
  }
  syncTorchStateFromItem(item);
  if (Array.isArray(item.content)) {
    for (const child of item.content) {
      syncTorchStatesFromContainer(child);
    }
  }
};

const synchronizeItemState = (target, source, itemsByUid) => {
  for (const [key, value] of Object.entries(source)) {
    if (key !== "content") {
      target[key] = structuredClone(value);
    }
  }
  if (Array.isArray(source.content)) {
    target.content = source.content.map((sourceItem) => {
      if (!isItemState(sourceItem)) {
        return null;
      }
      const currentItem = itemsByUid.get(sourceItem.uid) ?? null;
      if (!currentItem) {
        return structuredClone(sourceItem);
      }
      return synchronizeItemState(currentItem, sourceItem, itemsByUid);
    });
  }
  return target;
};

const synchronizeEquipmentState = (targetEquipment, sourceEquipment) => {
  const itemsByUid = new Map();
  for (const item of Object.values(targetEquipment)) {
    collectItemReferences(item, itemsByUid);
  }
  for (const slotName of Object.keys(targetEquipment)) {
    if (!(slotName in sourceEquipment)) {
      const removedItem = targetEquipment[slotName];
      syncTorchStatesFromContainer(removedItem);
      delete targetEquipment[slotName];
    }
  }
  for (const [slotName, sourceItem] of Object.entries(sourceEquipment)) {
    const currentItem = isItemState(sourceItem) ? (itemsByUid.get(sourceItem.uid) ?? null) : null;
    targetEquipment[slotName] = currentItem
      ? synchronizeItemState(currentItem, sourceItem, itemsByUid)
      : structuredClone(sourceItem);
    syncTorchStatesFromContainer(targetEquipment[slotName]);
  }
};

const copyFieldsInto = (target, source) => {
  if (!target || !source) {
    return false;
  }
  if (isItemState(target) && isItemState(source) && target.uid === source.uid) {
    const itemsByUid = new Map();
    collectItemReferences(target, itemsByUid);
    synchronizeItemState(target, source, itemsByUid);
    return true;
  }
  for (const [key, value] of Object.entries(source)) {
    if (key === "equipment" && target.equipment && value && typeof value === "object") {
      synchronizeEquipmentState(target.equipment, value);
      continue;
    }
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

    // Preserve old position for smooth interpolation before applying new state
    const previousX = playerState.x;
    const previousY = playerState.y;

    copyFieldsInto(playerState, nextSelf);

    // If position changed and we're not in a snapshot, update oldX/oldY for interpolation
    if (event.type !== "server.snapshot" && (previousX !== playerState.x || previousY !== playerState.y)) {
      playerState.oldX = previousX;
      playerState.oldY = previousY;
      // Preserve valid movement timing from nextSelf/predictedSelf; only fall back if missing/invalid
      if (!Number.isFinite(playerState.moveStartTime) || !Number.isFinite(playerState.moveDuration)) {
        playerState.moveStartTime = Date.now();
        playerState.moveDuration = 100; // Short interpolation for reconciliation
      }
    }

    if (
      event.type === "server.snapshot" ||
      !Number.isFinite(playerState.renderX) ||
      !Number.isFinite(playerState.renderY)
    ) {
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
