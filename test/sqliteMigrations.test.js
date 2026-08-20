import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { openGameDatabase } from "../server/persistence/sqliteDatabase.js";
import { runSqliteMigrations, SQLITE_MIGRATIONS } from "../server/persistence/sqliteMigrations.js";

test("SQLite migrations are ordered and idempotent", () => {
  const database = openGameDatabase({ databasePath: ":memory:" });
  const firstRows = database.prepare("SELECT version, name FROM schema_migrations ORDER BY version").all();
  runSqliteMigrations(database, SQLITE_MIGRATIONS, 5000);
  const secondRows = database.prepare("SELECT version, name FROM schema_migrations ORDER BY version").all();

  assert.deepEqual(secondRows, firstRows);
  assert.deepEqual(firstRows.map((row) => row.version), [1, 2, 3, 4, 5, 6]);
  assert.equal(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'accounts'").get().name, "accounts");
  assert.equal(
    database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'external_identities'").get().name,
    "external_identities",
  );
  assert.equal(
    database.prepare("SELECT name FROM pragma_table_info('accounts') WHERE name = 'email'").get().name,
    "email",
  );
  database.close();
});

test("a migrated SQLite database reopens at the same schema version", () => {
  const databasePath = join(tmpdir(), `nonameyet-${randomUUID()}.sqlite`);
  const firstDatabase = openGameDatabase({ databasePath });
  firstDatabase.close();
  const reopenedDatabase = openGameDatabase({ databasePath });
  const versions = reopenedDatabase.prepare("SELECT version FROM schema_migrations ORDER BY version").all();
  reopenedDatabase.close();
  unlinkSync(databasePath);

  assert.deepEqual(versions.map((row) => row.version), [1, 2, 3, 4, 5, 6]);
});
