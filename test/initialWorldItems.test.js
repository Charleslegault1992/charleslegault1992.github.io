import assert from "node:assert/strict";
import test from "node:test";

import { getItemData } from "../src/items/itemModel.js";
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
    "iceRune",
    "energyRune",
    "poisonRune",
    "smallHealingRune",
    "greatHealingRune",
    "fireFieldRune",
    "iceFieldRune",
    "energyFieldRune",
    "poisonFieldRune",
    "dissipationRune",
  ]);
});

test("every test rune maps to its matching action and atlas icon", () => {
  const expectedRunes = {
    fireRune: ["attackRune", 25, 0],
    iceRune: ["attackRune", 25, 8],
    energyRune: ["attackRune", 25, 1],
    poisonRune: ["attackRune", 25, 2],
    smallHealingRune: ["healRune", 25, 3],
    greatHealingRune: ["healRune", 26, 2],
    energyFieldRune: ["createField", 26, 9],
    poisonFieldRune: ["createField", 26, 0],
    iceFieldRune: ["createField", 26, 5],
    fireFieldRune: ["createField", 26, 10],
    dissipationRune: ["dispelField", 26, 6],
  };

  for (const [itemId, [action, atlasRow, atlasCol]] of Object.entries(expectedRunes)) {
    const itemData = getItemData(itemId);
    assert.equal(itemData.use.action, action, `${itemId} action`);
    assert.equal(itemData.render.parts[0].atlasRow, atlasRow, `${itemId} atlas row`);
    assert.equal(itemData.render.parts[0].atlasCol, atlasCol, `${itemId} atlas column`);
  }
});
