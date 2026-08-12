import test from "node:test";
import assert from "node:assert/strict";

import { createGameActionDispatcher } from "../src/actions/gameActionDispatcher.js";
import {
  createAttackMonsterAction,
  createCastSpellAction,
  createMovePlayerAction,
  createSpeakToNpcAction,
  createUseWorldTransitionAction,
  createWorldInteractionAction,
  registerGameplayActionHandlers,
} from "../src/actions/gameplayActions.js";

test("gameplay action builders create serializable transport contracts", () => {
  const actions = [
    createMovePlayerAction({
      fromX: 64,
      fromY: 64,
      fromZ: 0,
      toX: 128,
      toY: 64,
      direction: "right",
      isNavigationMovement: false,
      requestedAt: 100,
    }),
    createAttackMonsterAction(12, 101),
    createSpeakToNpcAction("salut", "local-player", 102),
    createWorldInteractionAction({
      interactableId: "chest-1",
      interactionType: "rewardChest",
      z: 0,
      col: 3,
      row: 4,
      requestedAt: 103,
    }),
    createCastSpellAction("light", 104),
    createUseWorldTransitionAction({
      z: -1,
      col: 3,
      row: 4,
      transitionType: "ropeUp",
      requestedAt: 105,
    }),
  ];

  assert.equal(actions.every(Boolean), true);
  assert.doesNotThrow(() => JSON.stringify(actions));
});

test("gameplay handlers execute through the dispatcher boundary", () => {
  const dispatcher = createGameActionDispatcher();
  registerGameplayActionHandlers(dispatcher);
  const action = createAttackMonsterAction(14, 500);

  const result = dispatcher.dispatch(action, {
    executeAttackMonster(payload) {
      return { success: true, changes: { attackedUid: payload.monsterUid } };
    },
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.changes, { attackedUid: 14 });
});

test("gameplay handlers preserve a domain rejection reason", () => {
  const dispatcher = createGameActionDispatcher();
  registerGameplayActionHandlers(dispatcher);
  const action = createCastSpellAction("heal", 600);

  const result = dispatcher.dispatch(action, {
    executeCastSpell: () => ({ success: false, reason: "not-enough-mana" }),
  });

  assert.equal(result.success, false);
  assert.equal(result.reason, "not-enough-mana");
});
