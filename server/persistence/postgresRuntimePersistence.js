import {
  createPostgresDatabase,
} from "./postgresDatabase.js";

import {
  createPostgresMigrationChecksum,
  POSTGRES_MIGRATIONS,
} from "./postgresMigrations.js";

import {
  createPostgresAccountRepository,
} from "./postgresAccountRepository.js";

import {
  createPostgresCharacterRepository,
} from "./postgresCharacterRepository.js";

import {
  createPostgresChatModerationRepository,
} from "./postgresChatModerationRepository.js";

const REQUIRED_RUNTIME_TABLES =
  Object.freeze([
    "accounts",
    "characters",
    "character_names",
    "chat_mutes",
    "external_identities",
  ]);

export const verifyPostgresRuntimeSchema =
  async ({
    database,
    expectedUser,
    migrations =
      POSTGRES_MIGRATIONS,
  } = {}) => {
    if (
      !database ||
      typeof database.query !==
        "function"
    ) {
      throw new TypeError(
        "PostgreSQL runtime schema verification requires a database.",
      );
    }

    if (
      typeof expectedUser !==
        "string" ||
      expectedUser === ""
    ) {
      throw new TypeError(
        "PostgreSQL runtime schema verification requires an expected user.",
      );
    }

    if (
      !Array.isArray(migrations) ||
      migrations.length === 0
    ) {
      throw new TypeError(
        "PostgreSQL runtime migrations are required.",
      );
    }

    const historyResult =
      await database.query({
        name:
          "runtime-schema-history-v1",

        text: `
          SELECT
            version,
            name,
            checksum
          FROM game.schema_migrations
          ORDER BY version ASC
        `,
      });

    if (
      historyResult.rows.length !==
      migrations.length
    ) {
      throw new Error(
        "PostgreSQL runtime schema version does not match this server build.",
      );
    }

    for (
      let index = 0;
      index < migrations.length;
      index += 1
    ) {
      const expected =
        migrations[index];

      const actual =
        historyResult.rows[index];
      const expectedChecksum = expected.checksum ?? createPostgresMigrationChecksum(expected);

      if (
        Number(actual?.version) !==
          expected.version ||
        actual?.name !==
          expected.name ||
        actual?.checksum !== expectedChecksum
      ) {
        throw new Error(
          "PostgreSQL runtime migration history does not match this server build.",
        );
      }
    }

    const securityResult =
      await database.query({
        name:
          "runtime-schema-security-v1",

        text: `
          SELECT
            current_user AS role_name,

            has_schema_privilege(
              current_user,
              'game',
              'USAGE'
            ) AS schema_usage,

            has_schema_privilege(
              current_user,
              'game',
              'CREATE'
            ) AS schema_create,

            has_table_privilege(
              current_user,
              'game.schema_migrations',
              'SELECT'
            ) AS migration_select,

            has_table_privilege(
              current_user,
              'game.schema_migrations',
              'INSERT'
            ) AS migration_insert,

            has_table_privilege(
              current_user,
              'game.schema_migrations',
              'UPDATE'
            ) AS migration_update,

            has_table_privilege(
              current_user,
              'game.schema_migrations',
              'DELETE'
            ) AS migration_delete
        `,
      });

    const security =
      securityResult.rows[0];

    if (
      security?.role_name !==
        expectedUser
    ) {
      throw new Error(
        `PostgreSQL runtime connected as unexpected role ${security?.role_name ?? "unknown"}.`,
      );
    }

    if (!security.schema_usage) {
      throw new Error(
        "PostgreSQL runtime role cannot use the game schema.",
      );
    }

    if (security.schema_create) {
      throw new Error(
        "PostgreSQL runtime role unexpectedly has CREATE permission on the game schema.",
      );
    }

    if (!security.migration_select) {
      throw new Error(
        "PostgreSQL runtime role cannot verify migration history.",
      );
    }

    if (
      security.migration_insert ||
      security.migration_update ||
      security.migration_delete
    ) {
      throw new Error(
        "PostgreSQL runtime role can modify migration history.",
      );
    }

    const privilegesResult =
      await database.query({
        name:
          "runtime-table-privileges-v1",

        text: `
          SELECT
            required.table_name,

            has_table_privilege(
              current_user,
              'game.' ||
                quote_ident(
                  required.table_name
                ),
              'SELECT'
            ) AS select_ok,

            has_table_privilege(
              current_user,
              'game.' ||
                quote_ident(
                  required.table_name
                ),
              'INSERT'
            ) AS insert_ok,

            has_table_privilege(
              current_user,
              'game.' ||
                quote_ident(
                  required.table_name
                ),
              'UPDATE'
            ) AS update_ok,

            has_table_privilege(
              current_user,
              'game.' ||
                quote_ident(
                  required.table_name
                ),
              'DELETE'
            ) AS delete_ok

          FROM (
            VALUES
              ('accounts'),
              ('characters'),
              ('character_names'),
              ('chat_mutes'),
              ('external_identities')
          ) AS required(table_name)

          ORDER BY required.table_name
        `,
      });

    if (
      privilegesResult.rows.length !==
        REQUIRED_RUNTIME_TABLES.length
    ) {
      throw new Error(
        "PostgreSQL runtime table verification is incomplete.",
      );
    }

    for (
      const tableName
      of REQUIRED_RUNTIME_TABLES
    ) {
      const privilege =
        privilegesResult.rows.find(
          (row) =>
            row.table_name ===
              tableName,
        );

      if (
        !privilege ||
        !privilege.select_ok ||
        !privilege.insert_ok ||
        !privilege.update_ok ||
        !privilege.delete_ok
      ) {
        throw new Error(
          `PostgreSQL runtime permissions are incomplete for game.${tableName}.`,
        );
      }
    }

    return Object.freeze({
      currentVersion:
        migrations[
          migrations.length - 1
        ].version,

      tableCount:
        REQUIRED_RUNTIME_TABLES.length,
    });
  };

