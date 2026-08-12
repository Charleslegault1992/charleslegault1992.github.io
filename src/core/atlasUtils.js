import { ATLAS_CELL_SIZE, ATLAS_PADDING } from "./gameConstants.js";

export const getAtlasSource = (col, row, spriteSize) => {
  return {
    sourceX: col * ATLAS_CELL_SIZE + ATLAS_PADDING,
    sourceY: row * ATLAS_CELL_SIZE + ATLAS_PADDING,
    sourceWidth: spriteSize,
    sourceHeight: spriteSize,
  };
};
