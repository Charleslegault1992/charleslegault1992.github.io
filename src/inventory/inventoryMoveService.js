import { MAX_ITEM_STACK_SIZE } from "../core/gameConstants.js";
import { getItemData, isContainerItem, isOpenableContainerItem } from "../items/itemModel.js";

export const INVENTORY_MOVE_REASON = Object.freeze({
  capacityExceeded: "capacity-exceeded",
  invalidDestination: "invalid-destination",
  invalidSource: "invalid-source",
  itemChanged: "item-changed",
  moveRejected: "move-rejected",
  notTopOfStack: "not-top-of-stack",
});

const createFailure = (reason) => ({ success: false, reason });

const createRollbackLocation = (source, item) => {
  if (source.locationType !== "worldItem") {
    return source;
  }
  return {
    locationType: "worldTile",
    x: item.x,
    y: item.y,
    z: item.z,
  };
};

const isSameLocation = (first, second) => {
  if (!first || !second || first.locationType !== second.locationType) {
    return false;
  }
  if (first.locationType === "containerSlot") {
    return first.parentContainerUid === second.parentContainerUid && first.slotIndex === second.slotIndex;
  }
  if (first.locationType === "equipmentSlot") {
    return first.equipmentSlotName === second.equipmentSlotName;
  }
  if (first.locationType === "worldItem") {
    return first.itemUid === second.itemUid;
  }
  return false;
};

const containsItemUid = (containerItem, searchedUid) => {
  if (!Array.isArray(containerItem?.content)) {
    return false;
  }
  for (const item of containerItem.content) {
    if (!item) {
      continue;
    }
    if (item.uid === searchedUid || (isContainerItem(item) && containsItemUid(item, searchedUid))) {
      return true;
    }
  }
  return false;
};

const findFirstEmptySlot = (containerItem) => {
  const capacity = getItemData(containerItem?.itemId)?.capacity;
  if (!Array.isArray(containerItem?.content) || !Number.isInteger(capacity)) {
    return null;
  }
  for (let slotIndex = 0; slotIndex < capacity; slotIndex++) {
    if (!containerItem.content[slotIndex]) {
      return slotIndex;
    }
  }
  return null;
};

const findBestSlot = (containerItem, item) => {
  const capacity = getItemData(containerItem?.itemId)?.capacity;
  const itemData = getItemData(item?.itemId);
  if (!Array.isArray(containerItem?.content) || !Number.isInteger(capacity) || !itemData) {
    return null;
  }
  if (itemData.stackable) {
    for (let slotIndex = 0; slotIndex < capacity; slotIndex++) {
      const slotItem = containerItem.content[slotIndex];
      if (slotItem?.itemId === item.itemId && slotItem.quantity < MAX_ITEM_STACK_SIZE) {
        return slotIndex;
      }
    }
  }
  return findFirstEmptySlot(containerItem);
};

const getContainerSlotLocation = (parentContainerUid, slotIndex) => ({
  locationType: "containerSlot",
  parentContainerUid,
  slotIndex,
});

