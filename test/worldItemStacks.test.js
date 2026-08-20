import assert from "node:assert/strict";
import test from "node:test";

import { createGroundItem } from "../src/items/itemFactory.js";
import { worldItemsByUid, worldTileStacksByKey } from "../src/state/worldState.js";
import { getTopWorldItemAtTile, rebuildWorldTileStacks } from "../src/world/worldItemStacks.js";

test("world item stacks rebuild from authoritative tile stack order", (testContext) => {
  worldItemsByUid.clear();
  worldTileStacksByKey.clear();
  testContext.after(() => {
    worldItemsByUid.clear();
    worldTileStacksByKey.clear();
  });

  const topItem = createGroundItem("apple", 1, 64, 128, 0);
  const bottomItem = createGroundItem("cheese", 1, 64, 128, 0);
  topItem.tileStackOrder = 20;
  bottomItem.tileStackOrder = 10;

  worldItemsByUid.set(topItem.uid, topItem);
  worldItemsByUid.set(bottomItem.uid, bottomItem);
  rebuildWorldTileStacks();

  assert.equal(getTopWorldItemAtTile(64, 128, 0)?.uid, topItem.uid);
});
