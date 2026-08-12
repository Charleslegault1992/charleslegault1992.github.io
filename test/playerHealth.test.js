import assert from "node:assert/strict";
import test from "node:test";

import { applyDamageToPlayer } from "../src/combat/playerHealth.js";

test("player damage is clamped and reports death once health reaches zero", () => {
  const player = { hp: 12 };

  const result = applyDamageToPlayer(player, 50);

  assert.equal(result.success, true);
  assert.equal(result.damageApplied, 12);
  assert.equal(result.hp, 0);
  assert.equal(result.didDie, true);
  assert.equal(player.hp, 0);
});

