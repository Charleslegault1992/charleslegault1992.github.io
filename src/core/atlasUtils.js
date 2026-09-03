import { ATLAS_CELL_SIZE, ATLAS_PADDING } from "./gameConstants.js";

import { ATLAS_CELL_SIZE, ATLAS_PADDING } from "./gameConstants.js";

export const getAtlasSource = (col, row, spriteSize, options = {}) => {
  const cellSize = Number.isFinite(options.cellSize) ? options.cellSize : ATLAS_CELL_SIZE;
  const padding = Number.isFinite(options.padding) ? options.padding : ATLAS_PADDING;

  return {
    sourceX: col * cellSize + padding,
    sourceY: row * cellSize + padding,
    sourceWidth: spriteSize,
    sourceHeight: spriteSize,
  };
};
