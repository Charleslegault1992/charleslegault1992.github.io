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
