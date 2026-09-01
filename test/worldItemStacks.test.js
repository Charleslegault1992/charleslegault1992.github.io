import assert from "node:assert/strict";
import test from "node:test";

import { createGroundItem } from "../src/items/itemFactory.js";
import {
  groundEffectsByUid,
  groundEffectUidByTileKey,
  worldItemsByUid,
  worldTileStacksByKey,
} from "../src/state/worldState.js";
import {
  getTopWorldItemAtTile,
  getWorldDynamicStackIndex,
  getWorldTileStackKey,
  rebuildWorldTileStacks,
} from "../src/world/worldItemStacks.js";

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

test("dynamic world stack keeps a field above old items and below newly placed items", (testContext) => {
  worldItemsByUid.clear();
  worldTileStacksByKey.clear();
  groundEffectsByUid.clear();
  groundEffectUidByTileKey.clear();
  testContext.after(() => {
    worldItemsByUid.clear();
    worldTileStacksByKey.clear();
    groundEffectsByUid.clear();
    groundEffectUidByTileKey.clear();
  });

  const bottomItem = createGroundItem("apple", 1, 64, 128, 0);
  const topItem = createGroundItem("cheese", 1, 64, 128, 0);
  const field = { uid: 400, groundEffectId: "fireField", x: 64, y: 128, z: 0, tileStackOrder: 20 };
  bottomItem.tileStackOrder = 10;
  topItem.tileStackOrder = 30;
  worldItemsByUid.set(bottomItem.uid, bottomItem);
  worldItemsByUid.set(topItem.uid, topItem);
  groundEffectsByUid.set(field.uid, field);
  groundEffectUidByTileKey.set(`${getWorldTileStackKey(64, 128, 0)}:field`, field.uid);
  rebuildWorldTileStacks();

  assert.equal(getWorldDynamicStackIndex(bottomItem, "item"), 0);
  assert.equal(getWorldDynamicStackIndex(field, "field"), 1);
  assert.equal(getWorldDynamicStackIndex(topItem, "item"), 2);

  groundEffectsByUid.delete(field.uid);
  groundEffectUidByTileKey.clear();
  assert.equal(getWorldDynamicStackIndex(bottomItem, "item"), 0);
  assert.equal(getWorldDynamicStackIndex(topItem, "item"), 1);
});
