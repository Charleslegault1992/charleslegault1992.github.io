import assert from "node:assert/strict";
import test from "node:test";

import {
  createPostgresPoolPressureMonitor,
} from "../server/persistence/postgresPoolPressureMonitor.js";

const createHarness = (
  initialStats,
) => {
  let stats = {
    ...initialStats,
  };

  let callback = null;
  let clearCalls = 0;
  let unrefCalls = 0;

  const logs = [];
  const warnings = [];

  const timer = {
    unref() {
      unrefCalls += 1;
    },
  };

  const monitor =
    createPostgresPoolPressureMonitor({
      getPoolStats() {
        return {
          ...stats,
        };
      },

      logger: {
        log(message) {
          logs.push(message);
        },

        warn(message) {
          warnings.push(
            message,
          );
        },
      },

      setIntervalFn(
        nextCallback,
      ) {
        callback =
          nextCallback;

        return timer;
      },

      clearIntervalFn(
        receivedTimer,
      ) {
        assert.equal(
          receivedTimer,
          timer,
        );

        clearCalls += 1;
      },
    });

  return {
    monitor,
    logs,
    warnings,

    setStats(nextStats) {
      stats = {
        ...nextStats,
      };
    },

    tick() {
      assert.equal(
        typeof callback,
        "function",
      );

      return callback();
    },

    getClearCalls() {
      return clearCalls;
    },

    getUnrefCalls() {
      return unrefCalls;
    },
  };
};

test("PostgreSQL pool monitor stays silent while the pool is healthy", () => {
  const harness =
    createHarness({
      total: 3,
      idle: 2,
      waiting: 0,
    });

  harness.monitor.start();

  harness.tick();
  harness.tick();

  assert.deepEqual(
    harness.warnings,
    [],
  );

  assert.deepEqual(
    harness.logs,
    [],
  );

  assert.equal(
    harness.getUnrefCalls(),
    1,
  );
});

test("PostgreSQL pool monitor reports pressure only once while requests remain queued", () => {
  const harness =
    createHarness({
      total: 8,
      idle: 0,
      waiting: 3,
    });

  harness.monitor.start();

  harness.tick();
  harness.tick();
  harness.tick();

  assert.equal(
    harness.warnings.length,
    1,
  );

  assert.match(
    harness.warnings[0],
    /3 waiting/,
  );
});

test("PostgreSQL pool monitor reports recovery and stops cleanly", () => {
  const harness =
    createHarness({
      total: 8,
      idle: 0,
      waiting: 2,
    });

  harness.monitor.start();

  harness.tick();

  harness.setStats({
    total: 5,
    idle: 3,
    waiting: 0,
  });

  const recovered =
    harness.tick();

  assert.equal(
    recovered.pressured,
    false,
  );

  assert.equal(
    harness.logs.length,
    1,
  );

  assert.match(
    harness.logs[0],
    /recovered/,
  );

  harness.monitor.stop();

  assert.equal(
    harness.getClearCalls(),
    1,
  );
});