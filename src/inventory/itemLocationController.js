import { isOpenableContainerItem } from "../items/itemModel.js";

export const isValidContainerSlotParent = (containerItem) => {
  return Array.isArray(containerItem?.content) && isOpenableContainerItem(containerItem);
};

export const createItemLocationController = ({
  equipment,
  findContainerByUid,
  findWorldItemByUid,
  removeWorldItem,
  addWorldItem,
  positionWorldItem,
  canEquipItem,
  setEquipmentItem,
}) => {
  const getParentContainer = (location) => {
    if (location?.locationType !== "containerSlot" || !Number.isInteger(location.parentContainerUid)) {
      return null;
    }
    const containerItem = findContainerByUid(location.parentContainerUid);
    return isValidContainerSlotParent(containerItem) ? containerItem : null;
  };

  const getItem = (location) => {
    if (location?.locationType === "worldItem") {
      return findWorldItemByUid(location.itemUid) ?? null;
    }
    if (location?.locationType === "equipmentSlot") {
      return equipment[location.equipmentSlotName] ?? null;
    }
    if (location?.locationType === "containerSlot") {
      return getParentContainer(location)?.content[location.slotIndex] ?? null;
    }
    return null;
  };

  const setContainerItem = (location, item) => {
    const parentContainer = getParentContainer(location);
    if (!parentContainer || !Number.isInteger(location.slotIndex) || location.slotIndex < 0) {
      return false;
    }
    parentContainer.content[location.slotIndex] = item;
    return true;
  };

  const removeItem = (location) => {
    const item = getItem(location);
    if (!item) {
      return null;
    }
    if (location.locationType === "containerSlot") {
      return setContainerItem(location, null) ? item : null;
    }
    if (location.locationType === "equipmentSlot") {
      return setEquipmentItem(location, null) ? item : null;
    }
    if (location.locationType === "worldItem") {
      return removeWorldItem(location.itemUid) ? item : null;
    }
    return null;
  };

  const placeItem = (destination, item) => {
    if (!destination || !item) {
      return null;
    }
    const existingItem = getItem(destination);
    if (destination.locationType === "containerSlot") {
      return setContainerItem(destination, item) ? existingItem ?? true : null;
    }
    if (destination.locationType === "equipmentSlot") {
      if (!canEquipItem(item, destination.equipmentSlotName)) {
        return null;
      }
      return setEquipmentItem(destination, item) ? existingItem ?? true : null;
    }
    if (destination.locationType === "worldTile") {
      if (!positionWorldItem(destination, item) || !addWorldItem(item)) {
        return null;
      }
      return true;
    }
    return null;
  };

  return {
    getItem,
    getParentContainer,
    placeItem,
    removeItem,
    setContainerItem,
  };
};
