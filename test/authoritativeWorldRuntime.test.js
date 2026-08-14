import assert from "node:assert/strict";
import test from "node:test";

import {
  createAttackPlayerAction,
  createSetPvpEnabledAction,
  createAttackMonsterAction,
  createCastSpellAction,
  createMovePlayerAction,
  createSpeakToNpcAction,
  createUseWorldTransitionAction,
  createWorldInteractionAction,
} from "../src/actions/gameplayActions.js";
import { TILE_SIZE } from "../src/core/gameConstants.js";
import { createAuthoritativeWorldRuntime } from "../server/authoritativeWorldRuntime.js";
import { loadServerWorldMaps } from "../server/loadServerWorldMaps.js";
import { createSqliteCharacterRepository } from "../server/persistence/sqliteCharacterRepository.js";
import { getWorldChunkForTilePosition, isTiledCollisionAtTile } from "../src/world/worldCoordinates.js";
import { createMoveItemAction } from "../src/inventory/inventoryActions.js";
import { createGroundItem, createItemInstance } from "../src/items/itemFactory.js";
import { createUseItemAction } from "../src/items/itemUseActions.js";

test("the authoritative runtime creates independent players and replicates movement", async () => {
  const worldMapsByZ = await loadServerWorldMaps();
  let serverTime = 1000;
  const runtime = createAuthoritativeWorldRuntime({ worldMapsByZ, now: () => serverTime });
  const firstSession = {};
  const secondSession = {};
  const firstConnection = runtime.connectClient(firstSession, { accountId: "test", characterId: "first", name: "First" });
  const secondConnection = runtime.connectClient(secondSession, { accountId: "test", characterId: "second", name: "Second" });
  firstSession.playerUid = firstConnection.playerUid;
  secondSession.playerUid = secondConnection.playerUid;
  const firstPlayer = runtime.getPlayer(firstConnection.playerUid);
  const secondPlayer = runtime.getPlayer(secondConnection.playerUid);
  const start = { x: firstPlayer.x, y: firstPlayer.y, z: firstPlayer.z };
  const worldMap = worldMapsByZ.get(start.z);
  const destination = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]
    .map(([colOffset, rowOffset]) => ({
      x: start.x + colOffset * TILE_SIZE,
      y: start.y + rowOffset * TILE_SIZE,
    }))
    .find(({ x, y }) => {
      const col = x / TILE_SIZE;
      const row = y / TILE_SIZE;
      return (
        getWorldChunkForTilePosition(worldMap, col, row) &&
        !isTiledCollisionAtTile(worldMap, col, row) &&
        (secondPlayer.x !== x || secondPlayer.y !== y)
      );
    });
  assert.ok(destination);

  serverTime += 1000;
  runtime.update(serverTime);
  const result = runtime.dispatchAction(
    firstSession,
    createMovePlayerAction({
      fromX: start.x,
      fromY: start.y,
      fromZ: start.z,
      toX: destination.x,
      toY: destination.y,
      direction: "right",
      isNavigationMovement: false,
      requestedAt: 0,
    }),
  );

  assert.equal(result.success, true);
  assert.equal(firstPlayer.x, destination.x);
  assert.notDeepEqual(
    { x: runtime.getPlayer(secondConnection.playerUid).x, y: runtime.getPlayer(secondConnection.playerUid).y },
    { x: firstPlayer.x, y: firstPlayer.y },
  );
  const deltas = runtime.getDeltasForClient(secondSession, 0);
  assert.equal(deltas.length, 1);
  assert.equal(deltas[0].upserts.players.some((player) => player.uid === firstPlayer.uid), true);
});

test("player spawns use four tiles before stacking additional players", async () => {
  const worldMapsByZ = await loadServerWorldMaps();
  const runtime = createAuthoritativeWorldRuntime({ worldMapsByZ });
  const players = [];

  for (let index = 0; index < 5; index++) {
    const session = {};
    const connection = runtime.connectClient(session, {
      accountId: "spawn-stack",
      characterId: `player-${index}`,
    });
    players.push(runtime.getPlayer(connection.playerUid));
  }

  const firstFourPositions = new Set(players.slice(0, 4).map((player) => `${player.x}:${player.y}:${player.z}`));
  assert.equal(firstFourPositions.size, 4);
  assert.deepEqual(
    { x: players[4].x, y: players[4].y, z: players[4].z },
    { x: players[0].x, y: players[0].y, z: players[0].z },
  );
  assert.ok(players[4].tileStackOrder > players[0].tileStackOrder);
});

