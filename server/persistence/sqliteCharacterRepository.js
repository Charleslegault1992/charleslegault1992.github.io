import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export const createSqliteCharacterRepository = ({ databasePath = ".data/game.sqlite" } = {}) => {
  if (typeof databasePath !== "string" || databasePath === "") {
    throw new TypeError("A SQLite database path is required.");
  }
  if (databasePath !== ":memory:") {
    mkdirSync(dirname(databasePath), { recursive: true });
  }
  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec(`
    CREATE TABLE IF NOT EXISTS characters (
      account_id TEXT NOT NULL,
      character_id TEXT NOT NULL,
      snapshot_json TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (account_id, character_id)
    ) STRICT;
  `);

  const selectCharacter = database.prepare(`
    SELECT snapshot_json, version, updated_at
    FROM characters
    WHERE account_id = ? AND character_id = ?
  `);
  const insertCharacter = database.prepare(`
    INSERT INTO characters (account_id, character_id, snapshot_json, version, updated_at)
    VALUES (?, ?, ?, 1, ?)
    ON CONFLICT (account_id, character_id) DO NOTHING
  `);
  const updateCharacter = database.prepare(`
    UPDATE characters
    SET snapshot_json = ?, version = version + 1, updated_at = ?
    WHERE account_id = ? AND character_id = ? AND version = ?
  `);

  const isValidIdentity = (accountId, characterId) => {
    return (
      typeof accountId === "string" &&
      accountId !== "" &&
      typeof characterId === "string" &&
      characterId !== ""
    );
  };

  return Object.freeze({
    load(accountId, characterId) {
      if (!isValidIdentity(accountId, characterId)) {
        return null;
      }
      const row = selectCharacter.get(accountId, characterId);
      if (!row) {
        return null;
      }
      try {
        return {
          snapshot: JSON.parse(row.snapshot_json),
          version: row.version,
          updatedAt: row.updated_at,
        };
      } catch {
        return null;
      }
    },
    save(accountId, characterId, snapshot, expectedVersion = null, now = Date.now()) {
      if (!isValidIdentity(accountId, characterId) || !snapshot || !Number.isFinite(now)) {
        return { success: false, reason: "invalid-save" };
      }
      const snapshotJson = JSON.stringify(snapshot);
      if (expectedVersion === null) {
        const insertResult = insertCharacter.run(accountId, characterId, snapshotJson, now);
        if (insertResult.changes === 1) {
          return { success: true, version: 1 };
        }
        return { success: false, reason: "character-already-exists" };
      }
      if (!Number.isSafeInteger(expectedVersion) || expectedVersion <= 0) {
        return { success: false, reason: "invalid-version" };
      }
      const updateResult = updateCharacter.run(snapshotJson, now, accountId, characterId, expectedVersion);
      return updateResult.changes === 1
        ? { success: true, version: expectedVersion + 1 }
        : { success: false, reason: "version-conflict" };
    },
    close() {
      database.close();
    },
  });
};
