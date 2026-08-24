import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";

import {
  CLIENT_MESSAGE_TYPE,
  decodeNetworkMessage,
  encodeNetworkPayload,
  SESSION_REPLACED_CLOSE_CODE,
  SERVER_MESSAGE_TYPE,
} from "../src/network/networkProtocol.js";
import { createServerTickLoop } from "./serverTickLoop.js";

const REQUIRED_RUNTIME_METHODS = [
  "connectClient",
  "disconnectClient",
  "dispatchAction",
  "createSnapshotForClient",
  "getDeltasForClient",
  "update",
];
const MAX_SOCKET_BUFFERED_BYTES = 1024 * 1024;
const DEFAULT_NETWORK_RATE_HZ = 20;
const DEFAULT_MAX_DELTAS_PER_FLUSH = 8;
const HEARTBEAT_INTERVAL_MS = 15000;
const HEARTBEAT_TIMEOUT_MS = 30000;

const getClientInstanceId = (payload) => {
  const clientInstanceId = typeof payload?.clientInstanceId === "string" ? payload.clientInstanceId.trim() : "";
  return /^[a-zA-Z0-9-]{1,128}$/.test(clientInstanceId) ? clientInstanceId : null;
};

export const createGameServer = ({
  runtime,
  authenticateClient,
  handleHttpRequest = null,
  allowedOrigin = "",
  host = "127.0.0.1",
  port = 8080,
  tickRateHz = 30,
  networkRateHz = DEFAULT_NETWORK_RATE_HZ,
  maxDeltasPerFlush = DEFAULT_MAX_DELTAS_PER_FLUSH,
} = {}) => {
  if (
    !runtime ||
    !REQUIRED_RUNTIME_METHODS.every((methodName) => typeof runtime[methodName] === "function") ||
    typeof authenticateClient !== "function"
  ) {
    throw new TypeError("The game server requires a complete authoritative runtime.");
  }
  const safeNetworkRateHz =
    Number.isFinite(networkRateHz) && networkRateHz > 0 ? Math.min(networkRateHz, tickRateHz) : DEFAULT_NETWORK_RATE_HZ;

  const networkFlushIntervalMs = 1000 / safeNetworkRateHz;

  const safeMaxDeltasPerFlush =
    Number.isInteger(maxDeltasPerFlush) && maxDeltasPerFlush > 0 ? maxDeltasPerFlush : DEFAULT_MAX_DELTAS_PER_FLUSH;

  const httpServer = createServer(async (request, response) => {
    if (request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: "ok", clients: sessionsBySocket.size }));
      return;
    }
    if (typeof handleHttpRequest === "function") {
      try {
        if (await handleHttpRequest(request, response)) {
          return;
        }
      } catch {
        if (!response.headersSent) {
          response.writeHead(500, { "content-type": "application/json" });
        }
        response.end(JSON.stringify({ success: false, reason: "internal-server-error" }));
        return;
      }
    }
    response.writeHead(404);
    response.end();
  });
  const webSocketServer = new WebSocketServer({
    noServer: true,
    maxPayload: 64 * 1024,
    perMessageDeflate: {
      threshold: 1024,
      clientNoContextTakeover: true,
      serverNoContextTakeover: true,
    },
  });
  const sessionsBySocket = new Map();
  let nextHeartbeatAt = 0;

  const send = (session, type, payload) => {
    if (session.socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    if (session.socket.bufferedAmount > MAX_SOCKET_BUFFERED_BYTES) {
      session.socket.close(1013, "Client connection is too slow");
      return false;
    }
    const encodedMessage = encodeNetworkPayload(type, payload, session.nextServerSequence++);
    if (!encodedMessage) {
      return false;
    }
    session.socket.send(encodedMessage);
    return true;
  };

  const sendSnapshot = (session) => {
    const snapshot = runtime.createSnapshotForClient(session);
    if (!snapshot) {
      return false;
    }
    session.lastSentRevision = snapshot.revision;
    return send(session, SERVER_MESSAGE_TYPE.snapshot, snapshot);
  };

  const flushSessionDeltas = (session) => {
    if (!session?.isAuthenticated) {
      return false;
    }

    const deltas = runtime.getDeltasForClient(session, session.lastSentRevision);

    if (deltas === null) {
      return sendSnapshot(session);
    }

    if (!Array.isArray(deltas) || deltas.length <= 0) {
      return false;
    }

    if (deltas.length > safeMaxDeltasPerFlush) {
      return sendSnapshot(session);
    }

    let didSendDelta = false;

    for (const delta of deltas) {
      if (send(session, SERVER_MESSAGE_TYPE.delta, delta)) {
        session.lastSentRevision = delta.revision;
        didSendDelta = true;
      }
    }

    return didSendDelta;
  };

  const closeSession = (session) => {
    if (!session || !sessionsBySocket.delete(session.socket)) {
      return;
    }
    if (session.isAuthenticated) {
      runtime.disconnectClient(session);
    }
  };

  const handleHello = (session, message) => {
    if (session.isAuthenticated) {
      send(session, SERVER_MESSAGE_TYPE.error, { reason: "already-connected" });
      return;
    }
    const identity = authenticateClient(message.payload);
    if (!identity || typeof identity.accountId !== "string") {
      send(session, SERVER_MESSAGE_TYPE.error, { reason: "authentication-failed" });
      session.socket.close(1008, "Authentication failed");
      return;
    }
    const characterId = typeof message.payload?.characterId === "string" ? message.payload.characterId.trim() : "";
    const clientInstanceId = getClientInstanceId(message.payload);
    const existingSession = [...sessionsBySocket.values()].find(
      (candidate) =>
        candidate !== session &&
        candidate.isAuthenticated &&
        candidate.accountId === identity.accountId &&
        candidate.characterId === characterId,
    );
    if (existingSession) {
      if (existingSession.clientInstanceId && !clientInstanceId) {
        send(session, SERVER_MESSAGE_TYPE.error, { reason: "connection-rejected" });
        session.socket.close(SESSION_REPLACED_CLOSE_CODE, "Client update required");
        return;
      }
      send(existingSession, SERVER_MESSAGE_TYPE.error, { reason: "session-replaced" });
      closeSession(existingSession);
      existingSession.socket.close(SESSION_REPLACED_CLOSE_CODE, "Session replaced");
    }
    const result = runtime.connectClient(session, { ...message.payload, accountId: identity.accountId });
    if (!result?.success || typeof result.playerUid !== "string") {
      send(session, SERVER_MESSAGE_TYPE.error, { reason: result?.reason ?? "connection-rejected" });
      session.socket.close(1008, "Connection rejected");
      return;
    }
    session.isAuthenticated = true;
    session.accountId = identity.accountId;
    session.characterId = characterId;
    session.clientInstanceId = clientInstanceId;
    session.playerUid = result.playerUid;
    send(session, SERVER_MESSAGE_TYPE.welcome, { clientId: session.clientId, playerUid: session.playerUid });
    sendSnapshot(session);
  };

  const handleClientMessage = (session, rawMessage, isBinary) => {
    if (isBinary) {
      session.socket.close(1003, "Text messages required");
      return;
    }
    const receivedAt = Date.now();
    if (receivedAt - session.rateLimitWindowStartedAt >= 1000) {
      session.rateLimitWindowStartedAt = receivedAt;
      session.messagesInWindow = 0;
    }
    session.messagesInWindow += 1;
    if (session.messagesInWindow > 60) {
      session.socket.close(1008, "Rate limit exceeded");
      return;
    }
    const message = decodeNetworkMessage(rawMessage.toString());
    if (!message || message.sequence <= session.lastClientSequence) {
      send(session, SERVER_MESSAGE_TYPE.error, { reason: "invalid-or-duplicate-message" });
      return;
    }
    session.lastClientSequence = message.sequence;

    if (message.type === CLIENT_MESSAGE_TYPE.hello) {
      handleHello(session, message);
      return;
    }
    if (!session.isAuthenticated) {
      send(session, SERVER_MESSAGE_TYPE.error, { reason: "hello-required" });
      return;
    }
    if (message.type === CLIENT_MESSAGE_TYPE.ping) {
      send(session, SERVER_MESSAGE_TYPE.pong, {
        clientTime: message.payload?.clientTime ?? null,
        serverTime: Date.now(),
      });
      return;
    }
    if (message.type === CLIENT_MESSAGE_TYPE.acknowledge) {
      const revision = message.payload?.revision;
      if (Number.isSafeInteger(revision) && revision >= session.lastAcknowledgedRevision) {
        session.lastAcknowledgedRevision = revision;
      }
      return;
    }
    if (message.type === CLIENT_MESSAGE_TYPE.requestSnapshot) {
      sendSnapshot(session);
      return;
    }
    if (message.type === CLIENT_MESSAGE_TYPE.action) {
      const action = message.payload?.action;
      if (typeof action?.requestId !== "string" || action.requestId === "") {
        send(session, SERVER_MESSAGE_TYPE.error, { reason: "invalid-action" });
        return;
      }
      const actionFingerprint = JSON.stringify(action);
      const cachedAction = session.actionResultsByRequestId.get(action.requestId) ?? null;
      if (cachedAction) {
        const result =
          cachedAction.fingerprint === actionFingerprint
            ? cachedAction.result
            : { success: false, reason: "request-id-conflict", requestId: action.requestId };
        send(session, SERVER_MESSAGE_TYPE.actionResult, result);
        return;
      }
      const result = runtime.dispatchAction(session, action);
      session.actionResultsByRequestId.set(action.requestId, { fingerprint: actionFingerprint, result });

      while (session.actionResultsByRequestId.size > 256) {
        session.actionResultsByRequestId.delete(session.actionResultsByRequestId.keys().next().value);
      }

      send(session, SERVER_MESSAGE_TYPE.actionResult, result);

      if (result?.success) {
        flushSessionDeltas(session);
        session.nextNetworkFlushAt = Date.now() + networkFlushIntervalMs;
      }

      return;
    }
    send(session, SERVER_MESSAGE_TYPE.error, { reason: "unsupported-message" });
  };

  webSocketServer.on("connection", (socket) => {
    const session = {
      clientId: randomUUID(),
      socket,
      isAuthenticated: false,
      accountId: null,
      characterId: null,
      clientInstanceId: null,
      playerUid: null,
      lastClientSequence: -1,
      nextServerSequence: 0,
      lastAcknowledgedRevision: 0,
      lastSentRevision: 0,
      actionResultsByRequestId: new Map(),
      rateLimitWindowStartedAt: Date.now(),
      messagesInWindow: 0,
      nextNetworkFlushAt: 0,
      lastPongAt: Date.now(),
    };
    sessionsBySocket.set(socket, session);
    socket.on("pong", () => {
      session.lastPongAt = Date.now();
    });
    socket.on("message", (message, isBinary) => handleClientMessage(session, message, isBinary));
    socket.on("close", () => closeSession(session));
    socket.on("error", () => closeSession(session));
  });

  httpServer.on("upgrade", (request, socket, head) => {
    if (request.url !== "/game" || (allowedOrigin && request.headers.origin !== allowedOrigin)) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
      webSocketServer.emit("connection", webSocket, request);
    });
  });

  const tickLoop = createServerTickLoop({
    tickRateHz,
    onTick: (now, stepMs) => {
      runtime.update(now, stepMs);
      if (now >= nextHeartbeatAt) {
        nextHeartbeatAt = now + HEARTBEAT_INTERVAL_MS;
        for (const session of [...sessionsBySocket.values()]) {
          if (now - session.lastPongAt > HEARTBEAT_TIMEOUT_MS) {
            session.socket.terminate();
            closeSession(session);
            continue;
          }
          if (session.socket.readyState === WebSocket.OPEN) {
            session.socket.ping();
          }
        }
      }
      for (const session of sessionsBySocket.values()) {
        if (!session.isAuthenticated) {
          continue;
        }

        if (now < session.nextNetworkFlushAt) {
          continue;
        }

        flushSessionDeltas(session);
        session.nextNetworkFlushAt = now + networkFlushIntervalMs;
      }
    },
  });

  return Object.freeze({
    async start() {
      if (httpServer.listening) {
        return false;
      }
      await new Promise((resolve, reject) => {
        httpServer.once("error", reject);
        httpServer.listen(port, host, () => {
          httpServer.off("error", reject);
          resolve();
        });
      });
      tickLoop.start();
      return true;
    },
    async stop() {
      tickLoop.stop();
      for (const session of [...sessionsBySocket.values()]) {
        session.socket.close(1001, "Server stopping");
        closeSession(session);
      }
      webSocketServer.close();
      if (httpServer.listening) {
        await new Promise((resolve) => httpServer.close(resolve));
      }
    },
    getAddress: () => httpServer.address(),
    getClientCount: () => sessionsBySocket.size,
  });
};
