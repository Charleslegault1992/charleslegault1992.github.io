import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

import { ACCOUNT_EMAIL_PATTERN, ACCOUNT_ID_PATTERN, EXTERNAL_PROVIDER_PATTERN } from "./accountRepositoryRules.js";

import {
  POSTGRES_MIGRATIONS,
  POSTGRES_SCHEMA_LOCK_CLASS_ID,
  POSTGRES_SCHEMA_LOCK_OBJECT_ID,
} from "./postgresMigrations.js";

const EXPECTED_SQLITE_SCHEMA_VERSION = 6;
const DEFAULT_IMPORT_BATCH_SIZE = 250;

const toSafeInteger = (value, fieldName, { positive = false } = {}) => {
  const numberValue = typeof value === "number" ? value : Number(value);

  if (!Number.isSafeInteger(numberValue) || (positive && numberValue <= 0)) {
    throw new RangeError(`Invalid migration integer: ${fieldName}.`);
  }

  return numberValue;
};

const requireString = (value, fieldName, { allowEmpty = false, maxLength = null } = {}) => {
  if (typeof value !== "string") {
    throw new TypeError(`Invalid migration string: ${fieldName}.`);
  }

  if (!allowEmpty && value === "") {
    throw new TypeError(`Empty migration string: ${fieldName}.`);
  }

  if (Number.isSafeInteger(maxLength) && value.length > maxLength) {
    throw new RangeError(`Migration string is too long: ${fieldName}.`);
  }

  return value;
};

const assertPostgresJsonCompatible = (value, path = "$") => {
  if (value === null) {
    return;
  }

  if (typeof value === "string") {
    if (value.includes("\u0000")) {
      throw new TypeError(`Character snapshot contains a PostgreSQL-incompatible null character at ${path}.`);
    }

    return;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Character snapshot contains a non-finite number at ${path}.`);
    }

    return;
  }

  if (typeof value === "boolean") {
    return;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      assertPostgresJsonCompatible(value[index], `${path}[${index}]`);
    }

    return;
  }

  if (typeof value === "object" && value !== null) {
    for (const [key, nestedValue] of Object.entries(value)) {
      if (key.includes("\u0000")) {
        throw new TypeError(`Character snapshot contains a PostgreSQL-incompatible key at ${path}.`);
      }

      assertPostgresJsonCompatible(nestedValue, `${path}.${key}`);
    }

    return;
  }

  throw new TypeError(`Character snapshot contains an unsupported value at ${path}.`);
};

const parseCharacterSnapshot = (snapshotJson, accountId, characterId) => {
  if (typeof snapshotJson !== "string") {
    throw new TypeError(`Character ${accountId}/${characterId} has a non-string SQLite snapshot.`);
  }

  let snapshot;

  try {
    snapshot = JSON.parse(snapshotJson);
  } catch {
    throw new Error(`Character ${accountId}/${characterId} has invalid JSON.`);
  }

  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throw new Error(`Character ${accountId}/${characterId} does not contain an object snapshot.`);
  }

  assertPostgresJsonCompatible(snapshot);

  return snapshot;
};

const stableStringify = (value) => {
  if (value === null) {
    return "null";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((nestedValue) => stableStringify(nestedValue)).join(",")}]`;
  }

  const keys = Object.keys(value).sort();

  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
};

const validateAccountRecord = ({ accountId, email, passwordHash, createdAt }) => {
  requireString(accountId, "accounts.account_id");

  if (!ACCOUNT_ID_PATTERN.test(accountId)) {
    throw new Error(`Invalid persisted account id: ${accountId}.`);
  }

  requireString(email, "accounts.email", {
    allowEmpty: true,
    maxLength: 320,
  });

  if (email !== "" && !ACCOUNT_EMAIL_PATTERN.test(email)) {
    throw new Error(`Invalid persisted account email for ${accountId}.`);
  }

  requireString(passwordHash, "accounts.password_hash");

  return {
    accountId,
    email,
    passwordHash,
    createdAt: toSafeInteger(createdAt, "accounts.created_at"),
  };
};

const validateCharacterRecord = ({ accountId, characterId, snapshot, version, updatedAt }) => {
  requireString(accountId, "characters.account_id");

  requireString(characterId, "characters.character_id");

  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throw new TypeError(`Invalid character snapshot for ${accountId}/${characterId}.`);
  }

  assertPostgresJsonCompatible(snapshot);

  return {
    accountId,
    characterId,
    snapshot,
    version: toSafeInteger(version, "characters.version", {
      positive: true,
    }),
    updatedAt: toSafeInteger(updatedAt, "characters.updated_at"),
  };
};

