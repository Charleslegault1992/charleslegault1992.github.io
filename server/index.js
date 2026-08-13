import { createAuthoritativeWorldRuntime } from "./authoritativeWorldRuntime.js";
import { createHmacAuthService } from "./auth/hmacAuthService.js";
import { createGameServer } from "./gameServer.js";
import { loadServerWorldMaps } from "./loadServerWorldMaps.js";
import { createSqliteCharacterRepository } from "./persistence/sqliteCharacterRepository.js";

const port = Number.parseInt(process.env.GAME_SERVER_PORT ?? "8080", 10);
const host = process.env.GAME_SERVER_HOST ?? "127.0.0.1";
const worldMapsByZ = await loadServerWorldMaps();
const authSecret = process.env.GAME_AUTH_SECRET ?? "development-only-secret-change-me";
if (!process.env.GAME_AUTH_SECRET) {
  console.warn("GAME_AUTH_SECRET is not set; using the development-only secret.");
}
const authService = createHmacAuthService({ secret: authSecret });
const characterRepository = createSqliteCharacterRepository({
  databasePath: process.env.GAME_DATABASE_PATH ?? ".data/game.sqlite",
});
const runtime = createAuthoritativeWorldRuntime({ worldMapsByZ, characterRepository });
const server = createGameServer({
  runtime,
  authenticateClient: (hello) => authService.verifyToken(hello?.authToken),
  host,
  port,
});

await server.start();
const address = server.getAddress();
console.log(`Game server listening on ws://${address.address}:${address.port}/game`);

let isStopping = false;
const stop = async () => {
  if (isStopping) {
    return;
  }
  isStopping = true;
  await server.stop();
  characterRepository.close();
  process.exit(0);
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
