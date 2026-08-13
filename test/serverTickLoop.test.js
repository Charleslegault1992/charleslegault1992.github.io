import assert from "node:assert/strict";
import test from "node:test";

import { createFixedStepClock } from "../server/serverTickLoop.js";

test("the server clock advances simulation with fixed duration steps", () => {
  const ticks = [];
  const clock = createFixedStepClock({ tickRateHz: 20, onTick: (now, stepMs) => ticks.push({ now, stepMs }) });

  clock.advance(1000);
  clock.advance(1125);

  assert.equal(ticks.length, 2);
  assert.deepEqual(ticks.map((tick) => tick.stepMs), [50, 50]);
  assert.deepEqual(ticks.map((tick) => tick.now), [1050, 1100]);
});

test("the server clock caps catch-up work after a long pause", () => {
  let tickCount = 0;
  const clock = createFixedStepClock({ tickRateHz: 10, maxCatchUpSteps: 3, onTick: () => tickCount++ });

  clock.advance(0);
  assert.equal(clock.advance(1000), 3);
  assert.equal(tickCount, 3);
});
