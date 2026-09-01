import { createHash } from "node:crypto";

export const POSTGRES_SCHEMA_LOCK_CLASS_ID = 1852796534;
export const POSTGRES_SCHEMA_LOCK_OBJECT_ID = 1;

export const POSTGRES_MIGRATIONS = Object.freeze([
  {
    version: 1,
    name: "initial-persistence-schema",
    sql: `
      CREATE TABLE game.accounts (
        account_id TEXT PRIMARY KEY,
        email TEXT NOT NULL DEFAULT '',
        password_hash TEXT NOT NULL,
        created_at BIGINT NOT NULL
      );

      CREATE UNIQUE INDEX accounts_email_unique_index
      ON game.accounts (email)
      WHERE email <> '';


      CREATE TABLE game.characters (
        account_id TEXT NOT NULL,
        character_id TEXT NOT NULL,
        snapshot_json JSONB NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        updated_at BIGINT NOT NULL,
        PRIMARY KEY (account_id, character_id)
      );


      CREATE TABLE game.character_names (
        normalized_name TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        character_id TEXT NOT NULL,
        UNIQUE (account_id, character_id),
        FOREIGN KEY (account_id, character_id)
          REFERENCES game.characters (account_id, character_id)
          ON DELETE CASCADE
      );


      CREATE TABLE game.chat_mutes (
        account_id TEXT PRIMARY KEY,
        muted_until BIGINT NOT NULL,
        reason TEXT NOT NULL,
        moderator_account_id TEXT NOT NULL,
        created_at BIGINT NOT NULL,
        FOREIGN KEY (account_id)
          REFERENCES game.accounts (account_id)
          ON DELETE CASCADE
      );

      CREATE INDEX chat_mutes_expiry_index
      ON game.chat_mutes (muted_until);


      CREATE TABLE game.external_identities (
        provider TEXT NOT NULL,
        subject TEXT NOT NULL,
        account_id TEXT NOT NULL,
        email TEXT NOT NULL DEFAULT '',
        display_name TEXT NOT NULL DEFAULT '',
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        PRIMARY KEY (provider, subject),
        UNIQUE (provider, account_id),
        FOREIGN KEY (account_id)
          REFERENCES game.accounts (account_id)
          ON DELETE CASCADE
      );

      CREATE INDEX external_identities_account_index
      ON game.external_identities (account_id);
    `,
  },
  {
    version: 2,
    name: "application-schema-read-access",
    sql: `
      GRANT SELECT
      ON TABLE game.schema_migrations
      TO nonameyet_app;

      REVOKE
        INSERT,
        UPDATE,
        DELETE,
        TRUNCATE,
        REFERENCES,
        TRIGGER
      ON TABLE game.schema_migrations
      FROM nonameyet_app;
    `,
  },
]);

export const createPostgresMigrationChecksum = (migration, migrationType = null) => {
  const resolvedMigrationType = migrationType ?? (typeof migration?.sql === "string" ? "sql" : "up");
  const migrationSource = resolvedMigrationType === "sql" ? migration.sql : migration.up.toString();

  return createHash("sha256")
    .update(String(migration.version))
    .update("\0")
    .update(migration.name)
    .update("\0")
    .update(resolvedMigrationType)
    .update("\0")
    .update(migrationSource)
    .digest("hex");
};

