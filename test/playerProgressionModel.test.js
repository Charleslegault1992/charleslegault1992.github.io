import assert from "node:assert/strict";
import test from "node:test";

import { createItemInstance } from "../src/items/itemFactory.js";
import {
  applyPlayerLevelProgression,
  applyPlayerShieldingSkillProgression,
} from "../src/player/playerProgressionModel.js";
import { getPlayerExperienceProgressData, getSkillProgressData } from "../src/player/playerProgression.js";
import { createPlayerState } from "../src/state/playerState.js";

test("level progression never lowers a saved player level", () => {
  const player = createPlayerState();
  player.level = 1;
  player.experience = 0;

  const result = applyPlayerLevelProgression(player);

  assert.equal(player.level, 1);
  assert.deepEqual(result, { previousLevel: 1, nextLevel: 1, levelsGained: 0 });
  assert.equal(getPlayerExperienceProgressData(player).level, 1);
});

test("skill progress never lowers a saved skill level", () => {
  const player = createPlayerState();
  player.skills.mace.level = 2;
  player.skills.mace.experience = 0;

  assert.equal(getSkillProgressData("mace", player).level, 2);
});

test("shielding progression respects training and block attempt limits", () => {
  const player = createPlayerState();
  player.equipment.shield = createItemInstance("woodenShield", 1);
  player.skillTraining.lastEffectiveHitAt = 1000;
  const attackResult = { didHit: true, wasBlocked: true, finalDamage: 0 };

  const first = applyPlayerShieldingSkillProgression(player, attackResult, 2000);
  const second = applyPlayerShieldingSkillProgression(player, attackResult, 2000);
  const limited = applyPlayerShieldingSkillProgression(player, attackResult, 2000);

  assert.equal(first.skillKey, "shielding");
  assert.equal(second.skillKey, "shielding");
  assert.equal(limited, null);
  assert.ok(player.skills.shielding.experience > 100);
});
