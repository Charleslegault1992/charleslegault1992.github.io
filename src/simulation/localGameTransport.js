export const createLocalGameTransport = ({ simulation }) => {
  if (typeof simulation?.dispatch !== "function") {
    throw new TypeError("The local transport requires a game simulation.");
  }

  return Object.freeze({
    send(action) {
      if (!action) {
        return null;
      }
      const transportedAction = structuredClone(action);
      const result = simulation.dispatch(transportedAction);
      return structuredClone(result);
    },
    subscribe(listener) {
      return simulation.subscribe(listener);
    },
  });
};
