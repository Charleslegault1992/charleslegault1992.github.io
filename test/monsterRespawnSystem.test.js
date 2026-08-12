import test from "node:test";
import assert from "node:assert/strict";

import { createMonsterRespawnSystem } from "../src/monsters/monsterRespawnSystem.js";
import { CHUNK_SIZE_TILES, MONSTER_RESPAWN_CONFIG, TILE_SIZE } from "../src/core/gameConstants.js";
import { playerState } from "../src/state/playerState.js";
import {
  monsterSpawnDefinitionsById,
  monsterSpawnStateById,
} from "../src/state/worldState.js";

test("a blocked monster respawn stays pending and retries later", () => {
  const spawnId = "test-respawn-zone";
  const previousPlayer = { x: playerState.x, y: playerState.y, z: playerState.z, hp: playerState.hp };
  monsterSpawnDefinitionsById.delete(spawnId);
  monsterSpawnStateById.delete(spawnId);

  const worldMap = {
    z: 0,
    chunksByKey: new Map([
      [
        "0:0:0",
        {
          chunkX: 0,
          chunkY: 0,
          layers: { collision: new Array(CHUNK_SIZE_TILES * CHUNK_SIZE_TILES).fill(0) },
        },
      ],
    ]),
  };
  const spawnZone = {
    col: 2,
    row: 2,
    width: TILE_SIZE,
    height: TILE_SIZE,
    properties: {
      spawnId,
      spawnType: "monster",
      monsterId: "rat",
      maxCount: 1,
      respawnMs: 120000,
    },
  };
  const createdMonsters = [];
  const system = createMonsterRespawnSystem({
    createMonster(monsterId, x, y, z) {
      const monster = { uid: 1, monsterId, x, y, z };
      createdMonsters.push(monster);
      return monster;
    },
    addMonsterToState: () => true,
    isBlockingItemAtPosition: () => false,
    isMonsterAtPosition: () => false,
    isNpcAtPosition: () => false,
    isPlayerAtPosition: () => false,
    refreshMonsterHp: () => {},
    renderMonsters: () => {},
  });

  try {
    playerState.x = spawnZone.col * TILE_SIZE;
    playerState.y = spawnZone.row * TILE_SIZE;
    playerState.z = 0;
    playerState.hp = 100;
    system.registerSpawnDefinition(worldMap, spawnZone);
    system.scheduleAt(spawnId, 1000);
    system.update(1000);

    assert.equal(createdMonsters.length, 0);
    assert.equal(monsterSpawnStateById.get(spawnId).pendingRespawnCount, 1);

    playerState.x = 100 * TILE_SIZE;
    playerState.y = 100 * TILE_SIZE;
    system.update(1000 + MONSTER_RESPAWN_CONFIG.blockedRetryMs);

    assert.equal(createdMonsters.length, 1);
    assert.equal(monsterSpawnStateById.get(spawnId).pendingRespawnCount, 0);
    assert.equal(monsterSpawnStateById.get(spawnId).aliveCount, 1);
  } finally {
    Object.assign(playerState, previousPlayer);
    monsterSpawnDefinitionsById.delete(spawnId);
    monsterSpawnStateById.delete(spawnId);
  }
});
