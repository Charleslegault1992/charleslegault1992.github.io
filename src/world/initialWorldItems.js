import { TILE_SIZE } from "../core/gameConstants.js";
import { createGroundItem, createItemInstance } from "../items/itemFactory.js";

const INITIAL_WORLD_ITEM_DEFINITIONS = Object.freeze([
  Object.freeze({ uid: -1, itemId: "smallBox", col: 13, row: 10, z: 0 }),
  Object.freeze({ uid: -2, itemId: "smallBox", col: 14, row: 9, z: 0 }),
  Object.freeze({ uid: -3, itemId: "box", col: 14, row: 10, z: 0 }),
  Object.freeze({ uid: -4, itemId: "fireRune", col: 14, row: 10, z: 0 }),
  Object.freeze({ uid: -5, itemId: "smallBox", col: 14, row: 11, z: 0 }),
  Object.freeze({ uid: -6, itemId: "smallBox", col: 15, row: 10, z: 0 }),
]);

export const createInitialWorldItems = (z = 0) => {
  if (!Number.isInteger(z)) {
    return [];
  }

  return INITIAL_WORLD_ITEM_DEFINITIONS.filter((definition) => definition.z === z).flatMap((definition) => {
    const content = (definition.contentItemIds ?? []).map((itemId) => createItemInstance(itemId, 1)).filter(Boolean);
    const item = createGroundItem(
      definition.itemId,
      1,
      definition.col * TILE_SIZE,
      definition.row * TILE_SIZE,
      definition.z,
      content,
    );
    if (!item) {
      return [];
    }
    item.uid = definition.uid;
    return [item];
  });
};
