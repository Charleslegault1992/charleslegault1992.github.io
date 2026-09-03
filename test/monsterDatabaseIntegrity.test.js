import assert from "node:assert/strict";
import test from "node:test";

import { ATLAS_CELL_SIZE, ATLAS_PADDING } from "../src/core/gameConstants.js";
import { monstersDatabase } from "../src/data/monstersDatabase.js";
import { getItemData, getItemRenderData } from "../src/items/itemModel.js";

test("every monster references valid corpse and loot items", () => {
  for (const monster of Object.values(monstersDatabase)) {
    assert.ok(getItemData(monster.corpseItemId), `${monster.monsterId} has an invalid corpse`);
    for (const loot of monster.loot) {
      assert.ok(getItemData(loot.itemId), `${monster.monsterId} has invalid loot ${loot.itemId}`);
    }
  }
});

test("village monster strength and corpse decay frames stay ordered", () => {
  const { rat, frog, wildboar, spider } = monstersDatabase;
  assert.ok(frog.maxHp > rat.maxHp);
  assert.ok(wildboar.maxHp > frog.maxHp);
  assert.ok(wildboar.maxHp < spider.maxHp);

  assert.equal(
    getItemRenderData({ itemId: "frogCorpse", decayStage: 2 })[0].sourceX,
    17 * ATLAS_CELL_SIZE + ATLAS_PADDING,
  );
  assert.equal(
    getItemRenderData({ itemId: "wildBoarCorpse", decayStage: 2 })[0].sourceX,
    21 * ATLAS_CELL_SIZE + ATLAS_PADDING,
  );
});
