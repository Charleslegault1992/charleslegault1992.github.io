import {
  createGameAction,
  createGameActionResult,
  GAME_ACTION_RESULT,
  rejectGameAction,
  succeedGameAction,
} from "./gameAction.js";

export const GAMEPLAY_ACTION_TYPE = Object.freeze({
  movePlayer: "gameplay.move-player",
  attackMonster: "gameplay.attack-monster",
  attackPlayer: "gameplay.attack-player",
  setPvpEnabled: "gameplay.set-pvp-enabled",
  speakToNpc: "gameplay.speak-to-npc",
  interactWithWorld: "gameplay.interact-with-world",
  useWorldTransition: "gameplay.use-world-transition",
  castSpell: "gameplay.cast-spell",
  sendChatMessage: "gameplay.send-chat-message",
});

export const GAMEPLAY_ACTION_REASON = Object.freeze({
  invalidRequest: "invalid-request",
  missingExecutor: "missing-executor",
  executionRejected: "execution-rejected",
});

const createTimedGameAction = (type, payload, requestedAt) => {
  if (!Number.isFinite(requestedAt)) {
    return null;
  }
  return createGameAction(type, { ...payload, requestedAt });
};

export const createMovePlayerAction = ({ fromX, fromY, fromZ, toX, toY, direction, isNavigationMovement, requestedAt }) => {
  if (
    !Number.isFinite(fromX) ||
    !Number.isFinite(fromY) ||
    !Number.isInteger(fromZ) ||
    !Number.isFinite(toX) ||
    !Number.isFinite(toY) ||
    typeof direction !== "string" ||
    direction === "" ||
    typeof isNavigationMovement !== "boolean"
  ) {
    return null;
  }
  return createTimedGameAction(
    GAMEPLAY_ACTION_TYPE.movePlayer,
    { fromX, fromY, fromZ, toX, toY, direction, isNavigationMovement },
    requestedAt,
  );
};

export const createAttackMonsterAction = (monsterUid, requestedAt) => {
  if (!Number.isInteger(monsterUid)) {
    return null;
  }
  return createTimedGameAction(GAMEPLAY_ACTION_TYPE.attackMonster, { monsterUid }, requestedAt);
};

export const createAttackPlayerAction = (playerUid, requestedAt) => {
  if (typeof playerUid !== "string" || playerUid === "") {
    return null;
  }
  return createTimedGameAction(GAMEPLAY_ACTION_TYPE.attackPlayer, { playerUid }, requestedAt);
};

export const createSetPvpEnabledAction = (enabled, requestedAt) => {
  if (typeof enabled !== "boolean") {
    return null;
  }
  return createTimedGameAction(GAMEPLAY_ACTION_TYPE.setPvpEnabled, { enabled }, requestedAt);
};

export const createSpeakToNpcAction = (text, playerUid, requestedAt) => {
  if (typeof text !== "string" || text.trim() === "" || typeof playerUid !== "string" || playerUid === "") {
    return null;
  }
  return createTimedGameAction(GAMEPLAY_ACTION_TYPE.speakToNpc, { text, playerUid }, requestedAt);
};

export const createWorldInteractionAction = ({ interactableId, interactionType, z, col, row, requestedAt }) => {
  if (
    typeof interactableId !== "string" ||
    interactableId === "" ||
    typeof interactionType !== "string" ||
    interactionType === "" ||
    !Number.isInteger(z) ||
    !Number.isInteger(col) ||
    !Number.isInteger(row)
  ) {
    return null;
  }
  return createTimedGameAction(
    GAMEPLAY_ACTION_TYPE.interactWithWorld,
    { interactableId, interactionType, z, col, row },
    requestedAt,
  );
};

export const createCastSpellAction = (spellId, requestedAt) => {
  if (typeof spellId !== "string" || spellId === "") {
    return null;
  }
  return createTimedGameAction(GAMEPLAY_ACTION_TYPE.castSpell, { spellId }, requestedAt);
};

export const createSendChatMessageAction = (channelId, text, requestedAt) => {
  const normalizedText = typeof text === "string" ? text.trim() : "";
  if (
    !["local", "global", "trade"].includes(channelId) ||
    normalizedText === "" ||
    normalizedText.length > 200
  ) {
    return null;
  }
  return createTimedGameAction(GAMEPLAY_ACTION_TYPE.sendChatMessage, { channelId, text: normalizedText }, requestedAt);
};

export const createUseWorldTransitionAction = ({ z, col, row, transitionType, requestedAt }) => {
  if (
    !Number.isInteger(z) ||
    !Number.isInteger(col) ||
    !Number.isInteger(row) ||
    typeof transitionType !== "string" ||
    transitionType === ""
  ) {
    return null;
  }
  return createTimedGameAction(
    GAMEPLAY_ACTION_TYPE.useWorldTransition,
    { z, col, row, transitionType },
    requestedAt,
  );
};

const executeGameplayAction = (action, context, executorName) => {
  const executor = context?.[executorName];
  if (typeof executor !== "function") {
    return rejectGameAction(action, GAMEPLAY_ACTION_REASON.missingExecutor);
  }
  const executionResult = executor(action.payload, action);
  if (executionResult?.success === false || executionResult === false) {
    return createGameActionResult(
      action,
      GAME_ACTION_RESULT.rejected,
      executionResult?.reason ?? GAMEPLAY_ACTION_REASON.executionRejected,
      executionResult?.changes ?? null,
      Array.isArray(executionResult?.events) ? executionResult.events : [],
    );
  }
  const changes = executionResult?.changes ?? (executionResult === true ? null : executionResult);
  const events = Array.isArray(executionResult?.events) ? executionResult.events : [];
  return succeedGameAction(action, changes, events);
};

export const registerGameplayActionHandlers = (dispatcher) => {
  const registrations = [
    [GAMEPLAY_ACTION_TYPE.movePlayer, "executeMovePlayer"],
    [GAMEPLAY_ACTION_TYPE.attackMonster, "executeAttackMonster"],
    [GAMEPLAY_ACTION_TYPE.attackPlayer, "executeAttackPlayer"],
    [GAMEPLAY_ACTION_TYPE.setPvpEnabled, "executeSetPvpEnabled"],
    [GAMEPLAY_ACTION_TYPE.speakToNpc, "executeSpeakToNpc"],
    [GAMEPLAY_ACTION_TYPE.interactWithWorld, "executeWorldInteraction"],
    [GAMEPLAY_ACTION_TYPE.useWorldTransition, "executeWorldTransition"],
    [GAMEPLAY_ACTION_TYPE.castSpell, "executeCastSpell"],
    [GAMEPLAY_ACTION_TYPE.sendChatMessage, "executeSendChatMessage"],
  ];

  return registrations.every(([type, executorName]) =>
    dispatcher?.register?.(type, (action, context) => executeGameplayAction(action, context, executorName)),
  );
};
