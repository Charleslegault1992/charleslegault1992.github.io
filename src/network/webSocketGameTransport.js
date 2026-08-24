import {
  CLIENT_MESSAGE_TYPE,
  createNetworkMessage,
  decodeNetworkMessage,
  encodeNetworkMessage,
  SESSION_REPLACED_CLOSE_CODE,
  SERVER_MESSAGE_TYPE,
} from "./networkProtocol.js";
import { createClientReplicationStore } from "./clientReplicationStore.js";
import { createPlayerMovementPrediction } from "./playerMovementPrediction.js";

const getMessageText = async (data) => {
  if (typeof data === "string") {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(data);
  }
  if (typeof data?.text === "function") {
    return data.text();
  }
  return data?.toString?.() ?? "";
};

const createClientInstanceId = () => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

export const createWebSocketGameTransport = ({
  url,
  socketFactory,
  replicationStore = createClientReplicationStore(),
  reconnectDelayMs = 250,
  maxReconnectDelayMs = 5000,
  connectionAttemptTimeoutMs = 8000,
  pingIntervalMs = 5000,
  now = () => Date.now(),
}) => {
  if (typeof url !== "string" || url === "" || typeof socketFactory !== "function") {
    throw new TypeError("The WebSocket transport requires a URL and a socket factory.");
  }
  if (
    !Number.isFinite(reconnectDelayMs) ||
    !Number.isFinite(maxReconnectDelayMs) ||
    reconnectDelayMs < 0 ||
    maxReconnectDelayMs < reconnectDelayMs ||
    !Number.isFinite(connectionAttemptTimeoutMs) ||
    connectionAttemptTimeoutMs <= 0 ||
    !Number.isFinite(pingIntervalMs) ||
    pingIntervalMs <= 0 ||
    typeof now !== "function"
  ) {
    throw new TypeError("Invalid WebSocket transport timing.");
  }

  const listeners = new Set();
  const pendingActionsByRequestId = new Map();
  const movementPrediction = createPlayerMovementPrediction();
  let socket = null;
  let nextSequence = 0;
  let playerUid = null;
  let connectPromise = null;
  let resolveConnection = null;
  let rejectConnection = null;
  let helloPayload = null;
  let reconnectTimeoutId = null;
  let connectionAttemptTimeoutId = null;
  let reconnectAttempt = 0;
  let connectionState = "disconnected";
  let shouldReconnect = false;
  let socketGeneration = 0;
  let pingTimeoutId = null;
  let roundTripTimeMs = null;
  let smoothedRoundTripTimeMs = null;
  const clientInstanceId = createClientInstanceId();

  const getMovementPredictionState = (acknowledgedRequestId = null) => {
    const predictionState = movementPrediction.reconcileWithState(
      replicationStore.getSelf(),
      acknowledgedRequestId,
    );
    return {
      predictedSelf: predictionState.player,
      hasPendingMovementPredictions: movementPrediction.getPendingRequestIds().length > 0,
      hasEffectiveMovementPrediction: predictionState.appliedActionCount > 0,
    };
  };

  const publish = (event) => {
    for (const listener of listeners) {
      listener(event);
    }
  };

  const setConnectionState = (state, details = {}) => {
    connectionState = state;
    publish({ type: "connection-state", state, ...details });
  };

  const sendMessage = (type, payload) => {
    if (socket?.readyState !== 1) {
      return false;
    }
    const encoded = encodeNetworkMessage(createNetworkMessage(type, payload, nextSequence++));
    if (!encoded) {
      return false;
    }
    socket.send(encoded);
    return true;
  };

  const stopPingLoop = () => {
    if (pingTimeoutId !== null) {
      clearTimeout(pingTimeoutId);
      pingTimeoutId = null;
    }
  };

  const clearConnectionAttemptTimeout = () => {
    if (connectionAttemptTimeoutId !== null) {
      clearTimeout(connectionAttemptTimeoutId);
      connectionAttemptTimeoutId = null;
    }
  };

  const publishDisconnectedLatency = () => {
    if (roundTripTimeMs === null && smoothedRoundTripTimeMs === null) {
      return;
    }
    roundTripTimeMs = null;
    smoothedRoundTripTimeMs = null;
    publish({ type: "latency-updated", roundTripTimeMs, smoothedRoundTripTimeMs });
  };

  const schedulePing = () => {
    stopPingLoop();
    if (!shouldReconnect || connectionState !== "ready") {
      return;
    }
    pingTimeoutId = setTimeout(() => {
      pingTimeoutId = null;
      sendMessage(CLIENT_MESSAGE_TYPE.ping, { clientTime: now() });
      schedulePing();
    }, pingIntervalMs);
  };

  const startPingLoop = () => {
    stopPingLoop();
    if (connectionState !== "ready") {
      return;
    }
    sendMessage(CLIENT_MESSAGE_TYPE.ping, { clientTime: now() });
    schedulePing();
  };

  const acknowledgeRevision = () => {
    const revision = replicationStore.getRevision();
    if (Number.isSafeInteger(revision)) {
      sendMessage(CLIENT_MESSAGE_TYPE.acknowledge, { revision });
    }
  };

  const handleReplicationMessage = (message) => {
    const result =
      message.type === SERVER_MESSAGE_TYPE.snapshot
        ? replicationStore.applySnapshot(message.payload)
        : replicationStore.applyDelta(message.payload);
    if (!result.success) {
      if (result.reason === "revision-gap" || result.reason === "snapshot-required") {
        sendMessage(CLIENT_MESSAGE_TYPE.requestSnapshot, { knownRevision: replicationStore.getRevision() });
      }
      publish({ type: "replication-rejected", result });
      return;
    }
    acknowledgeRevision();
    const movementPredictionState = getMovementPredictionState(
      replicationStore.getAcknowledgedActionRequestId(),
    );
    publish({
      type: message.type,
      payload: message.payload,
      result,
      ...movementPredictionState,
    });
    if (message.type === SERVER_MESSAGE_TYPE.snapshot) {
      clearConnectionAttemptTimeout();
      reconnectAttempt = 0;
      setConnectionState("ready", { playerUid });
      startPingLoop();
    }
    if (message.type === SERVER_MESSAGE_TYPE.snapshot && resolveConnection) {
      resolveConnection({ playerUid, snapshot: structuredClone(message.payload) });
      resolveConnection = null;
      rejectConnection = null;
      connectPromise = null;
    }
  };

  const handleMessage = async (event, generation) => {
    const messageText = await getMessageText(event.data);
    if (generation !== socketGeneration) {
      return;
    }
    const message = decodeNetworkMessage(messageText);
    if (!message) {
      publish({ type: "protocol-error", reason: "invalid-server-message" });
      return;
    }
    if (message.type === SERVER_MESSAGE_TYPE.welcome) {
      playerUid = message.payload?.playerUid ?? null;
      publish({ type: message.type, payload: message.payload });
      return;
    }
    if (message.type === SERVER_MESSAGE_TYPE.snapshot || message.type === SERVER_MESSAGE_TYPE.delta) {
      handleReplicationMessage(message);
      return;
    }
    if (message.type === SERVER_MESSAGE_TYPE.actionResult) {
      const pending = pendingActionsByRequestId.get(message.payload?.requestId) ?? null;
      if (pending) {
        pendingActionsByRequestId.delete(message.payload.requestId);
        if (!message.payload.success && movementPrediction.reject(message.payload.requestId)) {
          const movementPredictionState = getMovementPredictionState();
          publish({
            type: "prediction-updated",
            actionResult: structuredClone(message.payload),
            ...movementPredictionState,
          });
        }
        pending.resolve(structuredClone(message.payload));
      }
      publish({ type: message.type, payload: message.payload });
      return;
    }
    if (message.type === SERVER_MESSAGE_TYPE.pong) {
      const clientTime = message.payload?.clientTime;
      const receivedAt = now();
      if (Number.isFinite(clientTime) && Number.isFinite(receivedAt) && receivedAt >= clientTime) {
        roundTripTimeMs = Math.round(receivedAt - clientTime);
        smoothedRoundTripTimeMs =
          smoothedRoundTripTimeMs === null
            ? roundTripTimeMs
            : Math.round(smoothedRoundTripTimeMs * 0.75 + roundTripTimeMs * 0.25);
        publish({ type: "latency-updated", roundTripTimeMs, smoothedRoundTripTimeMs });
      }
      return;
    }
    if (
      message.type === SERVER_MESSAGE_TYPE.error &&
      ["authentication-failed", "connection-rejected", "session-replaced"].includes(message.payload?.reason)
    ) {
      shouldReconnect = false;
      clearConnectionAttemptTimeout();
      rejectConnection?.(new Error(message.payload.reason));
      resolveConnection = null;
      rejectConnection = null;
      connectPromise = null;
    }
    publish({ type: message.type, payload: message.payload });
  };

  const closePendingActions = (reason) => {
    for (const pending of pendingActionsByRequestId.values()) {
      pending.reject(new Error(reason));
    }
    pendingActionsByRequestId.clear();
  };

  const scheduleReconnect = () => {
    if (!shouldReconnect || reconnectTimeoutId !== null) {
      return;
    }
    const delay = Math.min(reconnectDelayMs * 2 ** reconnectAttempt, maxReconnectDelayMs);
    reconnectAttempt += 1;
    setConnectionState("reconnecting", { attempt: reconnectAttempt, delay });
    reconnectTimeoutId = setTimeout(() => {
      reconnectTimeoutId = null;
      if (!shouldReconnect) {
        return;
      }
      openSocket();
    }, delay);
  };

  const startConnectionAttemptTimeout = (generation) => {
    clearConnectionAttemptTimeout();
    connectionAttemptTimeoutId = setTimeout(() => {
      connectionAttemptTimeoutId = null;
      if (generation !== socketGeneration || connectionState === "ready" || !shouldReconnect) {
        return;
      }
      const expiredSocket = socket;
      socketGeneration += 1;
      socket = null;
      playerUid = null;
      publish({ type: "connection-timeout", attempt: reconnectAttempt + 1 });
      expiredSocket?.close();
      scheduleReconnect();
    }, connectionAttemptTimeoutMs);
  };

  const openSocket = () => {
    const generation = ++socketGeneration;
    nextSequence = 0;
    socket = socketFactory(url);
    setConnectionState(reconnectAttempt > 0 ? "reconnecting" : "connecting", { attempt: reconnectAttempt });
    startConnectionAttemptTimeout(generation);
    socket.addEventListener("open", () => {
      if (generation !== socketGeneration) {
        return;
      }
      if (!sendMessage(CLIENT_MESSAGE_TYPE.hello, helloPayload)) {
        socket.close();
      }
    });
    socket.addEventListener("message", (event) => {
      if (generation === socketGeneration) {
        handleMessage(event, generation);
      }
    });
    socket.addEventListener("error", () => {
      if (generation === socketGeneration) {
        publish({ type: "connection-error" });
      }
    });
    socket.addEventListener("close", (event) => {
      if (generation !== socketGeneration) {
        return;
      }
      clearConnectionAttemptTimeout();
      if (event?.code === SESSION_REPLACED_CLOSE_CODE) {
        shouldReconnect = false;
      }
      socket = null;
      playerUid = null;
      stopPingLoop();
      publishDisconnectedLatency();
      closePendingActions("WebSocket closed before the action was resolved.");
      publish({ type: "connection-closed" });
      if (shouldReconnect) {
        scheduleReconnect();
      } else {
        setConnectionState("disconnected");
      }
    });
  };

  const connect = (nextHelloPayload) => {
    if (!nextHelloPayload || typeof nextHelloPayload !== "object") {
      return Promise.reject(new TypeError("A client hello payload is required."));
    }
    helloPayload = {
      ...structuredClone(nextHelloPayload),
      clientInstanceId,
    };
    shouldReconnect = true;
    if (connectionState === "ready") {
      return Promise.resolve({ playerUid, snapshot: null });
    }
    if (!connectPromise) {
      connectPromise = new Promise((resolve, reject) => {
        resolveConnection = resolve;
        rejectConnection = reject;
      });
    }
    if (!socket && reconnectTimeoutId === null) {
      openSocket();
    }
    return connectPromise;
  };

  const send = (action) => {
    if (!action || typeof action.requestId !== "string" || pendingActionsByRequestId.has(action.requestId)) {
      return Promise.reject(new TypeError("A unique valid game action is required."));
    }
    return new Promise((resolve, reject) => {
      const movementWasPredicted = movementPrediction.enqueue(action);
      pendingActionsByRequestId.set(action.requestId, { resolve, reject });
      if (!sendMessage(CLIENT_MESSAGE_TYPE.action, { action })) {
        pendingActionsByRequestId.delete(action.requestId);
        if (movementWasPredicted) {
          movementPrediction.reject(action.requestId);
        }
        reject(new Error("The game connection is not ready."));
        return;
      }
      if (movementWasPredicted) {
        const movementPredictionState = getMovementPredictionState();
        publish({
          type: "prediction-updated",
          action: structuredClone(action),
          ...movementPredictionState,
        });
      }
    });
  };

  const subscribe = (listener) => {
    if (typeof listener !== "function") {
      return () => {};
    }
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  return Object.freeze({
    connect,
    updateAuthenticationToken: (authToken) => {
      if (!helloPayload || typeof authToken !== "string" || authToken === "") {
        return false;
      }
      helloPayload.authToken = authToken;
      return true;
    },
    disconnect: () => {
      shouldReconnect = false;
      socketGeneration += 1;
      if (reconnectTimeoutId !== null) {
        clearTimeout(reconnectTimeoutId);
        reconnectTimeoutId = null;
      }
      clearConnectionAttemptTimeout();
      stopPingLoop();
      publishDisconnectedLatency();
      const activeSocket = socket;
      socket = null;
      activeSocket?.close();
      rejectConnection?.(new Error("WebSocket connection cancelled."));
      resolveConnection = null;
      rejectConnection = null;
      connectPromise = null;
      playerUid = null;
      closePendingActions("WebSocket connection cancelled.");
      setConnectionState("disconnected");
    },
    send,
    subscribe,
    getPlayerUid: () => playerUid,
    getConnectionState: () => connectionState,
    getRoundTripTimeMs: () => smoothedRoundTripTimeMs,
    getPredictedSelf: () => getMovementPredictionState().predictedSelf,
    getReplicationStore: () => replicationStore,
  });
};
