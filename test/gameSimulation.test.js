import assert from "node:assert/strict";
import test from "node:test";

import {
  createAttackMonsterAction,
  createCastSpellAction,
  createMovePlayerAction,
  createSpeakToNpcAction,
  createUseWorldTransitionAction,
  createWorldInteractionAction,
} from "../src/actions/gameplayActions.js";
import { createInsertItemsAction, createMoveItemAction } from "../src/inventory/inventoryActions.js";
import { createItemInstance } from "../src/items/itemFactory.js";
import { createUseItemAction } from "../src/items/itemUseActions.js";
import { createGameSimulation } from "../src/simulation/gameSimulation.js";
import { createLocalGameTransport } from "../src/simulation/localGameTransport.js";

const createFixture = () => {
  const player = { uid: "player-1", x: 0, y: 0, z: 0, hp: 100, direction: "down" };
  const monster = { uid: 7, x: 64, y: 0, z: 0, hp: 20 };
  const bag = createItemInstance("bag", 1);
  const timing = { nextPlayerMoveTime: 0, nextPlayerAttackTime: 0 };
  const calls = [];
  const transition = { properties: { transitionType: "hole", targetZ: -1 } };
  const interactable = { properties: { interactableId: "chest-1", interactableType: "rewardChest" } };

  const simulation = createGameSimulation({
    state: { player, monstersByUid: new Map([[monster.uid, monster]]), timing },
    rules: {
      canPlayerMove: () => true,
      getPlayerMoveTiming: () => ({ duration: 100, cooldown: 200 }),
      canPlayerAttackMonster: () => true,
      getPlayerAttackCooldownMs: () => 1000,
      canPlayerUseWorldTransition: () => true,
    },
    commands: {
      executeAttackMonster(target) {
        target.hp -= 5;
        return {
          success: true,
          changes: { monsterUid: target.uid, hp: target.hp },
          events: [{ type: "player-attack-resolved", monsterUid: target.uid }],
        };
      },
      executeMoveItem: ({ itemUid }) => ({ success: true, changes: { itemUid } }),
      executeNpcSpeech(payload) {
        calls.push(`npc:${payload.text}`);
        return true;
      },
      executeSpell(payload) {
        calls.push(`spell:${payload.spellId}`);
        return { success: true, changes: { spellId: payload.spellId } };
      },
      executeWorldInteraction(target) {
        calls.push(`world:${target.properties.interactableId}`);
        return true;
      },
      executeWorldTransition() {
        const previousZ = player.z;
        player.z = -1;
        player.x = 128;
        player.y = 192;
        return {
          success: true,
          changes: { z: player.z },
          events: [{ type: "player-world-transitioned", previousZ, z: player.z }],
        };
      },
      findAutomaticWorldTransition: (movingPlayer) => (movingPlayer.x === 64 ? transition : null),
      findContainerByUid: (uid) => (uid === bag.uid ? bag : null),
      findWorldInteractable: (payload) => (payload.interactableId === "chest-1" ? interactable : null),
      findWorldTransition: () => transition,
      getPlayerByUid: (uid) => (uid === player.uid ? player : null),
      getRemainingCapacity: () => 1000,
      getSpellById: (spellId) => (spellId === "light" ? { spellId } : null),
    },
  });

  return {
    bag,
    calls,
    interactable,
    monster,
    player,
    simulation,
    timing,
    transport: createLocalGameTransport({ simulation }),
  };
};

test("movement is authoritative, rate limited and can apply a floor transition", () => {
  const { player, timing, transport } = createFixture();
  const action = createMovePlayerAction({
    fromX: 0,
    fromY: 0,
    fromZ: 0,
    toX: 64,
    toY: 0,
    direction: "right",
    isNavigationMovement: false,
    requestedAt: 100,
  });

  const result = transport.send(action);

  assert.equal(result.success, true);
  assert.deepEqual({ x: player.x, y: player.y, z: player.z }, { x: 128, y: 192, z: -1 });
  assert.equal(timing.nextPlayerMoveTime, 300);
  assert.equal(result.events.some((event) => event.type === "player-world-transitioned"), true);

  const tooEarly = transport.send(createMovePlayerAction({
    fromX: 128,
    fromY: 192,
    fromZ: -1,
    toX: 192,
    toY: 192,
    direction: "right",
    isNavigationMovement: false,
    requestedAt: 200,
  }));
  assert.equal(tooEarly.success, false);
});

test("movement jitter tolerance preserves the authoritative cooldown cadence", () => {
  const player = { uid: "player-1", x: 0, y: 0, z: 0, hp: 100, direction: "down" };
  const timing = { nextPlayerMoveTime: 200, nextPlayerAttackTime: 0 };
  const simulation = createGameSimulation({
    state: { player, monstersByUid: new Map(), timing },
    rules: {
      canPlayerMove: () => true,
      getMovementCooldownToleranceMs: () => 50,
      getPlayerMoveTiming: () => ({ duration: 100, cooldown: 200 }),
    },
    commands: {},
  });

  const result = simulation.dispatch(createMovePlayerAction({
    fromX: 0,
    fromY: 0,
    fromZ: 0,
    toX: 64,
    toY: 0,
    direction: "right",
    isNavigationMovement: false,
    requestedAt: 150,
  }));

  assert.equal(result.success, true);
  assert.equal(player.moveStartTime, 200);
  assert.equal(timing.nextPlayerMoveTime, 400);
});

