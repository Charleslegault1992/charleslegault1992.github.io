import { playerState } from "../state/playerState.js";
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

export const calculatePlayerCarriedWeight = () => {
  let totalWeight = 0;
  for (const equipment of Object.values(playerState.equipment)) {
    if (equipment) {
      totalWeight += getItemTotalWeight(equipment);
    }
  }
  return totalWeight;
};

export const getPlayerRemainingCapacity = () => {
  return Number((playerState.capacity - playerState.carriedWeight).toFixed(1));
};

export const updatePlayerCarriedWeight = () => {
  playerState.carriedWeight = Number(calculatePlayerCarriedWeight().toFixed(2));
};
