import test from "node:test";
import assert from "node:assert/strict";

import { createGameAction } from "../src/actions/gameAction.js";
import { createGameActionDispatcher } from "../src/actions/gameActionDispatcher.js";

test("the dispatcher rejects an action without a registered handler", () => {
  const dispatcher = createGameActionDispatcher();
  const action = createGameAction("test.unknown", { value: 1 });

  const result = dispatcher.dispatch(action);

  assert.equal(result.success, false);
  assert.equal(result.status, "rejected");
  assert.equal(result.reason, "unknown-action");
  assert.equal(result.requestId, action.requestId);
});

test("an action payload is isolated from later caller mutations", () => {
  const payload = { itemEntries: [{ itemId: "apple", quantity: 1 }] };
  const action = createGameAction("test.clone", payload);

  payload.itemEntries[0].quantity = 99;

  assert.equal(action.payload.itemEntries[0].quantity, 1);
});
