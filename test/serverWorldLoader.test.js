import assert from "node:assert/strict";
import test from "node:test";

import { loadServerWorldMaps } from "../server/loadServerWorldMaps.js";

test("Node loads the same Tiled floors without Vite", async () => {
  const worldMapsByZ = await loadServerWorldMaps();

  assert.deepEqual([...worldMapsByZ.keys()].sort((first, second) => first - second), [-1, 0]);
  assert.ok(worldMapsByZ.get(0).chunksByKey.size > 0);
  assert.ok(worldMapsByZ.get(-1).chunksByKey.size > 0);
  assert.ok(worldMapsByZ.get(0).tilesets.length > 0);
});
