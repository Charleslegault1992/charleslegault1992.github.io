import {
  createPostgresDatabase,
} from "./postgresDatabase.js";
import {
  POSTGRES_MIGRATIONS,
  runPostgresMigrations,
} from "./postgresMigrations.js";

export const runPostgresMigrationLifecycle = async ({
  databaseOptions,
  databaseFactory = createPostgresDatabase,
  migrations = POSTGRES_MIGRATIONS,
  migrationRunner = runPostgresMigrations,
  logger = console,
} = {}) => {
  if (
    !databaseOptions ||
    typeof databaseOptions !== "object"
  ) {
    throw new TypeError(
      "PostgreSQL migration database options are required.",
    );
  }

  if (
    typeof databaseFactory !== "function" ||
    typeof migrationRunner !== "function"
  ) {
    throw new TypeError(
      "PostgreSQL migration dependencies are invalid.",
    );
  }

  const database = databaseFactory(
    databaseOptions,
  );

  if (
    !database ||
    typeof database.healthCheck !== "function" ||
    typeof database.close !== "function"
  ) {
    throw new TypeError(
      "PostgreSQL migration database is invalid.",
    );
  }

  try {
    const isHealthy =
      await database.healthCheck();

    if (!isHealthy) {
      throw new Error(
        "PostgreSQL migration health check failed.",
      );
    }

    const result = await migrationRunner(
      database,
      migrations,
    );

    logger.log(
      `PostgreSQL schema ready: version ${result.currentVersion}, applied ${result.appliedCount}.`,
    );

    return result;
  } finally {
    await database.close();
  }
};