import { performance } from "node:perf_hooks";
import { WebSocket } from "ws";

import { createAuthoritativeWorldRuntime } from "./authoritativeWorldRuntime.js";
import { createGameServer } from "./gameServer.js";
import { loadServerWorldMaps } from "./loadServerWorldMaps.js";
import {
  CLIENT_MESSAGE_TYPE,
  createNetworkMessage,
  decodeNetworkMessage,
  encodeNetworkMessage,
  SERVER_MESSAGE_TYPE,
} from "../src/network/networkProtocol.js";

const clientCount = Number.parseInt(process.env.LOAD_TEST_CLIENTS ?? "20", 10);
if (!Number.isInteger(clientCount) || clientCount <= 0 || clientCount > 100) {
  throw new Error("LOAD_TEST_CLIENTS must be between 1 and 100.");
}

const worldMapsByZ = await loadServerWorldMaps();
const runtime = createAuthoritativeWorldRuntime({ worldMapsByZ });
const server = createGameServer({
  runtime,
  authenticateClient: (hello) => ({ accountId: `load-${hello.characterId}` }),
  port: 0,
});
await server.start();
const { port } = server.getAddress();
const sockets = [];
const startedAt = performance.now();

const connectClient = (index) => {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/game`);
    sockets.push(socket);
    const timeout = setTimeout(() => reject(new Error(`Client ${index} timed out`)), 5000);
    socket.on("open", () => {
      socket.send(
        encodeNetworkMessage(
          createNetworkMessage(CLIENT_MESSAGE_TYPE.hello, { characterId: `client-${index}` }, 0),
        ),
      );
    });
    socket.on("message", (rawMessage) => {
      const message = decodeNetworkMessage(rawMessage.toString());
      if (message?.type === SERVER_MESSAGE_TYPE.snapshot) {
        clearTimeout(timeout);
        resolve();
      }
    });
    socket.on("error", reject);
  });
};

try {
  await Promise.all(Array.from({ length: clientCount }, (_, index) => connectClient(index)));
  const elapsedMs = performance.now() - startedAt;
  console.log(
    JSON.stringify({
      clients: clientCount,
      connectedClients: server.getClientCount(),
      elapsedMs: Math.round(elapsedMs),
      averageMsPerClient: Number((elapsedMs / clientCount).toFixed(2)),
    }),
  );
} finally {
  for (const socket of sockets) {
    socket.close();
  }
  await server.stop();
}
