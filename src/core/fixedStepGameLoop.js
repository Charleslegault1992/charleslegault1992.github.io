import {
  GAME_LOGIC_STEP_MS,
  MAX_FRAME_DELTA_MS,
  MAX_LOGIC_STEPS_PER_FRAME,
} from "./gameConstants.js";
import { frameTimingState } from "../state/clientRuntimeState.js";

const updateFpsCounter = (fpsCounter, frameTime) => {
  if (!fpsCounter) {
    return;
  }
  frameTimingState.fpsFrameCount++;
  if (frameTimingState.fpsLastUpdateTime === 0) {
    frameTimingState.fpsLastUpdateTime = frameTime;
  }
  const elapsed = frameTime - frameTimingState.fpsLastUpdateTime;
  if (elapsed >= 1000) {
    frameTimingState.currentFps = Math.round((frameTimingState.fpsFrameCount * 1000) / elapsed);
    fpsCounter.textContent = `FPS: ${frameTimingState.currentFps}`;
    frameTimingState.fpsFrameCount = 0;
    frameTimingState.fpsLastUpdateTime = frameTime;
  }
};

export const startFixedStepGameLoop = ({ updateGameLogic, renderGameFrame, renderPixiFrame, fpsCounter }) => {
  if (
    typeof updateGameLogic !== "function" ||
    typeof renderGameFrame !== "function" ||
    typeof renderPixiFrame !== "function"
  ) {
    return false;
  }

  const gameLoop = (frameTime) => {
    if (frameTimingState.previousFrameTime === null) {
      frameTimingState.previousFrameTime = frameTime;
      requestAnimationFrame(gameLoop);
      return;
    }

    const frameDelta = Math.min(frameTime - frameTimingState.previousFrameTime, MAX_FRAME_DELTA_MS);
    frameTimingState.previousFrameTime = frameTime;
    frameTimingState.accumulatedLogicTime += frameDelta;
    const frameNow = Date.now();
    let logicSteps = 0;
    while (
      frameTimingState.accumulatedLogicTime >= GAME_LOGIC_STEP_MS &&
      logicSteps < MAX_LOGIC_STEPS_PER_FRAME
    ) {
      updateGameLogic(frameNow);
      frameTimingState.accumulatedLogicTime -= GAME_LOGIC_STEP_MS;
      logicSteps++;
    }
    if (logicSteps >= MAX_LOGIC_STEPS_PER_FRAME) {
      frameTimingState.accumulatedLogicTime = 0;
    }

    renderGameFrame(frameNow);
    renderPixiFrame(frameTime);
    updateFpsCounter(fpsCounter, frameTime);
    requestAnimationFrame(gameLoop);
  };

  requestAnimationFrame(gameLoop);
  return true;
};
