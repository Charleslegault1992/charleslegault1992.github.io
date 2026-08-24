import assert from "node:assert/strict";
import test from "node:test";

import { createInitialWorldItems } from "../src/world/initialWorldItems.js";

test("the initial online world contains the authored test item stack", () => {
  const items = createInitialWorldItems(0);

  assert.deepEqual(items.map((item) => item.itemId), [
    "smallBox",
    "smallBox",
    "box",
    "fireRune",
    "smallBox",
    "smallBox",
  ]);
  assert.equal(new Set(items.map((item) => item.uid)).size, items.length);
  assert.equal(items.every((item) => item.uid < 0 && item.z === 0), true);
});

test("the cave contains a runic test bag with every new rune", () => {
  const items = createInitialWorldItems(-1);
  const runeSatchel = items.find((item) => item.itemId === "runeSatchel");

  assert.ok(runeSatchel);
  assert.deepEqual(runeSatchel.content.map((item) => item.itemId), [
    "fireRune",
    "energyRune",
    "poisonRune",
    "iceRune",
    "smallHealingRune",
    "greatHealingRune",
    "fireFieldRune",
    "energyFieldRune",
    "poisonFieldRune",
    "iceFieldRune",
    "dissipationRune",
  ]);
});
