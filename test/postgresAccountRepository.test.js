import assert from "node:assert/strict";
import test from "node:test";

import {
  createPostgresAccountRepository,
} from "../server/persistence/postgresAccountRepository.js";

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

      return work({
        async query(config) {
          transactionQueries.push(config);

          if (typeof transactionQuery !== "function") {
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
  };
};

test("PostgreSQL account creation normalizes values and uses one insert on the success path", async () => {
  const database = createDatabaseStub({
    query: async (config) => {
      assert.equal(config.name, "account-create-v1");

      return createResult([
        {
          account_id: "charles_92",
          email: "charles@example.com",
        },
      ]);
    },
  });

  const repository =
    createPostgresAccountRepository({
      database,
    });

  const result = await repository.create(
    " Charles_92 ",
    " CHARLES@EXAMPLE.COM ",
    "password-hash",
    123456789,
  );

  assert.deepEqual(result, {
    success: true,
    accountId: "charles_92",
    email: "charles@example.com",
  });

  assert.equal(
    database.getDirectQueries().length,
    1,
  );

  assert.deepEqual(
    database.getDirectQueries()[0].values,
    [
      "charles_92",
      "charles@example.com",
      "password-hash",
      123456789,
    ],
  );
});

test("PostgreSQL account creation preserves email conflict priority", async () => {
  const database = createDatabaseStub({
    query: async (config) => {
      if (config.name === "account-create-v1") {
        return createResult([], 0);
      }

      if (config.name === "account-create-conflict-v1") {
        return createResult([
          {
            email_exists: true,
            account_exists: true,
          },
        ]);
      }

      throw new Error(
        `Unexpected query: ${config.name}`,
      );
    },
  });

  const repository =
    createPostgresAccountRepository({
      database,
    });

  const result = await repository.create(
    "charles_92",
    "charles@example.com",
    "password-hash",
    1000,
  );

  assert.deepEqual(result, {
    success: false,
    reason: "email-already-exists",
  });
});

test("PostgreSQL account repository maps BIGINT timestamps to safe JavaScript numbers", async () => {
  const database = createDatabaseStub({
    query: async (config) => {
      assert.equal(config.name, "account-find-v1");

      return createResult([
        {
          account_id: "charles_92",
          email: "charles@example.com",
          password_hash: "password-hash",
          created_at: "1788192000123",
        },
      ]);
    },
  });

  const repository =
    createPostgresAccountRepository({
      database,
    });

  const account = await repository.find(
    " CHARLES_92 ",
  );

  assert.deepEqual(account, {
    accountId: "charles_92",
    email: "charles@example.com",
    passwordHash: "password-hash",
    createdAt: 1788192000123,
  });
});

test("PostgreSQL account login lookup chooses the indexed email or account query", async () => {
  const queryNames = [];

  const database = createDatabaseStub({
    query: async (config) => {
      queryNames.push(config.name);

      return createResult([]);
    },
  });

  const repository =
    createPostgresAccountRepository({
      database,
    });

  await repository.findByLogin(
    "CHARLES@EXAMPLE.COM",
  );

  await repository.findByLogin(
    "Charles_92",
  );

  assert.deepEqual(queryNames, [
    "account-find-by-email-v1",
    "account-find-by-id-v1",
  ]);
});

test("PostgreSQL external identity login updates an existing identity without opening a transaction", async () => {
  const database = createDatabaseStub({
    query: async (config) => {
      assert.equal(
        config.name,
        "account-external-identity-update-v1",
      );

      return createResult([
        {
          account_id: "google_existing",
        },
      ]);
    },
  });

  const repository =
    createPostgresAccountRepository({
      database,
    });

  const result =
    await repository.findOrCreateExternalIdentity(
      {
        provider: " GOOGLE ",
        subject: " user-123 ",
        email: " test@example.com ",
        displayName: " Charles ",
      },
      5000,
    );

  assert.deepEqual(result, {
    success: true,
    accountId: "google_existing",
    wasCreated: false,
  });

  assert.equal(
    database.getTransactionCount(),
    0,
  );

  assert.deepEqual(
    database.getDirectQueries()[0].values,
    [
      "google",
      "user-123",
      "test@example.com",
      "Charles",
      5000,
    ],
  );
});

test("PostgreSQL external identity creation creates the account and identity in one transaction", async () => {
  const database = createDatabaseStub({
    query: async (config) => {
      if (
        config.name ===
        "account-external-identity-update-v1"
      ) {
        return createResult([]);
      }

      throw new Error(
        `Unexpected direct query: ${config.name}`,
      );
    },

    transactionQuery: async (
      config,
      queryIndex,
    ) => {
      if (queryIndex === 0) {
        assert.equal(
          config.name,
          "account-external-identity-update-v1",
        );

        return createResult([]);
      }

      if (queryIndex === 1) {
        assert.equal(
          config.name,
          "account-external-account-create-v1",
        );

        return createResult([
          {
            account_id:
              "google_2fbb5b0fbc25023fdcf037a5",
          },
        ]);
      }

      if (queryIndex === 2) {
        assert.equal(
          config.name,
          "account-external-identity-create-v1",
        );

        return createResult([
          {
            account_id:
              config.values[2],
          },
        ]);
      }

      throw new Error(
        `Unexpected transaction query: ${config.name}`,
      );
    },
  });

  const repository =
    createPostgresAccountRepository({
      database,
    });

  const result =
    await repository.findOrCreateExternalIdentity(
      {
        provider: "google",
        subject: "google-user-123",
        email: "charles@example.com",
        displayName: "Charles",
      },
      7000,
    );

  assert.equal(result.success, true);
  assert.equal(result.wasCreated, true);
  assert.match(
    result.accountId,
    /^google_[a-f0-9]{24}$/,
  );

  assert.equal(
    database.getTransactionCount(),
    1,
  );

  assert.deepEqual(
    database
      .getTransactionQueries()
      .map((query) => query.name),
    [
      "account-external-identity-update-v1",
      "account-external-account-create-v1",
      "account-external-identity-create-v1",
    ],
  );
});

test("PostgreSQL external identity creation handles a concurrent creator without duplicating the account", async () => {
  const database = createDatabaseStub({
    query: async () => {
      return createResult([]);
    },

    transactionQuery: async (
      config,
      queryIndex,
    ) => {
      assert.equal(
        queryIndex,
        0,
      );

      assert.equal(
        config.name,
        "account-external-identity-update-v1",
      );

      return createResult([
        {
          account_id: "google_concurrent",
        },
      ]);
    },
  });

  const repository =
    createPostgresAccountRepository({
      database,
    });

  const result =
    await repository.findOrCreateExternalIdentity(
      {
        provider: "google",
        subject: "same-user",
        email: "",
        displayName: "",
      },
      8000,
    );

  assert.deepEqual(result, {
    success: true,
    accountId: "google_concurrent",
    wasCreated: false,
  });

  assert.equal(
    database.getTransactionQueries().length,
    1,
  );
});

test("PostgreSQL account repository rejects invalid input before querying PostgreSQL", async () => {
  const database = createDatabaseStub({
    query: async (config) => {
      throw new Error(
        `Query should not run: ${config.name}`,
      );
    },
  });

  const repository =
    createPostgresAccountRepository({
      database,
    });

  assert.deepEqual(
    await repository.create(
      "x",
      "bad-email",
      "",
    ),
    {
      success: false,
      reason: "invalid-account",
    },
  );

  assert.equal(
    await repository.find("x"),
    null,
  );

  assert.deepEqual(
    await repository.findOrCreateExternalIdentity({
      provider: "",
      subject: "",
    }),
    {
      success: false,
      reason: "invalid-external-identity",
    },
  );

  assert.equal(
    database.getDirectQueries().length,
    0,
  );
});