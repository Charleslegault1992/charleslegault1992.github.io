import assert from "node:assert/strict";
import test from "node:test";

import { POSTGRES_MIGRATIONS, runPostgresMigrations } from "../server/persistence/postgresMigrations.js";

const createFakePostgresDatabase = () => {
  const state = {
    appliedMigrations: new Map(),
    migrationStatements: [],
    queryLog: [],
  };

  const executeQuery = async (textOrConfig, values) => {
    const text = typeof textOrConfig === "string" ? textOrConfig : textOrConfig.text;

    state.queryLog.push({
      text,
      values,
    });

    if (text.includes("SELECT version, name, checksum") && text.includes("FROM game.schema_migrations")) {
      return {
        rows: [...state.appliedMigrations.values()].sort((first, second) => first.version - second.version),
        rowCount: state.appliedMigrations.size,
      };
    }

    if (text.includes("INSERT INTO game.schema_migrations")) {
      const [version, name, checksum] = values;

      state.appliedMigrations.set(version, {
        version,
        name,
        checksum,
      });

      return {
        rows: [],
        rowCount: 1,
      };
    }

    if (
      text.startsWith("SET LOCAL lock_timeout") ||
      text.startsWith("SELECT pg_advisory_xact_lock") ||
      text.startsWith("SET LOCAL ROLE") ||
      text.includes("CREATE TABLE IF NOT EXISTS game.schema_migrations") ||
      text.startsWith("REVOKE ALL ON TABLE game.schema_migrations")
    ) {
      return {
        rows: [],
        rowCount: 0,
      };
    }

    if (/REVOKE[\s\S]*ON TABLE game\.schema_migrations[\s\S]*FROM nonameyet_app/i.test(text)) {
      return {
        rows: [],
        rowCount: 0,
      };
    }

    state.migrationStatements.push({
      text,
      values,
    });

    return {
      rows: [],
      rowCount: 0,
    };
  };

  return {
    async transaction(work) {
      const appliedMigrationsBeforeTransaction = new Map(state.appliedMigrations);

      const migrationStatementCountBeforeTransaction = state.migrationStatements.length;

      try {
        return await work({
          query: executeQuery,
        });
      } catch (error) {
        state.appliedMigrations = appliedMigrationsBeforeTransaction;
        state.migrationStatements.length = migrationStatementCountBeforeTransaction;

        throw error;
      }
    },

    getAppliedMigrations() {
      return [...state.appliedMigrations.values()].sort((first, second) => first.version - second.version);
    },

    getMigrationStatements() {
      return [...state.migrationStatements];
    },

    getQueryLog() {
      return [...state.queryLog];
    },

    seedAppliedMigration(migration) {
      state.appliedMigrations.set(migration.version, {
        ...migration,
      });
    },
  };
};

test("PostgreSQL migrations run in deterministic version order and are idempotent", async () => {
  const database = createFakePostgresDatabase();

  const migrations = [
    {
      version: 2,
      name: "second",
      up: async (transactionDatabase) => {
        await transactionDatabase.query("SELECT 'javascript-migration'");
      },
    },
    {
      version: 1,
      name: "first",
      sql: "CREATE TABLE game.first_table (id INTEGER PRIMARY KEY)",
    },
  ];

  const firstRun = await runPostgresMigrations(database, migrations);

  assert.deepEqual(firstRun, {
    currentVersion: 2,
    appliedCount: 2,
  });

  assert.deepEqual(
    database.getMigrationStatements().map(({ text }) => text),
    ["CREATE TABLE game.first_table (id INTEGER PRIMARY KEY)", "SELECT 'javascript-migration'"],
  );

  assert.deepEqual(
    database.getAppliedMigrations().map(({ version, name }) => ({
      version,
      name,
    })),
    [
      {
        version: 1,
        name: "first",
      },
      {
        version: 2,
        name: "second",
      },
    ],
  );

  const secondRun = await runPostgresMigrations(database, migrations);

  assert.deepEqual(secondRun, {
    currentVersion: 2,
    appliedCount: 0,
  });

  assert.equal(database.getMigrationStatements().length, 2);
});

test("PostgreSQL migrations reject a previously applied migration that was modified", async () => {
  const database = createFakePostgresDatabase();

  await runPostgresMigrations(database, [
    {
      version: 1,
      name: "characters",
      sql: "CREATE TABLE game.characters (id TEXT PRIMARY KEY)",
    },
  ]);

  await assert.rejects(
    runPostgresMigrations(database, [
      {
        version: 1,
        name: "characters",
        sql: "CREATE TABLE game.characters (id BIGINT PRIMARY KEY)",
      },
    ]),
    /modified after being applied/,
  );
});

test("PostgreSQL migrations reject a database newer than the running server", async () => {
  const database = createFakePostgresDatabase();

  database.seedAppliedMigration({
    version: 2,
    name: "future-migration",
    checksum: "a".repeat(64),
  });

  await assert.rejects(
    runPostgresMigrations(database, [
      {
        version: 1,
        name: "characters",
        sql: "CREATE TABLE game.characters (id TEXT PRIMARY KEY)",
      },
    ]),
    /migration version 2 that this server does not know/,
  );
});

