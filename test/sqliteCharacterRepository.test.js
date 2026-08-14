import assert from "node:assert/strict";
import test from "node:test";

import { createSqliteCharacterRepository } from "../server/persistence/sqliteCharacterRepository.js";

test("SQLite character saves use optimistic versions", () => {
  const repository = createSqliteCharacterRepository({ databasePath: ":memory:" });
  const firstSave = repository.save("account-1", "hero", { uid: "player:hero", level: 1 }, null, 100);
  const update = repository.save("account-1", "hero", { uid: "player:hero", level: 2 }, firstSave.version, 200);
  const staleUpdate = repository.save("account-1", "hero", { uid: "player:hero", level: 3 }, firstSave.version, 300);

  assert.deepEqual(firstSave, { success: true, version: 1 });
  assert.deepEqual(update, { success: true, version: 2 });
  assert.equal(staleUpdate.reason, "version-conflict");
  assert.deepEqual(repository.load("account-1", "hero"), {
    snapshot: { uid: "player:hero", level: 2 },
    version: 2,
    updatedAt: 200,
  });
  repository.close();
});

test("SQLite reserves character names across accounts", () => {
  const repository = createSqliteCharacterRepository({ databasePath: ":memory:" });
  const first = repository.save("account-1", "first", { name: "Ari Vale", level: 1 }, null, 100);
  const duplicate = repository.save("account-2", "second", { name: "ari vale", level: 1 }, null, 100);

  assert.equal(first.success, true);
  assert.equal(duplicate.reason, "character-name-taken");
  assert.equal(repository.load("account-2", "second"), null);
  repository.close();
});
