import { restoreVerifiedSqliteBackup } from "./persistence/sqliteBackup.js";

const backupPath = process.argv[2] ?? "";
const databasePath = process.env.GAME_DATABASE_PATH ?? ".data/game.sqlite";

if (process.env.CONFIRM_DATABASE_RESTORE !== "RESTORE") {
  console.error("Database restore refused. Stop the game server and set CONFIRM_DATABASE_RESTORE=RESTORE.");
  process.exitCode = 1;
} else {
  const result = restoreVerifiedSqliteBackup({ backupPath, databasePath });
  if (!result.success) {
    console.error(`SQLite restore failed: ${result.reason}`, result.error ?? "");
    process.exitCode = 1;
  } else {
    console.log(`SQLite restore verified: ${result.databasePath}`);
    if (result.previousDatabasePath) {
      console.log(`Previous database preserved: ${result.previousDatabasePath}`);
    }
  }
}
