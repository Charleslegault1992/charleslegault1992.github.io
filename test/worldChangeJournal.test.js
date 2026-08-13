import assert from "node:assert/strict";
import test from "node:test";

import { createWorldChangeJournal } from "../src/simulation/worldChangeJournal.js";

test("the world journal returns contiguous deltas after a known revision", () => {
  const journal = createWorldChangeJournal({ initialRevision: 10, maxEntries: 3 });
  journal.record({ serverTime: 100, upserts: { monsters: [{ uid: 1, hp: 10 }] } });
  journal.record({ serverTime: 110, removals: { monsters: [1] } });

  const deltas = journal.getDeltasAfter(10);
  assert.deepEqual(deltas.map((delta) => [delta.baseRevision, delta.revision]), [[10, 11], [11, 12]]);
});

test("the world journal requests a snapshot when the known revision expired", () => {
  const journal = createWorldChangeJournal({ maxEntries: 2 });
  journal.record({ serverTime: 1 });
  journal.record({ serverTime: 2 });
  journal.record({ serverTime: 3 });

  assert.equal(journal.getDeltasAfter(0), null);
  assert.equal(journal.getDeltasAfter(3).length, 0);
});
