import { createAuthoritativeWorldRuntime } from "./authoritativeWorldRuntime.js";
import { createHmacAuthService } from "./auth/hmacAuthService.js";
import { createPasswordService } from "./auth/passwordService.js";
import { createGoogleIdentityService } from "./auth/googleIdentityService.js";
import { createGameServer } from "./gameServer.js";
import { createGameHttpApi } from "./http/gameHttpApi.js";
import { loadServerWorldMaps } from "./loadServerWorldMaps.js";
import { createSqliteCharacterRepository } from "./persistence/sqliteCharacterRepository.js";
import { createSqliteAccountRepository } from "./persistence/sqliteAccountRepository.js";
import { createSqliteChatModerationRepository } from "./persistence/sqliteChatModerationRepository.js";
import { createChatModerationService } from "./chatModerationService.js";

const port = Number.parseInt(process.env.GAME_SERVER_PORT ?? "8080", 10);
const host = process.env.GAME_SERVER_HOST ?? "127.0.0.1";
const isProduction = process.env.NODE_ENV === "production";
const developmentAuthSecret = "development-only-secret-change-me";
const configuredClientOrigin = process.env.GAME_CLIENT_ORIGIN?.trim() ?? "";
const clientOriginUrl = configuredClientOrigin ? new URL(configuredClientOrigin) : null;
if (clientOriginUrl && clientOriginUrl.protocol !== "http:" && clientOriginUrl.protocol !== "https:") {
  throw new Error("GAME_CLIENT_ORIGIN must use http or https.");
}
const clientOrigin = clientOriginUrl?.origin ?? "";
const worldMapsByZ = await loadServerWorldMaps();
const authSecret = process.env.GAME_AUTH_SECRET ?? developmentAuthSecret;
if (isProduction && (!process.env.GAME_AUTH_SECRET || authSecret === developmentAuthSecret)) {
  throw new Error("GAME_AUTH_SECRET must use a private production value.");
}
if (isProduction && !clientOrigin) {
  throw new Error("GAME_CLIENT_ORIGIN must be set in production.");
}
if (!isProduction && !process.env.GAME_AUTH_SECRET) {
  console.warn("GAME_AUTH_SECRET is not set; using the development-only secret.");
}
const authService = createHmacAuthService({ secret: authSecret });
const databasePath = process.env.GAME_DATABASE_PATH ?? ".data/game.sqlite";
const characterRepository = createSqliteCharacterRepository({ databasePath });
const accountRepository = createSqliteAccountRepository({ databasePath });
const chatModerationRepository = createSqliteChatModerationRepository({ databasePath });
const moderatorAccountIds = (process.env.GAME_MODERATOR_ACCOUNTS ?? "")
  .split(",")
  .map((accountId) => accountId.trim())
  .filter(Boolean);
const runtime = createAuthoritativeWorldRuntime({
  worldMapsByZ,
  characterRepository,
  chatModerationService: createChatModerationService({
    repository: chatModerationRepository,
    moderatorAccountIds,
  }),
  allowCharacterAutoCreate: process.env.GAME_ALLOW_CHARACTER_AUTOCREATE === "true",
});
const passwordService = createPasswordService();
const googleIdentityService = createGoogleIdentityService({
  clientId: process.env.GAME_GOOGLE_CLIENT_ID ?? "",
});
const httpApi = createGameHttpApi({
  accountRepository,
  characterRepository,
  authService,
  passwordService,
  googleIdentityService,
  allowedOrigin: clientOrigin,
  isCharacterOnline: (accountId, characterId) => runtime.getPlayer(`player:${accountId}:${characterId}`) !== null,
});
const server = createGameServer({
  runtime,
  authenticateClient: (hello) => authService.verifyToken(hello?.authToken),
  handleHttpRequest: httpApi,
  allowedOrigin: clientOrigin,
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
  accountRepository.close();
  chatModerationRepository.close();
  characterRepository.close();
  process.exit(0);
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
