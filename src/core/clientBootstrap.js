export const createClientBootstrap = ({ runtimeState, phases, onStarted = null }) => {
  if (!runtimeState || !Array.isArray(phases)) {
    throw new TypeError("A runtime state and bootstrap phases are required.");
  }

  const start = async () => {
    if (runtimeState.isStarting || runtimeState.isStarted) {
      return { success: false, reason: "already-started", context: null };
    }

    runtimeState.isStarting = true;
    const context = {};
    try {
      for (const phase of phases) {
        if (typeof phase?.run !== "function") {
          throw new TypeError(`Invalid bootstrap phase: ${phase?.name ?? "unknown"}`);
        }
        const phaseResult = await phase.run(context);
        if (phaseResult && typeof phaseResult === "object") {
          Object.assign(context, phaseResult);
        }
      }
      runtimeState.isStarted = true;
      if (typeof onStarted === "function") {
        await onStarted(context);
      }
      return { success: true, reason: null, context };
    } catch (error) {
      runtimeState.isStarted = false;
      throw error;
    } finally {
      runtimeState.isStarting = false;
    }
  };

  return { start };
};
