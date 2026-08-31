class CharacterSaveAbort extends Error {
  constructor(reason) {
    super(reason);
    this.name = "CharacterSaveAbort";
    this.reason = reason;
  }
}

const isValidIdentity = (accountId, characterId) => {
  return (
    typeof accountId === "string" &&
    accountId !== "" &&
    typeof characterId === "string" &&
    characterId !== ""
  );
};

const toSafeInteger = (value, fieldName) => {
  const numberValue = typeof value === "number"
    ? value
    : Number(value);

  if (!Number.isSafeInteger(numberValue)) {
    throw new RangeError(
      `PostgreSQL returned an invalid ${fieldName}.`,
    );
  }

  return numberValue;
};

const mapLoadedCharacter = (row) => {
  if (!row) {
    return null;
  }

  return {
    snapshot: row.snapshot_json,
    version: toSafeInteger(
      row.version,
      "character version",
    ),
    updatedAt: toSafeInteger(
      row.updated_at,
      "character updated_at",
    ),
  };
};

const mapCharacterListRow = (row) => {
  const snapshot = row.snapshot_json;

  if (!snapshot || typeof snapshot !== "object") {
    return null;
  }

  return {
    characterId: row.character_id,
    name: snapshot.name ?? row.character_id,
    level: Number.isFinite(snapshot.level)
      ? snapshot.level
      : 0,
    appearanceId: snapshot.appearanceId ?? "male",
    appearanceParts: snapshot.appearanceParts ?? null,
    appearanceColors: snapshot.appearanceColors ?? null,
    version: toSafeInteger(
      row.version,
      "character version",
    ),
    updatedAt: toSafeInteger(
      row.updated_at,
      "character updated_at",
    ),
  };
};

export const createPostgresCharacterRepository = ({
  database,
} = {}) => {
  if (
    !database ||
    typeof database.query !== "function" ||
    typeof database.transaction !== "function"
  ) {
    throw new TypeError(
      "The PostgreSQL character repository requires a database.",
    );
  }

  const load = async (
    accountId,
    characterId,
  ) => {
    if (!isValidIdentity(accountId, characterId)) {
      return null;
    }

    const result = await database.query({
      name: "character-load-v1",
      text: `
        SELECT
          snapshot_json,
          version,
          updated_at
        FROM game.characters
        WHERE account_id = $1
          AND character_id = $2
      `,
      values: [
        accountId,
        characterId,
      ],
    });

    return mapLoadedCharacter(result.rows[0]);
  };

  const list = async (accountId) => {
    if (
      typeof accountId !== "string" ||
      accountId === ""
    ) {
      return [];
    }

    const result = await database.query({
      name: "character-list-v1",
      text: `
        SELECT
          character_id,
          snapshot_json,
          version,
          updated_at
        FROM game.characters
        WHERE account_id = $1
        ORDER BY updated_at DESC, character_id ASC
      `,
      values: [
        accountId,
      ],
    });

    const characters = [];

    for (const row of result.rows) {
      const character = mapCharacterListRow(row);

      if (character) {
        characters.push(character);
      }
    }

    return characters;
  };

  const deleteCharacter = async (
    accountId,
    characterId,
  ) => {
    if (!isValidIdentity(accountId, characterId)) {
      return false;
    }

    const result = await database.query({
      name: "character-delete-v1",
      text: `
        DELETE FROM game.characters
        WHERE account_id = $1
          AND character_id = $2
      `,
      values: [
        accountId,
        characterId,
      ],
    });

    return result.rowCount === 1;
  };

  const createCharacter = async (
    accountId,
    characterId,
    snapshotJson,
    normalizedName,
    now,
  ) => {
    try {
      return await database.transaction(
        async (transactionDatabase) => {
          const characterResult =
            await transactionDatabase.query({
              name: "character-create-v1",
              text: `
                INSERT INTO game.characters (
                  account_id,
                  character_id,
                  snapshot_json,
                  version,
                  updated_at
                )
                VALUES (
                  $1,
                  $2,
                  $3::jsonb,
                  1,
                  $4
                )
                ON CONFLICT (
                  account_id,
                  character_id
                )
                DO NOTHING
                RETURNING version
              `,
              values: [
                accountId,
                characterId,
                snapshotJson,
                now,
              ],
            });

          if (characterResult.rowCount !== 1) {
            return {
              success: false,
              reason: "character-already-exists",
            };
          }

          if (normalizedName !== "") {
            const nameResult =
              await transactionDatabase.query({
                name: "character-name-reserve-v1",
                text: `
                  INSERT INTO game.character_names (
                    normalized_name,
                    account_id,
                    character_id
                  )
                  VALUES ($1, $2, $3)
                  ON CONFLICT DO NOTHING
                  RETURNING normalized_name
                `,
                values: [
                  normalizedName,
                  accountId,
                  characterId,
                ],
              });

            if (nameResult.rowCount !== 1) {
              throw new CharacterSaveAbort(
                "character-name-taken",
              );
            }
          }

          return {
            success: true,
            version: 1,
          };
        },
      );
    } catch (error) {
      if (error instanceof CharacterSaveAbort) {
        return {
          success: false,
          reason: error.reason,
        };
      }

      throw error;
    }
  };

  const updateCharacter = async (
    accountId,
    characterId,
    snapshotJson,
    expectedVersion,
    now,
  ) => {
    const result = await database.query({
      name: "character-update-v1",
      text: `
        UPDATE game.characters
        SET
          snapshot_json = $1::jsonb,
          version = version + 1,
          updated_at = $2
        WHERE account_id = $3
          AND character_id = $4
          AND version = $5
        RETURNING version
      `,
      values: [
        snapshotJson,
        now,
        accountId,
        characterId,
        expectedVersion,
      ],
    });

    if (result.rowCount !== 1) {
      return {
        success: false,
        reason: "version-conflict",
      };
    }

    return {
      success: true,
      version: toSafeInteger(
        result.rows[0].version,
        "character version",
      ),
    };
  };

  const save = async (
    accountId,
    characterId,
    snapshot,
    expectedVersion = null,
    now = Date.now(),
  ) => {
    if (
      !isValidIdentity(accountId, characterId) ||
      !snapshot ||
      !Number.isFinite(now)
    ) {
      return {
        success: false,
        reason: "invalid-save",
      };
    }

    const snapshotJson = JSON.stringify(snapshot);

    if (expectedVersion === null) {
      const normalizedName =
        typeof snapshot.name === "string"
          ? snapshot.name
              .trim()
              .toLocaleLowerCase()
          : "";

      return createCharacter(
        accountId,
        characterId,
        snapshotJson,
        normalizedName,
        now,
      );
    }

    if (
      !Number.isSafeInteger(expectedVersion) ||
      expectedVersion <= 0
    ) {
      return {
        success: false,
        reason: "invalid-version",
      };
    }

    return updateCharacter(
      accountId,
      characterId,
      snapshotJson,
      expectedVersion,
      now,
    );
  };

  return Object.freeze({
    load,
    list,
    delete: deleteCharacter,
    save,
  });
};