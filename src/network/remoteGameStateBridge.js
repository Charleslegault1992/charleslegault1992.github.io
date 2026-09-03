import { TILE_SIZE } from "../core/gameConstants.js";
import { GAMEPLAY_ACTION_TYPE } from "../actions/gameplayActions.js";
import { getItemData } from "../items/itemModel.js";
import { activeLitTorchesByUid } from "../state/worldState.js";
import {
  REMOTE_INTERPOLATED_ENTITY_TYPES,
  REMOTE_INTERPOLATION_IGNORED_FIELDS,
  remoteEntityInterpolationStore,
} from "./remoteEntityInterpolationStore.js";

const REPLICATED_ENTITY_TYPES = Object.freeze(["players", "monsters", "npcs", "worldItems", "groundEffects", "doors"]);
const VISUAL_ONLY_ENTITY_FIELDS = new Set(["renderX", "renderY"]);
const LOCAL_PLAYER_SERVER_IGNORED_FIELDS = new Set([
  "renderX",
  "renderY",
  "oldX",
  "oldY",
  "moveStartTime",
  "moveDuration",
]);

const LOCAL_PLAYER_MAX_SMOOTH_CORRECTION_DISTANCE = TILE_SIZE * 1.5;
const LOCAL_PLAYER_CORRECTION_DURATION_MS = 70;
const LOCAL_PLAYER_PREDICTED_MOVEMENT_FIELDS = Object.freeze([
  "x",
  "y",
  "z",
  "oldX",
  "oldY",
  "direction",
  "moveStartTime",
  "moveDuration",
]);

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

const copyFieldsInto = (target, source, options = {}) => {
  if (!target || !source) {
    return false;
  }

  if (isItemState(target) && isItemState(source) && target.uid === source.uid) {
    const itemsByUid = new Map();
    collectItemReferences(target, itemsByUid);
    synchronizeItemState(target, source, itemsByUid);
    return true;
  }

  const ignoredFields = options.ignoredFields instanceof Set ? options.ignoredFields : null;

  for (const [key, value] of Object.entries(source)) {
    if (ignoredFields?.has(key)) {
      continue;
    }

    if (VISUAL_ONLY_ENTITY_FIELDS.has(key) && "renderX" in target && "renderY" in target) {
      continue;
    }

    if (key === "equipment" && target.equipment && value && typeof value === "object") {
      synchronizeEquipmentState(target.equipment, value);
      continue;
    }

    target[key] = structuredClone(value);
  }

  return true;
};

const copySelectedFieldsInto = (target, source, fields) => {
  if (!target || !source || !Array.isArray(fields)) {
    return false;
  }

  for (const field of fields) {
    if (field in source) {
      target[field] = structuredClone(source[field]);
    }
  }

  return true;
};

const getEventServerTime = (event) => {
  const payloadServerTime = event?.payload?.serverTime;
  if (Number.isFinite(payloadServerTime)) {
    return payloadServerTime;
  }

  const eventServerTime = event?.serverTime;
  if (Number.isFinite(eventServerTime)) {
    return eventServerTime;
  }

  return null;
};

const hasReplicatedEntityChanges = (event, entityType) => {
  if (event?.type === "server.snapshot") {
    return true;
  }

  return (
    (Array.isArray(event?.payload?.upserts?.[entityType]) && event.payload.upserts[entityType].length > 0) ||
    (Array.isArray(event?.payload?.removals?.[entityType]) && event.payload.removals[entityType].length > 0)
  );
};

const hasReplicatedChunkChanges = (event) => {
  if (event?.type === "server.snapshot") {
    return true;
  }

  return (
    (Array.isArray(event?.payload?.upserts?.chunks) && event.payload.upserts.chunks.length > 0) ||
    (Array.isArray(event?.payload?.removals?.chunks) && event.payload.removals.chunks.length > 0)
  );
};

const shouldUseRemoteInterpolation = (entityType, replicatedEntity, playerState, serverTime) => {
  if (!REMOTE_INTERPOLATED_ENTITY_TYPES.has(entityType)) {
    return false;
  }

  if (!Number.isFinite(serverTime)) {
    return false;
  }

  if (entityType === "players" && replicatedEntity?.uid === playerState?.uid) {
    return false;
  }

  return true;
};

