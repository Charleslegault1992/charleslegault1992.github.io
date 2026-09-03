import assert from "node:assert/strict";
import test from "node:test";

import { createServerRaidSystem } from "../server/serverRaidSystem.js";
import { createRaidChestContent } from "../server/serverRaidLoot.js";
import { createSpatialEntityStore } from "../server/spatialEntityStore.js";
import { TILE_SIZE } from "../src/core/gameConstants.js";
import { getItemData } from "../src/items/itemModel.js";
import { RAID_PHASE, getRaidPortalCollisionTiles } from "../src/raids/raidModel.js";
import { isDynamicWorldCollisionAtTile } from "../src/world/dynamicWorldCollision.js";

const RAID_ID = "raid_01";

const marker = (name, col, row, properties = {}) => ({
  name,
  col,
  row,
  z: 0,
  tiledObjectId: `${name}:${col}:${row}`,
  properties: { raidId: RAID_ID, ...properties },
});

const createRaidFixture = ({ chestId = "raid_chest_01" } = {}) => {
  const portal = marker("raid_exit_portal", 10, 10, {
    targetCol: -78,
    targetRow: 45,
    targetZ: 0,
    transitionType: "portal",
  });
  const markers = [
    marker("raid_player_spawn", 2, 2, { maxPlayers: 2 }),
    marker("raid_monster_spawn_1", 4, 4, { spawnType: "monster", monsterId: "rat" }),
    marker("raid_monster_spawn_2", 5, 4, { spawnType: "monster", monsterId: "frog" }),
    marker("raid_boss_spawn", 6, 4, { spawnType: "boss", monsterId: "scorpion" }),
    marker("raid_chest_spawn", 7, 4, { spawnType: "chest", chestId }),
    portal,
  ];
  const worldMap = { z: 0, chunksByKey: new Map([["0:0:0", { raid_markers: markers }]]) };
  const worldMapsByZ = new Map([[0, worldMap]]);
  const playersByUid = new Map();
  const monsters = createSpatialEntityStore();
  const worldItems = createSpatialEntityStore({ stackOrderField: "tileStackOrder" });
  const system = createServerRaidSystem({
    worldMapsByZ,
    playersByUid,
    monsters,
    worldItems,
    findAvailablePlayerSpawn: (spawnMarker) => ({
      x: spawnMarker.col * TILE_SIZE,
      y: spawnMarker.row * TILE_SIZE,
    }),
    recordPlayerTileEntry: () => {},
  });
  const addPlayer = (uid) => {
    const player = { uid, hp: 100, x: 0, y: 0, z: 0, raid: null };
    playersByUid.set(uid, player);
    return player;
  };
  return { system, playersByUid, monsters, worldItems, worldMap, portal, addPlayer };
};

const advanceToBoss = (fixture, player) => {
  assert.equal(fixture.system.startRaid(player, RAID_ID, 0).success, true);
  assert.equal(fixture.system.update(1000).changedPlayers[0].raid.countdown, 2);
  assert.equal(fixture.system.update(2000).changedPlayers[0].raid.countdown, 1);
  const waveResult = fixture.system.update(3000);
  assert.equal(waveResult.spawnedMonsters.length, 2);
  assert.equal(fixture.system.getRaidState(RAID_ID).phase, RAID_PHASE.monsters);
  for (const monster of waveResult.spawnedMonsters) {
    assert.equal(monster.spawnId, null);
    assert.equal(fixture.system.notifyMonsterDeath(monster), true);
    assert.equal(fixture.system.notifyMonsterDeath(monster), false);
    fixture.monsters.remove(monster.uid);
  }
  const bossResult = fixture.system.update(3001);
  assert.equal(bossResult.spawnedMonsters.length, 1);
  assert.equal(bossResult.spawnedMonsters[0].raidRole, "boss");
  assert.equal(fixture.system.getRaidState(RAID_ID).phase, RAID_PHASE.boss);
  return bossResult.spawnedMonsters[0];
};

test("raid lifecycle advances countdown, regular wave, boss and one reward chest", () => {
  const fixture = createRaidFixture();
  const player = fixture.addPlayer("player-1");
  const boss = advanceToBoss(fixture, player);

  Object.assign(player, { x: fixture.portal.col * TILE_SIZE, y: (fixture.portal.row + 1) * TILE_SIZE });
  assert.equal(fixture.system.findAutomaticExitTransition(player), null);

  assert.equal(fixture.system.notifyMonsterDeath(boss), true);
  assert.equal(fixture.system.notifyMonsterDeath(boss), false);
  fixture.monsters.remove(boss.uid);
  const completedResult = fixture.system.update(3002);
  const state = fixture.system.getRaidState(RAID_ID);

  assert.equal(state.phase, RAID_PHASE.completed);
  assert.equal(completedResult.spawnedWorldItems.length, 1);
  assert.equal(completedResult.events.filter((event) => event.type === "raid-completed").length, 1);
  assert.equal(completedResult.spawnedWorldItems[0].itemId, "raidChest");
  assert.equal(completedResult.spawnedWorldItems[0].uid, state.chestUid);
  assert.equal(fixture.system.update(3003).spawnedWorldItems.length, 0);

  const transition = fixture.system.findAutomaticExitTransition(player);
  assert.equal(transition.properties.raidExit, true);
  assert.deepEqual(
    [transition.properties.targetCol, transition.properties.targetRow, transition.properties.targetZ],
    [-78, 45, 0],
  );
  assert.equal(isDynamicWorldCollisionAtTile(fixture.worldMap, fixture.portal.col, fixture.portal.row), false);
  Object.assign(player, { y: fixture.portal.row * TILE_SIZE });
  assert.equal(fixture.system.findAutomaticExitTransition(player), null);
  for (const tile of getRaidPortalCollisionTiles(fixture.portal)) {
    assert.equal(isDynamicWorldCollisionAtTile(fixture.worldMap, tile.col, tile.row), true);
  }

  const chestUid = state.chestUid;
  assert.equal(fixture.system.leaveRaid(player, "portal").success, true);
  const cleanupResult = fixture.system.update(3004);
  assert.equal(fixture.system.getRaidState(RAID_ID), null);
  assert.deepEqual(cleanupResult.removedWorldItemUids, [chestUid]);
  assert.equal(fixture.worldItems.has(chestUid), false);
  for (const tile of getRaidPortalCollisionTiles(fixture.portal)) {
    assert.equal(isDynamicWorldCollisionAtTile(fixture.worldMap, tile.col, tile.row), false);
  }
});

