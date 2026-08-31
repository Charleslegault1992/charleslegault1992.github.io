import assert from "node:assert/strict";
import test from "node:test";

import {
  createPostgresCharacterRepository,
} from "../server/persistence/postgresCharacterRepository.js";

const createResult = (
  rows = [],
  rowCount = rows.length,
) => {
  return {
    rows,
    rowCount,
  };
};

const createDatabaseStub = ({
  query,
  transactionQuery = query,
} = {}) => {
  const directQueries = [];
  const transactionQueries = [];

  let transactionCount = 0;
  let rollbackCount = 0;

  return {
    async query(config) {
      directQueries.push(config);

      if (typeof query !== "function") {
        throw new Error(
          `Unexpected direct query: ${config.name}`,
        );
      }

      return query(
        config,
        directQueries.length - 1,
      );
    },

    async transaction(work) {
      transactionCount += 1;

      try {
        return await work({
          async query(config) {
            transactionQueries.push(config);

            if (
              typeof transactionQuery !==
              "function"
            ) {
              throw new Error(
                `Unexpected transaction query: ${config.name}`,
              );
            }

            return transactionQuery(
              config,
              transactionQueries.length - 1,
            );
          },
        });
      } catch (error) {
        rollbackCount += 1;
        throw error;
      }
    },

    getDirectQueries() {
      return [...directQueries];
    },

    getTransactionQueries() {
      return [...transactionQueries];
    },

    getTransactionCount() {
      return transactionCount;
    },

    getRollbackCount() {
      return rollbackCount;
    },
  };
};

test("PostgreSQL character load returns JSONB snapshots and safe persistence metadata", async () => {
  const snapshot = {
    uid: "player:hero",
    name: "Ari Vale",
    level: 17,
  };

  const database = createDatabaseStub({
    query: async (config) => {
      assert.equal(
        config.name,
        "character-load-v1",
      );

      return createResult([
        {
          snapshot_json: snapshot,
          version: 7,
          updated_at: "1788192000123",
        },
      ]);
    },
  });

  const repository =
    createPostgresCharacterRepository({
      database,
    });

  assert.deepEqual(
    await repository.load(
      "account-1",
      "hero",
    ),
    {
      snapshot,
      version: 7,
      updatedAt: 1788192000123,
    },
  );
});

test("PostgreSQL character list preserves the current summary contract", async () => {
  const database = createDatabaseStub({
    query: async (config) => {
      assert.equal(
        config.name,
        "character-list-v1",
      );

      return createResult([
        {
          character_id: "hero-a",
          snapshot_json: {
            name: "Ari Vale",
            level: 20,
            appearanceId: "female",
            appearanceParts: {
              hair: 2,
            },
            appearanceColors: {
              hair: 3,
            },
          },
          version: 4,
          updated_at: "2000",
        },
        {
          character_id: "hero-b",
          snapshot_json: {},
          version: 1,
          updated_at: "1000",
        },
      ]);
    },
  });

  const repository =
    createPostgresCharacterRepository({
      database,
    });

  assert.deepEqual(
    await repository.list("account-1"),
    [
      {
        characterId: "hero-a",
        name: "Ari Vale",
        level: 20,
        appearanceId: "female",
        appearanceParts: {
          hair: 2,
        },
        appearanceColors: {
          hair: 3,
        },
        version: 4,
        updatedAt: 2000,
      },
      {
        characterId: "hero-b",
        name: "hero-b",
        level: 0,
        appearanceId: "male",
        appearanceParts: null,
        appearanceColors: null,
        version: 1,
        updatedAt: 1000,
      },
    ],
  );
});

test("PostgreSQL character creation inserts the character and reserves its normalized name atomically", async () => {
  const database = createDatabaseStub({
    transactionQuery: async (
      config,
      queryIndex,
    ) => {
      if (queryIndex === 0) {
        assert.equal(
          config.name,
          "character-create-v1",
        );

        return createResult([
          {
            version: 1,
          },
        ]);
      }

      if (queryIndex === 1) {
        assert.equal(
          config.name,
          "character-name-reserve-v1",
        );

        return createResult([
          {
            normalized_name: "ari vale",
          },
        ]);
      }

      throw new Error(
        `Unexpected transaction query: ${config.name}`,
      );
    },
  });

  const repository =
    createPostgresCharacterRepository({
      database,
    });

  const result = await repository.save(
    "account-1",
    "hero",
    {
      name: "  Ari Vale  ",
      level: 1,
    },
    null,
    1000,
  );

  assert.deepEqual(result, {
    success: true,
    version: 1,
  });

  assert.equal(
    database.getTransactionCount(),
    1,
  );

  const queries =
    database.getTransactionQueries();

  assert.deepEqual(
    queries.map((query) => query.name),
    [
      "character-create-v1",
      "character-name-reserve-v1",
    ],
  );

  assert.equal(
    queries[0].values[0],
    "account-1",
  );

  assert.equal(
    queries[0].values[1],
    "hero",
  );

  assert.deepEqual(
    JSON.parse(queries[0].values[2]),
    {
      name: "  Ari Vale  ",
      level: 1,
    },
  );

  assert.equal(
    queries[1].values[0],
    "ari vale",
  );
});

