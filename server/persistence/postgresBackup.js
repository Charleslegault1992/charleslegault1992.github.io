import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  createReadStream,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";

const runPostgresTool = (command, args, environment) => {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    env: environment,
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${String(result.stderr ?? "").trim()}`);
  }
  return result.stdout ?? "";
};

const createBackupTimestamp = (now) => new Date(now).toISOString().replaceAll(":", "-").replaceAll(".", "-");

const calculateFileSha256 = (filePath) => new Promise((resolveHash, rejectHash) => {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath);
  stream.on("error", rejectHash);
  stream.on("data", (chunk) => hash.update(chunk));
  stream.on("end", () => resolveHash(hash.digest("hex")));
});

const removeExpiredBackups = (backupDirectory, currentTimestamp, retentionDays) => {
  const cutoffTimestamp = currentTimestamp - retentionDays * 24 * 60 * 60 * 1000;
  for (const entry of readdirSync(backupDirectory, { withFileTypes: true })) {
    if (!entry.isFile() || (!entry.name.endsWith(".dump") && !entry.name.endsWith(".dump.sha256"))) {
      continue;
    }
    const backupPath = join(backupDirectory, entry.name);
    if (statSync(backupPath).mtimeMs < cutoffTimestamp) {
      rmSync(backupPath, { force: true });
    }
  }
};

export const createVerifiedPostgresBackup = async ({
  databaseOptions,
  backupDirectory,
  retentionDays = 14,
  now = Date.now(),
  pgDumpCommand = "pg_dump",
  pgRestoreCommand = "pg_restore",
} = {}) => {
  if (
    !databaseOptions ||
    typeof databaseOptions.host !== "string" ||
    !Number.isInteger(databaseOptions.port) ||
    typeof databaseOptions.database !== "string" ||
    typeof databaseOptions.user !== "string" ||
    typeof databaseOptions.password !== "string" ||
    typeof backupDirectory !== "string" ||
    backupDirectory === "" ||
    !Number.isInteger(retentionDays) ||
    retentionDays <= 0 ||
    !Number.isFinite(now)
  ) {
    return { success: false, reason: "invalid-backup-configuration" };
  }

  const resolvedBackupDirectory = resolve(backupDirectory);
  const backupPath = join(resolvedBackupDirectory, `nonameyet-${createBackupTimestamp(now)}.dump`);
  const temporaryPath = `${backupPath}.tmp`;
  const toolEnvironment = {
    ...process.env,
    PGPASSWORD: databaseOptions.password,
    PGSSLMODE: databaseOptions.ssl ? "require" : "disable",
  };

  mkdirSync(resolvedBackupDirectory, { recursive: true, mode: 0o700 });

  try {
    runPostgresTool(
      pgDumpCommand,
      [
        "--host", databaseOptions.host,
        "--port", String(databaseOptions.port),
        "--username", databaseOptions.user,
        "--dbname", databaseOptions.database,
        "--schema", "game",
        "--format", "custom",
        "--compress", "6",
        "--no-owner",
        "--no-privileges",
        "--file", temporaryPath,
      ],
      toolEnvironment,
    );

    const sizeBytes = statSync(temporaryPath).size;
    if (sizeBytes <= 0) {
      throw new Error("PostgreSQL backup archive is empty.");
    }

    const archiveList = runPostgresTool(pgRestoreCommand, ["--list", temporaryPath], toolEnvironment);
    for (const requiredTable of ["accounts", "characters", "character_names", "chat_mutes", "external_identities"]) {
      if (!archiveList.includes(`game ${requiredTable}`)) {
        throw new Error(`PostgreSQL backup is missing game.${requiredTable}.`);
      }
    }

    const sha256 = await calculateFileSha256(temporaryPath);
    renameSync(temporaryPath, backupPath);
    writeFileSync(`${backupPath}.sha256`, `${sha256}  ${basename(backupPath)}\n`, { mode: 0o600 });
    removeExpiredBackups(resolvedBackupDirectory, now, retentionDays);

    return { success: true, backupPath, sizeBytes, sha256 };
  } catch (error) {
    rmSync(temporaryPath, { force: true });
    return { success: false, reason: "postgres-backup-failed", error };
  }
};
