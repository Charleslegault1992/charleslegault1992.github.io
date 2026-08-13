import { performance } from "node:perf_hooks";

export const createFixedStepClock = ({ tickRateHz = 30, maxCatchUpSteps = 5, onTick }) => {
  if (
    !Number.isFinite(tickRateHz) ||
    tickRateHz <= 0 ||
    !Number.isInteger(maxCatchUpSteps) ||
    maxCatchUpSteps <= 0 ||
    typeof onTick !== "function"
  ) {
    throw new TypeError("Fixed step clock configuration is invalid.");
  }

  const stepMs = 1000 / tickRateHz;
  let previousTime = null;
  let accumulatedTime = 0;
  let simulationTime = 0;

  const advance = (now) => {
    if (!Number.isFinite(now)) {
      return 0;
    }
    if (previousTime === null) {
      previousTime = now;
      simulationTime = now;
      return 0;
    }
    accumulatedTime += Math.max(now - previousTime, 0);
    previousTime = now;

    let completedSteps = 0;
    while (accumulatedTime >= stepMs && completedSteps < maxCatchUpSteps) {
      simulationTime += stepMs;
      onTick(simulationTime, stepMs);
      accumulatedTime -= stepMs;
      completedSteps += 1;
    }
    if (completedSteps === maxCatchUpSteps && accumulatedTime >= stepMs) {
      accumulatedTime %= stepMs;
    }
    return completedSteps;
  };

  return Object.freeze({ advance, getStepMs: () => stepMs });
};

export const createServerTickLoop = ({ tickRateHz = 30, maxCatchUpSteps = 5, onTick }) => {
  const clock = createFixedStepClock({
    tickRateHz,
    maxCatchUpSteps,
    onTick: (_simulationTime, stepMs) => onTick(Date.now(), stepMs),
  });
  let timer = null;

  const pump = () => {
    clock.advance(performance.now());
    timer = setTimeout(pump, Math.max(Math.floor(clock.getStepMs() / 2), 1));
    timer.unref?.();
  };

  return Object.freeze({
    start() {
      if (timer !== null) {
        return false;
      }
      clock.advance(performance.now());
      pump();
      return true;
    },
    stop() {
      if (timer === null) {
        return false;
      }
      clearTimeout(timer);
      timer = null;
      return true;
    },
    isRunning: () => timer !== null,
  });
};