const normalizePostgresMigrations = (migrations) => {
  if (!Array.isArray(migrations)) {
    throw new TypeError("PostgreSQL migrations must be an array.");
  }

  const normalizedMigrations = migrations
    .map((migration) => {
      const hasSql = typeof migration?.sql === "string" && migration.sql.trim() !== "";
      const hasUp = typeof migration?.up === "function";

      if (
        !Number.isSafeInteger(migration?.version) ||
        migration.version <= 0 ||
        typeof migration.name !== "string" ||
        migration.name.trim() === "" ||
        hasSql === hasUp
      ) {
        throw new TypeError("Invalid PostgreSQL migration.");
      }

      const migrationType = hasSql ? "sql" : "up";

      return Object.freeze({
        version: migration.version,
        name: migration.name.trim(),
        type: migrationType,
        sql: hasSql ? migration.sql : null,
        up: hasUp ? migration.up : null,
        checksum: createPostgresMigrationChecksum(migration, migrationType),
      });
    })
    .sort((first, second) => first.version - second.version);

  const migrationNames = new Set();

  for (let index = 0; index < normalizedMigrations.length; index += 1) {
    const migration = normalizedMigrations[index];
    const expectedVersion = index + 1;

    if (migration.version !== expectedVersion) {
      throw new RangeError(
        `PostgreSQL migration versions must be contiguous from 1; expected ${expectedVersion} but found ${migration.version}.`,
      );
    }

    if (migrationNames.has(migration.name)) {
      throw new RangeError(`Duplicate PostgreSQL migration name: ${migration.name}.`);
    }

    migrationNames.add(migration.name);
  }

  return normalizedMigrations;
};

export const runPostgresMigrations = async (database, migrations = POSTGRES_MIGRATIONS) => {
  if (!database || typeof database.transaction !== "function") {
    throw new TypeError("PostgreSQL migrations require a transactional database.");
  }

  const normalizedMigrations = normalizePostgresMigrations(migrations);
  const migrationsByVersion = new Map(normalizedMigrations.map((migration) => [migration.version, migration]));

  return database.transaction(async (transactionDatabase) => {
    await transactionDatabase.query("SET LOCAL lock_timeout = '30s'");

    await transactionDatabase.query("SELECT pg_advisory_xact_lock($1::integer, $2::integer)", [
      POSTGRES_SCHEMA_LOCK_CLASS_ID,
      POSTGRES_SCHEMA_LOCK_OBJECT_ID,
    ]);

    await transactionDatabase.query("SET LOCAL ROLE nonameyet_owner");

    await transactionDatabase.query(`
      CREATE TABLE IF NOT EXISTS game.schema_migrations (
        version INTEGER PRIMARY KEY CHECK (version > 0),
        name TEXT NOT NULL UNIQUE CHECK (length(btrim(name)) > 0),
        checksum TEXT NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
        applied_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
      )
    `);

    await transactionDatabase.query("REVOKE ALL ON TABLE game.schema_migrations FROM PUBLIC");

    await transactionDatabase.query(`
    REVOKE
    INSERT,
    UPDATE,
    DELETE,
    TRUNCATE,
    REFERENCES,
    TRIGGER
  ON TABLE game.schema_migrations
  FROM nonameyet_app
`);

    const appliedResult = await transactionDatabase.query(`
      SELECT version, name, checksum
      FROM game.schema_migrations
      ORDER BY version ASC
    `);

    const appliedVersions = new Set();

    for (const appliedMigration of appliedResult.rows) {
      const version = Number(appliedMigration.version);

      if (!Number.isSafeInteger(version) || version <= 0) {
        throw new Error("PostgreSQL migration history contains an invalid version.");
      }

      const knownMigration = migrationsByVersion.get(version);

      if (!knownMigration) {
        throw new Error(`PostgreSQL database contains migration version ${version} that this server does not know.`);
      }

      if (appliedMigration.name !== knownMigration.name) {
        throw new Error(`PostgreSQL migration ${version} name does not match the applied migration history.`);
      }

      if (appliedMigration.checksum !== knownMigration.checksum) {
        throw new Error(`PostgreSQL migration ${version} was modified after being applied.`);
      }

      appliedVersions.add(version);
    }

    let appliedCount = 0;

    for (const migration of normalizedMigrations) {
      if (appliedVersions.has(migration.version)) {
        continue;
      }

      if (migration.type === "sql") {
        await transactionDatabase.query(migration.sql);
      } else {
        await migration.up(transactionDatabase);
      }

      await transactionDatabase.query(
        `
          INSERT INTO game.schema_migrations (
            version,
            name,
            checksum
          )
          VALUES ($1, $2, $3)
        `,
        [migration.version, migration.name, migration.checksum],
      );

      appliedCount += 1;
    }

    return Object.freeze({
      currentVersion: normalizedMigrations.at(-1)?.version ?? 0,
      appliedCount,
    });
  });
};
