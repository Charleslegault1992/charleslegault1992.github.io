import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import { openGameDatabase } from "../server/persistence/sqliteDatabase.js";
import {
  createVerifiedSqliteBackup,
  restoreVerifiedSqliteBackup,
  verifySqliteBackup,
} from "../server/persistence/sqliteBackup.js";

test("a live WAL database creates a standalone verified and restorable backup", (testContext) => {
  const directory = mkdtempSync(join(tmpdir(), "nonameyet-backup-"));
  const databasePath = join(directory, "game.sqlite");
  const backupDirectory = join(directory, "backups");
  const database = openGameDatabase({ databasePath });
  testContext.after(() => {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  });
  database.prepare("INSERT INTO accounts (account_id, password_hash, created_at) VALUES (?, ?, ?)")
    .run("backup-account", "hash", 1000);
  database.prepare(`
    INSERT INTO characters (account_id, character_id, snapshot_json, version, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run("backup-account", "backup-character", JSON.stringify({ name: "Backup Hero" }), 3, 2000);

  const result = createVerifiedSqliteBackup({
    databasePath,
    backupDirectory,
    now: Date.parse("2026-08-31T09:00:00.000Z"),
  });

  assert.equal(result.success, true);
  assert.equal(result.schemaVersion, 6);
  assert.equal(existsSync(result.backupPath), true);
  assert.equal(existsSync(`${result.backupPath}.sha256`), true);
  assert.match(readFileSync(`${result.backupPath}.sha256`, "utf8"), new RegExp(`^${result.sha256}`));

  const restoredDatabase = new DatabaseSync(result.backupPath, { readOnly: true });
  assert.equal(restoredDatabase.prepare("SELECT COUNT(*) AS count FROM accounts").get().count, 1);
  assert.equal(restoredDatabase.prepare("SELECT COUNT(*) AS count FROM characters").get().count, 1);
  restoredDatabase.close();

  const restoredDatabasePath = join(directory, "restored", "game.sqlite");
  const restoreResult = restoreVerifiedSqliteBackup({
    backupPath: result.backupPath,
    databasePath: restoredDatabasePath,
    now: Date.parse("2026-08-31T10:00:00.000Z"),
  });
  assert.equal(restoreResult.success, true);
  const restoredCopy = new DatabaseSync(restoredDatabasePath, { readOnly: true });
  assert.equal(restoredCopy.prepare("SELECT COUNT(*) AS count FROM accounts").get().count, 1);
  assert.equal(restoredCopy.prepare("SELECT COUNT(*) AS count FROM characters").get().count, 1);
  restoredCopy.close();

  const replacementResult = restoreVerifiedSqliteBackup({
    backupPath: result.backupPath,
    databasePath: restoredDatabasePath,
    now: Date.parse("2026-08-31T11:00:00.000Z"),
  });
  assert.equal(replacementResult.success, true);
  assert.equal(existsSync(replacementResult.previousDatabasePath), true);
});

test("backup verification rejects corruption and retention removes expired snapshots", (testContext) => {
  const directory = mkdtempSync(join(tmpdir(), "nonameyet-backup-retention-"));
  const databasePath = join(directory, "game.sqlite");
  const backupDirectory = join(directory, "backups");
  const database = openGameDatabase({ databasePath });
  testContext.after(() => {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  });

  const firstResult = createVerifiedSqliteBackup({
    databasePath,
    backupDirectory,
    now: Date.parse("2026-08-01T09:00:00.000Z"),
  });
  assert.equal(firstResult.success, true);
  const oldTimestamp = new Date("2026-08-01T09:00:00.000Z");
  utimesSync(firstResult.backupPath, oldTimestamp, oldTimestamp);

  const secondResult = createVerifiedSqliteBackup({
    databasePath,
    backupDirectory,
    retentionDays: 14,
    now: Date.parse("2026-08-31T09:00:00.000Z"),
  });
  assert.equal(secondResult.success, true);
  assert.equal(secondResult.removedCount, 1);
  assert.equal(existsSync(firstResult.backupPath), false);

  const corruptPath = join(backupDirectory, `corrupt-${basename(secondResult.backupPath)}`);
  writeFileSync(corruptPath, "not a sqlite database");
  assert.equal(verifySqliteBackup(corruptPath).success, false);
});
