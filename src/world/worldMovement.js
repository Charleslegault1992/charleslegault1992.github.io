import { MAX_STEP_HEIGHT } from "../core/gameConstants.js";
import { getWorldTileSurfaceHeight } from "./worldItemStacks.js";

export const canStepFromTileToTile = (fromX, fromY, toX, toY, z) => {
  const fromHeight = getWorldTileSurfaceHeight(fromX, fromY, z);
  const toHeight = getWorldTileSurfaceHeight(toX, toY, z);
  return toHeight - fromHeight <= MAX_STEP_HEIGHT;
};
