import assert from "node:assert/strict";
import test from "node:test";

import { createRemoteEntityInterpolationStore } from "../src/network/remoteEntityInterpolationStore.js";

const createTestStore = (options = {}) =>
  createRemoteEntityInterpolationStore({
    maxSnapshotsPerEntity: 3,
    typeConfigs: {
      monsters: {
        minDelayMs: 0,
        baseDelayMs: 0,
        maxDelayMs: 0,
        extrapolationLimitMs: 0,
        maxHoldMs: 250,
      },
    },
    ...options,
  });

test("remote interpolation follows the authoritative movement timeline", () => {
  const store = createTestStore();
  store.recordServerTime(1000, 1000);
  store.pushSnapshot("monsters", { uid: 8, x: 0, y: 0, z: 0 }, { serverTime: 1000, sequence: 1 });
  store.pushSnapshot(
    "monsters",
    {
      uid: 8,
      x: 64,
      y: 0,
      z: 0,
      oldX: 0,
      oldY: 0,
      moveStartTime: 1000,
      moveDuration: 200,
      direction: "right",
    },
    { serverTime: 1100, sequence: 2 },
  );

  const renderState = store.getRenderState("monsters", 8, 1150);

  assert.equal(renderState.renderX, 48);
  assert.equal(renderState.renderY, 0);
  assert.equal(renderState.renderFromX, 0);
  assert.equal(renderState.renderToX, 64);
  assert.equal(renderState.renderSortY, 0);
  assert.equal(renderState.mode, "movement-timeline");
});

test("remote interpolation keeps the northern sort row until downward movement finishes", () => {
  const store = createTestStore();
  store.recordServerTime(1000, 1000);
  store.pushSnapshot(
    "monsters",
    {
      uid: 9,
      x: 64,
      y: 128,
      z: 0,
      oldX: 0,
      oldY: 64,
      moveStartTime: 1000,
      moveDuration: 200,
    },
    { serverTime: 1000, sequence: 1 },
  );

  assert.equal(store.getRenderState("monsters", 9, 1100).renderSortY, 64);
  assert.equal(store.getRenderState("monsters", 9, 1200).renderSortY, 128);
});

test("remote interpolation keeps a bounded number of snapshots per entity", () => {
  const store = createTestStore();
  store.recordServerTime(1000, 1000);

  for (let index = 0; index < 8; index++) {
    store.pushSnapshot(
      "monsters",
      { uid: 8, x: index * 64, y: 0, z: 0 },
      { serverTime: 1000 + index * 50, sequence: index },
    );
  }

  assert.equal(store.getDebugState().snapshotCountsByType.monsters <= 3, true);
});

test("remote interpolation resets an entity buffer when its floor changes", () => {
  const store = createTestStore();
  store.recordServerTime(1000, 1000);
  store.pushSnapshot("monsters", { uid: 8, x: 0, y: 0, z: 0 }, { serverTime: 1000, sequence: 1 });
  store.pushSnapshot("monsters", { uid: 8, x: 0, y: 0, z: -1 }, { serverTime: 1050, sequence: 2 });

  const debugState = store.getDebugState();
  const renderState = store.getRenderState("monsters", 8, 1050);

  assert.equal(debugState.snapshotCountsByType.monsters, 1);
  assert.equal(renderState.z, -1);
});
