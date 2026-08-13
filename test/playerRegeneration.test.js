import assert from "node:assert/strict";
import test from "node:test";

import {
  advancePlayerRegeneration,
  startPlayerRegenerationTimers,
} from "../src/player/playerRegeneration.js";

const regenerationData = {
  healthAmount: 2,
  healthIntervalMs: 3000,
  manaAmount: 1,
  manaIntervalMs: 6000,
};

const createPlayer = () => ({
  hp: 5,
  maxHp: 10,
  mana: 2,
  maxMana: 10,
  sanity: 3,
  regeneration: {
    nextHealthRegenAt: 0,
    nextManaRegenAt: 0,
    nextSanityDecayAt: 0,
  },
});

test("player regeneration advances only the timers that are due", () => {
  const player = createPlayer();
  startPlayerRegenerationTimers(player, regenerationData, 1000);

  assert.equal(advancePlayerRegeneration(player, regenerationData, 4000), true);
  assert.equal(player.hp, 7);
  assert.equal(player.mana, 2);
  assert.equal(player.sanity, 3);
});

test("zero sanity stops regeneration and clears every timer", () => {
  const player = createPlayer();
  player.sanity = 0;
  startPlayerRegenerationTimers(player, regenerationData, 1000);

  assert.equal(advancePlayerRegeneration(player, regenerationData, 7000), false);
  assert.deepEqual(player.regeneration, {
    nextHealthRegenAt: 0,
    nextManaRegenAt: 0,
    nextSanityDecayAt: 0,
  });
});