test("normal movement cannot enter another player's tile", async () => {
  const worldMapsByZ = await loadServerWorldMaps();
  let serverTime = 1000;
  const runtime = createAuthoritativeWorldRuntime({ worldMapsByZ, now: () => serverTime });
  const firstSession = {};
  const secondSession = {};
  firstSession.playerUid = runtime.connectClient(firstSession, {
    accountId: "movement-stack",
    characterId: "first",
  }).playerUid;
  secondSession.playerUid = runtime.connectClient(secondSession, {
    accountId: "movement-stack",
    characterId: "second",
  }).playerUid;
  const firstPlayer = runtime.getPlayer(firstSession.playerUid);
  const secondPlayer = runtime.getPlayer(secondSession.playerUid);

  serverTime += 1000;
  runtime.update(serverTime);
  const result = runtime.dispatchAction(
    firstSession,
    createMovePlayerAction({
      fromX: firstPlayer.x,
      fromY: firstPlayer.y,
      fromZ: firstPlayer.z,
      toX: secondPlayer.x,
      toY: secondPlayer.y,
      direction: "right",
      isNavigationMovement: false,
      requestedAt: 0,
    }),
  );

  assert.equal(result.success, false);
  assert.equal(result.reason, "movement-blocked");
});

test("PVP requires consent from both players and applies damage on the server", async () => {
  const worldMapsByZ = await loadServerWorldMaps();
  let serverTime = 1000;
  const runtime = createAuthoritativeWorldRuntime({
    worldMapsByZ,
    now: () => serverTime,
    combatRandom: {
      getInt: () => 1,
      getFloat: (_minimum, maximum) => maximum,
    },
  });
  const attackerSession = {};
  const targetSession = {};
  attackerSession.playerUid = runtime.connectClient(attackerSession, {
    accountId: "pvp",
    characterId: "attacker",
    name: "Attacker",
  }).playerUid;
  targetSession.playerUid = runtime.connectClient(targetSession, {
    accountId: "pvp",
    characterId: "target",
    name: "Target",
  }).playerUid;
  const attacker = runtime.getPlayer(attackerSession.playerUid);
  const target = runtime.getPlayer(targetSession.playerUid);
  Object.assign(target, { x: attacker.x + TILE_SIZE, y: attacker.y, z: attacker.z });

  const rejected = runtime.dispatchAction(
    attackerSession,
    createAttackPlayerAction(target.uid, serverTime),
  );
  runtime.dispatchAction(attackerSession, createSetPvpEnabledAction(true, serverTime));
  runtime.dispatchAction(targetSession, createSetPvpEnabledAction(true, serverTime));
  serverTime += 1000;
  runtime.update(serverTime);
  const healthBeforeAttack = target.hp;
  const accepted = runtime.dispatchAction(
    attackerSession,
    createAttackPlayerAction(target.uid, serverTime),
  );

  assert.equal(rejected.reason, "pvp-disabled");
  assert.equal(accepted.success, true);
  assert.ok(target.hp < healthBeforeAttack);
  assert.equal(accepted.changes.targetPlayerUid, target.uid);
  assert.equal(attacker.pvp.skullType, "white");

  const lockedToggle = runtime.dispatchAction(
    attackerSession,
    createSetPvpEnabledAction(false, serverTime),
  );
  const retaliation = runtime.dispatchAction(
    targetSession,
    createAttackPlayerAction(attacker.uid, serverTime),
  );

  assert.equal(lockedToggle.reason, "pvp-locked-by-skull");
  assert.equal(retaliation.success, true);
  assert.equal(target.pvp.skullType, "none");
});