export const createInventoryMoveService = ({
  getItem,
  getParentContainer,
  removeItem,
  placeItem,
  findItemLocationByUid,
  isLocationCarriedByPlayer,
  getRemainingCapacity,
  getItemTotalWeight,
  canEquipItem,
  canInteractWithWorldItem,
  canAccessLocation = null,
  canPlaceWorldItem,
  onItemLocationChanged = null,
}) => {
  if (
    typeof getItem !== "function" ||
    typeof getParentContainer !== "function" ||
    typeof removeItem !== "function" ||
    typeof placeItem !== "function" ||
    typeof findItemLocationByUid !== "function" ||
    typeof isLocationCarriedByPlayer !== "function" ||
    typeof getRemainingCapacity !== "function" ||
    typeof getItemTotalWeight !== "function" ||
    typeof canEquipItem !== "function"
  ) {
    throw new TypeError("The inventory move service requires item-location operations.");
  }

  const notifyLocationChanged = (item, destination) => {
    onItemLocationChanged?.(item, destination);
  };

  const placeWholeItem = (source, destination, item) => {
    const rollbackLocation = createRollbackLocation(source, item);
    const removedItem = removeItem(source);
    if (!removedItem) {
      return false;
    }
    if (!placeItem(destination, removedItem)) {
      placeItem(rollbackLocation, removedItem);
      return false;
    }
    notifyLocationChanged(removedItem, destination);
    return true;
  };

  const canMoveWeightIntoPlayerInventory = (source, destination, item) => {
    if (isLocationCarriedByPlayer(source) || !isLocationCarriedByPlayer(destination)) {
      return true;
    }
    return getItemTotalWeight(item) <= getRemainingCapacity();
  };

  const tryStack = (source, sourceItem, destination, destinationItem) => {
    const itemData = getItemData(sourceItem.itemId);
    if (
      !destinationItem ||
      sourceItem.itemId !== destinationItem.itemId ||
      itemData?.stackable !== true ||
      destinationItem.quantity >= MAX_ITEM_STACK_SIZE
    ) {
      return null;
    }

    let quantityAllowed = MAX_ITEM_STACK_SIZE - destinationItem.quantity;
    if (!isLocationCarriedByPlayer(source) && isLocationCarriedByPlayer(destination)) {
      const capacityQuantity = itemData.weight > 0
        ? Math.floor(getRemainingCapacity() / itemData.weight)
        : sourceItem.quantity;
      quantityAllowed = Math.min(quantityAllowed, capacityQuantity);
    }
    if (quantityAllowed <= 0) {
      return createFailure(INVENTORY_MOVE_REASON.capacityExceeded);
    }

    const transferredQuantity = Math.min(sourceItem.quantity, quantityAllowed);
    destinationItem.quantity += transferredQuantity;
    sourceItem.quantity -= transferredQuantity;
    if (sourceItem.quantity === 0 && !removeItem(source)) {
      destinationItem.quantity -= transferredQuantity;
      sourceItem.quantity += transferredQuantity;
      return createFailure(INVENTORY_MOVE_REASON.moveRejected);
    }

    if (sourceItem.quantity > 0 && destination.locationType === "containerSlot") {
      const parentContainer = getParentContainer(destination);
      const emptySlot = findFirstEmptySlot(parentContainer);
      const canMoveRemainder =
        emptySlot !== null && canMoveWeightIntoPlayerInventory(source, destination, sourceItem);
      if (canMoveRemainder) {
        placeWholeItem(source, getContainerSlotLocation(destination.parentContainerUid, emptySlot), sourceItem);
      }
    }
    return { success: true };
  };

  const moveIntoContainerItem = (source, sourceItem, destinationItem) => {
    if (!isOpenableContainerItem(destinationItem)) {
      return null;
    }
    if (sourceItem.uid === destinationItem.uid || containsItemUid(sourceItem, destinationItem.uid)) {
      return createFailure(INVENTORY_MOVE_REASON.invalidDestination);
    }
    const slotIndex = findBestSlot(destinationItem, sourceItem);
    if (slotIndex === null) {
      return createFailure(INVENTORY_MOVE_REASON.moveRejected);
    }
    const destination = getContainerSlotLocation(destinationItem.uid, slotIndex);
    const slotItem = getItem(destination);
    if (slotItem) {
      return tryStack(source, sourceItem, destination, slotItem) ?? createFailure(INVENTORY_MOVE_REASON.moveRejected);
    }
    if (!canMoveWeightIntoPlayerInventory(source, destination, sourceItem)) {
      return createFailure(INVENTORY_MOVE_REASON.capacityExceeded);
    }
    return placeWholeItem(source, destination, sourceItem)
      ? { success: true }
      : createFailure(INVENTORY_MOVE_REASON.moveRejected);
  };

  const shouldRedirectOccupiedContainerSlot = (source, sourceItem, destination, destinationItem) => {
    if (destination.locationType !== "containerSlot" || !destinationItem) {
      return false;
    }
    const sourceIsExternal =
      source.locationType === "worldItem" ||
      (source.locationType === "containerSlot" && !isLocationCarriedByPlayer(source));
    if (!sourceIsExternal) {
      return false;
    }
    return sourceItem.itemId !== destinationItem.itemId || getItemData(sourceItem.itemId)?.stackable !== true;
  };

  const moveToRedirectedSlot = (source, sourceItem, destination) => {
    const parentContainer = getParentContainer(destination);
    const slotIndex = findBestSlot(parentContainer, sourceItem);
    if (slotIndex === null) {
      return createFailure(INVENTORY_MOVE_REASON.moveRejected);
    }
    const redirectedDestination = getContainerSlotLocation(destination.parentContainerUid, slotIndex);
    const redirectedItem = getItem(redirectedDestination);
    if (redirectedItem) {
      return tryStack(source, sourceItem, redirectedDestination, redirectedItem) ?? createFailure(INVENTORY_MOVE_REASON.moveRejected);
    }
    if (!canMoveWeightIntoPlayerInventory(source, redirectedDestination, sourceItem)) {
      return createFailure(INVENTORY_MOVE_REASON.capacityExceeded);
    }
    return placeWholeItem(source, redirectedDestination, sourceItem)
      ? { success: true }
      : createFailure(INVENTORY_MOVE_REASON.moveRejected);
  };

  const moveEquipmentItemBesideOccupiedContainerSlot = (source, sourceItem, destination, destinationItem) => {
    if (
      source.locationType !== "equipmentSlot" ||
      destination.locationType !== "containerSlot" ||
      !destinationItem ||
      canEquipItem(destinationItem, source.equipmentSlotName)
    ) {
      return null;
    }
    const parentContainer = getParentContainer(destination);
    const emptySlot = findFirstEmptySlot(parentContainer);
    if (emptySlot === null) {
      return createFailure(INVENTORY_MOVE_REASON.moveRejected);
    }
    return placeWholeItem(source, getContainerSlotLocation(destination.parentContainerUid, emptySlot), sourceItem)
      ? { success: true }
      : createFailure(INVENTORY_MOVE_REASON.moveRejected);
  };

  const swapItems = (source, sourceItem, destination, destinationItem) => {
    if (!isLocationCarriedByPlayer(source) || !isLocationCarriedByPlayer(destination)) {
      return createFailure(INVENTORY_MOVE_REASON.moveRejected);
    }
    const sourceAcceptsDestination =
      source.locationType === "containerSlot" ||
      (source.locationType === "equipmentSlot" && canEquipItem(destinationItem, source.equipmentSlotName));
    const destinationAcceptsSource =
      destination.locationType === "containerSlot" ||
      (destination.locationType === "equipmentSlot" && canEquipItem(sourceItem, destination.equipmentSlotName));
    if (!sourceAcceptsDestination || !destinationAcceptsSource) {
      return createFailure(INVENTORY_MOVE_REASON.moveRejected);
    }

    const removedSource = removeItem(source);
    if (!removedSource) {
      return createFailure(INVENTORY_MOVE_REASON.moveRejected);
    }
    const removedDestination = removeItem(destination);
    if (!removedDestination) {
      placeItem(source, removedSource);
      return createFailure(INVENTORY_MOVE_REASON.moveRejected);
    }
    if (!placeItem(destination, removedSource) || !placeItem(source, removedDestination)) {
      removeItem(destination);
      removeItem(source);
      placeItem(source, removedSource);
      placeItem(destination, removedDestination);
      return createFailure(INVENTORY_MOVE_REASON.moveRejected);
    }
    notifyLocationChanged(removedSource, destination);
    notifyLocationChanged(removedDestination, source);
    return { success: true };
  };

  const execute = ({ source, destination, itemUid }) => {
    const sourceItem = getItem(source);
    if (!sourceItem || sourceItem.uid !== itemUid) {
      return createFailure(INVENTORY_MOVE_REASON.itemChanged);
    }
    if (source.locationType === "worldItem") {
      const interactionResult = canInteractWithWorldItem?.(source, sourceItem);
      if (interactionResult !== true) {
        return createFailure(
          interactionResult === INVENTORY_MOVE_REASON.notTopOfStack
            ? INVENTORY_MOVE_REASON.notTopOfStack
            : INVENTORY_MOVE_REASON.invalidSource,
        );
      }
    }
    if (canAccessLocation && canAccessLocation(source, sourceItem) !== true) {
      return createFailure(INVENTORY_MOVE_REASON.invalidSource);
    }
    if (canAccessLocation && canAccessLocation(destination, getItem(destination)) !== true) {
      return createFailure(INVENTORY_MOVE_REASON.invalidDestination);
    }
    if (isSameLocation(source, destination)) {
      return createFailure(INVENTORY_MOVE_REASON.moveRejected);
    }

    if (destination.locationType === "worldTile") {
      if (canPlaceWorldItem?.(source, sourceItem, destination) !== true) {
        return createFailure(INVENTORY_MOVE_REASON.invalidDestination);
      }
      if (!placeWholeItem(source, destination, sourceItem)) {
        return createFailure(INVENTORY_MOVE_REASON.moveRejected);
      }
      return {
        success: true,
        changes: { itemUid, location: findItemLocationByUid(itemUid), quantity: sourceItem.quantity },
      };
    }

    const destinationItem = getItem(destination);
    const destinationContainer = destination.locationType === "containerSlot" ? getParentContainer(destination) : null;
    if (destination.locationType === "containerSlot" && !isOpenableContainerItem(destinationContainer)) {
      return createFailure(INVENTORY_MOVE_REASON.invalidDestination);
    }
    if (
      destinationContainer &&
      isContainerItem(sourceItem) &&
      (destinationContainer.uid === sourceItem.uid || containsItemUid(sourceItem, destinationContainer.uid))
    ) {
      return createFailure(INVENTORY_MOVE_REASON.invalidDestination);
    }

    const stackResult = tryStack(source, sourceItem, destination, destinationItem);
    if (stackResult) {
      return stackResult.success
        ? { ...stackResult, changes: { itemUid, location: findItemLocationByUid(itemUid), quantity: sourceItem.quantity } }
        : stackResult;
    }

    const containerResult = moveIntoContainerItem(source, sourceItem, destinationItem);
    if (containerResult) {
      return containerResult.success
        ? { ...containerResult, changes: { itemUid, location: findItemLocationByUid(itemUid), quantity: sourceItem.quantity } }
        : containerResult;
    }

    if (shouldRedirectOccupiedContainerSlot(source, sourceItem, destination, destinationItem)) {
      const result = moveToRedirectedSlot(source, sourceItem, destination);
      return result.success
        ? { ...result, changes: { itemUid, location: findItemLocationByUid(itemUid), quantity: sourceItem.quantity } }
        : result;
    }

    if (!destinationItem) {
      const canPlace =
        destination.locationType === "containerSlot" ||
        (destination.locationType === "equipmentSlot" && canEquipItem(sourceItem, destination.equipmentSlotName));
      if (!canPlace) {
        return createFailure(INVENTORY_MOVE_REASON.invalidDestination);
      }
      if (!canMoveWeightIntoPlayerInventory(source, destination, sourceItem)) {
        return createFailure(INVENTORY_MOVE_REASON.capacityExceeded);
      }
      if (!placeWholeItem(source, destination, sourceItem)) {
        return createFailure(INVENTORY_MOVE_REASON.moveRejected);
      }
      return {
        success: true,
        changes: { itemUid, location: findItemLocationByUid(itemUid), quantity: sourceItem.quantity },
      };
    }

    const equipmentResult = moveEquipmentItemBesideOccupiedContainerSlot(
      source,
      sourceItem,
      destination,
      destinationItem,
    );
    const result = equipmentResult ?? swapItems(source, sourceItem, destination, destinationItem);
    return result.success
      ? { ...result, changes: { itemUid, location: findItemLocationByUid(itemUid), quantity: sourceItem.quantity } }
      : result;
  };

  return Object.freeze({ execute });
};
