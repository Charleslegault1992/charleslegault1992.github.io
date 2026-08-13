import assert from "node:assert/strict";
import test from "node:test";

import { createGameAction } from "../src/actions/gameAction.js";
import { createGameActionDispatcher } from "../src/actions/gameActionDispatcher.js";
import {
  createUseItemAction,
  ITEM_USE_ACTION_REASON,
  ITEM_USE_ACTION_TYPE,
  registerItemUseActionHandlers,
} from "../src/items/itemUseActions.js";

test("an item use action contains only serializable item and target identities", () => {
  const action = createUseItemAction({
    source: { locationType: "containerSlot", parentContainerUid: 10, slotIndex: 2 },
    itemUid: 44,
    target: { targetType: "monster", monsterUid: 91 },
    requestedAt: 500,
  });

  assert.equal(action.type, ITEM_USE_ACTION_TYPE.useItem);
  assert.doesNotThrow(() => JSON.stringify(action));
  assert.deepEqual(action.payload.target, { targetType: "monster", monsterUid: 91 });
});

test("the item use handler rejects a forged invalid location before execution", () => {
  const dispatcher = createGameActionDispatcher();
  registerItemUseActionHandlers(dispatcher);
  let executionCount = 0;
  const forgedAction = createGameAction(ITEM_USE_ACTION_TYPE.useItem, {
    source: { locationType: "containerSlot", parentContainerUid: "fake", slotIndex: -1 },
    itemUid: 44,
    target: null,
    requestedAt: 500,
  });

  const result = dispatcher.dispatch(forgedAction, {
    executeUseItem: () => {
      executionCount += 1;
      return { success: true };
    },
  });

  assert.equal(result.reason, ITEM_USE_ACTION_REASON.invalidRequest);
  assert.equal(executionCount, 0);
});

test("the item use handler preserves authoritative rejection details", () => {
  const dispatcher = createGameActionDispatcher();
  registerItemUseActionHandlers(dispatcher);
  const action = createUseItemAction({
    source: { locationType: "equipmentSlot", equipmentSlotName: "ammo" },
    itemUid: 7,
    requestedAt: 600,
  });

  const result = dispatcher.dispatch(action, {
    executeUseItem: () => ({
      success: false,
      reason: "cooldown",
      changes: { remainingMs: 250 },
    }),
  });

  assert.equal(result.reason, "cooldown");
  assert.deepEqual(result.changes, { remainingMs: 250 });
});