test("a disconnected character reloads its authoritative saved position", async () => {
  const worldMapsByZ = await loadServerWorldMaps();
  const repository = createSqliteCharacterRepository({ databasePath: ":memory:" });
  const runtime = createAuthoritativeWorldRuntime({
    worldMapsByZ,
    characterRepository: repository,
    allowCharacterAutoCreate: true,
  });
  const firstSession = {};
  const connection = runtime.connectClient(firstSession, { accountId: "account", characterId: "saved" });
  firstSession.playerUid = connection.playerUid;
  const player = runtime.getPlayer(connection.playerUid);
  const savedPosition = { x: player.x, y: player.y, z: player.z };

  assert.equal(runtime.disconnectClient(firstSession), true);
  const reconnectedSession = {};
  const reconnection = runtime.connectClient(reconnectedSession, { accountId: "account", characterId: "saved" });
  const reconnectedPlayer = runtime.getPlayer(reconnection.playerUid);

  assert.deepEqual(
    { x: reconnectedPlayer.x, y: reconnectedPlayer.y, z: reconnectedPlayer.z },
    savedPosition,
  );
  repository.close();
});

test("a persistent runtime rejects a character that was not created by its account", async () => {
  const worldMapsByZ = await loadServerWorldMaps();
  const repository = createSqliteCharacterRepository({ databasePath: ":memory:" });
  const runtime = createAuthoritativeWorldRuntime({ worldMapsByZ, characterRepository: repository });

  const result = runtime.connectClient({}, { accountId: "account", characterId: "forged" });

  assert.deepEqual(result, { success: false, reason: "character-not-found" });
  repository.close();
});

test("dirty character autosaves are spread across server ticks", async () => {
  const worldMapsByZ = await loadServerWorldMaps();
  let serverTime = 1000;
  const saveCalls = [];
  const repository = {
    load: () => null,
    save(accountId, characterId, _snapshot, expectedVersion) {
      saveCalls.push({ accountId, characterId });
      return { success: true, version: (expectedVersion ?? 0) + 1 };
    },
  };
  const runtime = createAuthoritativeWorldRuntime({
    worldMapsByZ,
    characterRepository: repository,
    allowCharacterAutoCreate: true,
    now: () => serverTime,
  });
  const sessions = [];
  for (let index = 0; index < 5; index++) {
    const session = {};
    session.playerUid = runtime.connectClient(session, {
      accountId: "autosave",
      characterId: `player-${index}`,
    }).playerUid;
    sessions.push(session);
  }
  saveCalls.length = 0;
  for (const session of sessions) {
    runtime.dispatchAction(session, createSetPvpEnabledAction(true, serverTime));
  }

  serverTime += 30001;
  runtime.update(serverTime);
  assert.equal(saveCalls.length, 2);

  runtime.update(serverTime + 34);
  assert.equal(saveCalls.length, 4);

  runtime.update(serverTime + 68);
  assert.equal(saveCalls.length, 5);

  runtime.update(serverTime + 30001);
  assert.equal(saveCalls.length, 5);
});

test("the authoritative server owns world-to-inventory item moves", async () => {
  const worldMapsByZ = await loadServerWorldMaps();
  const runtime = createAuthoritativeWorldRuntime({ worldMapsByZ });
  const session = {};
  const connection = runtime.connectClient(session, { accountId: "test", characterId: "inventory" });
  session.playerUid = connection.playerUid;
  const player = runtime.getPlayer(connection.playerUid);
  const backpack = createItemInstance("bag", 1);
  const apple = createGroundItem("apple", 1, player.x, player.y, player.z);
  player.equipment.backpack = backpack;
  runtime.getWorldEntities().worldItems.add(apple);

  const result = runtime.dispatchAction(
    session,
    createMoveItemAction(
      { locationType: "worldItem", itemUid: apple.uid },
      { locationType: "containerSlot", parentContainerUid: backpack.uid, slotIndex: 0 },
      apple.uid,
    ),
  );

  assert.equal(result.success, true);
  assert.equal(backpack.content[0].uid, apple.uid);
  assert.equal(runtime.getWorldEntities().worldItems.has(apple.uid), false);
  assert.equal(result.changes.equipment.backpack.content[0].uid, apple.uid);
});