test("combat is resolved by uid and enforces the shared attack cooldown", () => {
  const { monster, timing, transport } = createFixture();

  const result = transport.send(createAttackMonsterAction(monster.uid, 1000));
  const tooEarly = transport.send(createAttackMonsterAction(monster.uid, 1500));

  assert.equal(result.success, true);
  assert.equal(monster.hp, 15);
  assert.equal(timing.nextPlayerAttackTime, 2000);
  assert.equal(tooEarly.reason, "attack-cooldown");
});

test("an invalid attack timing is rejected before combat mutates the target", () => {
  const player = { uid: "player-1", x: 0, y: 0, z: 0, hp: 100 };
  const monster = { uid: 9, x: 64, y: 0, z: 0, hp: 20 };
  const simulation = createGameSimulation({
    state: {
      player,
      monstersByUid: new Map([[monster.uid, monster]]),
      timing: { nextPlayerMoveTime: 0, nextPlayerAttackTime: 0 },
    },
    rules: {
      canPlayerAttackMonster: () => true,
      getPlayerAttackCooldownMs: () => Number.NaN,
    },
    commands: {
      executeAttackMonster: (target) => {
        target.hp -= 5;
        return { success: true };
      },
    },
  });

  const result = createLocalGameTransport({ simulation }).send(createAttackMonsterAction(monster.uid, 100));

  assert.equal(result.reason, "invalid-attack-cooldown");
  assert.equal(monster.hp, 20);
});

test("NPC speech, spells, interactables and explicit transitions share one transport", () => {
  const { calls, player, transport } = createFixture();

  assert.equal(transport.send(createSpeakToNpcAction("salut", player.uid, 10)).success, true);
  assert.equal(transport.send(createCastSpellAction("light", 11)).success, true);
  assert.equal(transport.send(createWorldInteractionAction({
    interactableId: "chest-1",
    interactionType: "rewardChest",
    z: 0,
    col: 1,
    row: 1,
    requestedAt: 12,
  })).success, true);
  assert.equal(transport.send(createUseWorldTransitionAction({
    z: 0,
    col: 1,
    row: 1,
    transitionType: "ropeUp",
    requestedAt: 13,
  })).success, true);
  assert.deepEqual(calls, ["npc:salut", "spell:light", "world:chest-1"]);
});

test("inventory insertions and moves cross the same simulation boundary", () => {
  const { bag, transport } = createFixture();

  const insertResult = transport.send(createInsertItemsAction(bag.uid, [{ itemId: "apple", quantity: 1 }]));
  const moveResult = transport.send(createMoveItemAction(
    { locationType: "containerSlot", parentContainerUid: bag.uid, slotIndex: 0 },
    { locationType: "worldTile", x: 64, y: 64, z: 0 },
    bag.content[0].uid,
  ));

  assert.equal(insertResult.success, true);
  assert.equal(bag.content[0].itemId, "apple");
  assert.equal(moveResult.success, true);
});

test("the local transport isolates commands and publishes simulation results", () => {
  const { simulation, transport } = createFixture();
  const receivedResults = [];
  simulation.subscribe((result) => receivedResults.push(result));
  const action = createCastSpellAction("light", 10);

  const result = transport.send(action);

  assert.equal(result.success, true);
  assert.equal(receivedResults.length, 1);
  assert.notEqual(result, receivedResults[0]);
});

test("client effect failures cannot reject an authoritative action", () => {
  const reportedErrors = [];
  const player = { uid: "player-1", x: 0, y: 0, z: 0, hp: 100 };
  const simulation = createGameSimulation({
    state: {
      player,
      monstersByUid: new Map(),
      timing: { nextPlayerMoveTime: 0, nextPlayerAttackTime: 0 },
    },
    rules: {},
    commands: {
      executeSpell: () => ({ success: true, events: [{ type: "spell-cast-resolved" }] }),
      getSpellById: () => ({}),
    },
    onListenerError: (error) => reportedErrors.push(error),
  });
  simulation.subscribe(() => {
    throw new Error("broken visual effect");
  });

  const result = createLocalGameTransport({ simulation }).send(createCastSpellAction("light", 10));

  assert.equal(result.success, true);
  assert.equal(reportedErrors.length, 1);
});

test("item use resolves the current source again inside the simulation", () => {
  const item = { uid: 15, itemId: "apple", quantity: 1 };
  const source = { locationType: "containerSlot", parentContainerUid: 2, slotIndex: 0 };
  const player = { uid: "player-1", x: 0, y: 0, z: 0, hp: 100 };
  const simulation = createGameSimulation({
    state: {
      player,
      monstersByUid: new Map(),
      timing: { nextPlayerMoveTime: 0, nextPlayerAttackTime: 0 },
    },
    rules: {},
    commands: {
      getItemFromLocation: () => item,
      getItemUseData: () => ({ action: "eat" }),
      executeItemUse: (resolvedItem) => ({
        success: true,
        changes: { itemUid: resolvedItem.uid },
        events: [{ type: "item-use-resolved", itemUid: resolvedItem.uid }],
      }),
    },
  });
  const transport = createLocalGameTransport({ simulation });

  const accepted = transport.send(createUseItemAction({ source, itemUid: item.uid, requestedAt: 100 }));
  const stale = transport.send(createUseItemAction({ source, itemUid: 99, requestedAt: 101 }));

  assert.equal(accepted.success, true);
  assert.equal(accepted.events[0].type, "item-use-resolved");
  assert.equal(stale.reason, "item-changed");
});
