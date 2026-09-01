import assert from "node:assert/strict";
import test from "node:test";

import {
  createPostgresRuntimePersistence,
  verifyPostgresRuntimeSchema,
} from "../server/persistence/postgresRuntimePersistence.js";
import {
  createPostgresMigrationChecksum,
  POSTGRES_MIGRATIONS,
} from "../server/persistence/postgresMigrations.js";

const migrationHistory = POSTGRES_MIGRATIONS.map((migration) => ({
  version: migration.version,
  name: migration.name,
  checksum: createPostgresMigrationChecksum(migration),
}));

const tableNames = [
  "accounts",
  "character_names",
  "characters",
  "chat_mutes",
  "external_identities",
];

const createFakeDatabase = ({
  healthy = true,
  history =
    migrationHistory,

  roleName =
    "nonameyet_app",

  schemaCreate = false,

  migrationSelect = true,

  tablePrivileges = true,
} = {}) => {
  let closeCalls = 0;
  const queryNames = [];

  const database = {
    async healthCheck() {
      return healthy;
    },

    async query(config) {
      queryNames.push(
        config.name,
      );

      if (
        config.name ===
        "runtime-schema-history-v1"
      ) {
        return {
          rows:
            structuredClone(
              history,
            ),
        };
      }

      if (
        config.name ===
        "runtime-schema-security-v1"
      ) {
        return {
          rows: [
            {
              role_name:
                roleName,

              schema_usage:
                true,

              schema_create:
                schemaCreate,

              migration_select:
                migrationSelect,

              migration_insert:
                false,

              migration_update:
                false,

              migration_delete:
                false,
            },
          ],
        };
      }

      if (
        config.name ===
        "runtime-table-privileges-v1"
      ) {
        return {
          rows:
            tableNames.map(
              (tableName) => ({
                table_name:
                  tableName,

                select_ok:
                  tablePrivileges,

                insert_ok:
                  tablePrivileges,

                update_ok:
                  tablePrivileges,

                delete_ok:
                  tablePrivileges,
              }),
            ),
        };
      }

      throw new Error(
        `Unexpected PostgreSQL query: ${config.name}`,
      );
    },

    async transaction(work) {
      return work({
        query:
          database.query,
      });
    },

    getPoolStats() {
      return {
        total: 1,
        idle: 1,
        waiting: 0,
      };
    },

    async close() {
      closeCalls += 1;
    },

    getCloseCalls() {
      return closeCalls;
    },

    getQueryNames() {
      return [...queryNames];
    },
  };

  return database;
};

test("PostgreSQL runtime persistence verifies the database before exposing repositories", async () => {
  const database =
    createFakeDatabase();

  const messages = [];

  const persistence =
    await createPostgresRuntimePersistence({
      databaseOptions: {
        user:
          "nonameyet_app",

        password:
          "test-password",
      },

      databaseFactory() {
        return database;
      },

      logger: {
        log(message) {
          messages.push(
            message,
          );
        },
      },
    });

  assert.equal(
    typeof persistence
      .accountRepository
      .find,
    "function",
  );

  assert.equal(
    typeof persistence
      .characterRepository
      .save,
    "function",
  );

  assert.equal(
    typeof persistence
      .chatModerationRepository
      .mute,
    "function",
  );

  assert.deepEqual(
    persistence.schema,
    {
      currentVersion: 2,
      tableCount: 5,
    },
  );

  assert.deepEqual(
    database.getQueryNames(),
    [
      "runtime-schema-history-v1",
      "runtime-schema-security-v1",
      "runtime-table-privileges-v1",
    ],
  );

  assert.deepEqual(
    persistence.getPoolStats(),
    {
      total: 1,
      idle: 1,
      waiting: 0,
    },
  );

  assert.equal(
    messages.length,
    1,
  );

  await persistence.close();

  assert.equal(
    database.getCloseCalls(),
    1,
  );
});

test("PostgreSQL runtime persistence refuses to start against an older schema and closes the pool", async () => {
  const database =
    createFakeDatabase({
      history: [
        migrationHistory[0],
      ],
    });

  await assert.rejects(
    createPostgresRuntimePersistence({
      databaseOptions: {
        user:
          "nonameyet_app",

        password:
          "test-password",
      },

      databaseFactory() {
        return database;
      },

      logger: {
        log() {},
      },
    }),
    /schema version does not match/,
  );

  assert.equal(
    database.getCloseCalls(),
    1,
  );
});

test("PostgreSQL runtime persistence refuses a modified applied migration checksum", async () => {
  const changedHistory = structuredClone(migrationHistory);
  changedHistory[0].checksum = "0".repeat(64);
  const database = createFakeDatabase({ history: changedHistory });

  await assert.rejects(
    createPostgresRuntimePersistence({
      databaseOptions: {
        user: "nonameyet_app",
        password: "test-password",
      },
      databaseFactory() {
        return database;
      },
      logger: { log() {} },
    }),
    /migration history does not match/,
  );

  assert.equal(database.getCloseCalls(), 1);
});

test("PostgreSQL runtime persistence refuses an overprivileged application role", async () => {
  const database =
    createFakeDatabase({
      schemaCreate: true,
    });

  await assert.rejects(
    verifyPostgresRuntimeSchema({
      database,

      expectedUser:
        "nonameyet_app",

      migrations:
        migrationHistory,
    }),
    /unexpectedly has CREATE/,
  );
});

test("PostgreSQL runtime persistence closes the pool when health check fails", async () => {
  const database =
    createFakeDatabase({
      healthy: false,
    });

  await assert.rejects(
    createPostgresRuntimePersistence({
      databaseOptions: {
        user:
          "nonameyet_app",

        password:
          "test-password",
      },

      databaseFactory() {
        return database;
      },

      logger: {
        log() {},
      },
    }),
    /health check failed/,
  );

  assert.equal(
    database.getCloseCalls(),
    1,
  );

  assert.deepEqual(
    database.getQueryNames(),
    [],
  );
});