test("private inventory deltas are sent only as self state", async () => {
  const worldMapsByZ = await loadServerWorldMaps();
  const runtime = createAuthoritativeWorldRuntime({ worldMapsByZ });
  const ownerSession = {};
  const observerSession = {};
  const ownerConnection = runtime.connectClient(ownerSession, { accountId: "private", characterId: "owner" });
  const observerConnection = runtime.connectClient(observerSession, { accountId: "private", characterId: "observer" });
  ownerSession.playerUid = ownerConnection.playerUid;
  observerSession.playerUid = observerConnection.playerUid;
  const owner = runtime.getPlayer(ownerConnection.playerUid);
  const observer = runtime.getPlayer(observerConnection.playerUid);
  Object.assign(observer, { x: owner.x, y: owner.y, z: owner.z });
  const backpack = createItemInstance("bag", 1);
  const apple = createGroundItem("apple", 1, owner.x, owner.y, owner.z);
  owner.equipment.backpack = backpack;
  runtime.getWorldEntities().worldItems.add(apple);
  const ownerSnapshot = runtime.createSnapshotForClient(ownerSession);
  const observerSnapshot = runtime.createSnapshotForClient(observerSession);

  runtime.dispatchAction(
    ownerSession,
    createMoveItemAction(
      { locationType: "worldItem", itemUid: apple.uid },
      { locationType: "containerSlot", parentContainerUid: backpack.uid, slotIndex: 0 },
      apple.uid,
    ),
  );
  const ownerDelta = runtime.getDeltasForClient(ownerSession, ownerSnapshot.revision)[0];
  const observerDelta = runtime.getDeltasForClient(observerSession, observerSnapshot.revision)[0];

  assert.equal(ownerDelta.upserts.self.equipment.backpack.content[0].uid, apple.uid);
  assert.equal("equipment" in observerDelta.upserts.players.find((entry) => entry.uid === owner.uid), false);
});

test("concurrent players cannot both move the same authoritative world item", async () => {
  const worldMapsByZ = await loadServerWorldMaps();
  const runtime = createAuthoritativeWorldRuntime({ worldMapsByZ });
  const firstSession = {};
  const secondSession = {};
  const firstConnection = runtime.connectClient(firstSession, { accountId: "race", characterId: "first" });
  const secondConnection = runtime.connectClient(secondSession, { accountId: "race", characterId: "second" });
  firstSession.playerUid = firstConnection.playerUid;
  secondSession.playerUid = secondConnection.playerUid;
  const firstPlayer = runtime.getPlayer(firstConnection.playerUid);
  const secondPlayer = runtime.getPlayer(secondConnection.playerUid);
  Object.assign(secondPlayer, { x: firstPlayer.x, y: firstPlayer.y, z: firstPlayer.z });
  firstPlayer.equipment.backpack = createItemInstance("bag", 1);
  secondPlayer.equipment.backpack = createItemInstance("bag", 1);
  const apple = createGroundItem("apple", 1, firstPlayer.x, firstPlayer.y, firstPlayer.z);
  runtime.getWorldEntities().worldItems.add(apple);

  const createPickupAction = (backpackUid) => createMoveItemAction(
    { locationType: "worldItem", itemUid: apple.uid },
    { locationType: "containerSlot", parentContainerUid: backpackUid, slotIndex: 0 },
    apple.uid,
  );
  const firstResult = runtime.dispatchAction(firstSession, createPickupAction(firstPlayer.equipment.backpack.uid));
  const secondResult = runtime.dispatchAction(secondSession, createPickupAction(secondPlayer.equipment.backpack.uid));

  assert.equal(firstResult.success, true);
  assert.equal(secondResult.success, false);
  assert.equal(firstPlayer.equipment.backpack.content[0].uid, apple.uid);
  assert.equal(secondPlayer.equipment.backpack.content[0], undefined);
});

test("a client cannot speak or execute commands as another player UID", async () => {
  const worldMapsByZ = await loadServerWorldMaps();
  const runtime = createAuthoritativeWorldRuntime({ worldMapsByZ });
  const firstSession = {};
  const secondSession = {};
  const firstConnection = runtime.connectClient(firstSession, { accountId: "spoof", characterId: "first" });
  const secondConnection = runtime.connectClient(secondSession, { accountId: "spoof", characterId: "second" });
  firstSession.playerUid = firstConnection.playerUid;
  secondSession.playerUid = secondConnection.playerUid;

  const result = runtime.dispatchAction(
    firstSession,
    createSpeakToNpcAction("hello", secondConnection.playerUid, 0),
  );

  assert.equal(result.success, false);
  assert.equal(result.reason, "player-not-found");
});

