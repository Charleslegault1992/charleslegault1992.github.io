import { TILE_SIZE } from "../core/gameConstants.js";
import { playerState } from "../state/playerState.js";

export const isNearPlayer = (target, range = 1) => {
  const playerCol = playerState.x / TILE_SIZE;
  const playerRow = playerState.y / TILE_SIZE;
  const targetCol = target.x / TILE_SIZE;
  const targetRow = target.y / TILE_SIZE;
  return Math.abs(playerCol - targetCol) <= range && Math.abs(playerRow - targetRow) <= range;
};
