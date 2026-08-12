import { playerState } from "../state/playerState.js";
import { getItemData } from "../items/itemModel.js";

export const getEquipmentSlotItem = (slotName) => {
  return playerState.equipment[slotName] ?? null;
};

export const setEquipmentSlotItem = (itemLocation, item) => {
  if (
    itemLocation?.locationType !== "equipmentSlot" ||
    typeof itemLocation.equipmentSlotName !== "string" ||
    !(itemLocation.equipmentSlotName in playerState.equipment)
  ) {
    return false;
  }
  playerState.equipment[itemLocation.equipmentSlotName] = item;
  return true;
};

export const canEquipItemInSlot = (item, slotName) => {
  if (!item || typeof slotName !== "string") {
    return false;
  }
  const itemData = getItemData(item.itemId);
  if (!Array.isArray(itemData?.equipmentSlot) || !itemData.equipmentSlot.includes(slotName)) {
    return false;
  }

  if (slotName === "weapon" && itemData.combat?.ammunitionItemId) {
    const offhandItem = playerState.equipment.shield;
    if (offhandItem && offhandItem.itemId !== itemData.combat.ammunitionItemId) {
      return false;
    }
  }

  if (slotName === "shield" && Number.isFinite(itemData.combat?.shieldDefense)) {
    const equippedWeaponData = getItemData(playerState.equipment.weapon?.itemId);
    if (equippedWeaponData?.combat?.ammunitionItemId) {
      return false;
    }
  }

  if (slotName === "shield" && itemData.type === "ammunition") {
    const equippedWeaponData = getItemData(playerState.equipment.weapon?.itemId);
    if (equippedWeaponData?.combat?.ammunitionItemId !== item.itemId) {
      return false;
    }
  }

  return true;
};
