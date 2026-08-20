import assert from "node:assert/strict";
import test from "node:test";

import { GAMEPLAY_ACTION_TYPE } from "../src/actions/gameplayActions.js";
import { createClientReplicationStore } from "../src/network/clientReplicationStore.js";
import { createRemoteGameStateBridge } from "../src/network/remoteGameStateBridge.js";
import { remoteEntityInterpolationStore } from "../src/network/remoteEntityInterpolationStore.js";

const createTransportHarness = (replicationStore) => {
  const listeners = new Set();
  return {
    transport: {
      getReplicationStore: () => replicationStore,
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    publish(event) {
      for (const listener of listeners) {
        listener(event);
      }
    },
  };
};

test("the remote state bridge mutates runtime state without replacing stable entity references", () => {
  const replicationStore = createClientReplicationStore();
  const harness = createTransportHarness(replicationStore);
  const playerState = { uid: "local", renderX: 0, renderY: 0 };
  const existingMonster = { uid: 8, hp: 20, renderX: 64 };
  const entityMaps = {
    players: new Map(),
    monsters: new Map([[8, existingMonster]]),
    npcs: new Map(),
    worldItems: new Map(),
    groundEffects: new Map(),
  };
  let appliedRevision = null;
  createRemoteGameStateBridge({
    transport: harness.transport,
    playerState,
    entityMaps,
    onStateApplied: ({ revision }) => {
      appliedRevision = revision;
    },
  });

  const snapshot = {
    revision: 1,
    self: { uid: "player:one", x: 128, y: 64, z: 0, hp: 100 },
    entities: {
      players: [],
      monsters: [{ uid: 8, monsterId: "rat", x: 192, y: 64, z: 0, hp: 12 }],
      npcs: [],
      worldItems: [{ uid: 4, itemId: "apple", quantity: 1, x: 64, y: 64, z: 0 }],
      groundEffects: [],
    },
    chunks: [],
  };
  const result = replicationStore.applySnapshot(snapshot);
  harness.publish({ type: "server.snapshot", result, predictedSelf: null });

  assert.equal(playerState.uid, "player:one");
  assert.equal(playerState.renderX, 128);
  assert.equal(entityMaps.monsters.get(8), existingMonster);
  assert.equal(existingMonster.hp, 12);
  assert.equal(entityMaps.worldItems.get(4).itemId, "apple");
  assert.equal(appliedRevision, 1);
});

test("the remote state bridge removes entities that leave the replicated interest area", () => {
  const replicationStore = createClientReplicationStore();
  const harness = createTransportHarness(replicationStore);
  const entityMaps = {
    players: new Map(),
    monsters: new Map([[8, { uid: 8 }]]),
    npcs: new Map(),
    worldItems: new Map(),
    groundEffects: new Map(),
  };
  createRemoteGameStateBridge({ transport: harness.transport, playerState: {}, entityMaps });
  const result = replicationStore.applySnapshot({
    revision: 1,
    self: { uid: "player:one", x: 0, y: 0, z: 0 },
    entities: { players: [], monsters: [], npcs: [], worldItems: [], groundEffects: [] },
    chunks: [],
  });
  harness.publish({ type: "server.snapshot", result });

  assert.equal(entityMaps.monsters.size, 0);
});

test("the remote state bridge preserves equipment and container references while applying item changes", () => {
  const replicationStore = createClientReplicationStore();
  const harness = createTransportHarness(replicationStore);
  const apple = { uid: 12, itemId: "apple", quantity: 1 };
  const backpack = { uid: 11, itemId: "bag", quantity: 1, content: [apple, null] };
  const equipment = { backpack, weapon: null };
  const playerState = { uid: "local", equipment };
  const entityMaps = {
    players: new Map(),
    monsters: new Map(),
    npcs: new Map(),
    worldItems: new Map(),
    groundEffects: new Map(),
  };
  createRemoteGameStateBridge({ transport: harness.transport, playerState, entityMaps });

  const result = replicationStore.applySnapshot({
    revision: 1,
    self: {
      uid: "player:one",
      x: 0,
      y: 0,
      z: 0,
      equipment: {
        backpack: { uid: 11, itemId: "bag", quantity: 1, content: [null, apple] },
        weapon: null,
      },
    },
    entities: { players: [], monsters: [], npcs: [], worldItems: [], groundEffects: [] },
    chunks: [],
  });
  harness.publish({ type: "server.snapshot", result });

  assert.equal(playerState.equipment, equipment);
  assert.equal(playerState.equipment.backpack, backpack);
  assert.equal(playerState.equipment.backpack.content[1], apple);
  assert.equal(playerState.equipment.backpack.content[0], null);
});

test("an acknowledged movement keeps the local prediction animation timing", () => {
  const replicationStore = createClientReplicationStore();
  const harness = createTransportHarness(replicationStore);
  const playerState = { uid: "local", x: 0, y: 0, z: 0, renderX: 0, renderY: 0 };
  const entityMaps = {
    players: new Map(),
    monsters: new Map(),
    npcs: new Map(),
    worldItems: new Map(),
    groundEffects: new Map(),
  };
  createRemoteGameStateBridge({ transport: harness.transport, playerState, entityMaps });

  let result = replicationStore.applySnapshot({
    revision: 1,
    self: { uid: "player:one", x: 0, y: 0, z: 0 },
    entities: { players: [], monsters: [], npcs: [], worldItems: [], groundEffects: [] },
    chunks: [],
  });
  harness.publish({ type: "server.snapshot", result, hasPendingMovementPredictions: false });

  harness.publish({
    type: "prediction-updated",
    action: { type: GAMEPLAY_ACTION_TYPE.movePlayer },
    predictedSelf: {
      uid: "player:one",
      x: 64,
      y: 0,
      z: 0,
      oldX: 0,
      oldY: 0,
      moveStartTime: 1000,
      moveDuration: 200,
      direction: "right",
    },
    hasPendingMovementPredictions: true,
  });
  playerState.renderX = 24;

  result = replicationStore.applyDelta({
    baseRevision: 1,
    revision: 2,
    acknowledgedActionRequestId: "move-1",
    upserts: {
      self: {
        uid: "player:one",
        x: 64,
        y: 0,
        z: 0,
        oldX: 0,
        oldY: 0,
        moveStartTime: 1180,
        moveDuration: 200,
        direction: "right",
      },
    },
    removals: {},
    events: [{ type: "player-moved" }],
  });
  harness.publish({
    type: "server.delta",
    result,
    predictedSelf: replicationStore.getSelf(),
    hasPendingMovementPredictions: false,
  });

  assert.equal(playerState.x, 64);
  assert.equal(playerState.renderX, 24);
  assert.equal(playerState.oldX, 0);
  assert.equal(playerState.moveStartTime, 1000);
  assert.equal(playerState.moveDuration, 200);
});

test("a local movement prediction does not clear remote interpolation buffers", () => {
  remoteEntityInterpolationStore.clear();
  const replicationStore = createClientReplicationStore();
  const harness = createTransportHarness(replicationStore);
  const playerState = { uid: "player:one", x: 0, y: 0, z: 0, renderX: 0, renderY: 0 };
  const entityMaps = {
    players: new Map(),
    monsters: new Map(),
    npcs: new Map(),
    worldItems: new Map(),
    groundEffects: new Map(),
  };
  createRemoteGameStateBridge({ transport: harness.transport, playerState, entityMaps });

  const result = replicationStore.applySnapshot({
    revision: 1,
    serverTime: 1000,
    self: { uid: "player:one", x: 0, y: 0, z: 0 },
    entities: {
      players: [],
      monsters: [{ uid: 8, monsterId: "rat", x: 64, y: 0, z: 0 }],
      npcs: [],
      worldItems: [],
      groundEffects: [],
    },
    chunks: [],
  });
  harness.publish({
    type: "server.snapshot",
    payload: { serverTime: 1000 },
    result,
    hasPendingMovementPredictions: false,
  });
  const snapshotsBeforePrediction = remoteEntityInterpolationStore.getDebugState().snapshotCountsByType.monsters;

  harness.publish({
    type: "prediction-updated",
    action: { type: GAMEPLAY_ACTION_TYPE.movePlayer },
    predictedSelf: {
      uid: "player:one",
      x: 64,
      y: 0,
      z: 0,
      oldX: 0,
      oldY: 0,
      moveStartTime: 1000,
      moveDuration: 200,
      direction: "right",
    },
    hasPendingMovementPredictions: true,
  });

  assert.equal(remoteEntityInterpolationStore.getDebugState().snapshotCountsByType.monsters, snapshotsBeforePrediction);

  const selfOnlyResult = replicationStore.applyDelta({
    baseRevision: 1,
    revision: 2,
    serverTime: 1100,
    upserts: { self: { uid: "player:one", x: 64, y: 0, z: 0 } },
    removals: {},
    events: [{ type: "player-moved" }],
  });
  harness.publish({
    type: "server.delta",
    payload: {
      serverTime: 1100,
      upserts: { self: { uid: "player:one", x: 64, y: 0, z: 0 } },
      removals: {},
    },
    result: selfOnlyResult,
    hasPendingMovementPredictions: false,
  });

  assert.equal(remoteEntityInterpolationStore.getDebugState().snapshotCountsByType.monsters, snapshotsBeforePrediction);
  remoteEntityInterpolationStore.clear();
});
