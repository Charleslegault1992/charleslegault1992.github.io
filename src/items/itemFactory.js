import { CORPSE_DECAY_COOLDOWN_MS } from "../core/gameConstants.js";
import { decayingItems } from "../state/worldState.js";
import { allocateItemUid } from "../state/uidAllocator.js";
import { getItemData } from "./itemModel.js";

export const createItemInstance = (itemId, quantity, content = [], options = {}) => {
  const itemData = getItemData(itemId);
  if (!itemData) {
    return null;
  }
  const itemInstance = {
    itemId,
    quantity,
    uid: allocateItemUid(),
  };

  if (itemData.use && "charges" in itemData.use) {
    itemInstance.charges = itemData.use.charges;
  }
  if (itemData.container) {
    itemInstance.content = content;
  }
  if (itemData.lightSource) {
    itemInstance.isLit = false;
    itemInstance.fuelRemainingMs = itemData.lightSource.fuelDurationMs;
    itemInstance.lastFuelUpdateAt = 0;
  }
  if (itemData.decayType) {
    const decayCooldown = CORPSE_DECAY_COOLDOWN_MS[itemData.decayType];
    if (!decayCooldown) {
      return null;
    }
    itemInstance.decayStage = 0;
    const currentTime = typeof options.now === "function" ? options.now() : Date.now();
    itemInstance.nextDecayAt = currentTime + decayCooldown.stage0;
    const decayCollection = Array.isArray(options.decayingItems) ? options.decayingItems : decayingItems;
    decayCollection.push(itemInstance);
  }
  return itemInstance;
};

export const createGroundItem = (itemId, quantity, x, y, z, content = [], options = {}) => {
  const worldItem = createItemInstance(itemId, quantity, content, options);
  if (!worldItem) {
    return null;
  }
  worldItem.x = x;
  worldItem.y = y;
  worldItem.z = z;
  return worldItem;
};