test("item use and shared item cooldown are authoritative per player", async () => {
  const worldMapsByZ = await loadServerWorldMaps();
  let serverTime = 1000;
  const runtime = createAuthoritativeWorldRuntime({ worldMapsByZ, now: () => serverTime });
  const session = {};
  const connection = runtime.connectClient(session, { accountId: "test", characterId: "items" });
  session.playerUid = connection.playerUid;
  const player = runtime.getPlayer(connection.playerUid);
  const backpack = createItemInstance("bag", 1);
  const firstPotion = createItemInstance("healthPotion", 1);
  const secondPotion = createItemInstance("healthPotion", 1);
  backpack.content[0] = firstPotion;
  backpack.content[1] = secondPotion;
  player.equipment.backpack = backpack;
  player.hp = 20;

  const usePotion = (potion, slotIndex) => runtime.dispatchAction(
    session,
    createUseItemAction({
      source: { locationType: "containerSlot", parentContainerUid: backpack.uid, slotIndex },
      itemUid: potion.uid,
      target: { targetType: "self", playerUid: player.uid },
      requestedAt: 0,
    }),
  );
  const firstResult = usePotion(firstPotion, 0);
  const cooldownResult = usePotion(secondPotion, 1);

  assert.equal(firstResult.success, true);
  assert.equal(player.hp, player.maxHp);
  assert.equal(firstPotion.itemId, "emptyPotion");
  assert.equal(cooldownResult.success, false);
  assert.equal(cooldownResult.reason, "cooldown");
});

test("learned spells consume authoritative mana and share the spell cooldown", async () => {
  const worldMapsByZ = await loadServerWorldMaps();
  let serverTime = 1000;
  const runtime = createAuthoritativeWorldRuntime({ worldMapsByZ, now: () => serverTime });
  const session = {};
  const connection = runtime.connectClient(session, { accountId: "test", characterId: "spells" });
  session.playerUid = connection.playerUid;
  const player = runtime.getPlayer(connection.playerUid);
  player.mana = 20;
  player.maxMana = 20;

  const castResult = runtime.dispatchAction(session, createCastSpellAction("lux", 0));
  const cooldownResult = runtime.dispatchAction(session, createCastSpellAction("lux", 0));
  const unlearnedResult = runtime.dispatchAction(session, createCastSpellAction("cura", 0));

  assert.equal(castResult.success, true);
  assert.equal(player.mana, 15);
  assert.ok(player.spellEffects.light.expiresAt > serverTime);
  assert.equal(cooldownResult.reason, "cooldown");
  assert.equal(unlearnedResult.reason, "spell-not-learned");
});

test("reward chests grant items and commit quest progress exactly once on the server", async () => {
  const worldMapsByZ = await loadServerWorldMaps();
  let serverTime = 1000;
  const runtime = createAuthoritativeWorldRuntime({ worldMapsByZ, now: () => serverTime });
  const session = {};
  const connection = runtime.connectClient(session, { accountId: "test", characterId: "quest" });
  session.playerUid = connection.playerUid;
  const player = runtime.getPlayer(connection.playerUid);
  player.equipment.backpack = createItemInstance("bag", 1);
  const worldMap = [...worldMapsByZ.values()].find((map) =>
    [...map.chunksByKey.values()].some((chunk) => chunk.interactables.some((entry) => entry.properties?.interactableType === "rewardChest")),
  );
  const chest = [...worldMap.chunksByKey.values()]
    .flatMap((chunk) => chunk.interactables)
    .find((entry) => entry.properties?.interactableType === "rewardChest");
  player.x = chest.col * TILE_SIZE;
  player.y = chest.row * TILE_SIZE;
  player.z = worldMap.z;

  const action = createWorldInteractionAction({
    interactableId: chest.properties.interactableId,
    interactionType: chest.properties.interactableType,
    z: player.z,
    col: chest.col,
    row: chest.row,
    requestedAt: 0,
  });
  const result = runtime.dispatchAction(session, action);
  const repeatedResult = runtime.dispatchAction(session, action);

  assert.equal(result.success, true);
  assert.equal(repeatedResult.reason, "already-claimed");
  assert.equal(player.progress.questsById[chest.properties.questId].status, "completed");
  assert.ok(player.equipment.backpack.content.filter(Boolean).length > 0);
});

