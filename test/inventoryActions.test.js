import test from "node:test";
import assert from "node:assert/strict";

import { createGameActionDispatcher } from "../src/actions/gameActionDispatcher.js";
import { createItemInstance } from "../src/items/itemFactory.js";
import {
  createInsertItemsAction,
  createMoveItemAction,
  INVENTORY_ACTION_REASON,
  registerInventoryActionHandlers,
} from "../src/inventory/inventoryActions.js";

const createDispatcher = () => {
  const dispatcher = createGameActionDispatcher();
  registerInventoryActionHandlers(dispatcher);
  return dispatcher;
};

const dispatchInsert = (dispatcher, bag, itemEntries, remainingCapacity = Number.MAX_SAFE_INTEGER) => {
  const action = createInsertItemsAction(bag.uid, itemEntries);
  return dispatcher.dispatch(action, {
    findContainerByUid(containerUid) {
      return containerUid === bag.uid ? bag : null;
    },
    getRemainingCapacity() {
      return remainingCapacity;
    },
  });
};

test("an insertion fills an existing stack before creating another stack", () => {
  const dispatcher = createDispatcher();
  const bag = createItemInstance("bag", 1);
  bag.content[0] = createItemInstance("goldCoin", 80);

  const result = dispatchInsert(dispatcher, bag, [{ itemId: "goldCoin", quantity: 50 }]);

  assert.equal(result.success, true);
  assert.equal(bag.content[0].quantity, 100);
  assert.equal(bag.content[1].itemId, "goldCoin");
  assert.equal(bag.content[1].quantity, 30);
});

test("a capacity rejection leaves the container unchanged", () => {
  const dispatcher = createDispatcher();
  const bag = createItemInstance("bag", 1);

  const result = dispatchInsert(dispatcher, bag, [{ itemId: "apple", quantity: 1 }], 0);

  assert.equal(result.success, false);
  assert.equal(result.reason, INVENTORY_ACTION_REASON.capacityExceeded);
  assert.equal(bag.content.every((item) => item === null), true);
});

test("a full container rejection leaves every slot unchanged", () => {
  const dispatcher = createDispatcher();
  const bag = createItemInstance("bag", 1);
  for (let slotIndex = 0; slotIndex < 8; slotIndex++) {
    bag.content[slotIndex] = createItemInstance("sword", 1);
  }
  const originalItems = [...bag.content];

  const result = dispatchInsert(dispatcher, bag, [{ itemId: "apple", quantity: 1 }]);

  assert.equal(result.success, false);
  assert.equal(result.reason, INVENTORY_ACTION_REASON.noRoom);
  assert.deepEqual(bag.content, originalItems);
});

test("a move action preserves its serializable source and destination contract", () => {
  const dispatcher = createDispatcher();
  const source = { locationType: "containerSlot", parentContainerUid: 10, slotIndex: 2 };
  const destination = { locationType: "equipmentSlot", equipmentSlotName: "weapon" };
  const action = createMoveItemAction(source, destination, 25);

  const result = dispatcher.dispatch(action, {
    executeMove(payload) {
      assert.deepEqual(payload.source, source);
      assert.deepEqual(payload.destination, destination);
      assert.equal(payload.itemUid, 25);
      return { success: true, changes: { itemUid: 25 } };
    },
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.changes, { itemUid: 25 });
});

test("a rejected local move keeps the domain reason", () => {
  const dispatcher = createDispatcher();
  const action = createMoveItemAction(
    { locationType: "worldItem", itemUid: 25 },
    { locationType: "worldTile", x: 64, y: 128, z: 0 },
    25,
  );

  const result = dispatcher.dispatch(action, {
    executeMove() {
      return { success: false, reason: INVENTORY_ACTION_REASON.itemChanged };
    },
  });

  assert.equal(result.success, false);
  assert.equal(result.reason, INVENTORY_ACTION_REASON.itemChanged);
});