const initializeReplicatedEntity = (replicatedEntity, interpolationEnabled) => {
  const nextEntity = structuredClone(replicatedEntity);

  nextEntity.renderX = nextEntity.x;
  nextEntity.renderY = nextEntity.y;
  nextEntity.renderFromX = nextEntity.x;
  nextEntity.renderFromY = nextEntity.y;
  nextEntity.renderToX = nextEntity.x;
  nextEntity.renderToY = nextEntity.y;
  nextEntity.renderSortY = nextEntity.y;
  nextEntity.oldX = nextEntity.x;
  nextEntity.oldY = nextEntity.y;

  if (interpolationEnabled) {
    nextEntity.moveStartTime = 0;
    nextEntity.moveDuration = 0;
  }

  if (!Number.isInteger(nextEntity.walkFrame)) {
    nextEntity.walkFrame = 1;
  }

  return nextEntity;
};

const upsertReplicatedEntity = (targetMap, replicatedEntity, options = {}) => {
  const entityType = options.entityType;
  const playerState = options.playerState;
  const serverTime = options.serverTime;
  const sequence = options.sequence;
  const interpolationEnabled = shouldUseRemoteInterpolation(entityType, replicatedEntity, playerState, serverTime);
  const currentEntity = targetMap.get(replicatedEntity.uid) ?? null;

  if (currentEntity) {
    if (interpolationEnabled) {
      remoteEntityInterpolationStore.pushSnapshot(entityType, replicatedEntity, { serverTime, sequence });
      copyFieldsInto(currentEntity, replicatedEntity, { ignoredFields: REMOTE_INTERPOLATION_IGNORED_FIELDS });
      currentEntity.moveStartTime = 0;
      currentEntity.moveDuration = 0;
    } else {
      remoteEntityInterpolationStore.removeEntity(entityType, replicatedEntity.uid);
      copyFieldsInto(currentEntity, replicatedEntity);
    }
    return currentEntity;
  }

  const nextEntity = initializeReplicatedEntity(replicatedEntity, interpolationEnabled);

  if (interpolationEnabled) {
    remoteEntityInterpolationStore.pushSnapshot(entityType, replicatedEntity, {
      serverTime,
      sequence,
    });
  }

  targetMap.set(replicatedEntity.uid, nextEntity);
  return nextEntity;
};

const synchronizeEntityMap = (targetMap, replicatedEntities, options = {}) => {
  const visibleUids = new Set();

  for (const replicatedEntity of replicatedEntities) {
    visibleUids.add(replicatedEntity.uid);
    upsertReplicatedEntity(targetMap, replicatedEntity, options);
  }

  for (const entityUid of targetMap.keys()) {
    if (!visibleUids.has(entityUid)) {
      targetMap.delete(entityUid);
      remoteEntityInterpolationStore.removeEntity(options.entityType, entityUid);
    }
  }

  remoteEntityInterpolationStore.retainVisibleEntities(options.entityType, visibleUids);
};

const applyEntityMapDelta = (targetMap, upserts, removals, options = {}) => {
  for (const replicatedEntity of upserts ?? []) {
    upsertReplicatedEntity(targetMap, replicatedEntity, options);
  }

  for (const entityUid of removals ?? []) {
    targetMap.delete(entityUid);
    remoteEntityInterpolationStore.removeEntity(options.entityType, entityUid);
  }
};

const shouldSnapLocalPlayerCorrection = (playerState, previousX, previousY, previousZ) => {
  if (playerState.z !== previousZ) {
    return true;
  }

  const correctionDistance = Math.hypot(playerState.x - previousX, playerState.y - previousY);

  return correctionDistance > LOCAL_PLAYER_MAX_SMOOTH_CORRECTION_DISTANCE;
};

const applyLocalPlayerServerCorrectionTiming = ({
  playerState,
  previousX,
  previousY,
  previousZ,
  previousRenderX,
  previousRenderY,
}) => {
  if (previousX === playerState.x && previousY === playerState.y && previousZ === playerState.z) {
    return;
  }

  if (shouldSnapLocalPlayerCorrection(playerState, previousX, previousY, previousZ)) {
    playerState.oldX = playerState.x;
    playerState.oldY = playerState.y;
    playerState.renderX = playerState.x;
    playerState.renderY = playerState.y;
    playerState.moveStartTime = 0;
    playerState.moveDuration = 0;
    return;
  }

  playerState.oldX = Number.isFinite(previousRenderX) ? previousRenderX : previousX;
  playerState.oldY = Number.isFinite(previousRenderY) ? previousRenderY : previousY;
  playerState.moveStartTime = Date.now();
  playerState.moveDuration = LOCAL_PLAYER_CORRECTION_DURATION_MS;
};

