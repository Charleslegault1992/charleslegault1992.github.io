import { getPostgresMigratorOptions } from "./persistence/postgresEnvironment.js";
import { runPostgresMigrationLifecycle } from "./persistence/postgresMigrationRunner.js";

try {
  const databaseOptions = getPostgresMigratorOptions();

  await runPostgresMigrationLifecycle({
    databaseOptions,
  });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  console.error(`PostgreSQL migration command failed: ${message}`);

  process.exitCode = 1;
}
