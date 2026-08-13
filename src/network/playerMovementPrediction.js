import { GAMEPLAY_ACTION_TYPE } from "../actions/gameplayActions.js";

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
  return true;
};

export const createPlayerMovementPrediction = () => {
  const pendingActions = [];

  const replay = (authoritativePlayer) => {
    if (!authoritativePlayer) {
      return null;
    }
    const predictedPlayer = structuredClone(authoritativePlayer);
    for (const action of pendingActions) {
      applyPredictedMovement(predictedPlayer, action);
    }
    return predictedPlayer;
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
      pendingActions.splice(index, 1);
      return true;
    },
    reconcile(authoritativePlayer, acknowledgedRequestId = null) {
      acknowledge(acknowledgedRequestId);
      return replay(authoritativePlayer);
    },
    getPendingRequestIds: () => pendingActions.map((action) => action.requestId),
  });
};
