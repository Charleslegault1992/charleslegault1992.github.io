import assert from "node:assert/strict";
import test from "node:test";

import { applyPlayerDeathState } from "../src/player/playerDeath.js";

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