const validateCharacterNameRecord = ({ normalizedName, accountId, characterId }) => {
  requireString(normalizedName, "character_names.normalized_name");

  requireString(accountId, "character_names.account_id");

  requireString(characterId, "character_names.character_id");

  if (normalizedName !== normalizedName.trim().toLocaleLowerCase()) {
    throw new Error(`Character name reservation is not normalized: ${normalizedName}.`);
  }

  return {
    normalizedName,
    accountId,
    characterId,
  };
};

const validateChatMuteRecord = ({ accountId, mutedUntil, reason, moderatorAccountId, createdAt }) => {
  requireString(accountId, "chat_mutes.account_id");

  requireString(reason, "chat_mutes.reason", {
    allowEmpty: true,
    maxLength: 160,
  });

  requireString(moderatorAccountId, "chat_mutes.moderator_account_id");

  return {
    accountId,
    mutedUntil: toSafeInteger(mutedUntil, "chat_mutes.muted_until"),
    reason,
    moderatorAccountId,
    createdAt: toSafeInteger(createdAt, "chat_mutes.created_at"),
  };
};

const validateExternalIdentityRecord = ({ provider, subject, accountId, email, displayName, createdAt, updatedAt }) => {
  requireString(provider, "external_identities.provider");

  if (!EXTERNAL_PROVIDER_PATTERN.test(provider)) {
    throw new Error(`Invalid external identity provider: ${provider}.`);
  }

  requireString(subject, "external_identities.subject", {
    maxLength: 255,
  });

  requireString(accountId, "external_identities.account_id");

  requireString(email, "external_identities.email", {
    allowEmpty: true,
    maxLength: 320,
  });

  requireString(displayName, "external_identities.display_name", {
    allowEmpty: true,
    maxLength: 200,
  });

  return {
    provider,
    subject,
    accountId,
    email,
    displayName,
    createdAt: toSafeInteger(createdAt, "external_identities.created_at"),
    updatedAt: toSafeInteger(updatedAt, "external_identities.updated_at"),
  };
};

