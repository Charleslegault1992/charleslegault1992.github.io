import assert from "node:assert/strict";
import test from "node:test";

import { createPostgresChatModerationRepository } from "../server/persistence/postgresChatModerationRepository.js";

const createResult = (rows = [], rowCount = rows.length) => {
  return {
    rows,
    rowCount,
  };
};

const createDatabaseStub = ({ query } = {}) => {
  const queries = [];

  return {
    async query(config) {
      queries.push(config);

      if (typeof query !== "function") {
        throw new Error(`Unexpected PostgreSQL query: ${config.name}`);
      }

      return query(config, queries.length - 1);
    },

    getQueries() {
      return [...queries];
    },
  };
};

test("PostgreSQL chat mute upsert preserves the current moderation contract", async () => {
  const database = createDatabaseStub({
    query: async (config) => {
      assert.equal(config.name, "chat-mute-upsert-v1");

      return createResult([], 1);
    },
  });

  const repository = createPostgresChatModerationRepository({
    database,
  });

  const longReason = "x".repeat(200);

  const result = await repository.mute("account-1", 5000, longReason, "moderator-1", 1000);

  assert.equal(result, true);

  assert.equal(database.getQueries().length, 1);

  assert.deepEqual(database.getQueries()[0].values, ["account-1", 5000, "x".repeat(160), "moderator-1", 1000]);
});

test("PostgreSQL chat mute rejects invalid moderation requests before querying PostgreSQL", async () => {
  const database = createDatabaseStub({
    query: async (config) => {
      throw new Error(`Query should not run: ${config.name}`);
    },
  });

  const repository = createPostgresChatModerationRepository({
    database,
  });

  assert.equal(await repository.mute("", 5000, "reason", "moderator-1", 1000), false);

  assert.equal(await repository.mute("account-1", 1000, "reason", "moderator-1", 1000), false);

  assert.equal(await repository.mute("account-1", 5000, "reason", "", 1000), false);

  assert.equal(database.getQueries().length, 0);
});

test("PostgreSQL active mute lookup maps BIGINT timestamps to safe JavaScript numbers", async () => {
  const database = createDatabaseStub({
    query: async (config) => {
      assert.equal(config.name, "chat-mute-active-v1");

      return createResult([
        {
          account_id: "account-1",
          muted_until: "1788192600000",
          reason: "spam",
          moderator_account_id: "moderator-1",
          created_at: "1788192000000",
        },
      ]);
    },
  });

  const repository = createPostgresChatModerationRepository({
    database,
  });

  const result = await repository.getActiveMute("account-1", 1788192100000);

  assert.deepEqual(result, {
    accountId: "account-1",
    mutedUntil: 1788192600000,
    reason: "spam",
    moderatorAccountId: "moderator-1",
    createdAt: 1788192000000,
  });

  assert.deepEqual(database.getQueries()[0].values, ["account-1", 1788192100000]);
});

test("PostgreSQL active mute lookup returns null when no active mute exists", async () => {
  const database = createDatabaseStub({
    query: async (config) => {
      assert.equal(config.name, "chat-mute-active-v1");

      return createResult([]);
    },
  });

  const repository = createPostgresChatModerationRepository({
    database,
  });

  assert.equal(await repository.getActiveMute("account-1", 5000), null);
});

test("PostgreSQL unmute reports whether a mute existed", async () => {
  let callCount = 0;

  const database = createDatabaseStub({
    query: async (config) => {
      assert.equal(config.name, "chat-mute-delete-v1");

      callCount += 1;

      return createResult([], callCount === 1 ? 1 : 0);
    },
  });

  const repository = createPostgresChatModerationRepository({
    database,
  });

  assert.equal(await repository.unmute("account-1"), true);

  assert.equal(await repository.unmute("account-1"), false);
});

test("PostgreSQL expired mute pruning uses one indexed delete and returns the deleted count", async () => {
  const database = createDatabaseStub({
    query: async (config) => {
      assert.equal(config.name, "chat-mute-prune-v1");

      return createResult([], 14);
    },
  });

  const repository = createPostgresChatModerationRepository({
    database,
  });

  const deletedCount = await repository.pruneExpired(9000);

  assert.equal(deletedCount, 14);

  assert.deepEqual(database.getQueries()[0].values, [9000]);

  assert.match(database.getQueries()[0].text, /WHERE muted_until <= \$1/);
});

test("PostgreSQL active mute listing loads the startup cache with one indexed query", async () => {
  const database = createDatabaseStub({
    query: async (config) => {
      assert.equal(config.name, "chat-mute-list-active-v1");

      return createResult([
        {
          account_id: "account-1",

          muted_until: "1788192600000",

          reason: "spam",

          moderator_account_id: "moderator-1",

          created_at: "1788192000000",
        },

        {
          account_id: "account-2",

          muted_until: "1788192700000",

          reason: "flood",

          moderator_account_id: "moderator-1",

          created_at: "1788192001000",
        },
      ]);
    },
  });

  const repository = createPostgresChatModerationRepository({
    database,
  });

  const mutes = await repository.listActiveMutes(1788192100000);

  assert.deepEqual(mutes, [
    {
      accountId: "account-1",

      mutedUntil: 1788192600000,

      reason: "spam",

      moderatorAccountId: "moderator-1",

      createdAt: 1788192000000,
    },

    {
      accountId: "account-2",

      mutedUntil: 1788192700000,

      reason: "flood",

      moderatorAccountId: "moderator-1",

      createdAt: 1788192001000,
    },
  ]);

  assert.deepEqual(database.getQueries()[0].values, [1788192100000]);

  assert.match(
    database.getQueries()[0].text,

    /WHERE muted_until > \$1/,
  );
});
