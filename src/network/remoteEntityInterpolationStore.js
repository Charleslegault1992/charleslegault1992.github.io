import { TILE_SIZE } from "../core/gameConstants.js";

const REMOTE_INTERPOLATED_TYPES = ["players", "monsters", "npcs"];

export const REMOTE_INTERPOLATED_ENTITY_TYPES = new Set(REMOTE_INTERPOLATED_TYPES);

export const REMOTE_INTERPOLATION_IGNORED_FIELDS = new Set([
  "renderX",
  "renderY",
  "renderFromX",
  "renderFromY",
  "renderToX",
  "renderToY",
  "renderSortY",
  "oldX",
  "oldY",
  "moveStartTime",
  "moveDuration",
]);

const DEFAULT_TYPE_CONFIGS = Object.freeze({
  monsters: Object.freeze({
    minDelayMs: 70,
    baseDelayMs: 95,
    maxDelayMs: 150,
    extrapolationLimitMs: 0,
    maxHoldMs: 240,
  }),
  npcs: Object.freeze({
    minDelayMs: 70,
    baseDelayMs: 95,
    maxDelayMs: 150,
    extrapolationLimitMs: 0,
    maxHoldMs: 240,
  }),
  players: Object.freeze({
    minDelayMs: 60,
    baseDelayMs: 85,
    maxDelayMs: 140,
    extrapolationLimitMs: 20,
    maxHoldMs: 240,
  }),
});

const DEFAULT_OPTIONS = Object.freeze({
  maxSnapshotsPerEntity: 8,
  offsetSmoothing: 0.08,
  jitterSmoothing: 0.12,
  jitterDelayMultiplier: 3,
  maxInterpolatedDistance: TILE_SIZE * 1.5,
  maxServerTimeGapMs: 1200,
  typeConfigs: DEFAULT_TYPE_CONFIGS,
});

const clampValue = (value, min, max) => Math.min(max, Math.max(min, value));

const isValidEntityUid = (uid) => Number.isInteger(uid) || (typeof uid === "string" && uid !== "");

const isValidEntitySnapshotSource = (entity) =>
  entity &&
  isValidEntityUid(entity.uid) &&
  Number.isFinite(entity.x) &&
  Number.isFinite(entity.y) &&
  Number.isInteger(entity.z);

const normalizeTimingOptions = (timingOptions) => {
  if (Number.isFinite(timingOptions)) {
    return {
      serverTime: timingOptions,
      sequence: null,
    };
  }

  return {
    serverTime: Number.isFinite(timingOptions?.serverTime) ? timingOptions.serverTime : null,
    sequence: Number.isFinite(timingOptions?.sequence) ? timingOptions.sequence : null,
  };
};

const createSnapshot = (entity, timingOptions) => {
  const { serverTime, sequence } = normalizeTimingOptions(timingOptions);

  if (!Number.isFinite(serverTime) || !isValidEntitySnapshotSource(entity)) {
    return null;
  }

  return {
    serverTime,
    sequence,
    x: entity.x,
    y: entity.y,
    z: entity.z,
    oldX: Number.isFinite(entity.oldX) ? entity.oldX : entity.x,
    oldY: Number.isFinite(entity.oldY) ? entity.oldY : entity.y,
    moveStartTime: Number.isFinite(entity.moveStartTime) ? entity.moveStartTime : 0,
    moveDuration: Number.isFinite(entity.moveDuration) ? entity.moveDuration : 0,
    direction: entity.direction,
    walkFrame: entity.walkFrame,
  };
};

const isSameSnapshotPosition = (firstSnapshot, secondSnapshot) =>
  firstSnapshot &&
  secondSnapshot &&
  firstSnapshot.x === secondSnapshot.x &&
  firstSnapshot.y === secondSnapshot.y &&
  firstSnapshot.z === secondSnapshot.z;

const copySnapshotMutableFields = (targetSnapshot, sourceSnapshot) => {
  if (!targetSnapshot || !sourceSnapshot) {
    return false;
  }

  targetSnapshot.serverTime = sourceSnapshot.serverTime;
  targetSnapshot.sequence = sourceSnapshot.sequence;
  targetSnapshot.oldX = sourceSnapshot.oldX;
  targetSnapshot.oldY = sourceSnapshot.oldY;
  targetSnapshot.moveStartTime = sourceSnapshot.moveStartTime;
  targetSnapshot.moveDuration = sourceSnapshot.moveDuration;
  targetSnapshot.direction = sourceSnapshot.direction;
  targetSnapshot.walkFrame = sourceSnapshot.walkFrame;

  return true;
};

