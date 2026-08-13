export const isValidItemLocation = (location, { allowWorldTile = false } = {}) => {
  if (!location || typeof location !== "object") {
    return false;
  }
  if (location.locationType === "containerSlot") {
    return Number.isInteger(location.parentContainerUid) && Number.isInteger(location.slotIndex) && location.slotIndex >= 0;
  }
  if (location.locationType === "equipmentSlot") {
    return typeof location.equipmentSlotName === "string" && location.equipmentSlotName !== "";
  }
  if (location.locationType === "worldItem") {
    return Number.isInteger(location.itemUid);
  }
  if (allowWorldTile && location.locationType === "worldTile") {
    return Number.isInteger(location.x) && Number.isInteger(location.y) && Number.isInteger(location.z);
  }
  return false;
};
