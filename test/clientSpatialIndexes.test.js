import assert from "node:assert/strict";
import test from "node:test";

import {
  getMonstersInChunkRadius,
  rebuildMonsterSpatialIndexes,
} from "../src/monsters/monsterIndex.js";
import {
  getNpcsInChunkRadius,
  rebuildNpcSpatialIndexes,
} from "../src/npcs/npcIndex.js";
import {
  monstersByUid,
  monsterUidByTileKey,
  monsterUidsByChunkKey,
  npcsByUid,
  npcConversationStatesByUid,
  npcUidByTileKey,
  npcUidsByChunkKey,
} from "../src/state/worldState.js";

test("replicated monsters and NPCs rebuild the client spatial indexes", () => {
  monstersByUid.clear();
  monsterUidByTileKey.clear();
  monsterUidsByChunkKey.clear();
  npcsByUid.clear();
  npcUidByTileKey.clear();
  npcUidsByChunkKey.clear();
  npcConversationStatesByUid.clear();

  monstersByUid.set(41, { uid: 41, monsterId: "rat", x: 64, y: 128, z: -1 });
  npcsByUid.set("npc:0:kay", { uid: "npc:0:kay", npcId: "kay", x: 320, y: -384, z: 0 });

  rebuildMonsterSpatialIndexes();
  rebuildNpcSpatialIndexes();

  assert.deepEqual(getMonstersInChunkRadius(64, 128, -1, 0).map((monster) => monster.uid), [41]);
  assert.deepEqual(getNpcsInChunkRadius(320, -384, 0, 0).map((npc) => npc.uid), ["npc:0:kay"]);
  assert.equal(npcConversationStatesByUid.has("npc:0:kay"), true);
});
