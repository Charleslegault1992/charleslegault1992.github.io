let nextLocalActionRequestId = 1;

export const GAME_ACTION_RESULT = Object.freeze({
  success: "success",
  rejected: "rejected",
  failed: "failed",
});

export const createGameAction = (type, payload = {}) => {
  if (typeof type !== "string" || type === "" || !payload || typeof payload !== "object") {
    return null;
  }
  const requestId = `local-${nextLocalActionRequestId}`;
  nextLocalActionRequestId += 1;
  return Object.freeze({
    requestId,
    type,
    payload: structuredClone(payload),
  });
};

export const createGameActionResult = (action, status, reason = null, changes = null, events = []) => {
  if (!action || !Object.values(GAME_ACTION_RESULT).includes(status)) {
    return null;
  }
  if (!Array.isArray(events)) {
    return null;
  }
  return Object.freeze({
    requestId: action.requestId,
    type: action.type,
    success: status === GAME_ACTION_RESULT.success,
    status,
    reason,
    changes: structuredClone(changes),
    events: structuredClone(events),
  });
};

export const rejectGameAction = (action, reason) => {
  return createGameActionResult(action, GAME_ACTION_RESULT.rejected, reason);
};

export const failGameAction = (action, reason) => {
  return createGameActionResult(action, GAME_ACTION_RESULT.failed, reason);
};

export const succeedGameAction = (action, changes = null, events = []) => {
  return createGameActionResult(action, GAME_ACTION_RESULT.success, null, changes, events);
};
