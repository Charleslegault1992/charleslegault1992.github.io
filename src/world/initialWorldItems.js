import { TILE_SIZE } from "../core/gameConstants.js";
import { createGroundItem } from "../items/itemFactory.js";

const INITIAL_WORLD_ITEM_DEFINITIONS = Object.freeze([
  Object.freeze({ itemId: "smallBox", col: 13, row: 10 }),
  Object.freeze({ itemId: "smallBox", col: 14, row: 9 }),
  Object.freeze({ itemId: "box", col: 14, row: 10 }),
  Object.freeze({ itemId: "fireRune", col: 14, row: 10 }),
  Object.freeze({ itemId: "smallBox", col: 14, row: 11 }),
  Object.freeze({ itemId: "smallBox", col: 15, row: 10 }),
]);

export const createInitialWorldItems = (z = 0) => {
  if (!Number.isInteger(z)) {
    return [];
  }

  return INITIAL_WORLD_ITEM_DEFINITIONS.flatMap((definition, index) => {
    const item = createGroundItem(
      definition.itemId,
      1,
      definition.col * TILE_SIZE,
      definition.row * TILE_SIZE,
      z,
    );
    if (!item) {
      return [];
    }
    item.uid = -(index + 1);
    return [item];
  });
};
