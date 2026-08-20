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

test("spatial entity store refreshes configured stack order after an entity is re-added", () => {
  const store = createSpatialEntityStore({ stackOrderField: "tileStackOrder" });
  const first = { uid: 1, x: 0, y: 0, z: 0 };
  const second = { uid: 2, x: 64, y: 0, z: 0 };

  assert.equal(store.add(first), true);
  assert.equal(store.add(second), true);
  const previousFirstOrder = first.tileStackOrder;
  assert.ok(second.tileStackOrder > previousFirstOrder);

  assert.equal(store.remove(first.uid), true);
  assert.equal(store.add(first), true);
  assert.ok(first.tileStackOrder > second.tileStackOrder);
});