test("NPC conversations are queued and resolved by the authoritative server", async () => {
  const worldMapsByZ = await loadServerWorldMaps();
  let serverTime = 1000;
  const runtime = createAuthoritativeWorldRuntime({ worldMapsByZ, now: () => serverTime });
  const firstSession = {};
  const secondSession = {};
  const firstConnection = runtime.connectClient(firstSession, { accountId: "npc", characterId: "first", language: "fr" });
  const secondConnection = runtime.connectClient(secondSession, { accountId: "npc", characterId: "second", language: "fr" });
  firstSession.playerUid = firstConnection.playerUid;
  secondSession.playerUid = secondConnection.playerUid;
  const npc = [...runtime.getWorldEntities().npcs.values()][0];
  const firstPlayer = runtime.getPlayer(firstConnection.playerUid);
  const secondPlayer = runtime.getPlayer(secondConnection.playerUid);
  Object.assign(firstPlayer, { x: npc.x, y: npc.y, z: npc.z });
  Object.assign(secondPlayer, { x: npc.x, y: npc.y, z: npc.z });

  const greeting = runtime.dispatchAction(
    firstSession,
    createSpeakToNpcAction("salut", firstPlayer.uid, 0),
  );
  const queued = runtime.dispatchAction(
    secondSession,
    createSpeakToNpcAction("salut", secondPlayer.uid, 0),
  );

  assert.equal(greeting.success, true);
  assert.equal(greeting.events.some((event) => event.type === "npc-spoke"), true);
  assert.equal(queued.success, false);
  assert.equal(queued.reason, "npc-busy");
  assert.equal(queued.changes.queuePosition, 1);
});

test("the server tick wakes monster AI and acquires a nearby player target", async () => {
  const worldMapsByZ = await loadServerWorldMaps();
  let serverTime = 1000;
  const runtime = createAuthoritativeWorldRuntime({
    worldMapsByZ,
    now: () => serverTime,
    combatRandom: { getInt: () => 1, getFloat: (_minimum, maximum) => maximum },
  });
  const session = {};
  const connection = runtime.connectClient(session, { accountId: "test", characterId: "monster-ai" });
  session.playerUid = connection.playerUid;
  const player = runtime.getPlayer(connection.playerUid);
  const monster = [...runtime.getWorldEntities().monsters.values()][0];
  Object.assign(player, { x: monster.x, y: monster.y, z: monster.z });

  serverTime += 1000;
  runtime.update(serverTime);

  assert.equal(monster.isAwake, true);
  assert.equal(monster.targetUid, player.uid);
  assert.equal(monster.state, "combat");
  assert.ok(player.hp < player.maxHp);
});

test("monster combat death creates a corpse and resets the player to the saved spawn", async () => {
  const worldMapsByZ = await loadServerWorldMaps();
  let serverTime = 1000;
  const runtime = createAuthoritativeWorldRuntime({
    worldMapsByZ,
    now: () => serverTime,
    combatRandom: { getInt: () => 1, getFloat: (_minimum, maximum) => maximum },
  });
  const session = {};
  const connection = runtime.connectClient(session, { accountId: "test", characterId: "player-death" });
  session.playerUid = connection.playerUid;
  const player = runtime.getPlayer(connection.playerUid);
  const monster = [...runtime.getWorldEntities().monsters.values()][0];
  player.equipment.backpack = createItemInstance("bag", 1);
  player.hp = 1;
  player.experience = 100;
  Object.assign(player, { x: monster.x, y: monster.y, z: monster.z });
  const snapshot = runtime.createSnapshotForClient(session);

  serverTime += 1000;
  runtime.update(serverTime);
  const delta = runtime.getDeltasForClient(session, snapshot.revision).at(-1);
  const deathEvent = delta.events.find((event) => event.type === "player-died");
  const corpse = runtime.getWorldEntities().worldItems.get(deathEvent.corpseUid);

  assert.equal(player.hp, player.maxHp);
  assert.equal(player.experience, 90);
  assert.equal(player.z, player.spawn.z);
  assert.equal(corpse.itemId, "playerCorpse");
  assert.equal(corpse.content[0].itemId, "bag");
  assert.equal(player.equipment.backpack, null);
});

