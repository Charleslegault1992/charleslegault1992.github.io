import assert from "node:assert/strict";
import test from "node:test";

import { createSpatialEntityStore } from "../server/spatialEntityStore.js";

test("spatial entity store updates chunk membership without cloning entities", () => {
  const store = createSpatialEntityStore();
  const entity = { uid: 1, x: 0, y: 0, z: 0 };
  assert.equal(store.add(entity), true);
  assert.equal(store.getInChunkKeys(["0:0:0"])[0], entity);

  store.updatePosition(1, 17 * 64, 0, 0);

  assert.equal(store.getInChunkKeys(["0:0:0"]).length, 0);
  assert.equal(store.getInChunkKeys(["0:1:0"])[0], entity);
  assert.equal(store.getAt(17 * 64, 0, 0), entity);
});