const TABLE_DEFINITIONS = Object.freeze([
  {
    name: "accounts",

    sourceSql: `
      SELECT
        account_id,
        email,
        password_hash,
        created_at
      FROM accounts
      ORDER BY account_id ASC
    `,

    targetSql: `
      SELECT
        account_id,
        email,
        password_hash,
        created_at
      FROM game.accounts
      ORDER BY account_id ASC
    `,

    insertColumns: ["account_id", "email", "password_hash", "created_at"],

    casts: ["", "", "", ""],

    mapSource(row) {
      return validateAccountRecord({
        accountId: row.account_id,
        email: row.email,
        passwordHash: row.password_hash,
        createdAt: row.created_at,
      });
    },

    mapTarget(row) {
      return validateAccountRecord({
        accountId: row.account_id,
        email: row.email,
        passwordHash: row.password_hash,
        createdAt: row.created_at,
      });
    },

    toValues(record) {
      return [record.accountId, record.email, record.passwordHash, record.createdAt];
    },
  },

  {
    name: "characters",

    sourceSql: `
      SELECT
        account_id,
        character_id,
        snapshot_json,
        version,
        updated_at
      FROM characters
      ORDER BY account_id ASC, character_id ASC
    `,

    targetSql: `
      SELECT
        account_id,
        character_id,
        snapshot_json,
        version,
        updated_at
      FROM game.characters
      ORDER BY account_id ASC, character_id ASC
    `,

    insertColumns: ["account_id", "character_id", "snapshot_json", "version", "updated_at"],

    casts: ["", "", "::jsonb", "", ""],

    mapSource(row) {
      return validateCharacterRecord({
        accountId: row.account_id,
        characterId: row.character_id,

        snapshot: parseCharacterSnapshot(row.snapshot_json, row.account_id, row.character_id),

        version: row.version,
        updatedAt: row.updated_at,
      });
    },

    mapTarget(row) {
      return validateCharacterRecord({
        accountId: row.account_id,
        characterId: row.character_id,
        snapshot: row.snapshot_json,
        version: row.version,
        updatedAt: row.updated_at,
      });
    },

    toValues(record) {
      return [record.accountId, record.characterId, JSON.stringify(record.snapshot), record.version, record.updatedAt];
    },
  },

  {
    name: "character_names",

    sourceSql: `
      SELECT
        normalized_name,
        account_id,
        character_id
      FROM character_names
      ORDER BY normalized_name ASC
    `,

    targetSql: `
      SELECT
        normalized_name,
        account_id,
        character_id
      FROM game.character_names
      ORDER BY normalized_name ASC
    `,

    insertColumns: ["normalized_name", "account_id", "character_id"],

    casts: ["", "", ""],

    mapSource(row) {
      return validateCharacterNameRecord({
        normalizedName: row.normalized_name,
        accountId: row.account_id,
        characterId: row.character_id,
      });
    },

    mapTarget(row) {
      return validateCharacterNameRecord({
        normalizedName: row.normalized_name,
        accountId: row.account_id,
        characterId: row.character_id,
      });
    },

    toValues(record) {
      return [record.normalizedName, record.accountId, record.characterId];
    },
  },

  {
    name: "chat_mutes",

    sourceSql: `
      SELECT
        account_id,
        muted_until,
        reason,
        moderator_account_id,
        created_at
      FROM chat_mutes
      ORDER BY account_id ASC
    `,

    targetSql: `
      SELECT
        account_id,
        muted_until,
        reason,
        moderator_account_id,
        created_at
      FROM game.chat_mutes
      ORDER BY account_id ASC
    `,

    insertColumns: ["account_id", "muted_until", "reason", "moderator_account_id", "created_at"],

    casts: ["", "", "", "", ""],

    mapSource(row) {
      return validateChatMuteRecord({
        accountId: row.account_id,
        mutedUntil: row.muted_until,
        reason: row.reason,
        moderatorAccountId: row.moderator_account_id,
        createdAt: row.created_at,
      });
    },

    mapTarget(row) {
      return validateChatMuteRecord({
        accountId: row.account_id,
        mutedUntil: row.muted_until,
        reason: row.reason,
        moderatorAccountId: row.moderator_account_id,
        createdAt: row.created_at,
      });
    },

    toValues(record) {
      return [record.accountId, record.mutedUntil, record.reason, record.moderatorAccountId, record.createdAt];
    },
  },

  {
    name: "external_identities",

    sourceSql: `
      SELECT
        provider,
        subject,
        account_id,
        email,
        display_name,
        created_at,
        updated_at
      FROM external_identities
      ORDER BY provider ASC, subject ASC
    `,

    targetSql: `
      SELECT
        provider,
        subject,
        account_id,
        email,
        display_name,
        created_at,
        updated_at
      FROM game.external_identities
      ORDER BY provider ASC, subject ASC
    `,

    insertColumns: ["provider", "subject", "account_id", "email", "display_name", "created_at", "updated_at"],

    casts: ["", "", "", "", "", "", ""],

    mapSource(row) {
      return validateExternalIdentityRecord({
        provider: row.provider,
        subject: row.subject,
        accountId: row.account_id,
        email: row.email,
        displayName: row.display_name,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    },

    mapTarget(row) {
      return validateExternalIdentityRecord({
        provider: row.provider,
        subject: row.subject,
        accountId: row.account_id,
        email: row.email,
        displayName: row.display_name,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    },

    toValues(record) {
      return [
        record.provider,
        record.subject,
        record.accountId,
        record.email,
        record.displayName,
        record.createdAt,
        record.updatedAt,
      ];
    },
  },
]);

const getSingleSqliteValue = (database, sql) => {
  const row = database.prepare(sql).get();

  if (!row) {
    return null;
  }

  return Object.values(row)[0] ?? null;
};

const validateSqliteRelations = (database) => {
  const relationChecks = [
    {
      name: "characters without accounts",

      sql: `
        SELECT COUNT(*) AS count
        FROM characters AS characters
        LEFT JOIN accounts AS accounts
          ON accounts.account_id =
             characters.account_id
        WHERE accounts.account_id IS NULL
      `,
    },

    {
      name: "character names without characters",

      sql: `
        SELECT COUNT(*) AS count
        FROM character_names AS names
        LEFT JOIN characters AS characters
          ON characters.account_id =
             names.account_id
         AND characters.character_id =
             names.character_id
        WHERE characters.character_id IS NULL
      `,
    },

    {
      name: "chat mutes without accounts",

      sql: `
        SELECT COUNT(*) AS count
        FROM chat_mutes AS mutes
        LEFT JOIN accounts AS accounts
          ON accounts.account_id =
             mutes.account_id
        WHERE accounts.account_id IS NULL
      `,
    },

    {
      name: "external identities without accounts",

      sql: `
        SELECT COUNT(*) AS count
        FROM external_identities AS identities
        LEFT JOIN accounts AS accounts
          ON accounts.account_id =
             identities.account_id
        WHERE accounts.account_id IS NULL
      `,
    },
  ];

  for (const check of relationChecks) {
    const row = database.prepare(check.sql).get();

    const count = toSafeInteger(row?.count, check.name);

    if (count !== 0) {
      throw new Error(`SQLite migration validation failed: ${check.name} (${count}).`);
    }
  }

  const nameRows = database.prepare(`
    SELECT
      names.normalized_name,
      characters.account_id,
      characters.character_id,
      characters.snapshot_json
    FROM character_names AS names
    INNER JOIN characters AS characters
      ON characters.account_id =
         names.account_id
     AND characters.character_id =
         names.character_id
    ORDER BY names.normalized_name ASC
  `);

  for (const row of nameRows.iterate()) {
    const snapshot = parseCharacterSnapshot(row.snapshot_json, row.account_id, row.character_id);

    const expectedName = typeof snapshot.name === "string" ? snapshot.name.trim().toLocaleLowerCase() : "";

    if (expectedName === "" || expectedName !== row.normalized_name) {
      throw new Error(`Character name reservation does not match snapshot for ${row.account_id}/${row.character_id}.`);
    }
  }
};

const validateSqliteMigrationSource = (database) => {
  const quickCheck = String(getSingleSqliteValue(database, "PRAGMA quick_check;") ?? "").toLocaleLowerCase();

  if (quickCheck !== "ok") {
    throw new Error("SQLite quick_check failed before PostgreSQL import.");
  }

  const schemaVersion = toSafeInteger(
    getSingleSqliteValue(
      database,
      `
        SELECT MAX(version)
        FROM schema_migrations
      `,
    ),
    "SQLite schema version",
    {
      positive: true,
    },
  );

  if (schemaVersion !== EXPECTED_SQLITE_SCHEMA_VERSION) {
    throw new Error(
      `SQLite schema version ${schemaVersion} is not supported; expected ${EXPECTED_SQLITE_SCHEMA_VERSION}.`,
    );
  }

  const requiredTableNames = ["accounts", "characters", "character_names", "chat_mutes", "external_identities"];

  const placeholders = requiredTableNames.map(() => "?").join(", ");

  const requiredTableRow = database
    .prepare(
      `
      SELECT COUNT(*) AS count
      FROM sqlite_master
      WHERE type = 'table'
        AND name IN (${placeholders})
    `,
    )
    .get(...requiredTableNames);

  const requiredTableCount = toSafeInteger(requiredTableRow?.count, "SQLite required table count");

  if (requiredTableCount !== requiredTableNames.length) {
    throw new Error("SQLite migration source is missing required tables.");
  }

  const foreignKeyIssue = database.prepare("PRAGMA foreign_key_check;").get();

  if (foreignKeyIssue) {
    throw new Error("SQLite foreign key validation failed before PostgreSQL import.");
  }

  validateSqliteRelations(database);

  return schemaVersion;
};

const createSummaryFromIterable = (iterable, mapRow) => {
  const hash = createHash("sha256");
  let count = 0;

  for (const row of iterable) {
    const record = mapRow(row);

    hash.update(stableStringify(record), "utf8");

    hash.update("\n", "utf8");

    count += 1;
  }

  return Object.freeze({
    count,
    sha256: hash.digest("hex"),
  });
};

const summarizeSqliteSource = (database) => {
  const summaries = {};

  for (const definition of TABLE_DEFINITIONS) {
    const statement = database.prepare(definition.sourceSql);

    summaries[definition.name] = createSummaryFromIterable(statement.iterate(), definition.mapSource);
  }

  return Object.freeze(summaries);
};

const assertPostgresTargetReadyAndEmpty = async (database) => {
  const migrationResult = await database.query({
    name: "sqlite-import-target-schema-v1",

    text: `
          SELECT version, name
          FROM game.schema_migrations
          ORDER BY version ASC
        `,
  });

  if (migrationResult.rows.length !== POSTGRES_MIGRATIONS.length) {
    throw new Error("PostgreSQL target schema does not match the importer build.");
  }

  for (let index = 0; index < POSTGRES_MIGRATIONS.length; index += 1) {
    const expected = POSTGRES_MIGRATIONS[index];

    const actual = migrationResult.rows[index];

    if (Number(actual?.version) !== expected.version || actual?.name !== expected.name) {
      throw new Error("PostgreSQL target migration history does not match the importer build.");
    }
  }

  for (const definition of TABLE_DEFINITIONS) {
    const result = await database.query(`
        SELECT COUNT(*)::bigint AS count
        FROM game.${definition.name}
      `);

    const count = toSafeInteger(result.rows[0]?.count, `PostgreSQL ${definition.name} count`);

    if (count !== 0) {
      throw new Error(`PostgreSQL target table game.${definition.name} is not empty.`);
    }
  }
};

const insertPostgresBatch = async (database, definition, records) => {
  if (records.length === 0) {
    return;
  }

  const values = [];
  let parameterIndex = 1;

  const tuples = records.map((record) => {
    const recordValues = definition.toValues(record);

    const tuple = recordValues.map((value, columnIndex) => {
      values.push(value);

      const cast = definition.casts[columnIndex] ?? "";

      const placeholder = `$${parameterIndex}${cast}`;

      parameterIndex += 1;

      return placeholder;
    });

    return `(${tuple.join(", ")})`;
  });

  await database.query({
    text: `
      INSERT INTO game.${definition.name} (
        ${definition.insertColumns.join(", ")}
      )
      VALUES
        ${tuples.join(",\n        ")}
    `,

    values,
  });
};

const importSqliteTable = async (sqliteDatabase, postgresDatabase, definition, batchSize) => {
  const statement = sqliteDatabase.prepare(definition.sourceSql);

  let batch = [];

  for (const row of statement.iterate()) {
    batch.push(definition.mapSource(row));

    if (batch.length < batchSize) {
      continue;
    }

    await insertPostgresBatch(postgresDatabase, definition, batch);

    batch = [];
  }

  if (batch.length > 0) {
    await insertPostgresBatch(postgresDatabase, definition, batch);
  }
};

const summarizePostgresTarget = async (database) => {
  const summaries = {};

  for (const definition of TABLE_DEFINITIONS) {
    const result = await database.query(definition.targetSql);

    summaries[definition.name] = createSummaryFromIterable(result.rows, definition.mapTarget);
  }

  return Object.freeze(summaries);
};

const assertMatchingSummaries = (sourceSummary, targetSummary) => {
  for (const definition of TABLE_DEFINITIONS) {
    const tableName = definition.name;

    const source = sourceSummary[tableName];

    const target = targetSummary[tableName];

    if (!source || !target || source.count !== target.count || source.sha256 !== target.sha256) {
      throw new Error(`SQLite/PostgreSQL verification mismatch for table ${tableName}.`);
    }
  }
};

export const migrateSqliteBackupToPostgres = async ({
  sqlitePath,
  database,
  batchSize = DEFAULT_IMPORT_BATCH_SIZE,
} = {}) => {
  if (typeof sqlitePath !== "string" || sqlitePath === "" || !database || typeof database.transaction !== "function") {
    throw new TypeError("SQLite to PostgreSQL migration requires a SQLite path and transactional PostgreSQL database.");
  }

  if (!Number.isSafeInteger(batchSize) || batchSize <= 0 || batchSize > 1000) {
    throw new RangeError("SQLite import batch size must be between 1 and 1000.");
  }

  const sqliteDatabase = new DatabaseSync(sqlitePath, {
    readOnly: true,
    enableForeignKeyConstraints: true,
  });

  try {
    const sourceSchemaVersion = validateSqliteMigrationSource(sqliteDatabase);

    /*
     * PASS 1:
     * Every source row is validated and hashed
     * before PostgreSQL mutation begins.
     */
    const sourceSummary = summarizeSqliteSource(sqliteDatabase);

    const transactionResult = await database.transaction(async (postgresDatabase) => {
      await postgresDatabase.query("SET LOCAL lock_timeout = '30s'");

      await postgresDatabase.query(
        `
                SELECT pg_advisory_xact_lock(
                  $1::integer,
                  $2::integer
                )
              `,
        [POSTGRES_SCHEMA_LOCK_CLASS_ID, POSTGRES_SCHEMA_LOCK_OBJECT_ID],
      );

      await postgresDatabase.query("SET LOCAL ROLE nonameyet_owner");

      await assertPostgresTargetReadyAndEmpty(postgresDatabase);

      /*
       * PASS 2:
       * Dependency-safe order:
       * accounts
       * characters
       * character_names
       * chat_mutes
       * external_identities
       */
      for (const definition of TABLE_DEFINITIONS) {
        await importSqliteTable(sqliteDatabase, postgresDatabase, definition, batchSize);
      }

      /*
       * Verification happens BEFORE COMMIT.
       * Any mismatch throws and the global
       * PostgreSQL transaction rolls back.
       */
      const targetSummary = await summarizePostgresTarget(postgresDatabase);

      assertMatchingSummaries(sourceSummary, targetSummary);

      return Object.freeze({
        sourceSchemaVersion,
        tables: targetSummary,
      });
    });

    return transactionResult;
  } finally {
    sqliteDatabase.close();
  }
};
