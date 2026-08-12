import assert from "node:assert/strict";
import test from "node:test";

import { createItemInstance } from "../src/items/itemFactory.js";
import { isOpenableContainerItem } from "../src/items/itemModel.js";

test("a regular bag is openable without corpse decay state", () => {
  const bag = createItemInstance("bag", 1);

  assert.equal("decayStage" in bag, false);
  assert.equal(isOpenableContainerItem(bag), true);
});

test("a corpse stops being openable at its final decay stage", () => {
  const corpse = createItemInstance("ratCorpse", 1);

  corpse.decayStage = 2;

  assert.equal(isOpenableContainerItem(corpse), false);
});
