import { getItemData, isContainerItem } from "../items/itemModel.js";

export const getItemTotalWeight = (item) => {
  if (!item) {
    return 0;
  }
  const itemData = getItemData(item.itemId);
  if (!itemData) {
    return 0;
  }
  let totalWeight = itemData.weight * item.quantity;
  if (isContainerItem(item) && Array.isArray(item.content)) {
    for (const containedItem of item.content) {
      totalWeight += getItemTotalWeight(containedItem);
    }
  }
  return totalWeight;
};

export const calculatePlayerCarriedWeight = (player) => {
  if (!player?.equipment) {
    return 0;
  }
  let totalWeight = 0;
  for (const equipment of Object.values(player.equipment)) {
    if (equipment) {
      totalWeight += getItemTotalWeight(equipment);
    }
  }
  return totalWeight;
};

export const getPlayerRemainingCapacity = (player) => {
  if (!Number.isFinite(player?.capacity) || !Number.isFinite(player?.carriedWeight)) {
    return 0;
  }
  return Number((player.capacity - player.carriedWeight).toFixed(1));
};

export const updatePlayerCarriedWeight = (player) => {
  if (!player) {
    return false;
  }
  player.carriedWeight = Number(calculatePlayerCarriedWeight(player).toFixed(2));
  return true;
};
