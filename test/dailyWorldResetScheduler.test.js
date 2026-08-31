import assert from "node:assert/strict";
import test from "node:test";

import {
  createDailyWorldResetScheduler,
  getNextDailyWorldResetAt,
} from "../server/dailyWorldResetScheduler.js";

test("daily world reset follows Toronto time in summer and winter", () => {
  assert.equal(
    getNextDailyWorldResetAt(Date.parse("2026-08-31T08:00:00.000Z")),
    Date.parse("2026-08-31T09:00:00.000Z"),
  );
  assert.equal(
    getNextDailyWorldResetAt(Date.parse("2026-08-31T10:00:00.000Z")),
    Date.parse("2026-09-01T09:00:00.000Z"),
  );
  assert.equal(
    getNextDailyWorldResetAt(Date.parse("2027-01-10T09:00:00.000Z")),
    Date.parse("2027-01-10T10:00:00.000Z"),
  );
});

test("daily world reset scheduler registers warnings and one reset", () => {
  const currentTimestamp = Date.parse("2026-08-31T08:30:00.000Z");
  const scheduledDelays = [];
  const clearedTimers = [];
  const scheduler = createDailyWorldResetScheduler({
    now: () => currentTimestamp,
    setTimer: (_callback, delay) => {
      scheduledDelays.push(delay);
      return scheduledDelays.length;
    },
    clearTimer: (timer) => clearedTimers.push(timer),
    onReset: () => {},
  });

  assert.equal(scheduler.nextResetAt, Date.parse("2026-08-31T09:00:00.000Z"));
  assert.deepEqual(scheduledDelays, [15 * 60 * 1000, 25 * 60 * 1000, 29 * 60 * 1000, 30 * 60 * 1000]);
  scheduler.stop();
  assert.deepEqual(clearedTimers, [1, 2, 3, 4]);
});