test("PostgreSQL migration versions must be contiguous from version one", async () => {
  const database = createFakePostgresDatabase();

  await assert.rejects(
    runPostgresMigrations(database, [
      {
        version: 1,
        name: "first",
        sql: "SELECT 1",
      },
      {
        version: 3,
        name: "third",
        sql: "SELECT 3",
      },
    ]),
    /expected 2 but found 3/,
  );
});

test("PostgreSQL migration names must be unique", async () => {
  const database = createFakePostgresDatabase();

  await assert.rejects(
    runPostgresMigrations(database, [
      {
        version: 1,
        name: "duplicate-name",
        sql: "SELECT 1",
      },
      {
        version: 2,
        name: "duplicate-name",
        sql: "SELECT 2",
      },
    ]),
    /Duplicate PostgreSQL migration name/,
  );
});

test("PostgreSQL migration batch rolls back completely when a migration fails", async () => {
  const database = createFakePostgresDatabase();

  await assert.rejects(
    runPostgresMigrations(database, [
      {
        version: 1,
        name: "first",
        sql: "CREATE TABLE game.first_table (id INTEGER PRIMARY KEY)",
      },
      {
        version: 2,
        name: "failure",
        up: async () => {
          throw new Error("migration exploded");
        },
      },
    ]),
    /migration exploded/,
  );

  assert.deepEqual(database.getAppliedMigrations(), []);

  assert.deepEqual(database.getMigrationStatements(), []);
});

test("PostgreSQL persistence schema defines the five current durable data structures", () => {
  assert.equal(POSTGRES_MIGRATIONS.length, 2);

  const [migration] = POSTGRES_MIGRATIONS;

  assert.equal(migration.version, 1);
  assert.equal(migration.name, "initial-persistence-schema");
  assert.equal(typeof migration.sql, "string");

  const requiredTables = ["accounts", "characters", "character_names", "chat_mutes", "external_identities"];

  for (const tableName of requiredTables) {
    assert.match(migration.sql, new RegExp(`CREATE TABLE game\\.${tableName}\\s*\\(`));
  }
});

test("PostgreSQL migration v2 grants the application role read-only migration history access", () => {
  const migration = POSTGRES_MIGRATIONS[1];

  assert.equal(migration.version, 2);

  assert.equal(migration.name, "application-schema-read-access");

  assert.match(migration.sql, /GRANT SELECT[\s\S]*ON TABLE game\.schema_migrations[\s\S]*TO nonameyet_app/);

  assert.match(
    migration.sql,
    /REVOKE[\s\S]*INSERT[\s\S]*UPDATE[\s\S]*DELETE[\s\S]*ON TABLE game\.schema_migrations[\s\S]*FROM nonameyet_app/,
  );

  assert.doesNotMatch(migration.sql, /GRANT\s+(INSERT|UPDATE|DELETE)/);
});

test("PostgreSQL character snapshots use JSONB and preserve optimistic version fields", () => {
  const schemaSql = POSTGRES_MIGRATIONS[0].sql;

  assert.match(schemaSql, /snapshot_json\s+JSONB\s+NOT NULL/);

  assert.match(schemaSql, /version\s+INTEGER\s+NOT NULL\s+DEFAULT\s+1/);

  assert.match(schemaSql, /updated_at\s+BIGINT\s+NOT NULL/);

  assert.match(schemaSql, /PRIMARY KEY\s*\(\s*account_id\s*,\s*character_id\s*\)/);
});

test("PostgreSQL persistence schema creates only indexes justified by current queries", () => {
  const schemaSql = POSTGRES_MIGRATIONS[0].sql;

  assert.match(
    schemaSql,
    /CREATE UNIQUE INDEX accounts_email_unique_index[\s\S]*ON game\.accounts\s*\(\s*email\s*\)[\s\S]*WHERE email <> ''/,
  );

  assert.match(schemaSql, /CREATE INDEX chat_mutes_expiry_index[\s\S]*ON game\.chat_mutes\s*\(\s*muted_until\s*\)/);

  assert.match(
    schemaSql,
    /CREATE INDEX external_identities_account_index[\s\S]*ON game\.external_identities\s*\(\s*account_id\s*\)/,
  );

  assert.doesNotMatch(schemaSql, /characters_updated_at_index/);
});

test("PostgreSQL persistence schema contains no SQLite-specific SQL", () => {
  const schemaSql = POSTGRES_MIGRATIONS[0].sql;

  assert.doesNotMatch(schemaSql, /\bSTRICT\b/);
  assert.doesNotMatch(schemaSql, /INSERT\s+OR\s+IGNORE/i);
  assert.doesNotMatch(schemaSql, /json_extract/i);
  assert.doesNotMatch(schemaSql, /json_valid/i);
  assert.doesNotMatch(schemaSql, /\?/);
});
