import assert from "node:assert/strict";
import test from "node:test";

import { applyPlayerDeathState } from "../src/player/playerDeath.js";
import { getExperienceRequiredForLevel } from "../src/player/playerProgression.js";

test("player death applies its penalty and resets every world position", () => {
  const player = {
    uid: "player-1",
    hp: 0,
    maxHp: 120,
    experience: 999,
    x: 64,
    y: 128,
    z: -1,
    oldX: 64,
    oldY: 128,
    renderX: 64,
    renderY: 128,
    moveStartTime: 10,
    moveDuration: 200,
  };

  const result = applyPlayerDeathState(player, { x: 640, y: 320, z: 0 });

  assert.equal(result.success, true);
  assert.equal(result.changes.experienceLost, 100);
  assert.equal(player.experience, 899);
  assert.equal(player.hp, 120);
  assert.deepEqual(
    { x: player.x, y: player.y, z: player.z, oldX: player.oldX, oldY: player.oldY },
    { x: 640, y: 320, z: 0, oldX: 640, oldY: 320 },
  );
});

test("player death recalculates a lost level and its derived stats", () => {
  const player = {
    uid: "player-level-loss",
    classId: "noClass",
    level: 5,
    hp: 0,
    maxHp: 125,
    mana: 25,
    maxMana: 25,
    capacity: 400,
    experience: getExperienceRequiredForLevel(5),
    x: 64,
    y: 64,
    z: 0,
  };

  const result = applyPlayerDeathState(player, { x: 128, y: 128, z: 0 });

  assert.equal(result.success, true);
  assert.equal(player.level, 4);
  assert.equal(player.maxHp, 120);
  assert.equal(player.maxMana, 20);
  assert.equal(player.capacity, 390);
  assert.equal(player.hp, 120);
  assert.equal(result.changes.levelLoss.levelsLost, 1);
});
