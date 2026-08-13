import assert from "node:assert/strict";
import test from "node:test";

import { createPlayerState } from "../src/state/playerState.js";

test("each player state owns independent nested data", () => {
  const firstPlayer = createPlayerState();
  const secondPlayer = createPlayerState();

  firstPlayer.uid = "first";
  firstPlayer.skills.sword.experience += 50;
  firstPlayer.spellbook.learnedSpellIds.push("test-spell");

  assert.notEqual(firstPlayer.uid, secondPlayer.uid);
  assert.notEqual(firstPlayer.skills.sword.experience, secondPlayer.skills.sword.experience);
  assert.equal(secondPlayer.spellbook.learnedSpellIds.includes("test-spell"), false);
});
