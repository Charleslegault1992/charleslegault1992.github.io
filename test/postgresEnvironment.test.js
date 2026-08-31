import assert from "node:assert/strict";
import test from "node:test";

import {
  getPostgresApplicationOptions,
  getPostgresMigratorOptions,
} from "../server/persistence/postgresEnvironment.js";

test("PostgreSQL migrator options use one short-lived connection", () => {
  const options = getPostgresMigratorOptions({
    GAME_POSTGRES_MIGRATOR_PASSWORD: "test-password",
  });

  assert.deepEqual(options, {
    host: "127.0.0.1",
    port: 5432,
    database: "nonameyet",
    user: "nonameyet_migrator",
    password: "test-password",

    poolMax: 1,
    poolMin: 0,

    connectionTimeoutMillis: 2000,
    idleTimeoutMillis: 1000,
    queryTimeoutMillis: 0,

    ssl: false,
    applicationName: "nonameyet-migrator",
  });
});

test("PostgreSQL migrator options preserve the password exactly", () => {
  const options = getPostgresMigratorOptions({
    GAME_POSTGRES_MIGRATOR_PASSWORD: "  secret with spaces  ",
  });

  assert.equal(options.password, "  secret with spaces  ");
});

test("PostgreSQL migrator options reject missing credentials and invalid ports", () => {
  assert.throws(() => getPostgresMigratorOptions({}), /GAME_POSTGRES_MIGRATOR_PASSWORD/);

  assert.throws(
    () =>
      getPostgresMigratorOptions({
        GAME_POSTGRES_MIGRATOR_PASSWORD: "test-password",
        GAME_POSTGRES_PORT: "99999",
      }),
    /valid TCP port/,
  );
});

test("PostgreSQL application options use the measured eight-connection pool", () => {
  const options =
    getPostgresApplicationOptions({
      GAME_POSTGRES_APP_PASSWORD:
        "application-password",
    });

  assert.deepEqual(
    options,
    {
      host: "127.0.0.1",
      port: 5432,
      database: "nonameyet",
      ssl: false,

      user: "nonameyet_app",
      password:
        "application-password",

      poolMax: 8,
      poolMin: 2,

      connectionTimeoutMillis:
        2000,

      idleTimeoutMillis:
        30000,

      queryTimeoutMillis:
        6000,

      applicationName:
        "nonameyet-game-server",
    },
  );
});

test("PostgreSQL application connection can move to another host without changing runtime code", () => {
  const options =
    getPostgresApplicationOptions({
      GAME_POSTGRES_HOST:
        "10.20.0.15",

      GAME_POSTGRES_PORT:
        "6432",

      GAME_POSTGRES_DATABASE:
        "nonameyet_prod",

      GAME_POSTGRES_APP_USER:
        "nonameyet_app",

      GAME_POSTGRES_APP_PASSWORD:
        "application-password",

      GAME_POSTGRES_POOL_MAX:
        "4",

      GAME_POSTGRES_SSL:
        "true",
    });

  assert.equal(
    options.host,
    "10.20.0.15",
  );

  assert.equal(
    options.port,
    6432,
  );

  assert.equal(
    options.database,
    "nonameyet_prod",
  );

  assert.equal(
    options.poolMax,
    4,
  );

  assert.equal(
    options.poolMin,
    2,
  );

  assert.equal(
    options.ssl,
    true,
  );
});

test("PostgreSQL application options reject missing credentials and unsafe pool configuration", () => {
  assert.throws(
    () =>
      getPostgresApplicationOptions(
        {},
      ),
    /GAME_POSTGRES_APP_PASSWORD/,
  );

  assert.throws(
    () =>
      getPostgresApplicationOptions({
        GAME_POSTGRES_APP_PASSWORD:
          "password",

        GAME_POSTGRES_POOL_MAX:
          "13",
      }),
    /between 1 and 12/,
  );

  assert.throws(
    () =>
      getPostgresApplicationOptions({
        GAME_POSTGRES_APP_PASSWORD:
          "password",

        GAME_POSTGRES_SSL:
          "maybe",
      }),
    /must be "true" or "false"/,
  );
});