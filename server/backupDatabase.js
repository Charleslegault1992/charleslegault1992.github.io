import { dirname, join } from "node:path";

import { createVerifiedSqliteBackup } from "./persistence/sqliteBackup.js";

const databasePath = process.env.GAME_DATABASE_PATH ?? ".data/game.sqlite";
const backupDirectory = process.env.GAME_BACKUP_DIRECTORY ?? join(dirname(databasePath), "backups");
const retentionDays = Number.parseInt(process.env.GAME_BACKUP_RETENTION_DAYS ?? "14", 10);
const result = createVerifiedSqliteBackup({ databasePath, backupDirectory, retentionDays });

if (!result.success) {
  console.error(`SQLite backup failed: ${result.reason}`, result.error ?? "");
  process.exitCode = 1;
} else {
  console.log(
    `SQLite backup verified: ${result.backupPath} (${result.sizeBytes} bytes, schema ${result.schemaVersion}, ${result.sha256})`,
  );
}
