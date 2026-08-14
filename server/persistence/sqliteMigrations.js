export const SQLITE_MIGRATIONS = Object.freeze([
  {
    version: 1,
    name: "characters",
    sql: `
      CREATE TABLE IF NOT EXISTS characters (
        account_id TEXT NOT NULL,
        character_id TEXT NOT NULL,
        snapshot_json TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (account_id, character_id)
      ) STRICT;
    `,
  },
  {
    version: 2,
    name: "accounts",
    sql: `
      CREATE TABLE IF NOT EXISTS accounts (
        account_id TEXT PRIMARY KEY,
        password_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
      ) STRICT;

      CREATE INDEX IF NOT EXISTS characters_updated_at_index
      ON characters(updated_at);
    `,
  },
  {
    version: 3,
    name: "unique-character-names",
    sql: `
      CREATE TABLE IF NOT EXISTS character_names (
        normalized_name TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        character_id TEXT NOT NULL,
        UNIQUE (account_id, character_id),
        FOREIGN KEY (account_id, character_id)
          REFERENCES characters(account_id, character_id)
          ON DELETE CASCADE
      ) STRICT;

      INSERT OR IGNORE INTO character_names (normalized_name, account_id, character_id)
      SELECT lower(trim(json_extract(snapshot_json, '$.name'))), account_id, character_id
      FROM characters
      WHERE json_valid(snapshot_json)
        AND json_type(snapshot_json, '$.name') = 'text'
        AND trim(json_extract(snapshot_json, '$.name')) <> ''
      ORDER BY updated_at ASC;
    `,
  },
  {
    version: 4,
    name: "chat-moderation",
    sql: `
      CREATE TABLE IF NOT EXISTS chat_mutes (
        account_id TEXT PRIMARY KEY,
        muted_until INTEGER NOT NULL,
        reason TEXT NOT NULL,
        moderator_account_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE
      ) STRICT;

      CREATE INDEX IF NOT EXISTS chat_mutes_expiry_index
      ON chat_mutes(muted_until);
    `,
  },
  {
    version: 5,
    name: "external-identities",
    sql: `
      CREATE TABLE IF NOT EXISTS external_identities (
        provider TEXT NOT NULL,
        subject TEXT NOT NULL,
        account_id TEXT NOT NULL,
        email TEXT NOT NULL DEFAULT '',
        display_name TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (provider, subject),
        UNIQUE (provider, account_id),
        FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE
      ) STRICT;

      CREATE INDEX IF NOT EXISTS external_identities_account_index
      ON external_identities(account_id);
    `,
  },
]);

export const runSqliteMigrations = (database, migrations = SQLITE_MIGRATIONS, now = Date.now()) => {
  if (!database || !Array.isArray(migrations) || !Number.isFinite(now)) {
    throw new TypeError("SQLite migrations require a database, a migration list and a timestamp.");
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    ) STRICT;
  `);

  const appliedVersions = new Set(
    database.prepare("SELECT version FROM schema_migrations ORDER BY version").all().map((row) => row.version),
  );
  const insertMigration = database.prepare(
    "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
  );

  for (const migration of [...migrations].sort((first, second) => first.version - second.version)) {
    if (
      !Number.isSafeInteger(migration?.version) ||
      migration.version <= 0 ||
      typeof migration.name !== "string" ||
      migration.name === "" ||
      typeof migration.sql !== "string" ||
      migration.sql === ""
    ) {
      throw new TypeError("Invalid SQLite migration.");
    }
    if (appliedVersions.has(migration.version)) {
      continue;
    }
    database.exec("BEGIN IMMEDIATE;");
    try {
      database.exec(migration.sql);
      insertMigration.run(migration.version, migration.name, now);
      database.exec("COMMIT;");
    } catch (error) {
      database.exec("ROLLBACK;");
      throw error;
    }
  }

  return Math.max(0, ...migrations.map((migration) => migration.version));
};
