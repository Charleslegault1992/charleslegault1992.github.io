import assert from "node:assert/strict";
import test from "node:test";

import { createServerPlayerInventory } from "../server/serverPlayerInventory.js";
import { createSpatialEntityStore } from "../server/spatialEntityStore.js";
import { createGroundItem, createItemInstance } from "../src/items/itemFactory.js";

test("nested world containers become inaccessible when their root is too far away", () => {
  const apple = createItemInstance("apple", 1);
  const innerBag = createItemInstance("bag", 1, [apple]);
  const outerBag = createGroundItem("bag", 1, 0, 0, 0, [innerBag]);
  const worldItems = createSpatialEntityStore({ stackOrderField: "tileStackOrder" });
  worldItems.add(outerBag);
  const player = { x: 0, y: 0, z: 0, equipment: {} };
  const inventory = createServerPlayerInventory({ player, worldMapsByZ: new Map(), worldItems });
  const appleLocation = {
    locationType: "containerSlot",
    parentContainerUid: innerBag.uid,
    slotIndex: 0,
  };

  assert.equal(inventory.canUseItemSource(appleLocation, apple), true);

  player.x = 2 * 64;

  assert.equal(inventory.canUseItemSource(appleLocation, apple), false);
});

test("distant nested world items cannot be moved or split through stale locations", () => {
  const gold = createItemInstance("goldCoin", 10);
  const innerBag = createItemInstance("bag", 1, [gold]);
  const outerBag = createGroundItem("bag", 1, 0, 0, 0, [innerBag]);
  const worldItems = createSpatialEntityStore({ stackOrderField: "tileStackOrder" });
  worldItems.add(outerBag);
  const player = { x: 2 * 64, y: 0, z: 0, equipment: {} };
  const inventory = createServerPlayerInventory({ player, worldMapsByZ: new Map(), worldItems });
  const source = { locationType: "containerSlot", parentContainerUid: innerBag.uid, slotIndex: 0 };

  const moveResult = inventory.executeMove({
    source,
    destination: { locationType: "worldTile", x: player.x, y: player.y, z: player.z },
    itemUid: gold.uid,
  });
  const splitResult = inventory.splitItemStack({ source, itemUid: gold.uid, splitQuantity: 5 });

  assert.equal(moveResult.reason, "invalid-source");
  assert.equal(splitResult.reason, "invalid-source");
  assert.equal(innerBag.content[0], gold);
  assert.equal(gold.quantity, 10);
});
