import { createHash } from "node:crypto";
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const DEFAULT_RETENTION_DAYS = 14;
const BACKUP_FILE_PATTERN = /^game-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.sqlite$/;

const getBackupTimestamp = (timestamp) => {
  return new Date(timestamp).toISOString().replaceAll(":", "-").replace(".", "-");
};

const quoteSqliteString = (value) => {
  return `'${String(value).replaceAll("'", "''")}'`;
};

const calculateFileSha256 = (filePath) => {
  const hash = createHash("sha256");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  const fileDescriptor = openSync(filePath, "r");
  try {
    let bytesRead = 0;
    do {
      bytesRead = readSync(fileDescriptor, buffer, 0, buffer.length, null);
      if (bytesRead > 0) {
        hash.update(buffer.subarray(0, bytesRead));
      }
    } while (bytesRead > 0);
  } finally {
    closeSync(fileDescriptor);
  }
  return hash.digest("hex");
};

export const verifySqliteBackup = (backupPath) => {
  if (typeof backupPath !== "string" || backupPath === "" || !existsSync(backupPath)) {
    return { success: false, reason: "backup-not-found" };
  }

  let database = null;
  try {
    database = new DatabaseSync(backupPath, { readOnly: true });
    const integrityRows = database.prepare("PRAGMA integrity_check;").all();
    const integrityOk =
      integrityRows.length === 1 && String(Object.values(integrityRows[0])[0] ?? "").toLocaleLowerCase() === "ok";
    if (!integrityOk) {
      return { success: false, reason: "integrity-check-failed" };
    }
    const migrationRow = database.prepare("SELECT MAX(version) AS version FROM schema_migrations;").get();
    if (!Number.isSafeInteger(migrationRow?.version) || migrationRow.version <= 0) {
      return { success: false, reason: "schema-validation-failed" };
    }
    database.prepare("SELECT COUNT(*) AS count FROM accounts;").get();
    database.prepare("SELECT COUNT(*) AS count FROM characters;").get();
    return {
      success: true,
      schemaVersion: migrationRow.version,
      sizeBytes: statSync(backupPath).size,
      sha256: calculateFileSha256(backupPath),
    };
  } catch (error) {
    return { success: false, reason: "backup-open-failed", error };
  } finally {
    database?.close();
  }
};

const verifySqliteBackupChecksum = (backupPath, sha256) => {
  const checksumPath = `${backupPath}.sha256`;
  if (!existsSync(checksumPath)) {
    return true;
  }
  const expectedSha256 = readFileSync(checksumPath, "utf8").trim().split(/\s+/)[0] ?? "";
  return expectedSha256 === sha256;
};

const removeExpiredBackups = (backupDirectory, currentTimestamp, retentionDays) => {
  const cutoffTimestamp = currentTimestamp - retentionDays * 24 * 60 * 60 * 1000;
  let removedCount = 0;
  for (const entry of readdirSync(backupDirectory, { withFileTypes: true })) {
    if (!entry.isFile() || !BACKUP_FILE_PATTERN.test(entry.name)) {
      continue;
    }
    const backupPath = join(backupDirectory, entry.name);
    if (statSync(backupPath).mtimeMs >= cutoffTimestamp) {
      continue;
    }
    rmSync(backupPath, { force: true });
    rmSync(`${backupPath}.sha256`, { force: true });
    removedCount++;
  }
  return removedCount;
};