test("PostgreSQL character creation reports an existing character without attempting name reservation", async () => {
  const database = createDatabaseStub({
    transactionQuery: async (config) => {
      assert.equal(
        config.name,
        "character-create-v1",
      );

      return createResult([], 0);
    },
  });

  const repository =
    createPostgresCharacterRepository({
      database,
    });

  assert.deepEqual(
    await repository.save(
      "account-1",
      "hero",
      {
        name: "Ari Vale",
      },
      null,
      1000,
    ),
    {
      success: false,
      reason: "character-already-exists",
    },
  );

  assert.equal(
    database.getTransactionQueries().length,
    1,
  );

  assert.equal(
    database.getRollbackCount(),
    0,
  );
});

test("PostgreSQL character name conflict rolls back the newly inserted character", async () => {
  const database = createDatabaseStub({
    transactionQuery: async (
      config,
      queryIndex,
    ) => {
      if (queryIndex === 0) {
        assert.equal(
          config.name,
          "character-create-v1",
        );

        return createResult([
          {
            version: 1,
          },
        ]);
      }

      if (queryIndex === 1) {
        assert.equal(
          config.name,
          "character-name-reserve-v1",
        );

        return createResult([], 0);
      }

      throw new Error(
        `Unexpected transaction query: ${config.name}`,
      );
    },
  });

  const repository =
    createPostgresCharacterRepository({
      database,
    });

  assert.deepEqual(
    await repository.save(
      "account-2",
      "hero-2",
      {
        name: "ARI VALE",
      },
      null,
      2000,
    ),
    {
      success: false,
      reason: "character-name-taken",
    },
  );

  assert.equal(
    database.getRollbackCount(),
    1,
  );
});

test("PostgreSQL character autosave uses one optimistic update query", async () => {
  const database = createDatabaseStub({
    query: async (config) => {
      assert.equal(
        config.name,
        "character-update-v1",
      );

      return createResult([
        {
          version: 8,
        },
      ]);
    },
  });

  const repository =
    createPostgresCharacterRepository({
      database,
    });

  assert.deepEqual(
    await repository.save(
      "account-1",
      "hero",
      {
        name: "Ari Vale",
        level: 21,
      },
      7,
      3000,
    ),
    {
      success: true,
      version: 8,
    },
  );

  assert.equal(
    database.getDirectQueries().length,
    1,
  );

  assert.deepEqual(
    database.getDirectQueries()[0].values.slice(1),
    [
      3000,
      "account-1",
      "hero",
      7,
    ],
  );
});

test("PostgreSQL character autosave detects stale optimistic versions", async () => {
  const database = createDatabaseStub({
    query: async (config) => {
      assert.equal(
        config.name,
        "character-update-v1",
      );

      return createResult([], 0);
    },
  });

  const repository =
    createPostgresCharacterRepository({
      database,
    });

  assert.deepEqual(
    await repository.save(
      "account-1",
      "hero",
      {
        level: 22,
      },
      7,
      4000,
    ),
    {
      success: false,
      reason: "version-conflict",
    },
  );
});

test("PostgreSQL character delete reports whether a character existed", async () => {
  let deleteCount = 0;

  const database = createDatabaseStub({
    query: async (config) => {
      assert.equal(
        config.name,
        "character-delete-v1",
      );

      deleteCount += 1;

      return createResult(
        [],
        deleteCount === 1 ? 1 : 0,
      );
    },
  });

  const repository =
    createPostgresCharacterRepository({
      database,
    });

  assert.equal(
    await repository.delete(
      "account-1",
      "hero",
    ),
    true,
  );

  assert.equal(
    await repository.delete(
      "account-1",
      "missing",
    ),
    false,
  );
});

test("PostgreSQL character repository rejects invalid saves and versions before querying PostgreSQL", async () => {
  const database = createDatabaseStub({
    query: async (config) => {
      throw new Error(
        `Query should not run: ${config.name}`,
      );
    },
  });

  const repository =
    createPostgresCharacterRepository({
      database,
    });

  assert.equal(
    await repository.load("", "hero"),
    null,
  );

  assert.deepEqual(
    await repository.list(""),
    [],
  );

  assert.equal(
    await repository.delete(
      "account-1",
      "",
    ),
    false,
  );

  assert.deepEqual(
    await repository.save(
      "",
      "hero",
      {},
      null,
      1000,
    ),
    {
      success: false,
      reason: "invalid-save",
    },
  );

  assert.deepEqual(
    await repository.save(
      "account-1",
      "hero",
      {},
      0,
      1000,
    ),
    {
      success: false,
      reason: "invalid-version",
    },
  );

  assert.equal(
    database.getDirectQueries().length,
    0,
  );

  assert.equal(
    database.getTransactionCount(),
    0,
  );
});