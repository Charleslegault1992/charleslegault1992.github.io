import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";

import {
  CLIENT_MESSAGE_TYPE,
  createNetworkMessage,
  decodeNetworkMessage,
  encodeNetworkMessage,
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

export const createGameServer = ({ runtime, authenticateClient, host = "127.0.0.1", port = 8080, tickRateHz = 30 } = {}) => {
  if (
    !runtime ||
    !REQUIRED_RUNTIME_METHODS.every((methodName) => typeof runtime[methodName] === "function") ||
    typeof authenticateClient !== "function"
  ) {
    throw new TypeError("The game server requires a complete authoritative runtime.");
  }

  const httpServer = createServer((request, response) => {
    if (request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: "ok", clients: sessionsBySocket.size }));
      return;
    }
    response.writeHead(404);
    response.end();
  });
  const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  const sessionsBySocket = new Map();

  const send = (session, type, payload) => {
    if (session.socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    const message = createNetworkMessage(type, payload, session.nextServerSequence++);
    const encodedMessage = encodeNetworkMessage(message);
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
    const result = runtime.connectClient(session, { ...message.payload, accountId: identity.accountId });
    if (!result?.success || typeof result.playerUid !== "string") {
      send(session, SERVER_MESSAGE_TYPE.error, { reason: result?.reason ?? "connection-rejected" });
      session.socket.close(1008, "Connection rejected");
      return;
    }
    session.isAuthenticated = true;
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
      send(session, SERVER_MESSAGE_TYPE.pong, { clientTime: message.payload?.clientTime ?? null, serverTime: Date.now() });
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
      return;
    }
    send(session, SERVER_MESSAGE_TYPE.error, { reason: "unsupported-message" });
  };

  webSocketServer.on("connection", (socket) => {
    const session = {
      clientId: randomUUID(),
      socket,
      isAuthenticated: false,
      playerUid: null,
      lastClientSequence: -1,
      nextServerSequence: 0,
      lastAcknowledgedRevision: 0,
      lastSentRevision: 0,
      actionResultsByRequestId: new Map(),
      rateLimitWindowStartedAt: Date.now(),
      messagesInWindow: 0,
    };
    sessionsBySocket.set(socket, session);
    socket.on("message", (message, isBinary) => handleClientMessage(session, message, isBinary));
    socket.on("close", () => closeSession(session));
    socket.on("error", () => closeSession(session));
  });

  httpServer.on("upgrade", (request, socket, head) => {
    if (request.url !== "/game") {
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
      for (const session of sessionsBySocket.values()) {
        if (!session.isAuthenticated) {
          continue;
        }
        const deltas = runtime.getDeltasForClient(session, session.lastSentRevision);
        if (deltas === null) {
          sendSnapshot(session);
          continue;
        }
        for (const delta of deltas) {
          if (send(session, SERVER_MESSAGE_TYPE.delta, delta)) {
            session.lastSentRevision = delta.revision;
          }
        }
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
