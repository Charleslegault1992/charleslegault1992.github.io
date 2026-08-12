export const createGameActionEffectRouter = (handlersByEventType = {}) => {
  return (result) => {
    if (!Array.isArray(result?.events)) {
      return;
    }
    for (const event of result.events) {
      const handler = handlersByEventType[event?.type];
      if (typeof handler === "function") {
        handler(event, result);
      }
    }
  };
};
