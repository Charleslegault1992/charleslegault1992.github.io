import { GAMEPLAY_ACTION_TYPE } from "../actions/gameplayActions.js";
import { getPlayerMovementTiming } from "../player/playerMovementTiming.js";

const applyPredictedMovement = (player, action) => {
  const payload = action?.payload;
  if (
    action?.type !== GAMEPLAY_ACTION_TYPE.movePlayer ||
    player.x !== payload?.fromX ||
    player.y !== payload?.fromY ||
    player.z !== payload?.fromZ
  ) {
    return false;
  }
  player.oldX = player.x;
  player.oldY = player.y;
  player.x = payload.toX;
  player.y = payload.toY;
  player.direction = payload.direction;
  const moveTiming = getPlayerMovementTiming(player, payload);
  player.moveStartTime = payload.requestedAt;
  player.moveDuration = moveTiming?.duration ?? 0;
  return true;
};

export const createPlayerMovementPrediction = () => {
  const pendingActions = [];

  const replayWithState = (authoritativePlayer) => {
    if (!authoritativePlayer) {
      return { player: null, appliedActionCount: 0 };
    }
    const predictedPlayer = structuredClone(authoritativePlayer);
    let appliedActionCount = 0;
    for (const action of pendingActions) {
      if (applyPredictedMovement(predictedPlayer, action)) {
        appliedActionCount += 1;
      }
    }
    return { player: predictedPlayer, appliedActionCount };
  };

  const acknowledge = (requestId) => {
    if (typeof requestId !== "string" || requestId === "") {
      return false;
    }
    const acknowledgedIndex = pendingActions.findIndex((action) => action.requestId === requestId);
    if (acknowledgedIndex < 0) {
      return false;
    }
    pendingActions.splice(0, acknowledgedIndex + 1);
    return true;
  };

  return Object.freeze({
    enqueue(action) {
      if (
        action?.type !== GAMEPLAY_ACTION_TYPE.movePlayer ||
        typeof action.requestId !== "string" ||
        pendingActions.some((pendingAction) => pendingAction.requestId === action.requestId)
      ) {
        return false;
      }
      pendingActions.push(structuredClone(action));
      return true;
    },
    reject(requestId) {
      const index = pendingActions.findIndex((action) => action.requestId === requestId);
      if (index < 0) {
        return false;
      }
      pendingActions.splice(index);
      return true;
    },
    reconcile(authoritativePlayer, acknowledgedRequestId = null) {
      acknowledge(acknowledgedRequestId);
      return replayWithState(authoritativePlayer).player;
    },
    reconcileWithState(authoritativePlayer, acknowledgedRequestId = null) {
      acknowledge(acknowledgedRequestId);
      return replayWithState(authoritativePlayer);
    },
    getPendingRequestIds: () => pendingActions.map((action) => action.requestId),
  });
};
