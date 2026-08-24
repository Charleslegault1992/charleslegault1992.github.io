import assert from "node:assert/strict";
import test from "node:test";

import { createItemCooldownState } from "../src/items/itemCooldown.js";

test("item cooldown state can synchronize authoritative server end times", () => {
  const cooldowns = createItemCooldownState();

  cooldowns.synchronize({ item: 1500, rune: 3000, spell: 0 });

  assert.equal(cooldowns.isReady("rune", 1000), false);
  assert.equal(cooldowns.getRemainingRatio("rune", 2000), 0.5);
  assert.equal(cooldowns.isReady("spell", 1000), true);
});
