import assert from "node:assert/strict";
import test from "node:test";

import {
  createPostgresDatabase,
  createPostgresPoolConfig,
} from "../server/persistence/postgresDatabase.js";

const createFakePoolClass = () => {
  let latestPool = null;

  class FakePool {
    constructor(config) {
      this.config = config;
      this.totalCount = 2;
      this.idleCount = 1;
      this.waitingCount = 0;
      this.endCalls = 0;
      this.poolQueries = [];
      this.clientQueries = [];
      this.releaseCalls = [];
      this.eventHandlers = new Map();

      latestPool = this;

      this.client = {
        query: async (textOrConfig, values) => {
          this.clientQueries.push({ textOrConfig, values });

          return {
            rows: [],
            rowCount: 0,
          };
        },

        release: (destroy = false) => {
          this.releaseCalls.push(destroy);
        },
      };
    }

    on(eventName, handler) {
      this.eventHandlers.set(eventName, handler);
      return this;
    }

    async query(textOrConfig, values) {
      this.poolQueries.push({ textOrConfig, values });

      return {
        rows: [[1]],
        rowCount: 1,
      };
    }

    async connect() {
      return this.client;
    }

    async end() {
      this.endCalls += 1;
    }
  }

  return {
    FakePool,
    getLatestPool() {
      return latestPool;
    },
  };
};

test("PostgreSQL pool config uses the measured single-process limits", () => {
  const config = createPostgresPoolConfig({
    password: "test-password",
  });

  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.port, 5432);
  assert.equal(config.database, "nonameyet");
  assert.equal(config.user, "nonameyet_app");

  assert.equal(config.max, 8);
  assert.equal(config.min, 2);

  assert.equal(config.connectionTimeoutMillis, 2000);
  assert.equal(config.idleTimeoutMillis, 30000);
  assert.equal(config.query_timeout, 6000);

  assert.equal(config.keepAlive, true);
  assert.equal(config.keepAliveInitialDelayMillis, 10000);

  assert.equal(config.application_name, "nonameyet-game-server");
});

test("PostgreSQL pool config rejects a size above the application role connection limit", () => {
  assert.throws(
    () => createPostgresPoolConfig({
      password: "test-password",
      poolMax: 13,
    }),
    /between 1 and 12/,
  );
});

test("PostgreSQL transactions use one checked-out client and commit before release", async () => {
  const fakePool = createFakePoolClass();

  const database = createPostgresDatabase({
    PoolClass: fakePool.FakePool,
    password: "test-password",
  });

  const result = await database.transaction(async (transactionDatabase) => {
    await transactionDatabase.query(
      "SELECT $1::integer",
      [42],
    );

    return "committed";
  });

  const pool = fakePool.getLatestPool();

  assert.equal(result, "committed");

  assert.deepEqual(
    pool.clientQueries.map(({ textOrConfig }) => textOrConfig),
    [
      "BEGIN",
      "SELECT $1::integer",
      "COMMIT",
    ],
  );

  assert.deepEqual(pool.releaseCalls, [false]);

  await database.close();
});

test("PostgreSQL transactions roll back before releasing the client when work fails", async () => {
  const fakePool = createFakePoolClass();

  const database = createPostgresDatabase({
    PoolClass: fakePool.FakePool,
    password: "test-password",
  });

  await assert.rejects(
    database.transaction(async (transactionDatabase) => {
      await transactionDatabase.query("UPDATE game.example SET value = 1");
      throw new Error("transaction failure");
    }),
    /transaction failure/,
  );

  const pool = fakePool.getLatestPool();

  assert.deepEqual(
    pool.clientQueries.map(({ textOrConfig }) => textOrConfig),
    [
      "BEGIN",
      "UPDATE game.example SET value = 1",
      "ROLLBACK",
    ],
  );

  assert.deepEqual(pool.releaseCalls, [false]);

  await database.close();
});

test("PostgreSQL database exposes pool pressure metrics", async () => {
  const fakePool = createFakePoolClass();

  const database = createPostgresDatabase({
    PoolClass: fakePool.FakePool,
    password: "test-password",
  });

  assert.deepEqual(database.getPoolStats(), {
    total: 2,
    idle: 1,
    waiting: 0,
  });

  assert.equal(await database.healthCheck(), true);

  await database.close();
});

test("PostgreSQL database closes its pool only once", async () => {
  const fakePool = createFakePoolClass();

  const database = createPostgresDatabase({
    PoolClass: fakePool.FakePool,
    password: "test-password",
  });

  await Promise.all([
    database.close(),
    database.close(),
    database.close(),
  ]);

  assert.equal(fakePool.getLatestPool().endCalls, 1);
});

test("PostgreSQL pool config supports a one-connection migration process", () => {
  const config = createPostgresPoolConfig({
    user: "nonameyet_migrator",
    password: "test-password",
    poolMax: 1,
    poolMin: 0,
    queryTimeoutMillis: 0,
    applicationName: "nonameyet-migrator",
  });

  assert.equal(
    config.user,
    "nonameyet_migrator",
  );

  assert.equal(
    config.max,
    1,
  );

  assert.equal(
    config.min,
    0,
  );

  assert.equal(
    config.query_timeout,
    0,
  );

  assert.equal(
    config.application_name,
    "nonameyet-migrator",
  );
});