export const createRemoteGameStateBridge = ({
  transport,
  playerState,
  entityMaps,
  onStateApplied = null,
  onEvents = null,
  onConnectionStateChanged = null,
  onLatencyUpdated = null,
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
    const isLocalMovementPrediction =
      event.type === "prediction-updated" && event.action?.type === GAMEPLAY_ACTION_TYPE.movePlayer;
    const shouldUsePredictedMovementTiming = isLocalMovementPrediction || event.hasEffectiveMovementPrediction === true;

    const previousX = playerState.x;
    const previousY = playerState.y;
    const previousZ = playerState.z;
    const previousRenderX = Number.isFinite(playerState.renderX) ? playerState.renderX : previousX;
    const previousRenderY = Number.isFinite(playerState.renderY) ? playerState.renderY : previousY;

    if (isLocalMovementPrediction) {
      copySelectedFieldsInto(playerState, nextSelf, LOCAL_PLAYER_PREDICTED_MOVEMENT_FIELDS);
    } else {
      copyFieldsInto(playerState, nextSelf, {
        ignoredFields: shouldUsePredictedMovementTiming ? null : LOCAL_PLAYER_SERVER_IGNORED_FIELDS,
      });
    }

    if (event.type === "server.snapshot") {
      playerState.oldX = playerState.x;
      playerState.oldY = playerState.y;
      playerState.renderX = playerState.x;
      playerState.renderY = playerState.y;
      playerState.moveStartTime = 0;
      playerState.moveDuration = 0;
    } else if (shouldUsePredictedMovementTiming) {
      if (event.type !== "server.snapshot" && (previousX !== playerState.x || previousY !== playerState.y)) {
        playerState.oldX = previousX;
        playerState.oldY = previousY;

        if (!Number.isFinite(playerState.moveStartTime) || !Number.isFinite(playerState.moveDuration)) {
          playerState.moveStartTime = Date.now();
          playerState.moveDuration = 100;
        }
      }
    } else {
      applyLocalPlayerServerCorrectionTiming({
        playerState,
        previousX,
        previousY,
        previousZ,
        previousRenderX,
        previousRenderY,
      });
    }

    if (!Number.isFinite(playerState.renderX) || !Number.isFinite(playerState.renderY)) {
      playerState.renderX = playerState.x;
      playerState.renderY = playerState.y;
    }

    if (event.type === "prediction-updated") {
      onStateApplied?.({
        revision: replicationStore.getRevision(),
        chunks: null,
        event,
      });
      return;
    }

    const serverTime = getEventServerTime(event);
    const receivedAt = Date.now();

    remoteEntityInterpolationStore.recordServerTime(serverTime, receivedAt);

    const revision = replicationStore.getRevision();

    for (const entityType of REPLICATED_ENTITY_TYPES) {
      if (!hasReplicatedEntityChanges(event, entityType)) {
        continue;
      }

      const synchronizationOptions = {
        entityType,
        playerState,
        serverTime,
        sequence: revision,
      };

      if (event.type === "server.snapshot") {
        synchronizeEntityMap(entityMaps[entityType], replicationStore.getEntities(entityType), synchronizationOptions);
      } else {
        applyEntityMapDelta(
          entityMaps[entityType],
          event.payload?.upserts?.[entityType],
          event.payload?.removals?.[entityType],
          synchronizationOptions,
        );
      }
    }
    onStateApplied?.({
      revision: replicationStore.getRevision(),
      chunks: hasReplicatedChunkChanges(event) ? replicationStore.getChunks() : null,
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
      if (event.state === "disconnected" || event.status === "disconnected") {
        remoteEntityInterpolationStore.clear();
      }

      onConnectionStateChanged?.(event);
      return;
    }
    if (event.type === "latency-updated") {
      onLatencyUpdated?.(event);
    }
  });

  return Object.freeze({
    applyReplicatedState,
    disconnect: unsubscribe,
  });
};
