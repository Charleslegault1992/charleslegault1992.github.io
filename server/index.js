import { dirname, join } from "node:path";

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
import { createDailyWorldResetScheduler } from "./dailyWorldResetScheduler.js";
import { createVerifiedSqliteBackup } from "./persistence/sqliteBackup.js";

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
const backupDirectory = process.env.GAME_BACKUP_DIRECTORY ?? join(dirname(databasePath), "backups");
const configuredBackupRetentionDays = Number.parseInt(process.env.GAME_BACKUP_RETENTION_DAYS ?? "14", 10);
const backupRetentionDays =
  Number.isInteger(configuredBackupRetentionDays) && configuredBackupRetentionDays > 0
    ? configuredBackupRetentionDays
    : 14;
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
let resetScheduler = null;
const stop = async ({
  exitCode = 0,
  closeCode = 1001,
  closeReason = "Server stopping",
  createFinalBackup = false,
} = {}) => {
  if (isStopping) {
    return;
  }
  isStopping = true;
  resetScheduler?.stop();
  const forceExitTimer = setTimeout(() => process.exit(exitCode || 1), 25000);
  forceExitTimer.unref();
  try {
    const saveResult = runtime.saveAllPlayerPersistence();
    if (!saveResult.success) {
      console.error("Final player save failed:", saveResult.failedPlayerUids);
    }
    if (createFinalBackup) {
      const backupResult = createVerifiedSqliteBackup({
        databasePath,
        backupDirectory,
        retentionDays: backupRetentionDays,
      });
      if (!backupResult.success) {
        console.error(`Final SQLite backup failed: ${backupResult.reason}`, backupResult.error ?? "");
      } else {
        console.log(`Final SQLite backup verified: ${backupResult.backupPath}`);
      }
    }
    await server.stop({ closeCode, closeReason });
    accountRepository.close();
    chatModerationRepository.close();
    characterRepository.close();
    process.exit(exitCode);
  } catch (error) {
    console.error("Graceful server shutdown failed:", error);
    process.exit(exitCode || 1);
  }
};

resetScheduler = createDailyWorldResetScheduler({
  onWarning: (minutes) => {
    runtime.announceSystemMessage({
      en: `Daily world reset in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      fr: `Reset quotidien du monde dans ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    });
  },
  onReset: () => stop({
    exitCode: 75,
    closeCode: 1012,
    closeReason: "Daily world reset",
    createFinalBackup: true,
  }),
});
console.log(`Next daily world reset: ${new Date(resetScheduler.nextResetAt).toISOString()}`);

process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
