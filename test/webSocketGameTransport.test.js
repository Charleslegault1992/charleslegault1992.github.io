import assert from "node:assert/strict";
import test from "node:test";
import { WebSocket } from "ws";

import { createAuthoritativeWorldRuntime } from "../server/authoritativeWorldRuntime.js";
import { createGameServer } from "../server/gameServer.js";
import { loadServerWorldMaps } from "../server/loadServerWorldMaps.js";
import { createMovePlayerAction } from "../src/actions/gameplayActions.js";
import { TILE_SIZE } from "../src/core/gameConstants.js";
import {
  createNetworkMessage,
  encodeNetworkMessage,
  SERVER_MESSAGE_TYPE,
} from "../src/network/networkProtocol.js";
import { createWebSocketGameTransport } from "../src/network/webSocketGameTransport.js";
import { getWorldChunkForTilePosition, isTiledCollisionAtTile } from "../src/world/worldCoordinates.js";

test("the WebSocket transport synchronizes a snapshot and resolves an action", async (testContext) => {
  const worldMapsByZ = await loadServerWorldMaps();
  const runtime = createAuthoritativeWorldRuntime({ worldMapsByZ });
  const server = createGameServer({
    runtime,
    authenticateClient: () => ({ accountId: "transport-account" }),
    port: 0,
  });
  await server.start();
  testContext.after(() => server.stop());
  const transport = createWebSocketGameTransport({
    url: `ws://127.0.0.1:${server.getAddress().port}/game`,
    socketFactory: (url) => new WebSocket(url),
  });
  testContext.after(() => transport.disconnect());

  const connection = await transport.connect({ characterId: "transport-character", name: "Transport" });
  const player = runtime.getPlayer(connection.playerUid);
  const worldMap = worldMapsByZ.get(player.z);
  const destination = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]
    .map(([colOffset, rowOffset]) => ({
      x: player.x + colOffset * TILE_SIZE,
      y: player.y + rowOffset * TILE_SIZE,
    }))
    .find(({ x, y }) => {
      const col = x / TILE_SIZE;
      const row = y / TILE_SIZE;
      return getWorldChunkForTilePosition(worldMap, col, row) && !isTiledCollisionAtTile(worldMap, col, row);
    });
  assert.ok(destination);

  const movementEvents = [];
  const unsubscribeMovementEvents = transport.subscribe((event) => {
    if (event.type === "prediction-updated" || event.type === SERVER_MESSAGE_TYPE.delta) {
      movementEvents.push(event);
    }
  });
  const deltaReceived = new Promise((resolve) => {
    const unsubscribe = transport.subscribe((event) => {
      if (event.type === SERVER_MESSAGE_TYPE.delta && event.payload?.upserts?.self?.x === destination.x) {
        unsubscribe();
        resolve(event.payload);
      }
    });
  });
  const result = await transport.send(
    createMovePlayerAction({
      fromX: player.x,
      fromY: player.y,
      fromZ: player.z,
      toX: destination.x,
      toY: destination.y,
      direction: "right",
      isNavigationMovement: false,
      requestedAt: 0,
    }),
  );

  assert.equal(result.success, true);
  await deltaReceived;
  unsubscribeMovementEvents();
  assert.equal(transport.getReplicationStore().getSelf().x, destination.x);
  assert.equal(
    movementEvents.some(
      (event) =>
        event.type === "prediction-updated" &&
        event.hasPendingMovementPredictions === true &&
        event.hasEffectiveMovementPrediction === true,
    ),
    true,
  );
  assert.equal(
    movementEvents.some(
      (event) =>
        event.type === SERVER_MESSAGE_TYPE.delta &&
        event.hasPendingMovementPredictions === false &&
        event.hasEffectiveMovementPrediction === false,
    ),
    true,
  );
});

class FakeSocket {
  constructor() {
    this.readyState = 0;
    this.listeners = new Map();
    this.sent = [];
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  emit(type, event = {}) {
    this.listeners.get(type)?.(event);
  }

  open() {
    this.readyState = 1;
    this.emit("open");
  }

  receive(type, payload, sequence) {
    this.emit("message", { data: encodeNetworkMessage(createNetworkMessage(type, payload, sequence)) });
  }

  send(message) {
    this.sent.push(message);
  }

  close() {
    this.readyState = 3;
    this.emit("close");
  }
}

const createReconnectSnapshot = (revision) => ({
  revision,
  self: { uid: "player:reconnect", x: 64, y: 64, z: 0 },
  entities: { players: [], monsters: [], npcs: [], worldItems: [], groundEffects: [] },
  chunks: [],
});

test("the WebSocket transport reconnects and requires a fresh snapshot", async () => {
  const sockets = [];
  const states = [];
  const transport = createWebSocketGameTransport({
    url: "ws://test/game",
    socketFactory: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    reconnectDelayMs: 0,
    maxReconnectDelayMs: 0,
  });
  transport.subscribe((event) => {
    if (event.type === "connection-state") {
      states.push(event.state);
    }
  });

  const initialConnection = transport.connect({ characterId: "reconnect" });
  sockets[0].open();
  sockets[0].receive(SERVER_MESSAGE_TYPE.welcome, { playerUid: "player:reconnect" }, 0);
  sockets[0].receive(SERVER_MESSAGE_TYPE.snapshot, createReconnectSnapshot(1), 1);
  await initialConnection;
  assert.equal(transport.getConnectionState(), "ready");

  sockets[0].close();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(sockets.length, 2);
  sockets[1].open();
  sockets[1].receive(SERVER_MESSAGE_TYPE.welcome, { playerUid: "player:reconnect" }, 0);
  sockets[1].receive(SERVER_MESSAGE_TYPE.snapshot, createReconnectSnapshot(4), 1);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(transport.getConnectionState(), "ready");
  assert.equal(transport.getReplicationStore().getRevision(), 4);
  assert.equal(states.includes("reconnecting"), true);
  transport.disconnect();
});

test("the WebSocket transport uses a refreshed token when it reconnects", async () => {
  const sockets = [];
  const transport = createWebSocketGameTransport({
    url: "ws://test/game",
    socketFactory: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    reconnectDelayMs: 0,
    maxReconnectDelayMs: 0,
  });

  const connection = transport.connect({ characterId: "reconnect", authToken: "old-token" });
  sockets[0].open();
  const initialHello = JSON.parse(sockets[0].sent[0]);
  sockets[0].receive(SERVER_MESSAGE_TYPE.welcome, { playerUid: "player:reconnect" }, 0);
  sockets[0].receive(SERVER_MESSAGE_TYPE.snapshot, createReconnectSnapshot(1), 1);
  await connection;

  assert.equal(initialHello.payload.authToken, "old-token");
  assert.equal(transport.updateAuthenticationToken("fresh-token"), true);

  sockets[0].close();
  await new Promise((resolve) => setTimeout(resolve, 0));
  sockets[1].open();
  const reconnectHello = JSON.parse(sockets[1].sent[0]);

  assert.equal(reconnectHello.payload.authToken, "fresh-token");
  transport.disconnect();
});
