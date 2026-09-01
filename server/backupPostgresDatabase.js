import { join } from "node:path";

import { createVerifiedPostgresBackup } from "./persistence/postgresBackup.js";
import { getPostgresApplicationOptions } from "./persistence/postgresEnvironment.js";

const backupDirectory = process.env.GAME_POSTGRES_BACKUP_DIRECTORY ?? "/var/lib/nonameyet/postgres-backups";
const retentionDays = Number.parseInt(process.env.GAME_BACKUP_RETENTION_DAYS ?? "14", 10);
const databaseOptions = getPostgresApplicationOptions();
const result = await createVerifiedPostgresBackup({
  databaseOptions,
  backupDirectory: join(backupDirectory),
  retentionDays,
});

if (!result.success) {
  console.error(`PostgreSQL backup failed: ${result.reason}`, result.error ?? "");
  process.exitCode = 1;
} else {
  console.log(`PostgreSQL backup verified: ${result.backupPath} (${result.sizeBytes} bytes, ${result.sha256})`);
}
