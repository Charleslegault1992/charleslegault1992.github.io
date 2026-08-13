import assert from "node:assert/strict";
import test from "node:test";
import { WebSocket } from "ws";

import { createAuthoritativeWorldRuntime } from "../server/authoritativeWorldRuntime.js";
import { createGameServer } from "../server/gameServer.js";
import { loadServerWorldMaps } from "../server/loadServerWorldMaps.js";
import { createMovePlayerAction } from "../src/actions/gameplayActions.js";
import { TILE_SIZE } from "../src/core/gameConstants.js";
import {
  CLIENT_MESSAGE_TYPE,
  createNetworkMessage,
  decodeNetworkMessage,
  encodeNetworkMessage,
  SERVER_MESSAGE_TYPE,
} from "../src/network/networkProtocol.js";
import { getWorldChunkForTilePosition, isTiledCollisionAtTile } from "../src/world/worldCoordinates.js";

const waitForMessage = (socket, expectedType, predicate = () => true) => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off("message", listener);
      reject(new Error(`Timed out waiting for ${expectedType}`));
    }, 2000);
    const listener = (rawMessage) => {
      const message = decodeNetworkMessage(rawMessage.toString());
      if (message?.type === expectedType && predicate(message.payload)) {
        clearTimeout(timeout);
        socket.off("message", listener);
        resolve(message);
      }
    };
    socket.on("message", listener);
  });
};

const connectClient = async (port, characterId) => {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/game`);
  await new Promise((resolve) => socket.once("open", resolve));
  const snapshotPromise = waitForMessage(socket, SERVER_MESSAGE_TYPE.snapshot);
  socket.send(
    encodeNetworkMessage(
      createNetworkMessage(CLIENT_MESSAGE_TYPE.hello, { characterId, name: characterId }, 0),
    ),
  );
  return { socket, snapshot: (await snapshotPromise).payload };
};

test("two WebSocket clients receive authoritative movement replication", async (testContext) => {
  const worldMapsByZ = await loadServerWorldMaps();
  const runtime = createAuthoritativeWorldRuntime({ worldMapsByZ });
  const server = createGameServer({
    runtime,
    authenticateClient: (hello) => ({ accountId: `account-${hello.characterId}` }),
    port: 0,
    tickRateHz: 30,
  });
  await server.start();
  testContext.after(() => server.stop());
  const { port } = server.getAddress();
  const firstClient = await connectClient(port, "first");
  const secondClient = await connectClient(port, "second");
  testContext.after(() => firstClient.socket.close());
  testContext.after(() => secondClient.socket.close());

  const firstPlayer = runtime.getPlayer(firstClient.snapshot.self.uid);
  const secondPlayer = runtime.getPlayer(secondClient.snapshot.self.uid);
  const worldMap = worldMapsByZ.get(firstPlayer.z);
  const destination = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]
    .map(([colOffset, rowOffset]) => ({
      x: firstPlayer.x + colOffset * TILE_SIZE,
      y: firstPlayer.y + rowOffset * TILE_SIZE,
    }))
    .find(({ x, y }) => {
      const col = x / TILE_SIZE;
      const row = y / TILE_SIZE;
      return (
        getWorldChunkForTilePosition(worldMap, col, row) &&
        !isTiledCollisionAtTile(worldMap, col, row) &&
        (secondPlayer.x !== x || secondPlayer.y !== y)
      );
    });
  assert.ok(destination);

  const action = createMovePlayerAction({
    fromX: firstPlayer.x,
    fromY: firstPlayer.y,
    fromZ: firstPlayer.z,
    toX: destination.x,
    toY: destination.y,
    direction: "right",
    isNavigationMovement: false,
    requestedAt: 0,
  });
  const resultPromise = waitForMessage(firstClient.socket, SERVER_MESSAGE_TYPE.actionResult);
  const deltaPromise = waitForMessage(
    secondClient.socket,
    SERVER_MESSAGE_TYPE.delta,
    (delta) => delta.upserts?.players?.some((player) => player.uid === firstPlayer.uid && player.x === destination.x),
  );
  firstClient.socket.send(
    encodeNetworkMessage(createNetworkMessage(CLIENT_MESSAGE_TYPE.action, { action }, 1)),
  );

  assert.equal((await resultPromise).payload.success, true);
  const delta = (await deltaPromise).payload;
  assert.equal(delta.upserts.players.find((player) => player.uid === firstPlayer.uid).x, destination.x);
});
