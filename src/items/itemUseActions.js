import {
  createGameAction,
  createGameActionResult,
  GAME_ACTION_RESULT,
  rejectGameAction,
  succeedGameAction,
} from "../actions/gameAction.js";
import { isValidItemLocation } from "../inventory/itemLocation.js";

export const ITEM_USE_ACTION_TYPE = Object.freeze({
  useItem: "item.use",
});

export const ITEM_USE_ACTION_REASON = Object.freeze({
  invalidRequest: "invalid-request",
  missingExecutor: "missing-executor",
  executionRejected: "execution-rejected",
});

const isValidItemUseTarget = (target) => {
  if (target === null) {
    return true;
  }
  if (!target || typeof target !== "object") {
    return false;
  }
  if (target.targetType === "self") {
    return typeof target.playerUid === "string" && target.playerUid !== "";
  }
  if (target.targetType === "monster") {
    return Number.isInteger(target.monsterUid);
  }
  if (target.targetType === "player") {
    return typeof target.playerUid === "string" && target.playerUid !== "";
  }
  if (target.targetType === "tile") {
    return Number.isInteger(target.x) && Number.isInteger(target.y) && Number.isInteger(target.z);
  }
  return false;
};

export const createUseItemAction = ({ source, itemUid, target = null, requestedAt }) => {
  if (
    !isValidItemLocation(source) ||
    !Number.isInteger(itemUid) ||
    !isValidItemUseTarget(target) ||
    !Number.isFinite(requestedAt)
  ) {
    return null;
  }
  return createGameAction(ITEM_USE_ACTION_TYPE.useItem, {
    source,
    itemUid,
    target,
    requestedAt,
  });
};

export const executeUseItemAction = (action, context) => {
  const { source, itemUid, target, requestedAt } = action?.payload ?? {};
  if (
    !isValidItemLocation(source) ||
    !Number.isInteger(itemUid) ||
    !isValidItemUseTarget(target ?? null) ||
    !Number.isFinite(requestedAt)
  ) {
    return rejectGameAction(action, ITEM_USE_ACTION_REASON.invalidRequest);
  }
  if (typeof context?.executeUseItem !== "function") {
    return rejectGameAction(action, ITEM_USE_ACTION_REASON.missingExecutor);
  }
  const executionResult = context.executeUseItem(action.payload, action);
  if (executionResult?.success === false || executionResult === false) {
    return createGameActionResult(
      action,
      GAME_ACTION_RESULT.rejected,
      executionResult?.reason ?? ITEM_USE_ACTION_REASON.executionRejected,
      executionResult?.changes ?? null,
      Array.isArray(executionResult?.events) ? executionResult.events : [],
    );
  }
  return succeedGameAction(
    action,
    executionResult?.changes ?? null,
    Array.isArray(executionResult?.events) ? executionResult.events : [],
  );
};

export const registerItemUseActionHandlers = (dispatcher) => {
  return dispatcher?.register?.(ITEM_USE_ACTION_TYPE.useItem, executeUseItemAction) === true;
};
