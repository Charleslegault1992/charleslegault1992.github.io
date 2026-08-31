import {
  dirname,
  join,
} from "node:path";

import {
  createVerifiedSqliteBackup,
} from "./persistence/sqliteBackup.js";

import {
  createPostgresDatabase,
} from "./persistence/postgresDatabase.js";

import {
  getPostgresMigratorOptions,
} from "./persistence/postgresEnvironment.js";

import {
  migrateSqliteBackupToPostgres,
} from "./persistence/sqliteToPostgresMigration.js";

const offlineConfirmed =
  process.env
    .GAME_SQLITE_IMPORT_CONFIRM_OFFLINE ===
  "true";

if (!offlineConfirmed) {
  throw new Error(
    "SQLite to PostgreSQL import requires GAME_SQLITE_IMPORT_CONFIRM_OFFLINE=true.",
  );
}

const databasePath =
  process.env.GAME_DATABASE_PATH ??
  ".data/game.sqlite";

const backupDirectory =
  process.env.GAME_BACKUP_DIRECTORY ??
  join(
    dirname(databasePath),
    "backups",
  );

const configuredRetentionDays =
  Number.parseInt(
    process.env
      .GAME_BACKUP_RETENTION_DAYS ??
      "14",
    10,
  );

const retentionDays =
  Number.isSafeInteger(
    configuredRetentionDays,
  ) &&
  configuredRetentionDays > 0
    ? configuredRetentionDays
    : 14;

const backup =
  createVerifiedSqliteBackup({
    databasePath,
    backupDirectory,
    retentionDays,
  });

if (!backup.success) {
  throw new Error(
    `Pre-import SQLite backup failed: ${backup.reason}.`,
  );
}

console.log(
  `Verified SQLite pre-import backup created: ${backup.backupPath}`,
);

const database =
  createPostgresDatabase(
    getPostgresMigratorOptions(),
  );

try {
  const healthy =
    await database.healthCheck();

  if (!healthy) {
    throw new Error(
      "PostgreSQL health check failed before SQLite import.",
    );
  }

  const result =
    await migrateSqliteBackupToPostgres({
      sqlitePath: backup.backupPath,
      database,
    });

  console.log(
    `SQLite schema ${result.sourceSchemaVersion} imported and verified.`,
  );

  for (
    const [
      tableName,
      summary,
    ]
    of Object.entries(result.tables)
  ) {
    console.log(
      `${tableName}: ${summary.count} rows, sha256 ${summary.sha256.slice(0, 12)}…`,
    );
  }
} catch (error) {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  console.error(
    `SQLite to PostgreSQL import failed: ${message}`,
  );

  process.exitCode = 1;
} finally {
  await database.close();
}