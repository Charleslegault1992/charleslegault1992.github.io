import assert from "node:assert/strict";
import test from "node:test";

import { TILE_SIZE } from "../src/core/gameConstants.js";
import { createServerNpcMovement } from "../server/serverNpcMovement.js";
import { createSpatialEntityStore } from "../server/spatialEntityStore.js";

const createWorldMap = () => ({
  z: 0,
  chunksByKey: new Map([
    [
      "0:0:0",
      {
        z: 0,
        chunkX: 0,
        chunkY: 0,
        layers: { collision: new Array(16 * 16).fill(0) },
      },
    ],
  ]),
});

const createNpc = () => ({
  uid: "npc:test:kay",
  npcId: "kay",
  x: TILE_SIZE,
  y: TILE_SIZE,
  z: 0,
  spawnX: TILE_SIZE,
  spawnY: TILE_SIZE,
  oldX: TILE_SIZE,
  oldY: TILE_SIZE,
  moveStartTime: 0,
  moveDuration: 0,
  nextWanderAt: 0,
  direction: "down",
});

test("server NPC movement replicates a rare cardinal step and pauses during conversations", () => {
  const worldMap = createWorldMap();
  const worldMapsByZ = new Map([[0, worldMap]]);
  const playersByUid = new Map([["player", { uid: "player", x: 0, y: 0, z: 0, hp: 100 }]]);
  const monsters = createSpatialEntityStore();
  const npcs = createSpatialEntityStore();
  const worldItems = createSpatialEntityStore();
  const conversationStatesByNpcUid = new Map();
  const npc = createNpc();
  npcs.add(npc);

  const movement = createServerNpcMovement({
    worldMapsByZ,
    playersByUid,
    monsters,
    npcs,
    worldItems,
    conversationStatesByNpcUid,
    randomInt: (minimum) => minimum,
  });

  const changedNpcs = movement.update(1000);
  assert.deepEqual(changedNpcs, [npc]);
  assert.equal(npc.x, TILE_SIZE);
  assert.equal(npc.y, 0);
  assert.equal(npc.oldY, TILE_SIZE);
  assert.equal(npc.direction, "up");
  assert.equal(npc.moveStartTime, 1000);
  assert.equal(npc.moveDuration, 350);

  conversationStatesByNpcUid.set(npc.uid, { activePlayerUid: "player" });
  npc.nextWanderAt = 0;
  assert.deepEqual(movement.update(2000), []);
  assert.equal(npc.y, 0);
});