test("idle raid updates expose the complete stable result contract", () => {
  const fixture = createRaidFixture();
  assert.deepEqual(Object.keys(fixture.system.update(0)), [
    "changedPlayers",
    "spawnedMonsters",
    "removedMonsterUids",
    "spawnedWorldItems",
    "removedWorldItemUids",
    "events",
  ]);
});

test("raid membership is shared, closes after countdown and cleans up only after the last participant", () => {
  const fixture = createRaidFixture();
  const first = fixture.addPlayer("player-1");
  const second = fixture.addPlayer("player-2");
  const third = fixture.addPlayer("player-3");

  assert.equal(fixture.system.startRaid(first, RAID_ID, 0).success, true);
  assert.equal(fixture.system.startRaid(second, RAID_ID, 100).success, true);
  assert.equal(fixture.system.startRaid(third, RAID_ID, 200).reason, "raid-full");
  const waveResult = fixture.system.update(3000);
  assert.equal(fixture.system.startRaid(third, RAID_ID, 3001).reason, "raid-in-progress");

  assert.equal(fixture.system.leaveRaid(first).success, true);
  assert.ok(fixture.system.getRaidState(RAID_ID));
  assert.equal(fixture.system.leaveRaid(second).success, true);
  const cleanupResult = fixture.system.update(3002);

  assert.equal(fixture.system.getRaidState(RAID_ID), null);
  assert.deepEqual(cleanupResult.removedMonsterUids.sort(), waveResult.spawnedMonsters.map(({ uid }) => uid).sort());
  for (const tile of getRaidPortalCollisionTiles(fixture.portal)) {
    assert.equal(isDynamicWorldCollisionAtTile(fixture.worldMap, tile.col, tile.row), false);
  }
});

test("raid chest loot uses independent rolls and creates separate non-stackable torches", () => {
  const minimum = createRaidChestContent("raid_chest_01", {
    randomInt: (min, max) => (min === 1 && max === 100 ? 100 : min),
  });
  assert.equal(minimum.success, true);
  assert.equal(minimum.content.find((entry) => entry.itemId === "goldCoin").quantity, 10);
  assert.equal(minimum.content.filter((entry) => entry.itemId === "torch").length, 1);
  assert.equal(minimum.content.some((entry) => entry.itemId === "shortSword"), false);

  const maximum = createRaidChestContent("raid_chest_01", {
    randomInt: (min, max) => (min === 1 && max === 100 ? 1 : max),
  });
  assert.equal(maximum.success, true);
  assert.equal(maximum.content.find((entry) => entry.itemId === "goldCoin").quantity, 35);
  const torches = maximum.content.filter((entry) => entry.itemId === "torch");
  assert.equal(torches.length, 2);
  assert.ok(torches.every((torch) => torch.quantity === 1));
  assert.equal(new Set(torches.map((torch) => torch.uid)).size, 2);
  assert.deepEqual(
    new Set(maximum.content.map((entry) => entry.itemId)),
    new Set(["goldCoin", "torch", "shortSword", "smallHealingRune", "healthPotion", "manaPotion"]),
  );
  assert.ok(maximum.content.length <= getItemData("raidChest").capacity);
});

test("raid chest data is immovable, reward-only and blocks world-item placement", () => {
  const chestData = getItemData("raidChest");
  assert.equal(chestData.container, true);
  assert.equal(chestData.movable, false);
  assert.equal(chestData.acceptsItems, false);
  assert.equal(chestData.blocksWorldItemPlacement, true);
});

test("a chest generation failure never prevents raid completion or portal activation", (testContext) => {
  testContext.mock.method(console, "error", () => {});
  const fixture = createRaidFixture({ chestId: "missing_chest" });
  const player = fixture.addPlayer("player-1");
  const boss = advanceToBoss(fixture, player);
  fixture.system.notifyMonsterDeath(boss);
  fixture.monsters.remove(boss.uid);

  const result = fixture.system.update(3002);
  const state = fixture.system.getRaidState(RAID_ID);
  assert.equal(state.phase, RAID_PHASE.completed);
  assert.equal(state.chestUid, null);
  assert.equal(result.spawnedWorldItems.length, 0);
  for (const tile of getRaidPortalCollisionTiles(fixture.portal)) {
    assert.equal(isDynamicWorldCollisionAtTile(fixture.worldMap, tile.col, tile.row), true);
  }
});
