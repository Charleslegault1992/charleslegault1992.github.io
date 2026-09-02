import assert from "node:assert/strict";
import test from "node:test";

import { createClientReplicationStore, getPlayerReconciliation } from "../src/network/clientReplicationStore.js";

const snapshot = {
  revision: 4,
  self: {
    uid: "player:one",
    x: 64,
    y: 64,
    z: 0,
    equipment: { backpack: { uid: 10, itemId: "bag", quantity: 1, content: [] } },
  },
  entities: { players: [], monsters: [], npcs: [], worldItems: [], groundEffects: [] },
  chunks: [{ key: "0:0:0", z: 0 }],
};

test("the client store applies ordered deltas and rejects a revision gap", () => {
  const store = createClientReplicationStore();
  assert.equal(store.applySnapshot(snapshot).success, true);
  assert.equal(
    store.applyDelta({
      baseRevision: 4,
      revision: 5,
      upserts: { self: { uid: "player:one", x: 128, y: 64, z: 0 } },
      removals: {},
      events: [{ type: "player-moved" }],
    }).success,
    true,
  );
  assert.equal(store.getSelf().x, 128);
  assert.equal(store.getSelf().equipment.backpack.uid, 10);
  assert.equal(store.applyDelta({ baseRevision: 7, revision: 8 }).reason, "revision-gap");
});

test("reconciliation corrects only a divergent authoritative position", () => {
  const correction = getPlayerReconciliation(
    { uid: "player:one", x: 192, y: 64, z: 0 },
    { uid: "player:one", x: 128, y: 64, z: 0 },
  );
  assert.deepEqual(correction, { requiresCorrection: true, position: { x: 128, y: 64, z: 0 } });
});
