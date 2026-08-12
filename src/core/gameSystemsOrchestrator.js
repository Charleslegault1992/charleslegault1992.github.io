const runSystems = (systems, context) => {
  for (const system of systems) {
    system(context);
  }
};

export const createGameSystemsOrchestrator = ({
  createLogicContext = (now) => ({ now }),
  createRenderContext = (now) => ({ now }),
  logicSystems = [],
  renderSystems = [],
}) => {
  if (
    typeof createLogicContext !== "function" ||
    typeof createRenderContext !== "function" ||
    !logicSystems.every((system) => typeof system === "function") ||
    !renderSystems.every((system) => typeof system === "function")
  ) {
    throw new TypeError("Game systems require valid context factories and functions.");
  }

  return {
    update(now) {
      runSystems(logicSystems, createLogicContext(now));
    },
    render(now) {
      runSystems(renderSystems, createRenderContext(now));
    },
  };
};