test("the authoritative runtime executes a Tiled floor transition", async () => {
  const worldMapsByZ = await loadServerWorldMaps();
  let serverTime = 1000;
  const runtime = createAuthoritativeWorldRuntime({ worldMapsByZ, now: () => serverTime });
  const session = {};
  const connection = runtime.connectClient(session, { accountId: "test", characterId: "transition" });
  session.playerUid = connection.playerUid;
  const player = runtime.getPlayer(connection.playerUid);
  const secondSession = {};
  const secondConnection = runtime.connectClient(secondSession, { accountId: "test", characterId: "transition-two" });
  secondSession.playerUid = secondConnection.playerUid;
  const secondPlayer = runtime.getPlayer(secondConnection.playerUid);
  player.x = 14 * TILE_SIZE;
  player.y = 16 * TILE_SIZE;
  player.z = 0;
  secondPlayer.x = 14 * TILE_SIZE;
  secondPlayer.y = 16 * TILE_SIZE;
  secondPlayer.z = 0;

  serverTime += 1000;
  runtime.update(serverTime);
  const result = runtime.dispatchAction(
    session,
    createUseWorldTransitionAction({
      z: 0,
      col: 14,
      row: 16,
      transitionType: "ropeDown",
      requestedAt: 0,
    }),
  );
  const secondResult = runtime.dispatchAction(
    secondSession,
    createUseWorldTransitionAction({
      z: 0,
      col: 14,
      row: 16,
      transitionType: "ropeDown",
      requestedAt: 0,
    }),
  );

  assert.equal(result.success, true);
  assert.equal(secondResult.success, true);
  assert.deepEqual({ x: player.x, y: player.y, z: player.z }, { x: 14 * TILE_SIZE, y: 16 * TILE_SIZE, z: -1 });
  assert.deepEqual(
    { x: secondPlayer.x, y: secondPlayer.y, z: secondPlayer.z },
    { x: player.x, y: player.y, z: player.z },
  );
  assert.ok(secondPlayer.tileStackOrder > player.tileStackOrder);
});

test("snapshots contain only nearby serialized world entities", async () => {
  const worldMapsByZ = await loadServerWorldMaps();
  const runtime = createAuthoritativeWorldRuntime({ worldMapsByZ });
  const session = {};
  const connection = runtime.connectClient(session, { accountId: "test", characterId: "interest" });
  session.playerUid = connection.playerUid;
  const monster = [...runtime.getWorldEntities().monsters.values()].find((entity) => entity.monsterId === "rat");
  const player = runtime.getPlayer(connection.playerUid);
  player.x = monster.x;
  player.y = monster.y;
  player.z = monster.z;

  const snapshot = runtime.createSnapshotForClient(session);

  assert.equal(snapshot.entities.monsters.some((entity) => entity.uid === monster.uid), true);
  assert.equal("path" in snapshot.entities.monsters.find((entity) => entity.uid === monster.uid), false);
});

