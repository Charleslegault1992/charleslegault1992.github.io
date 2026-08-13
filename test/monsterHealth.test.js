import assert from "node:assert/strict";
import test from "node:test";

import { applyDamageToMonsterHealth } from "../src/combat/monsterHealth.js";

test("monster damage is capped at the remaining health", () => {
  const monster = { hp: 7 };

  const result = applyDamageToMonsterHealth(monster, 20);

  assert.deepEqual(result, {
    success: true,
    damageApplied: 7,
    hp: 0,
    didDie: true,
  });
  assert.equal(monster.hp, 0);
});

test("invalid monster damage leaves health unchanged", () => {
  const monster = { hp: 7 };

  const result = applyDamageToMonsterHealth(monster, 0);

  assert.deepEqual(result, {
    success: false,
    damageApplied: 0,
    hp: 7,
    didDie: false,
  });
  assert.equal(monster.hp, 7);
});
