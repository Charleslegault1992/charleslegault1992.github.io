import { CORPSE_DECAY_COOLDOWN_MS } from "../core/gameConstants.js";
import { clamp } from "../core/mathUtils.js";
import { getItemData } from "../items/itemModel.js";
import { playerState } from "../state/playerState.js";
import { observeExistingItemUid } from "../state/uidAllocator.js";
import { activeLitTorchesByUid, decayingItems } from "../state/worldState.js";

export const serializeCharacterItem = (item) => {
  if (!item) {
    return null;
  }

  const serializedItem = {
    uid: item.uid,
    itemId: item.itemId,
    quantity: item.quantity,
  };
  if (Number.isInteger(item.charges)) {
    serializedItem.charges = item.charges;
  }
  if (Number.isInteger(item.decayStage)) {
    serializedItem.decayStage = item.decayStage;
  }
  if (Number.isFinite(item.nextDecayAt)) {
    serializedItem.nextDecayAt = item.nextDecayAt;
  }
  if (typeof item.isLit === "boolean") {
    serializedItem.isLit = item.isLit;
  }
  if (Number.isFinite(item.fuelRemainingMs)) {
    serializedItem.fuelRemainingMs = item.fuelRemainingMs;
  }
  if (Array.isArray(item.content)) {
    serializedItem.content = Array.from(item.content, (contentItem) => serializeCharacterItem(contentItem));
  }
  return serializedItem;
};

const collectCharacterItemUids = (item, itemUids) => {
  if (!item || !(itemUids instanceof Set)) {
    return;
  }
  itemUids.add(item.uid);
  if (Array.isArray(item.content)) {
    for (const contentItem of item.content) {
      collectCharacterItemUids(contentItem, itemUids);
    }
  }
};

export const removeCurrentEquipmentFromDecayTracking = () => {
  const equipmentItemUids = new Set();
  for (const item of Object.values(playerState.equipment)) {
    collectCharacterItemUids(item, equipmentItemUids);
  }
  for (let index = decayingItems.length - 1; index >= 0; index--) {
    if (equipmentItemUids.has(decayingItems[index]?.uid)) {
      decayingItems.splice(index, 1);
    }
  }
  for (const itemUid of equipmentItemUids) {
    activeLitTorchesByUid.delete(itemUid);
  }
};

export const restoreCharacterItem = (serializedItem, restoredItemUids) => {
  if (
    !serializedItem ||
    !Number.isInteger(serializedItem.uid) ||
    restoredItemUids.has(serializedItem.uid) ||
    !getItemData(serializedItem.itemId) ||
    !Number.isInteger(serializedItem.quantity) ||
    serializedItem.quantity <= 0
  ) {
    return null;
  }

  const itemData = getItemData(serializedItem.itemId);
  const item = {
    uid: serializedItem.uid,
    itemId: serializedItem.itemId,
    quantity: serializedItem.quantity,
  };
  restoredItemUids.add(item.uid);
  observeExistingItemUid(item.uid);

  if (Number.isInteger(serializedItem.charges)) {
    item.charges = serializedItem.charges;
  }
  if (itemData.lightSource) {
    item.fuelRemainingMs = Number.isFinite(serializedItem.fuelRemainingMs)
      ? clamp(serializedItem.fuelRemainingMs, 0, itemData.lightSource.fuelDurationMs)
      : itemData.lightSource.fuelDurationMs;
    item.isLit = serializedItem.isLit === true && item.fuelRemainingMs > 0;
    item.lastFuelUpdateAt = item.isLit ? Date.now() : 0;
    if (item.isLit) {
      activeLitTorchesByUid.set(item.uid, item);
    }
  }
  if (itemData.container) {
    const serializedContent = Array.isArray(serializedItem.content) ? serializedItem.content : [];
    item.content = Array.from(serializedContent, (contentItem) => restoreCharacterItem(contentItem, restoredItemUids));
  }
  if (itemData.decayType) {
    const decayCooldown = CORPSE_DECAY_COOLDOWN_MS[itemData.decayType];
    item.decayStage = Number.isInteger(serializedItem.decayStage) ? serializedItem.decayStage : 0;
    item.nextDecayAt = Number.isFinite(serializedItem.nextDecayAt)
      ? serializedItem.nextDecayAt
      : Date.now() + decayCooldown.stage0;
    decayingItems.push(item);
  }
  return item;
};