test("monster damage is calculated and replicated by the authoritative runtime", async () => {
  const worldMapsByZ = await loadServerWorldMaps();
  let serverTime = 1000;
  const runtime = createAuthoritativeWorldRuntime({
    worldMapsByZ,
    now: () => serverTime,
    combatRandom: {
      getInt: () => 1,
      getFloat: (_minimum, maximum) => maximum,
    },
  });
  const session = {};
  const connection = runtime.connectClient(session, { accountId: "test", characterId: "combat" });
  session.playerUid = connection.playerUid;
  const monster = [...runtime.getWorldEntities().monsters.values()].find((entity) => entity.monsterId === "rat");
  const player = runtime.getPlayer(connection.playerUid);
  player.x = monster.x - TILE_SIZE;
  player.y = monster.y;
  player.z = monster.z;
  const snapshot = runtime.createSnapshotForClient(session);
  const hpBefore = monster.hp;

  serverTime += 1000;
  runtime.update(serverTime);
  const result = runtime.dispatchAction(session, createAttackMonsterAction(monster.uid, 0));
  const deltas = runtime.getDeltasForClient(session, snapshot.revision);

  assert.equal(result.success, true);
  assert.ok(monster.hp < hpBefore);
  assert.equal(deltas[0].upserts.monsters.find((entity) => entity.uid === monster.uid).hp, monster.hp);
  assert.equal(deltas[0].events.some((event) => event.type === "monster-damage-resolved"), true);
});

test("combat events do not leak to a client on another floor", async () => {
  const worldMapsByZ = await loadServerWorldMaps();
  let serverTime = 1000;
  const runtime = createAuthoritativeWorldRuntime({
    worldMapsByZ,
    now: () => serverTime,
    combatRandom: { getInt: () => 1, getFloat: (_minimum, maximum) => maximum },
  });
  const attackerSession = {};
  const observerSession = {};
  const attackerConnection = runtime.connectClient(attackerSession, { accountId: "test", characterId: "attacker" });
  const observerConnection = runtime.connectClient(observerSession, { accountId: "test", characterId: "observer" });
  attackerSession.playerUid = attackerConnection.playerUid;
  observerSession.playerUid = observerConnection.playerUid;
  const monster = [...runtime.getWorldEntities().monsters.values()].find((entity) => entity.monsterId === "rat");
  const attacker = runtime.getPlayer(attackerConnection.playerUid);
  attacker.x = monster.x - TILE_SIZE;
  attacker.y = monster.y;
  attacker.z = monster.z;
  const observerSnapshot = runtime.createSnapshotForClient(observerSession);

  serverTime += 1000;
  runtime.update(serverTime);
  runtime.dispatchAction(attackerSession, createAttackMonsterAction(monster.uid, 0));
  const observerDelta = runtime.getDeltasForClient(observerSession, observerSnapshot.revision)[0];

  assert.equal(observerDelta.revision > observerSnapshot.revision, true);
  assert.equal(observerDelta.events.length, 0);
});

test("monster death atomically grants experience, creates loot and schedules respawn", async () => {
  const worldMapsByZ = await loadServerWorldMaps();
  let serverTime = 1000;
  const runtime = createAuthoritativeWorldRuntime({
    worldMapsByZ,
    now: () => serverTime,
    combatRandom: { getInt: () => 1, getFloat: (_minimum, maximum) => maximum },
  });
  const session = {};
  const connection = runtime.connectClient(session, { accountId: "test", characterId: "death" });
  session.playerUid = connection.playerUid;
  const monster = [...runtime.getWorldEntities().monsters.values()].find((entity) => entity.monsterId === "rat");
  const player = runtime.getPlayer(connection.playerUid);
  player.x = monster.x - TILE_SIZE;
  player.y = monster.y;
  player.z = monster.z;
  monster.hp = 1;
  const snapshot = runtime.createSnapshotForClient(session);
  const experienceBefore = player.experience;

  serverTime += 1000;
  runtime.update(serverTime);
  const result = runtime.dispatchAction(session, createAttackMonsterAction(monster.uid, 0));
  const delta = runtime.getDeltasForClient(session, snapshot.revision)[0];
  const corpse = runtime.getWorldEntities().worldItems.get(result.changes.corpseUid);
  const spawnState = runtime.getWorldEntities().spawnStateById.get(monster.spawnId);

  assert.equal(result.changes.didDie, true);
  assert.equal(runtime.getWorldEntities().monsters.has(monster.uid), false);
  assert.equal(player.experience, experienceBefore + 50);
  assert.equal(corpse.itemId, "ratCorpse");
  assert.equal(corpse.content.length, 2);
  assert.equal(spawnState.pendingRespawnCount, 1);
  assert.deepEqual(delta.removals.monsters, [monster.uid]);
  assert.equal(delta.upserts.worldItems[0].uid, corpse.uid);
});
