import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { runSqliteMigrations } from "../server/persistence/sqliteMigrations.js";

import { migrateSqliteBackupToPostgres } from "../server/persistence/sqliteToPostgresMigration.js";

const EXTERNAL_ACCOUNT_ID = "google_0123456789abcdef01234567";

const createFixture = ({ invalidSnapshot = false, orphanCharacter = false, schemaVersion = 6 } = {}) => {
  const directory = mkdtempSync(join(tmpdir(), "nonameyet-pg-import-"));

  const databasePath = join(directory, "game.sqlite");

  const database = new DatabaseSync(databasePath);

  runSqliteMigrations(database, undefined, 1000);

  database
    .prepare(
      `
    INSERT INTO accounts (
      account_id,
      email,
      password_hash,
      created_at
    )
    VALUES (?, ?, ?, ?)
  `,
    )
    .run("account-1", "player@example.com", "password-hash", 1000);

  database
    .prepare(
      `
    INSERT INTO accounts (
      account_id,
      email,
      password_hash,
      created_at
    )
    VALUES (?, ?, ?, ?)
  `,
    )
    .run(EXTERNAL_ACCOUNT_ID, "", "external-login-only", 1100);

  const characterAccountId = orphanCharacter ? "missing-account" : "account-1";

  database
    .prepare(
      `
    INSERT INTO characters (
      account_id,
      character_id,
      snapshot_json,
      version,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?)
  `,
    )
    .run(
      characterAccountId,
      "hero",
      invalidSnapshot
        ? "{invalid-json"
        : JSON.stringify({
            name: "Hero",
            level: 17,
            equipment: {
              backpack: {
                itemId: "bag",
                uid: 50,
                content: [
                  {
                    itemId: "apple",
                    uid: 51,
                    quantity: 3,
                  },
                ],
              },
            },
          }),
      3,
      2000,
    );

  database
    .prepare(
      `
    INSERT INTO character_names (
      normalized_name,
      account_id,
      character_id
    )
    VALUES (?, ?, ?)
  `,
    )
    .run("hero", characterAccountId, "hero");

  database
    .prepare(
      `
    INSERT INTO chat_mutes (
      account_id,
      muted_until,
      reason,
      moderator_account_id,
      created_at
    )
    VALUES (?, ?, ?, ?, ?)
  `,
    )
    .run("account-1", 9000, "spam", "moderator-1", 3000);

  database
    .prepare(
      `
    INSERT INTO external_identities (
      provider,
      subject,
      account_id,
      email,
      display_name,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run("google", "subject-1", EXTERNAL_ACCOUNT_ID, "google@example.com", "Google Player", 4000, 5000);

  if (schemaVersion < 6) {
    database
      .prepare(
        `
      DELETE FROM schema_migrations
      WHERE version > ?
    `,
      )
      .run(schemaVersion);
  }

  database.close();

  return {
    databasePath,

    cleanup() {
      rmSync(directory, {
        recursive: true,
        force: true,
      });
    },
  };
};

const cloneState = (state) => {
  return structuredClone(state);
};

const createFakePostgresDatabase = ({ initialState, schemaVersion = 2, corruptVerification = false } = {}) => {
  let state = initialState
    ? cloneState(initialState)
    : {
        accounts: [],
        characters: [],
        character_names: [],
        chat_mutes: [],
        external_identities: [],
      };

  let transactionCalls = 0;

  const getText = (query) => {
    return typeof query === "string" ? query : query.text;
  };

  const getValues = (query) => {
    return typeof query === "string" ? [] : (query.values ?? []);
  };

  const createResult = (rows = [], rowCount = rows.length) => {
    return {
      rows,
      rowCount,
    };
  };

  const handleInsert = (tableName, values) => {
    const columnCounts = {
      accounts: 4,
      characters: 5,
      character_names: 3,
      chat_mutes: 5,
      external_identities: 7,
    };

    const columnCount = columnCounts[tableName];

    assert.ok(columnCount);

    for (let offset = 0; offset < values.length; offset += columnCount) {
      const row = values.slice(offset, offset + columnCount);

      if (tableName === "accounts") {
        state.accounts.push({
          account_id: row[0],
          email: row[1],
          password_hash: row[2],
          created_at: String(row[3]),
        });

        continue;
      }

      if (tableName === "characters") {
        state.characters.push({
          account_id: row[0],
          character_id: row[1],
          snapshot_json: JSON.parse(row[2]),
          version: row[3],
          updated_at: String(row[4]),
        });

        continue;
      }

      if (tableName === "character_names") {
        state.character_names.push({
          normalized_name: row[0],
          account_id: row[1],
          character_id: row[2],
        });

        continue;
      }

      if (tableName === "chat_mutes") {
        state.chat_mutes.push({
          account_id: row[0],
          muted_until: String(row[1]),
          reason: row[2],
          moderator_account_id: row[3],
          created_at: String(row[4]),
        });

        continue;
      }

      state.external_identities.push({
        provider: row[0],
        subject: row[1],
        account_id: row[2],
        email: row[3],
        display_name: row[4],
        created_at: String(row[5]),
        updated_at: String(row[6]),
      });
    }

    return createResult([], values.length / columnCount);
  };

  const query = async (queryConfig) => {
    const text = getText(queryConfig);

    const values = getValues(queryConfig);

    if (text.includes("pg_advisory_xact_lock") || text.startsWith("SET LOCAL")) {
      return createResult();
    }

    if (text.includes("FROM game.schema_migrations")) {
      if (schemaVersion === 2) {
        return createResult([
          {
            version: 1,
            name: "initial-persistence-schema",
          },

          {
            version: 2,
            name: "application-schema-read-access",
          },
        ]);
      }

      if (schemaVersion === 1) {
        return createResult([
          {
            version: 1,
            name: "initial-persistence-schema",
          },
        ]);
      }

      return createResult([]);
    }

    const countMatch = text.match(/SELECT COUNT\(\*\)::bigint AS count\s+FROM game\.([a-z_]+)/);

    if (countMatch) {
      const tableName = countMatch[1];

      return createResult([
        {
          count: String(state[tableName].length),
        },
      ]);
    }

    const insertMatch = text.match(/INSERT INTO game\.([a-z_]+)/);

    if (insertMatch) {
      return handleInsert(insertMatch[1], values);
    }

    if (text.includes("FROM game.accounts")) {
      return createResult(cloneState(state.accounts));
    }

    if (text.includes("FROM game.characters")) {
      const rows = cloneState(state.characters);

      if (corruptVerification && rows.length > 0) {
        rows[0].snapshot_json.level = 999999;
      }

      return createResult(rows);
    }

    if (text.includes("FROM game.character_names")) {
      return createResult(cloneState(state.character_names));
    }

    if (text.includes("FROM game.chat_mutes")) {
      return createResult(cloneState(state.chat_mutes));
    }

    if (text.includes("FROM game.external_identities")) {
      return createResult(cloneState(state.external_identities));
    }

    throw new Error(`Unexpected PostgreSQL test query: ${text}`);
  };

  return {
    async transaction(work) {
      transactionCalls += 1;

      const before = cloneState(state);

      try {
        return await work({
          query,
        });
      } catch (error) {
        state = before;
        throw error;
      }
    },

    getState() {
      return cloneState(state);
    },

    getTransactionCalls() {
      return transactionCalls;
    },
  };
};

test("SQLite to PostgreSQL migration imports and verifies all durable tables", async () => {
  const fixture = createFixture();

  const postgres = createFakePostgresDatabase();

  try {
    const result = await migrateSqliteBackupToPostgres({
      sqlitePath: fixture.databasePath,

      database: postgres,

      batchSize: 1,
    });

    assert.equal(result.sourceSchemaVersion, 6);

    assert.deepEqual(
      Object.fromEntries(Object.entries(result.tables).map(([tableName, summary]) => [tableName, summary.count])),
      {
        accounts: 2,
        characters: 1,
        character_names: 1,
        chat_mutes: 1,
        external_identities: 1,
      },
    );

    const state = postgres.getState();

    assert.equal(state.accounts.length, 2);

    assert.equal(state.characters.length, 1);

    assert.equal(state.character_names.length, 1);

    assert.equal(state.chat_mutes.length, 1);

    assert.equal(state.external_identities.length, 1);
  } finally {
    fixture.cleanup();
  }
});

test("SQLite invalid character JSON is rejected before PostgreSQL mutation begins", async () => {
  const fixture = createFixture({
    invalidSnapshot: true,
  });

  const postgres = createFakePostgresDatabase();

  try {
    await assert.rejects(
      migrateSqliteBackupToPostgres({
        sqlitePath: fixture.databasePath,

        database: postgres,
      }),
      /invalid JSON/,
    );

    assert.equal(postgres.getTransactionCalls(), 0);
  } finally {
    fixture.cleanup();
  }
});

test("SQLite orphan characters are rejected before PostgreSQL mutation begins", async () => {
  const fixture = createFixture({
    orphanCharacter: true,
  });

  const postgres = createFakePostgresDatabase();

  try {
    await assert.rejects(
      migrateSqliteBackupToPostgres({
        sqlitePath: fixture.databasePath,

        database: postgres,
      }),
      /characters without accounts/,
    );

    assert.equal(postgres.getTransactionCalls(), 0);
  } finally {
    fixture.cleanup();
  }
});

test("SQLite schema versions other than six are rejected before PostgreSQL mutation", async () => {
  const fixture = createFixture({
    schemaVersion: 5,
  });

  const postgres = createFakePostgresDatabase();

  try {
    await assert.rejects(
      migrateSqliteBackupToPostgres({
        sqlitePath: fixture.databasePath,

        database: postgres,
      }),
      /expected 6/,
    );

    assert.equal(postgres.getTransactionCalls(), 0);
  } finally {
    fixture.cleanup();
  }
});

test("SQLite import refuses a PostgreSQL target containing gameplay data", async () => {
  const fixture = createFixture();

  const initialState = {
    accounts: [
      {
        account_id: "existing",
        email: "existing@example.com",
        password_hash: "hash",
        created_at: "1",
      },
    ],

    characters: [],
    character_names: [],
    chat_mutes: [],
    external_identities: [],
  };

  const postgres = createFakePostgresDatabase({
    initialState,
  });

  try {
    await assert.rejects(
      migrateSqliteBackupToPostgres({
        sqlitePath: fixture.databasePath,

        database: postgres,
      }),
      /is not empty/,
    );

    assert.deepEqual(postgres.getState(), initialState);
  } finally {
    fixture.cleanup();
  }
});

test("SQLite import rolls back PostgreSQL when post-import verification differs", async () => {
  const fixture = createFixture();

  const postgres = createFakePostgresDatabase({
    corruptVerification: true,
  });

  try {
    await assert.rejects(
      migrateSqliteBackupToPostgres({
        sqlitePath: fixture.databasePath,

        database: postgres,
      }),
      /verification mismatch/,
    );

    assert.deepEqual(postgres.getState(), {
      accounts: [],
      characters: [],
      character_names: [],
      chat_mutes: [],
      external_identities: [],
    });
  } finally {
    fixture.cleanup();
  }
});

test("SQLite import is deliberately one-shot and refuses an accidental replay", async () => {
  const fixture = createFixture();

  const postgres = createFakePostgresDatabase();

  try {
    await migrateSqliteBackupToPostgres({
      sqlitePath: fixture.databasePath,

      database: postgres,
    });

    const stateAfterFirstImport = postgres.getState();

    await assert.rejects(
      migrateSqliteBackupToPostgres({
        sqlitePath: fixture.databasePath,

        database: postgres,
      }),
      /is not empty/,
    );

    assert.deepEqual(postgres.getState(), stateAfterFirstImport);
  } finally {
    fixture.cleanup();
  }
});
