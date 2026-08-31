import assert from "node:assert/strict";
import test from "node:test";

import {
  runPostgresMigrationLifecycle,
} from "../server/persistence/postgresMigrationRunner.js";

const createLogger = () => {
  const messages = [];

  return {
    log(message) {
      messages.push(message);
    },

    getMessages() {
      return [...messages];
    },
  };
};

test("PostgreSQL migration lifecycle checks health, migrates and closes", async () => {
  const calls = [];
  const logger = createLogger();

  const database = {
    async healthCheck() {
      calls.push("health");
      return true;
    },

    async close() {
      calls.push("close");
    },
  };

  const result =
    await runPostgresMigrationLifecycle({
      databaseOptions: {
        password: "test-password",
      },

      databaseFactory(options) {
        calls.push("create");

        assert.equal(
          options.password,
          "test-password",
        );

        return database;
      },

      migrations: [
        {
          version: 1,
        },
      ],

      async migrationRunner(
        receivedDatabase,
        migrations,
      ) {
        calls.push("migrate");

        assert.equal(
          receivedDatabase,
          database,
        );

        assert.equal(
          migrations.length,
          1,
        );

        return {
          currentVersion: 1,
          appliedCount: 1,
        };
      },

      logger,
    });

  assert.deepEqual(result, {
    currentVersion: 1,
    appliedCount: 1,
  });

  assert.deepEqual(calls, [
    "create",
    "health",
    "migrate",
    "close",
  ]);

  assert.deepEqual(
    logger.getMessages(),
    [
      "PostgreSQL schema ready: version 1, applied 1.",
    ],
  );
});

test("PostgreSQL migration lifecycle closes the pool when health check fails", async () => {
  let migrationCalls = 0;
  let closeCalls = 0;

  await assert.rejects(
    runPostgresMigrationLifecycle({
      databaseOptions: {
        password: "test-password",
      },

      databaseFactory() {
        return {
          async healthCheck() {
            return false;
          },

          async close() {
            closeCalls += 1;
          },
        };
      },

      async migrationRunner() {
        migrationCalls += 1;

        return {
          currentVersion: 0,
          appliedCount: 0,
        };
      },

      logger: {
        log() {},
      },
    }),
    /health check failed/,
  );

  assert.equal(
    migrationCalls,
    0,
  );

  assert.equal(
    closeCalls,
    1,
  );
});

test("PostgreSQL migration lifecycle closes the pool when migration fails", async () => {
  let closeCalls = 0;

  await assert.rejects(
    runPostgresMigrationLifecycle({
      databaseOptions: {
        password: "test-password",
      },

      databaseFactory() {
        return {
          async healthCheck() {
            return true;
          },

          async close() {
            closeCalls += 1;
          },
        };
      },

      async migrationRunner() {
        throw new Error(
          "migration failure",
        );
      },

      logger: {
        log() {},
      },
    }),
    /migration failure/,
  );

  assert.equal(
    closeCalls,
    1,
  );
});