import assert from "node:assert/strict";
import test from "node:test";

import { getPlayerMoveCooldown, getPlayerMovementTiming } from "../src/player/playerMovementTiming.js";

test("player movement cooldown uses level and speed for both client and server", () => {
  assert.equal(getPlayerMoveCooldown({ level: 0, speed: 1 }), 199);
  assert.equal(getPlayerMoveCooldown({ level: 50, speed: 1 }), 149);
  assert.equal(getPlayerMoveCooldown({ level: 120, speed: 1 }), 89);
});

test("player movement timing derives cardinal animation and cooldown from the shared speed", () => {
  const timing = getPlayerMovementTiming(
    { level: 50, speed: 1 },
    { fromX: 0, fromY: 0, toX: 64, toY: 0 },
  );

  assert.deepEqual(timing, { duration: 149, cooldown: 149 });
});
