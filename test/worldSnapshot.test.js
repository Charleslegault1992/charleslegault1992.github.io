import assert from "node:assert/strict";
import test from "node:test";

import { createWorldDelta, createWorldSnapshot, serializePlayerPublicState } from "../src/simulation/worldSnapshot.js";
import { createItemInstance } from "../src/items/itemFactory.js";

const player = {
  uid: "player-1",
  name: "Charles",
  x: 64,
  y: 128,
  z: 0,
  oldX: 64,
  oldY: 128,
  hp: 100,
  maxHp: 100,
  mana: 5,
  maxMana: 10,
  sanity: 20,
  maxSanity: 100,
  experience: 40,
  level: 1,
  equipment: {},
};

test("a world snapshot is JSON serializable and excludes monster AI paths", () => {
  const monster = {
    uid: 2,
    monsterId: "rat",
    x: 128,
    y: 128,
    z: 0,
    hp: 20,
    state: "chase",
    path: [{ col: 9, row: 4 }],
  };
  const snapshot = createWorldSnapshot({
    revision: 7,
    serverTime: 1000,
    selfPlayer: player,
    monsters: new Map([[monster.uid, monster]]),
    chunks: [
      {
        z: 0,
        chunkX: 0,
        chunkY: 0,
        layers: { ground: [1, 0] },
        transitions: [],
        spawns: [],
        interactables: [],
      },
    ],
    visibleChunkKeys: ["0:1:0", "0:0:0", "0:1:0"],
  });

  assert.equal(JSON.parse(JSON.stringify(snapshot)).revision, 7);
  assert.equal("path" in snapshot.entities.monsters[0], false);
  assert.equal(snapshot.chunks[0].key, "0:0:0");
  assert.deepEqual(snapshot.visibleChunkKeys, ["0:0:0", "0:1:0"]);
});

test("a delta requires a strictly newer revision", () => {
  assert.equal(createWorldDelta({ baseRevision: 3, revision: 3, serverTime: 1 }), null);
  assert.equal(createWorldDelta({ baseRevision: 3, revision: 4, serverTime: 1 }).revision, 4);
});

test("public player snapshots expose compact light state without exposing equipment", () => {
  const torch = createItemInstance("torch", 1);
  torch.isLit = true;
  const publicState = serializePlayerPublicState({
    ...player,
    equipment: { ammo: torch },
    spellEffects: { light: { radius: 340, expiresAt: 5000 } },
    pvp: {},
  });

  assert.ok(publicState.light.equippedRadius > 0);
  assert.equal(publicState.light.spellRadius, 340);
  assert.equal("equipment" in publicState, false);
});
