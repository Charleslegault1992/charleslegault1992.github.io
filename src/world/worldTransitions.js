import { TILE_SIZE } from "../core/gameConstants.js";

export const setPlayerWorldPositionState = (player, x, y) => {
  if (!player || !Number.isFinite(x) || !Number.isFinite(y)) {
    return false;
  }
  player.x = x;
  player.y = y;
  player.oldX = x;
  player.oldY = y;
  player.renderX = x;
  player.renderY = y;
  player.moveStartTime = 0;
  player.moveDuration = 0;
  return true;
};

export const applyPlayerWorldTransitionState = (player, transition, worldMapsByZ) => {
  const targetZ = transition?.properties?.targetZ;
  const targetCol = transition?.properties?.targetCol;
  const targetRow = transition?.properties?.targetRow;
  if (
    !player ||
    !(worldMapsByZ instanceof Map) ||
    !Number.isInteger(targetZ) ||
    !Number.isInteger(targetCol) ||
    !Number.isInteger(targetRow)
  ) {
    return { success: false, reason: "invalid-transition" };
  }
  if (!worldMapsByZ.has(targetZ)) {
    return { success: false, reason: "target-floor-not-found" };
  }

  const previousZ = player.z;
  const targetX = targetCol * TILE_SIZE;
  const targetY = targetRow * TILE_SIZE;
  player.z = targetZ;
  setPlayerWorldPositionState(player, targetX, targetY);

  return {
    success: true,
    changes: { x: targetX, y: targetY, z: targetZ, previousZ },
    events: [
      {
        type: "player-world-transitioned",
        playerUid: player.uid,
        x: targetX,
        y: targetY,
        z: targetZ,
        previousZ,
      },
    ],
  };
};