const shouldCompactStationarySnapshot = (buffer, snapshot) => {
  if (!Array.isArray(buffer) || buffer.length < 2 || !snapshot) {
    return false;
  }

  const lastSnapshot = buffer[buffer.length - 1] ?? null;
  const secondLastSnapshot = buffer[buffer.length - 2] ?? null;

  return isSameSnapshotPosition(snapshot, lastSnapshot) && isSameSnapshotPosition(lastSnapshot, secondLastSnapshot);
};

const isOlderSnapshot = (snapshot, lastSnapshot) => {
  if (!snapshot || !lastSnapshot) {
    return false;
  }

  if (Number.isFinite(snapshot.sequence) && Number.isFinite(lastSnapshot.sequence)) {
    return snapshot.sequence < lastSnapshot.sequence;
  }

  return snapshot.serverTime < lastSnapshot.serverTime;
};

const shouldResetBufferForSnapshot = (snapshot, lastSnapshot, config) => {
  if (!snapshot || !lastSnapshot) {
    return false;
  }

  if (snapshot.z !== lastSnapshot.z) {
    return true;
  }

  const distance = Math.hypot(snapshot.x - lastSnapshot.x, snapshot.y - lastSnapshot.y);
  if (distance > config.maxInterpolatedDistance) {
    return true;
  }

  const serverTimeGap = snapshot.serverTime - lastSnapshot.serverTime;
  if (Number.isFinite(serverTimeGap) && serverTimeGap > config.maxServerTimeGapMs) {
    return true;
  }

  return false;
};

const isSnapshotMoving = (snapshot) =>
  snapshot &&
  Number.isFinite(snapshot.oldX) &&
  Number.isFinite(snapshot.oldY) &&
  Number.isFinite(snapshot.x) &&
  Number.isFinite(snapshot.y) &&
  Number.isFinite(snapshot.moveStartTime) &&
  Number.isFinite(snapshot.moveDuration) &&
  snapshot.moveDuration > 0 &&
  (snapshot.oldX !== snapshot.x || snapshot.oldY !== snapshot.y);

const getSnapshotMovementProgress = (snapshot, renderServerTime) => {
  if (!isSnapshotMoving(snapshot) || !Number.isFinite(renderServerTime)) {
    return null;
  }

  const movementEndTime = snapshot.moveStartTime + snapshot.moveDuration;

  if (!Number.isFinite(movementEndTime)) {
    return null;
  }

  if (renderServerTime <= snapshot.moveStartTime) {
    return 0;
  }

  if (renderServerTime >= movementEndTime) {
    return 1;
  }

  return clampValue((renderServerTime - snapshot.moveStartTime) / snapshot.moveDuration, 0, 1);
};

const createTimelineRenderState = (snapshot, renderServerTime, mode = "movement-timeline") => {
  const progress = getSnapshotMovementProgress(snapshot, renderServerTime);

  if (!Number.isFinite(progress)) {
    return null;
  }

  return {
    renderX: snapshot.oldX + (snapshot.x - snapshot.oldX) * progress,
    renderY: snapshot.oldY + (snapshot.y - snapshot.oldY) * progress,
    renderFromX: snapshot.oldX,
    renderFromY: snapshot.oldY,
    renderToX: snapshot.x,
    renderToY: snapshot.y,
    renderSortY: progress < 1 ? Math.min(snapshot.oldY, snapshot.y) : snapshot.y,
    z: snapshot.z,
    direction: snapshot.direction,
    walkFrame: snapshot.walkFrame,
    progress: progress >= 1 ? null : progress,
    mode,
  };
};

const getBestTimelineSnapshot = (buffer, renderServerTime) => {
  if (!Array.isArray(buffer) || buffer.length <= 0 || !Number.isFinite(renderServerTime)) {
    return null;
  }

  for (let index = buffer.length - 1; index >= 0; index--) {
    const snapshot = buffer[index];

    if (!isSnapshotMoving(snapshot)) {
      continue;
    }

    const movementEndTime = snapshot.moveStartTime + snapshot.moveDuration;

    if (!Number.isFinite(movementEndTime)) {
      continue;
    }

    if (renderServerTime >= snapshot.moveStartTime && renderServerTime <= movementEndTime) {
      return snapshot;
    }

    if (renderServerTime > movementEndTime) {
      return snapshot;
    }
  }

  return null;
};