export const createVerifiedSqliteBackup = ({
  databasePath,
  backupDirectory,
  retentionDays = DEFAULT_RETENTION_DAYS,
  now = Date.now(),
} = {}) => {
  if (
    typeof databasePath !== "string" ||
    databasePath === "" ||
    databasePath === ":memory:" ||
    !existsSync(databasePath) ||
    typeof backupDirectory !== "string" ||
    backupDirectory === "" ||
    !Number.isInteger(retentionDays) ||
    retentionDays <= 0 ||
    !Number.isFinite(now)
  ) {
    return { success: false, reason: "invalid-backup-configuration" };
  }

  const resolvedDatabasePath = resolve(databasePath);
  const resolvedBackupDirectory = resolve(backupDirectory);
  mkdirSync(resolvedBackupDirectory, { recursive: true, mode: 0o700 });
  const fileName = `game-${getBackupTimestamp(now)}.sqlite`;
  const backupPath = join(resolvedBackupDirectory, fileName);
  const temporaryPath = `${backupPath}.tmp`;
  rmSync(temporaryPath, { force: true });

  let sourceDatabase = null;
  try {
    sourceDatabase = new DatabaseSync(resolvedDatabasePath);
    sourceDatabase.exec("PRAGMA busy_timeout = 10000;");
    sourceDatabase.exec(`VACUUM INTO ${quoteSqliteString(temporaryPath)};`);
  } catch (error) {
    rmSync(temporaryPath, { force: true });
    return { success: false, reason: "backup-create-failed", error };
  } finally {
    sourceDatabase?.close();
  }

  const verification = verifySqliteBackup(temporaryPath);
  if (!verification.success) {
    rmSync(temporaryPath, { force: true });
    return verification;
  }

  renameSync(temporaryPath, backupPath);
  writeFileSync(`${backupPath}.sha256`, `${verification.sha256}  ${basename(backupPath)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  const removedCount = removeExpiredBackups(resolvedBackupDirectory, now, retentionDays);

  return {
    ...verification,
    backupPath,
    removedCount,
  };
};

export const restoreVerifiedSqliteBackup = ({ backupPath, databasePath, now = Date.now() } = {}) => {
  if (
    typeof backupPath !== "string" ||
    backupPath === "" ||
    typeof databasePath !== "string" ||
    databasePath === "" ||
    databasePath === ":memory:" ||
    !Number.isFinite(now)
  ) {
    return { success: false, reason: "invalid-restore-configuration" };
  }

  const resolvedBackupPath = resolve(backupPath);
  const resolvedDatabasePath = resolve(databasePath);
  if (resolvedBackupPath === resolvedDatabasePath) {
    return { success: false, reason: "invalid-restore-target" };
  }
  const backupVerification = verifySqliteBackup(resolvedBackupPath);
  if (!backupVerification.success) {
    return backupVerification;
  }
  if (!verifySqliteBackupChecksum(resolvedBackupPath, backupVerification.sha256)) {
    return { success: false, reason: "backup-checksum-mismatch" };
  }

  mkdirSync(dirname(resolvedDatabasePath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${resolvedDatabasePath}.restore.tmp`;
  const previousDatabasePath = existsSync(resolvedDatabasePath)
    ? `${resolvedDatabasePath}.before-restore-${getBackupTimestamp(now)}`
    : null;
  rmSync(temporaryPath, { force: true });
  copyFileSync(resolvedBackupPath, temporaryPath);
  const temporaryVerification = verifySqliteBackup(temporaryPath);
  if (!temporaryVerification.success || temporaryVerification.sha256 !== backupVerification.sha256) {
    rmSync(temporaryPath, { force: true });
    return { success: false, reason: "restore-copy-verification-failed" };
  }

  try {
    if (previousDatabasePath) {
      const currentDatabase = new DatabaseSync(resolvedDatabasePath);
      try {
        currentDatabase.exec("PRAGMA wal_checkpoint(TRUNCATE);");
      } finally {
        currentDatabase.close();
      }
      rmSync(`${resolvedDatabasePath}-wal`, { force: true });
      rmSync(`${resolvedDatabasePath}-shm`, { force: true });
      renameSync(resolvedDatabasePath, previousDatabasePath);
    }
    renameSync(temporaryPath, resolvedDatabasePath);
  } catch (error) {
    rmSync(temporaryPath, { force: true });
    if (previousDatabasePath && existsSync(previousDatabasePath) && !existsSync(resolvedDatabasePath)) {
      renameSync(previousDatabasePath, resolvedDatabasePath);
    }
    return { success: false, reason: "restore-replace-failed", error };
  }

  const restoredVerification = verifySqliteBackup(resolvedDatabasePath);
  if (!restoredVerification.success || restoredVerification.sha256 !== backupVerification.sha256) {
    rmSync(resolvedDatabasePath, { force: true });
    if (previousDatabasePath && existsSync(previousDatabasePath)) {
      renameSync(previousDatabasePath, resolvedDatabasePath);
    }
    return { success: false, reason: "restored-database-verification-failed" };
  }
  return {
    ...restoredVerification,
    databasePath: resolvedDatabasePath,
    previousDatabasePath,
  };
};
