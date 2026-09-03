import assert from "node:assert/strict";
import test from "node:test";

import { loadServerWorldMaps } from "../server/loadServerWorldMaps.js";
import { getRaidChestData } from "../src/data/raidChestDatabase.js";
import { getItemData } from "../src/items/itemModel.js";
import { getMonsterData } from "../src/monsters/monsterModel.js";
import {
  createRaidPortalTransition,
  getRaidBossSpawnMarker,
  getRaidMarkerByName,
  getRaidMonsterSpawnMarkers,
  getRaidPortalCollisionTiles,
} from "../src/raids/raidModel.js";
import { findTransitionAtTile } from "../src/world/tiledWorldObjects.js";
import { getWorldChunkForTilePosition, isTiledCollisionAtTile } from "../src/world/worldCoordinates.js";

test("world_z0 contains a complete and traversable raid_01 marker definition", async () => {
  const worldMapsByZ = await loadServerWorldMaps();
  const worldMap = worldMapsByZ.get(0);
  const playerSpawn = getRaidMarkerByName(worldMapsByZ, "raid_01", "raid_player_spawn");
  const monsterSpawns = getRaidMonsterSpawnMarkers(worldMapsByZ, "raid_01");
  const bossSpawn = getRaidBossSpawnMarker(worldMapsByZ, "raid_01");
  const chestSpawn = getRaidMarkerByName(worldMapsByZ, "raid_01", "raid_chest_spawn");
  const portalSpawn = getRaidMarkerByName(worldMapsByZ, "raid_01", "raid_exit_portal");

  assert.ok(worldMap);
  assert.ok(playerSpawn);
  assert.ok(monsterSpawns.length > 0);
  assert.ok(bossSpawn);
  assert.ok(chestSpawn);
  assert.ok(portalSpawn);
  assert.ok(monsterSpawns.every((spawn) => spawn.properties.spawnType === "monster"));
  assert.ok(monsterSpawns.every((spawn) => getMonsterData(spawn.properties.monsterId)));
  assert.equal(bossSpawn.properties.spawnType, "boss");
  assert.ok(getMonsterData(bossSpawn.properties.monsterId));
  assert.equal(chestSpawn.properties.spawnType, "chest");
  const chestDefinition = getRaidChestData(chestSpawn.properties.chestId);
  assert.ok(chestDefinition);
  assert.ok(getItemData(chestDefinition.itemId));

  const portalTransition = createRaidPortalTransition(portalSpawn);
  assert.ok(portalTransition);
  assert.equal(portalTransition.col, portalSpawn.col);
  assert.equal(portalTransition.row, portalSpawn.row + 1);
  assert.equal(portalSpawn.properties.transitionType, "portal");
  assert.deepEqual(
    [portalTransition.properties.targetCol, portalTransition.properties.targetRow, portalTransition.properties.targetZ],
    [-78, 45, 0],
  );
  assert.equal(findTransitionAtTile(worldMap, portalSpawn.col, portalSpawn.row), null);

  const importantMarkers = [playerSpawn, ...monsterSpawns, bossSpawn, chestSpawn, portalSpawn];
  for (const marker of importantMarkers) {
    assert.ok(getWorldChunkForTilePosition(worldMap, marker.col, marker.row));
    assert.equal(isTiledCollisionAtTile(worldMap, marker.col, marker.row), false, marker.name);
  }

  const portalTiles = [
    ...getRaidPortalCollisionTiles(portalSpawn),
    { col: portalSpawn.col, row: portalSpawn.row },
    { col: portalSpawn.col, row: portalSpawn.row + 1 },
  ];
  assert.equal(new Set(portalTiles.map(({ col, row }) => `${col}:${row}`)).size, 9);
  for (const tile of portalTiles) {
    assert.equal(isTiledCollisionAtTile(worldMap, tile.col, tile.row), false);
  }
});
