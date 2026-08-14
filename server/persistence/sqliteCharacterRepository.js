import { openGameDatabase } from "./sqliteDatabase.js";

export const createSqliteCharacterRepository = ({ databasePath = ".data/game.sqlite" } = {}) => {
  const database = openGameDatabase({ databasePath });

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
  const selectCharacters = database.prepare(`
    SELECT character_id, snapshot_json, version, updated_at
    FROM characters
    WHERE account_id = ?
    ORDER BY updated_at DESC, character_id ASC
  `);
  const deleteCharacter = database.prepare(`
    DELETE FROM characters
    WHERE account_id = ? AND character_id = ?
  `);
  const insertCharacterName = database.prepare(`
    INSERT INTO character_names (normalized_name, account_id, character_id)
    VALUES (?, ?, ?)
    ON CONFLICT DO NOTHING
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
    list(accountId) {
      if (typeof accountId !== "string" || accountId === "") {
        return [];
      }
      return selectCharacters.all(accountId).flatMap((row) => {
        try {
          const snapshot = JSON.parse(row.snapshot_json);
          return [{
            characterId: row.character_id,
            name: snapshot.name ?? row.character_id,
            level: Number.isFinite(snapshot.level) ? snapshot.level : 0,
            appearanceId: snapshot.appearanceId ?? "male",
            appearanceParts: snapshot.appearanceParts ?? null,
            appearanceColors: snapshot.appearanceColors ?? null,
            version: row.version,
            updatedAt: row.updated_at,
          }];
        } catch {
          return [];
        }
      });
    },
    delete(accountId, characterId) {
      if (!isValidIdentity(accountId, characterId)) {
        return false;
      }
      return deleteCharacter.run(accountId, characterId).changes === 1;
    },
    save(accountId, characterId, snapshot, expectedVersion = null, now = Date.now()) {
      if (!isValidIdentity(accountId, characterId) || !snapshot || !Number.isFinite(now)) {
        return { success: false, reason: "invalid-save" };
      }
      const snapshotJson = JSON.stringify(snapshot);
      if (expectedVersion === null) {
        const normalizedName = typeof snapshot.name === "string" ? snapshot.name.trim().toLocaleLowerCase() : "";
        database.exec("BEGIN IMMEDIATE;");
        try {
          const insertResult = insertCharacter.run(accountId, characterId, snapshotJson, now);
          if (insertResult.changes !== 1) {
            database.exec("ROLLBACK;");
            return { success: false, reason: "character-already-exists" };
          }
          if (normalizedName !== "" && insertCharacterName.run(normalizedName, accountId, characterId).changes !== 1) {
            database.exec("ROLLBACK;");
            return { success: false, reason: "character-name-taken" };
          }
          database.exec("COMMIT;");
          return { success: true, version: 1 };
        } catch (error) {
          database.exec("ROLLBACK;");
          throw error;
        }
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
