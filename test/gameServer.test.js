import assert from "node:assert/strict";
import test from "node:test";
import { WebSocket } from "ws";

import { createGameServer } from "../server/gameServer.js";
import {
  CLIENT_MESSAGE_TYPE,
  createNetworkMessage,
  decodeNetworkMessage,
  encodeNetworkMessage,
  SESSION_REPLACED_CLOSE_CODE,
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

test("a new authenticated socket replaces a stale session for the same character", async (testContext) => {
  let isCharacterOnline = false;
  let disconnectCount = 0;
  const runtime = {
    connectClient: () => {
      if (isCharacterOnline) {
        return { success: false, reason: "character-already-online" };
      }
      isCharacterOnline = true;
      return { success: true, playerUid: "player:account-1:one" };
    },
    disconnectClient: () => {
      disconnectCount += 1;
      isCharacterOnline = false;
    },
    dispatchAction: () => ({ success: true }),
    createSnapshotForClient: () => ({ revision: 0, self: { uid: "player:account-1:one" } }),
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
  const serverUrl = `ws://127.0.0.1:${server.getAddress().port}/game`;
  const firstSocket = new WebSocket(serverUrl);
  await new Promise((resolve) => firstSocket.once("open", resolve));
  const firstSnapshot = waitForMessage(firstSocket, SERVER_MESSAGE_TYPE.snapshot);
  firstSocket.send(
    encodeNetworkMessage(
      createNetworkMessage(CLIENT_MESSAGE_TYPE.hello, { characterId: "one", clientInstanceId: "first-client" }, 0),
    ),
  );
  await firstSnapshot;

  const replacementError = waitForMessage(firstSocket, SERVER_MESSAGE_TYPE.error);
  const firstSocketClosed = new Promise((resolve) => firstSocket.once("close", (code) => resolve(code)));
  const secondSocket = new WebSocket(serverUrl);
  testContext.after(() => secondSocket.close());
  await new Promise((resolve) => secondSocket.once("open", resolve));
  const secondSnapshot = waitForMessage(secondSocket, SERVER_MESSAGE_TYPE.snapshot);
  secondSocket.send(
    encodeNetworkMessage(
      createNetworkMessage(CLIENT_MESSAGE_TYPE.hello, { characterId: "one", clientInstanceId: "second-client" }, 0),
    ),
  );

  assert.equal((await replacementError).payload.reason, "session-replaced");
  assert.equal(await firstSocketClosed, 4001);
  assert.equal((await secondSnapshot).payload.self.uid, "player:account-1:one");
  assert.equal(disconnectCount, 1);
});

test("a legacy reconnect cannot replace an active modern character session", async (testContext) => {
  let isCharacterOnline = false;
  let disconnectCount = 0;
  const runtime = {
    connectClient: () => {
      if (isCharacterOnline) {
        return { success: false, reason: "character-already-online" };
      }
      isCharacterOnline = true;
      return { success: true, playerUid: "player:account-1:one" };
    },
    disconnectClient: () => {
      disconnectCount += 1;
      isCharacterOnline = false;
    },
    dispatchAction: () => ({ success: true }),
    createSnapshotForClient: () => ({ revision: 0, self: { uid: "player:account-1:one" } }),
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
  const serverUrl = `ws://127.0.0.1:${server.getAddress().port}/game`;

  const legacySocket = new WebSocket(serverUrl);
  await new Promise((resolve) => legacySocket.once("open", resolve));
  const legacySnapshot = waitForMessage(legacySocket, SERVER_MESSAGE_TYPE.snapshot);
  legacySocket.send(encodeNetworkMessage(createNetworkMessage(CLIENT_MESSAGE_TYPE.hello, { characterId: "one" }, 0)));
  await legacySnapshot;

  const modernSocket = new WebSocket(serverUrl);
  testContext.after(() => modernSocket.close());
  await new Promise((resolve) => modernSocket.once("open", resolve));
  const modernSnapshot = waitForMessage(modernSocket, SERVER_MESSAGE_TYPE.snapshot);
  modernSocket.send(
    encodeNetworkMessage(
      createNetworkMessage(CLIENT_MESSAGE_TYPE.hello, { characterId: "one", clientInstanceId: "modern-client" }, 0),
    ),
  );
  await modernSnapshot;

  const staleSocket = new WebSocket(serverUrl);
  await new Promise((resolve) => staleSocket.once("open", resolve));
  const rejection = waitForMessage(staleSocket, SERVER_MESSAGE_TYPE.error);
  const staleSocketClosed = new Promise((resolve) => staleSocket.once("close", (code) => resolve(code)));
  staleSocket.send(encodeNetworkMessage(createNetworkMessage(CLIENT_MESSAGE_TYPE.hello, { characterId: "one" }, 0)));

  assert.equal((await rejection).payload.reason, "connection-rejected");
  assert.equal(await staleSocketClosed, SESSION_REPLACED_CLOSE_CODE);
  assert.equal(modernSocket.readyState, WebSocket.OPEN);
  assert.equal(disconnectCount, 1);
});

test("the WebSocket gateway rejects an unexpected browser origin", async (testContext) => {
  const runtime = {
    connectClient: () => ({ success: true, playerUid: "player-1" }),
    disconnectClient: () => {},
    dispatchAction: () => ({ success: true }),
    createSnapshotForClient: () => ({ revision: 0, self: { uid: "player-1" } }),
    getDeltasForClient: () => [],
    update: () => {},
  };
  const server = createGameServer({
    runtime,
    authenticateClient: () => ({ accountId: "account-1" }),
    allowedOrigin: "https://nonameyet.example",
    port: 0,
  });
  await server.start();
  testContext.after(() => server.stop());

  const socket = new WebSocket(`ws://127.0.0.1:${server.getAddress().port}/game`, {
    origin: "https://unexpected.example",
  });
  socket.on("error", () => {});
  const statusCode = await new Promise((resolve) => {
    socket.once("unexpected-response", (_request, response) => resolve(response.statusCode));
  });

  assert.equal(statusCode, 403);
  socket.close();
});