export const createPostgresRuntimePersistence =
  async ({
    databaseOptions,
    databaseFactory =
      createPostgresDatabase,

    migrations =
      POSTGRES_MIGRATIONS,

    logger = console,
  } = {}) => {
    if (
      !databaseOptions ||
      typeof databaseOptions !==
        "object"
    ) {
      throw new TypeError(
        "PostgreSQL runtime database options are required.",
      );
    }

    if (
      typeof databaseFactory !==
        "function"
    ) {
      throw new TypeError(
        "PostgreSQL runtime database factory is invalid.",
      );
    }

    if (
      !logger ||
      typeof logger.log !==
        "function"
    ) {
      throw new TypeError(
        "PostgreSQL runtime logger is invalid.",
      );
    }

    const database =
      databaseFactory(
        databaseOptions,
      );

    if (
      !database ||
      typeof database.query !==
        "function" ||
      typeof database.transaction !==
        "function" ||
      typeof database.healthCheck !==
        "function" ||
      typeof database.getPoolStats !==
        "function" ||
      typeof database.close !==
        "function"
    ) {
      throw new TypeError(
        "PostgreSQL runtime database is invalid.",
      );
    }

    try {
      const healthy =
        await database.healthCheck();

      if (!healthy) {
        throw new Error(
          "PostgreSQL runtime health check failed.",
        );
      }

      const schema =
        await verifyPostgresRuntimeSchema({
          database,

          expectedUser:
            databaseOptions.user,

          migrations,
        });

      const accountRepository =
        createPostgresAccountRepository({
          database,
        });

      const characterRepository =
        createPostgresCharacterRepository({
          database,
        });

      const chatModerationRepository =
        createPostgresChatModerationRepository({
          database,
        });

      logger.log(
        `PostgreSQL runtime ready: schema v${schema.currentVersion}, ${schema.tableCount} persistence table(s).`,
      );

      return Object.freeze({
        accountRepository,
        characterRepository,
        chatModerationRepository,

        schema,

        getPoolStats() {
          return database
            .getPoolStats();
        },

        close() {
          return database.close();
        },
      });
    } catch (error) {
      await database.close();

      throw error;
    }
  };
