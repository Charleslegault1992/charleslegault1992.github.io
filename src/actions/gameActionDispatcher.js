import { failGameAction, rejectGameAction } from "./gameAction.js";

export const createGameActionDispatcher = () => {
  const handlersByType = new Map();

  return Object.freeze({
    register(type, handler) {
      if (typeof type !== "string" || type === "" || typeof handler !== "function" || handlersByType.has(type)) {
        return false;
      }
      handlersByType.set(type, handler);
      return true;
    },

    dispatch(action, context = {}) {
      if (!action || typeof action.type !== "string") {
        return rejectGameAction(action, "invalid-action");
      }
      const handler = handlersByType.get(action.type);
      if (!handler) {
        return rejectGameAction(action, "unknown-action");
      }
      try {
        return handler(action, context) ?? failGameAction(action, "empty-result");
      } catch {
        return failGameAction(action, "unexpected-error");
      }
    },
  });
};
