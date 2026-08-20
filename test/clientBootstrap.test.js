import test from "node:test";
import assert from "node:assert/strict";

import { createClientBootstrap } from "../src/core/clientBootstrap.js";

test("the client bootstrap runs phases in order and shares their context", async () => {
  const runtimeState = { isStarting: false, isStarted: false };
  const calls = [];
  const bootstrap = createClientBootstrap({
    runtimeState,
    onPhaseStarted: ({ phase }) => calls.push(`start:${phase.name}`),
    onPhaseCompleted: ({ phase }) => calls.push(`done:${phase.name}`),
    phases: [
      {
        name: "data",
        run() {
          calls.push("data");
          return { world: "loaded" };
        },
      },
      {
        name: "renderer",
        run(context) {
          calls.push(context.world);
          return { renderer: "ready" };
        },
      },
    ],
    onStarted(context) {
      calls.push(context.renderer);
    },
  });

  const result = await bootstrap.start();

  assert.equal(result.success, true);
  assert.deepEqual(calls, [
    "start:data",
    "data",
    "done:data",
    "start:renderer",
    "loaded",
    "done:renderer",
    "ready",
  ]);
  assert.equal(runtimeState.isStarted, true);
  assert.equal(runtimeState.isStarting, false);
});

test("the client bootstrap rejects a duplicate start", async () => {
  const runtimeState = { isStarting: false, isStarted: false };
  let releasePhase;
  const bootstrap = createClientBootstrap({
    runtimeState,
    phases: [
      {
        name: "waiting",
        run: () => new Promise((resolve) => {
          releasePhase = resolve;
        }),
      },
    ],
  });

  const firstStart = bootstrap.start();
  const duplicateResult = await bootstrap.start();
  releasePhase();
  await firstStart;

  assert.equal(duplicateResult.success, false);
  assert.equal(duplicateResult.reason, "already-started");
});
