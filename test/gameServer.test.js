import assert from "node:assert/strict";
import test from "node:test";
import { WebSocket } from "ws";

import { createGameServer } from "../server/gameServer.js";
import {
  CLIENT_MESSAGE_TYPE,
  createNetworkMessage,
  decodeNetworkMessage,
  encodeNetworkMessage,
  SERVER_MESSAGE_TYPE,
} from "../src/network/networkProtocol.js";

const waitForMessage = (socket, expectedType) => {
  return new Promise((resolve) => {
    const listener = (rawMessage) => {
      const message = decodeNetworkMessage(rawMessage.toString());
      if (message?.type === expectedType) {
        socket.off("message", listener);
        resolve(message);
      }
    };
    socket.on("message", listener);
  });
};

test("the WebSocket gateway welcomes a client and sends its snapshot", async (testContext) => {
  const runtime = {
    connectClient: () => ({ success: true, playerUid: "player-1" }),
    disconnectClient: () => {},
    dispatchAction: (_session, action) => ({ success: true, requestId: action.requestId }),
    createSnapshotForClient: () => ({ revision: 0, self: { uid: "player-1" } }),
    getDeltasForClient: () => [],
    update: () => {},
  };
  const server = createGameServer({
    runtime,
    authenticateClient: () => ({ accountId: "account-1" }),
    port: 0,
    tickRateHz: 10,
  });
  await server.start();
  testContext.after(() => server.stop());
  const { port } = server.getAddress();
  const socket = new WebSocket(`ws://127.0.0.1:${port}/game`);
  await new Promise((resolve) => socket.once("open", resolve));
  testContext.after(() => socket.close());

  const welcomePromise = waitForMessage(socket, SERVER_MESSAGE_TYPE.welcome);
  const snapshotPromise = waitForMessage(socket, SERVER_MESSAGE_TYPE.snapshot);
  socket.send(encodeNetworkMessage(createNetworkMessage(CLIENT_MESSAGE_TYPE.hello, { characterId: "one" }, 0)));

  const welcome = await welcomePromise;
  const snapshot = await snapshotPromise;
  assert.equal(welcome.payload.playerUid, "player-1");
  assert.equal(snapshot.payload.revision, 0);
});

test("the gateway executes a request ID once and rejects a conflicting replay", async (testContext) => {
  let dispatchCount = 0;
  const runtime = {
    connectClient: () => ({ success: true, playerUid: "player-1" }),
    disconnectClient: () => {},
    dispatchAction: (_session, action) => {
      dispatchCount += 1;
      return { success: true, requestId: action.requestId, changes: action.payload };
    },
    createSnapshotForClient: () => ({ revision: 0, self: { uid: "player-1" } }),
    getDeltasForClient: () => [],
    update: () => {},
  };
  const server = createGameServer({
    runtime,
    authenticateClient: () => ({ accountId: "account-1" }),
    port: 0,
  });
  await server.start();
  testContext.after(() => server.stop());
  const socket = new WebSocket(`ws://127.0.0.1:${server.getAddress().port}/game`);
  await new Promise((resolve) => socket.once("open", resolve));
  testContext.after(() => socket.close());
  const snapshotPromise = waitForMessage(socket, SERVER_MESSAGE_TYPE.snapshot);
  socket.send(encodeNetworkMessage(createNetworkMessage(CLIENT_MESSAGE_TYPE.hello, { characterId: "one" }, 0)));
  await snapshotPromise;

  const firstResultPromise = waitForMessage(socket, SERVER_MESSAGE_TYPE.actionResult);
  socket.send(
    encodeNetworkMessage(
      createNetworkMessage(CLIENT_MESSAGE_TYPE.action, {
        action: { requestId: "same-request", type: "test", payload: { value: 1 } },
      }, 1),
    ),
  );
  const firstResult = await firstResultPromise;
  const conflictPromise = waitForMessage(socket, SERVER_MESSAGE_TYPE.actionResult);
  socket.send(
    encodeNetworkMessage(
      createNetworkMessage(CLIENT_MESSAGE_TYPE.action, {
        action: { requestId: "same-request", type: "test", payload: { value: 2 } },
      }, 2),
    ),
  );
  const conflict = await conflictPromise;

  assert.equal(firstResult.payload.success, true);
  assert.equal(conflict.payload.success, false);
  assert.equal(conflict.payload.reason, "request-id-conflict");
  assert.equal(dispatchCount, 1);
});
