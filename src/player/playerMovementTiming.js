import { PLAYER_MOVE_COOLDOWN_MS } from "../core/gameConstants.js";
import { getTileMovementAnimationMultiplier, getTileMovementCost } from "../world/pathfinding.js";
import { getTilePosition } from "../world/worldCoordinates.js";

export const getPlayerMoveCooldown = (player) => {
  const level = Number.isFinite(player?.level) ? player.level : 0;
  const speed = Number.isFinite(player?.speed) ? player.speed : 0;

  if (level < 100) {
    return PLAYER_MOVE_COOLDOWN_MS - level - speed;
  }
  return PLAYER_MOVE_COOLDOWN_MS - 100 - (level - 100) / 2 - speed;
};

export const getPlayerMovementTiming = (player, payload) => {
  if (
    !Number.isFinite(payload?.fromX) ||
    !Number.isFinite(payload?.fromY) ||
    !Number.isFinite(payload?.toX) ||
    !Number.isFinite(payload?.toY)
  ) {
    return null;
  }

  const currentTile = getTilePosition({ x: payload.fromX, y: payload.fromY });
  const nextTile = getTilePosition({ x: payload.toX, y: payload.toY });
  const movementCost = getTileMovementCost(currentTile, nextTile);
  const animationMultiplier = getTileMovementAnimationMultiplier(currentTile, nextTile);
  const baseMoveCooldown = getPlayerMoveCooldown(player);
  if (
    !Number.isFinite(movementCost) ||
    !Number.isFinite(animationMultiplier) ||
    !Number.isFinite(baseMoveCooldown) ||
    baseMoveCooldown < 0
  ) {
    return null;
  }

  return {
    duration: baseMoveCooldown * animationMultiplier,
    cooldown: baseMoveCooldown * movementCost,
  };
};