const copySnapshotRenderState = (snapshot, mode = "snap", renderServerTime = null) => {
  if (!snapshot) {
    return null;
  }

  const timelineState = createTimelineRenderState(snapshot, renderServerTime, mode);
  if (timelineState) {
    return timelineState;
  }

  return {
    renderX: snapshot.x,
    renderY: snapshot.y,
    renderFromX: snapshot.x,
    renderFromY: snapshot.y,
    renderToX: snapshot.x,
    renderToY: snapshot.y,
    renderSortY: snapshot.y,
    z: snapshot.z,
    direction: snapshot.direction,
    walkFrame: snapshot.walkFrame,
    progress: null,
    mode,
  };
};

const interpolateSnapshots = (previousSnapshot, nextSnapshot, renderServerTime, config) => {
  const timelineState = createTimelineRenderState(nextSnapshot, renderServerTime, "movement-timeline");
  if (timelineState) {
    return timelineState;
  }

  const duration = nextSnapshot.serverTime - previousSnapshot.serverTime;

  if (!Number.isFinite(duration) || duration <= 0) {
    return copySnapshotRenderState(nextSnapshot, "snap", renderServerTime);
  }

  const distance = Math.hypot(nextSnapshot.x - previousSnapshot.x, nextSnapshot.y - previousSnapshot.y);
  if (distance > config.maxInterpolatedDistance) {
    return copySnapshotRenderState(nextSnapshot, "distance-snap", renderServerTime);
  }

  const progress = clampValue((renderServerTime - previousSnapshot.serverTime) / duration, 0, 1);

  return {
    renderX: previousSnapshot.x + (nextSnapshot.x - previousSnapshot.x) * progress,
    renderY: previousSnapshot.y + (nextSnapshot.y - previousSnapshot.y) * progress,
    renderFromX: previousSnapshot.x,
    renderFromY: previousSnapshot.y,
    renderToX: nextSnapshot.x,
    renderToY: nextSnapshot.y,
    renderSortY: progress < 1 ? Math.min(previousSnapshot.y, nextSnapshot.y) : nextSnapshot.y,
    z: nextSnapshot.z,
    direction: nextSnapshot.direction,
    walkFrame: nextSnapshot.walkFrame,
    progress,
    mode: "snapshot-interpolate",
  };
};

const extrapolateSnapshots = (previousSnapshot, latestSnapshot, renderServerTime, typeConfig) => {
  const timelineState = createTimelineRenderState(latestSnapshot, renderServerTime, "movement-timeline");
  if (timelineState) {
    return timelineState;
  }

  const snapshotDelta = latestSnapshot.serverTime - previousSnapshot.serverTime;
  const extraTime = renderServerTime - latestSnapshot.serverTime;

  if (!Number.isFinite(snapshotDelta) || snapshotDelta <= 0 || !Number.isFinite(extraTime) || extraTime <= 0) {
    return copySnapshotRenderState(latestSnapshot, "hold", renderServerTime);
  }

  if (extraTime > typeConfig.maxHoldMs || extraTime > typeConfig.extrapolationLimitMs) {
    return copySnapshotRenderState(latestSnapshot, "hold", renderServerTime);
  }

  const progress = clampValue(extraTime / snapshotDelta, 0, typeConfig.extrapolationLimitMs / snapshotDelta);

  return {
    renderX: latestSnapshot.x + (latestSnapshot.x - previousSnapshot.x) * progress,
    renderY: latestSnapshot.y + (latestSnapshot.y - previousSnapshot.y) * progress,
    renderFromX: latestSnapshot.x,
    renderFromY: latestSnapshot.y,
    renderToX: latestSnapshot.x,
    renderToY: latestSnapshot.y,
    renderSortY: latestSnapshot.y,
    z: latestSnapshot.z,
    direction: latestSnapshot.direction,
    walkFrame: latestSnapshot.walkFrame,
    progress,
    mode: "snapshot-extrapolate",
  };
};

