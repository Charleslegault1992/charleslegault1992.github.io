import assert from "node:assert/strict";
import test from "node:test";

import { createClientReplicationStore } from "../src/network/clientReplicationStore.js";
import { createRemoteGameStateBridge } from "../src/network/remoteGameStateBridge.js";

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