export const createRemoteEntityInterpolationStore = (options = {}) => {
  const config = {
    ...DEFAULT_OPTIONS,
    ...options,
    typeConfigs: {
      ...DEFAULT_TYPE_CONFIGS,
      ...(options.typeConfigs ?? {}),
    },
  };

  const buffersByType = new Map();
  let serverToClientOffset = null;
  let jitterMs = 0;
  let lastServerTime = null;
  let lastReceivedAt = null;
  const renderModeCounts = new Map();
  let lastRenderDebugAt = 0;
  let debugEnabled = false;

  for (const entityType of REMOTE_INTERPOLATED_TYPES) {
    buffersByType.set(entityType, new Map());
  }

  const getTypeConfig = (entityType) => config.typeConfigs[entityType] ?? DEFAULT_TYPE_CONFIGS.monsters;

  const getTypeBuffers = (entityType) => buffersByType.get(entityType) ?? null;

  const getEntityBuffer = (entityType, entityUid) => {
    const typeBuffers = getTypeBuffers(entityType);

    if (!typeBuffers || !isValidEntityUid(entityUid)) {
      return null;
    }

    let buffer = typeBuffers.get(entityUid);

    if (!buffer) {
      buffer = [];
      typeBuffers.set(entityUid, buffer);
    }

    return buffer;
  };

  const recordServerTime = (serverTime, receivedAt) => {
    if (!Number.isFinite(serverTime) || !Number.isFinite(receivedAt)) {
      return false;
    }

    const nextOffset = receivedAt - serverTime;

    if (!Number.isFinite(serverToClientOffset)) {
      serverToClientOffset = nextOffset;
      jitterMs = 0;
      lastServerTime = serverTime;
      lastReceivedAt = receivedAt;
      return true;
    }

    const offsetError = Math.abs(nextOffset - serverToClientOffset);
    let intervalError = 0;

    if (Number.isFinite(lastServerTime) && Number.isFinite(lastReceivedAt)) {
      const serverInterval = serverTime - lastServerTime;
      const receiveInterval = receivedAt - lastReceivedAt;

      if (serverInterval > 0 && receiveInterval > 0) {
        intervalError = Math.abs(receiveInterval - serverInterval);
      }
    }

    const jitterSample = Math.max(offsetError, intervalError);

    jitterMs = jitterMs * (1 - config.jitterSmoothing) + jitterSample * config.jitterSmoothing;
    serverToClientOffset = serverToClientOffset * (1 - config.offsetSmoothing) + nextOffset * config.offsetSmoothing;

    lastServerTime = serverTime;
    lastReceivedAt = receivedAt;

    return true;
  };

  const getInterpolationDelayMs = (entityType) => {
    const typeConfig = getTypeConfig(entityType);
    const adaptiveDelay = typeConfig.baseDelayMs + jitterMs * config.jitterDelayMultiplier;

    return clampValue(adaptiveDelay, typeConfig.minDelayMs, typeConfig.maxDelayMs);
  };

  const recordRenderMode = (mode) => {
    if (!debugEnabled || typeof mode !== "string" || mode === "") {
      return;
    }

    renderModeCounts.set(mode, (renderModeCounts.get(mode) ?? 0) + 1);
  };

  const getSnapshotCountByType = () => {
    const snapshotCountsByType = {};

    for (const [entityType, typeBuffers] of buffersByType.entries()) {
      let snapshotCount = 0;

      for (const buffer of typeBuffers.values()) {
        snapshotCount += buffer.length;
      }

      snapshotCountsByType[entityType] = snapshotCount;
    }

    return snapshotCountsByType;
  };

  const getBufferCountsByType = () => {
    const bufferCountsByType = {};

    for (const [entityType, typeBuffers] of buffersByType.entries()) {
      bufferCountsByType[entityType] = typeBuffers.size;
    }

    return bufferCountsByType;
  };

  const pushSnapshot = (entityType, entity, timingOptions) => {
    if (!REMOTE_INTERPOLATED_ENTITY_TYPES.has(entityType)) {
      return false;
    }

    const snapshot = createSnapshot(entity, timingOptions);

    if (!snapshot) {
      return false;
    }

    const buffer = getEntityBuffer(entityType, entity.uid);

    if (!buffer) {
      return false;
    }

    const lastSnapshot = buffer[buffer.length - 1] ?? null;

    if (isOlderSnapshot(snapshot, lastSnapshot)) {
      return false;
    }

    if (shouldResetBufferForSnapshot(snapshot, lastSnapshot, config)) {
      buffer.length = 0;
      buffer.push(snapshot);
      return true;
    }

    if (shouldCompactStationarySnapshot(buffer, snapshot)) {
      copySnapshotMutableFields(lastSnapshot, snapshot);
      return true;
    }

    if (
      lastSnapshot &&
      snapshot.x === lastSnapshot.x &&
      snapshot.y === lastSnapshot.y &&
      snapshot.oldX === lastSnapshot.oldX &&
      snapshot.oldY === lastSnapshot.oldY &&
      snapshot.moveStartTime === lastSnapshot.moveStartTime &&
      snapshot.moveDuration === lastSnapshot.moveDuration
    ) {
      copySnapshotMutableFields(lastSnapshot, snapshot);
      return true;
    }

    buffer.push(snapshot);

    while (buffer.length > config.maxSnapshotsPerEntity) {
      buffer.shift();
    }

    return true;
  };

  const pruneOldSnapshots = (buffer, renderServerTime) => {
    while (buffer.length >= 3) {
      const nextSnapshot = buffer[1];

      if (!nextSnapshot || nextSnapshot.serverTime > renderServerTime) {
        break;
      }

      const nextMovementEndTime =
        Number.isFinite(nextSnapshot.moveStartTime) && Number.isFinite(nextSnapshot.moveDuration)
          ? nextSnapshot.moveStartTime + nextSnapshot.moveDuration
          : nextSnapshot.serverTime;

      if (Number.isFinite(nextMovementEndTime) && nextMovementEndTime > renderServerTime) {
        break;
      }

      buffer.shift();
    }
  };

  const applyRenderStateObjectToEntity = (entity, renderState) => {
    if (
      !entity ||
      !renderState ||
      !Number.isFinite(renderState.renderX) ||
      !Number.isFinite(renderState.renderY) ||
      !Number.isInteger(renderState.z)
    ) {
      return false;
    }

    entity.renderX = renderState.renderX;
    entity.renderY = renderState.renderY;
    entity.renderFromX = renderState.renderFromX;
    entity.renderFromY = renderState.renderFromY;
    entity.renderToX = renderState.renderToX;
    entity.renderToY = renderState.renderToY;
    entity.renderSortY = renderState.renderSortY;
    entity.z = renderState.z;

    if (typeof renderState.direction === "string") {
      entity.direction = renderState.direction;
    }

    if (Number.isInteger(renderState.walkFrame)) {
      entity.walkFrame = renderState.walkFrame;
    }

    entity.networkMoveProgress = Number.isFinite(renderState.progress) ? renderState.progress : null;

    return true;
  };

  const getRenderState = (entityType, entityUid, now) => {
    if (!REMOTE_INTERPOLATED_ENTITY_TYPES.has(entityType)) {
      return null;
    }

    if (!isValidEntityUid(entityUid) || !Number.isFinite(now) || !Number.isFinite(serverToClientOffset)) {
      return null;
    }

    const typeBuffers = getTypeBuffers(entityType);
    const buffer = typeBuffers?.get(entityUid) ?? null;

    if (!buffer || buffer.length <= 0) {
      return null;
    }

    const estimatedServerTime = now - serverToClientOffset;
    const renderServerTime = estimatedServerTime - getInterpolationDelayMs(entityType);
    const typeConfig = getTypeConfig(entityType);

    pruneOldSnapshots(buffer, renderServerTime);

    const timelineSnapshot = getBestTimelineSnapshot(buffer, renderServerTime);
    const timelineRenderState = createTimelineRenderState(timelineSnapshot, renderServerTime, "movement-timeline");

    if (timelineRenderState) {
      recordRenderMode(timelineRenderState.mode);
      return timelineRenderState;
    }

    if (buffer.length === 1) {
      const renderState = copySnapshotRenderState(buffer[0], "warmup", renderServerTime);
      recordRenderMode(renderState?.mode);
      return renderState;
    }

    let previousSnapshot = null;
    let nextSnapshot = null;

    for (const snapshot of buffer) {
      if (snapshot.serverTime <= renderServerTime) {
        previousSnapshot = snapshot;
        continue;
      }

      nextSnapshot = snapshot;
      break;
    }

    if (previousSnapshot && nextSnapshot) {
      if (previousSnapshot.z !== nextSnapshot.z) {
        const renderState = copySnapshotRenderState(nextSnapshot, "z-snap", renderServerTime);
        recordRenderMode(renderState?.mode);
        return renderState;
      }

      const renderState = interpolateSnapshots(previousSnapshot, nextSnapshot, renderServerTime, config);
      recordRenderMode(renderState?.mode);
      return renderState;
    }

    if (previousSnapshot && !nextSnapshot) {
      const latestSnapshot = buffer[buffer.length - 1] ?? null;
      const secondLatestSnapshot = buffer[buffer.length - 2] ?? null;

      if (!latestSnapshot || !secondLatestSnapshot || latestSnapshot === secondLatestSnapshot) {
        const renderState = copySnapshotRenderState(latestSnapshot, "hold", renderServerTime);
        recordRenderMode(renderState?.mode);
        return renderState;
      }

      const renderState = extrapolateSnapshots(secondLatestSnapshot, latestSnapshot, renderServerTime, typeConfig);
      recordRenderMode(renderState?.mode);
      return renderState;
    }

    if (!previousSnapshot && nextSnapshot) {
      const renderState = copySnapshotRenderState(nextSnapshot, "wait-next", renderServerTime);
      recordRenderMode(renderState?.mode);
      return renderState;
    }

    return null;
  };

  const applyRenderState = (entityType, entity, now) => {
    if (!entity || !isValidEntityUid(entity.uid)) {
      return false;
    }

    const renderState = getRenderState(entityType, entity.uid, now);

    if (!applyRenderStateObjectToEntity(entity, renderState)) {
      return false;
    }

    return true;
  };

  const removeEntity = (entityType, entityUid) => {
    const typeBuffers = getTypeBuffers(entityType);
    typeBuffers?.delete(entityUid);
  };

  const retainVisibleEntities = (entityType, visibleUids) => {
    const typeBuffers = getTypeBuffers(entityType);

    if (!typeBuffers || !(visibleUids instanceof Set)) {
      return;
    }

    for (const entityUid of typeBuffers.keys()) {
      if (!visibleUids.has(entityUid)) {
        typeBuffers.delete(entityUid);
      }
    }
  };

  const clear = () => {
    for (const typeBuffers of buffersByType.values()) {
      typeBuffers.clear();
    }

    serverToClientOffset = null;
    jitterMs = 0;
    lastServerTime = null;
    lastReceivedAt = null;
    lastRenderDebugAt = 0;
    resetRenderModeCounts();
  };

  const getRenderModeCountsSnapshot = () => Object.fromEntries(renderModeCounts.entries());

  const resetRenderModeCounts = () => {
    renderModeCounts.clear();
  };

  const setDebugEnabled = (enabled) => {
    debugEnabled = enabled === true;

    if (!debugEnabled) {
      resetRenderModeCounts();
      lastRenderDebugAt = 0;
    }

    return debugEnabled;
  };

  const getDebugState = () => ({
    debugEnabled,
    serverToClientOffset,
    jitterMs,
    interpolationDelayMsByType: Object.fromEntries(
      REMOTE_INTERPOLATED_TYPES.map((entityType) => [entityType, getInterpolationDelayMs(entityType)]),
    ),
    bufferCountsByType: getBufferCountsByType(),
    snapshotCountsByType: getSnapshotCountByType(),
    renderModeCounts: getRenderModeCountsSnapshot(),
  });

  const logDebugState = (now = Date.now(), intervalMs = 1000) => {
    if (!debugEnabled || !Number.isFinite(now) || now - lastRenderDebugAt < intervalMs) {
      return false;
    }

    lastRenderDebugAt = now;

    console.log("REMOTE_INTERPOLATION_DEBUG", getDebugState());
    resetRenderModeCounts();

    return true;
  };

  return Object.freeze({
    recordServerTime,
    pushSnapshot,
    getRenderState,
    applyRenderState,
    removeEntity,
    retainVisibleEntities,
    clear,
    getDebugState,
    setDebugEnabled,
    logDebugState,
  });
};

export const remoteEntityInterpolationStore = createRemoteEntityInterpolationStore();
