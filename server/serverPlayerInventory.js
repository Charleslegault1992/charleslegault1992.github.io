import { MAX_SURFACE_HEIGHT, TILE_SIZE } from "../src/core/gameConstants.js";
import { createInventoryMoveService } from "../src/inventory/inventoryMoveService.js";
import {
  getPlayerRemainingCapacity,
  getItemTotalWeight,
  updatePlayerCarriedWeight,
} from "../src/inventory/inventoryWeight.js";
import { createItemLocationController } from "../src/inventory/itemLocationController.js";
import { getItemData, getItemSurfaceHeight, isContainerItem } from "../src/items/itemModel.js";
import { createGroundItem, createItemInstance } from "../src/items/itemFactory.js";
import { canPlayerEquipItemInSlot } from "../src/player/playerEquipment.js";
import {
  commitContainerInsertionPlan,
  createContainerInsertionPlan,
  getRewardItemsTotalWeight,
} from "../src/inventory/inventoryTransactions.js";
import { hasLineOfSightBetweenTiles } from "../src/world/pathfinding.js";
import { getWorldChunkForTilePosition, isWorldCollisionAtTile } from "../src/world/worldCoordinates.js";

const WORLD_ITEM_THROW_RANGE = 9;

const visitItemTree = (item, visitor) => {
  if (!item || typeof visitor !== "function") {
    return null;
  }
  if (visitor(item)) {
    return item;
  }
  for (const child of item.content ?? []) {
    const found = visitItemTree(child, visitor);
    if (found) {
      return found;
    }
  }
  return null;
};

const findItemLocationInsideContainer = (container, itemUid) => {
  for (let slotIndex = 0; slotIndex < (container?.content?.length ?? 0); slotIndex++) {
    const item = container.content[slotIndex];
    if (item?.uid === itemUid) {
      return { locationType: "containerSlot", parentContainerUid: container.uid, slotIndex };
    }
    const nestedLocation = findItemLocationInsideContainer(item, itemUid);
    if (nestedLocation) {
      return nestedLocation;
    }
  }
  return null;
};

const isNear = (player, target, range) => {
  if (!player || !target || player.z !== target.z) {
    return false;
  }
  return (
    Math.abs(player.x / TILE_SIZE - target.x / TILE_SIZE) <= range &&
    Math.abs(player.y / TILE_SIZE - target.y / TILE_SIZE) <= range
  );
};

export const createServerPlayerInventory = ({ player, worldMapsByZ, worldItems }) => {
  if (!player?.equipment || !(worldMapsByZ instanceof Map) || !worldItems) {
    throw new TypeError("The server player inventory requires a player, maps and world items.");
  }

  const findCarriedItem = (itemUid) => {
    for (const equipmentItem of Object.values(player.equipment)) {
      const found = visitItemTree(equipmentItem, (item) => item.uid === itemUid);
      if (found) {
        return found;
      }
    }
    return null;
  };

  const findWorldRootContaining = (itemUid) => {
    for (const worldItem of worldItems.values()) {
      if (visitItemTree(worldItem, (item) => item.uid === itemUid)) {
        return worldItem;
      }
    }
    return null;
  };

  const findContainerByUid = (containerUid) => {
    const carriedItem = findCarriedItem(containerUid);
    if (carriedItem) {
      return carriedItem;
    }
    const worldRoot = findWorldRootContaining(containerUid);
    return worldRoot ? visitItemTree(worldRoot, (item) => item.uid === containerUid) : null;
  };

  const setEquipmentItem = (location, item) => {
    if (!(location?.equipmentSlotName in player.equipment)) {
      return false;
    }
    player.equipment[location.equipmentSlotName] = item;
    return true;
  };

  const getWorldItemsAt = (x, y, z) => worldItems.getAllAt?.(x, y, z) ?? [];
  const isTopWorldItem = (item) => {
    const stack = getWorldItemsAt(item.x, item.y, item.z);
    return stack.at(-1)?.uid === item.uid;
  };

  const positionWorldItem = (destination, item) => {
    const worldMap = worldMapsByZ.get(destination.z);
    const col = destination.x / TILE_SIZE;
    const row = destination.y / TILE_SIZE;
    if (
      !Number.isInteger(col) ||
      !Number.isInteger(row) ||
      !getWorldChunkForTilePosition(worldMap, col, row) ||
      isWorldCollisionAtTile(worldMap, col, row)
    ) {
      return false;
    }
    const surfaceHeight = getWorldItemsAt(destination.x, destination.y, destination.z).reduce(
      (total, worldItem) => total + getItemSurfaceHeight(worldItem),
      0,
    );
    if (surfaceHeight + getItemSurfaceHeight(item) > MAX_SURFACE_HEIGHT) {
      return false;
    }
    item.x = destination.x;
    item.y = destination.y;
    item.z = destination.z;
    return true;
  };

  const locationController = createItemLocationController({
    equipment: player.equipment,
    findContainerByUid,
    findWorldItemByUid: (itemUid) => worldItems.get(itemUid),
    removeWorldItem: (itemUid) => worldItems.remove(itemUid),
    addWorldItem: (item) => worldItems.add(item),
    positionWorldItem,
    canEquipItem: (item, slotName) => canPlayerEquipItemInSlot(player, item, slotName),
    setEquipmentItem,
  });

  const findItemLocationByUid = (itemUid) => {
    const worldItem = worldItems.get(itemUid);
    if (worldItem) {
      return { locationType: "worldItem", itemUid };
    }
    for (const [equipmentSlotName, equipmentItem] of Object.entries(player.equipment)) {
      if (equipmentItem?.uid === itemUid) {
        return { locationType: "equipmentSlot", equipmentSlotName };
      }
      const nestedLocation = findItemLocationInsideContainer(equipmentItem, itemUid);
      if (nestedLocation) {
        return nestedLocation;
      }
    }
    for (const rootWorldItem of worldItems.values()) {
      const nestedLocation = findItemLocationInsideContainer(rootWorldItem, itemUid);
      if (nestedLocation) {
        return nestedLocation;
      }
    }
    return null;
  };

  const isLocationCarriedByPlayer = (location) => {
    if (location?.locationType === "equipmentSlot") {
      return true;
    }
    if (location?.locationType !== "containerSlot") {
      return false;
    }
    return Boolean(findCarriedItem(location.parentContainerUid));
  };

  const canAccessLocation = (location) => {
    if (location?.locationType !== "containerSlot" || isLocationCarriedByPlayer(location)) {
      return true;
    }
    const rootWorldItem = findWorldRootContaining(location.parentContainerUid);
    return Boolean(rootWorldItem && isNear(player, rootWorldItem, 1) && isTopWorldItem(rootWorldItem));
  };

  const getWorldRootUidForLocation = (location) => {
    if (location?.locationType !== "containerSlot") {
      return null;
    }
    return findWorldRootContaining(location.parentContainerUid)?.uid ?? null;
  };

  const canPlaceWorldItem = (_source, _item, destination) => {
    const destinationItems = getWorldItemsAt(destination.x, destination.y, destination.z);

    /*
     * Un raidChest ne peut pas être enterré
     * sous un paquet d'items.
     */
    if (destinationItems.some((worldItem) => getItemData(worldItem.itemId)?.blocksWorldItemPlacement === true)) {
      return false;
    }

    if (!isNear(player, destination, WORLD_ITEM_THROW_RANGE)) {
      return false;
    }

    const worldMap = worldMapsByZ.get(player.z);

    return hasLineOfSightBetweenTiles(
      worldMap,

      {
        col: player.x / TILE_SIZE,

        row: player.y / TILE_SIZE,
      },

      {
        col: destination.x / TILE_SIZE,

        row: destination.y / TILE_SIZE,
      },
    );
  };

  const canInteractWithWorldItem = (_source, item) => {
    if (!isNear(player, item, 1)) {
      return false;
    }
    return isTopWorldItem(item) ? true : "not-top-of-stack";
  };

  const canUseItemSource = (location, item) => {
    if (location?.locationType === "equipmentSlot") {
      return true;
    }
    if (location?.locationType === "worldItem") {
      return canInteractWithWorldItem(location, item) === true;
    }
    return location?.locationType === "containerSlot" && canAccessLocation(location);
  };

  const moveService = createInventoryMoveService({
    getItem: locationController.getItem,
    getParentContainer: locationController.getParentContainer,
    removeItem: locationController.removeItem,
    placeItem: locationController.placeItem,
    findItemLocationByUid,
    isLocationCarriedByPlayer,
    getRemainingCapacity: () => {
      updatePlayerCarriedWeight(player);
      return getPlayerRemainingCapacity(player);
    },
    getItemTotalWeight,
    canEquipItem: (item, slotName) => canPlayerEquipItemInSlot(player, item, slotName),
    canInteractWithWorldItem,
    canAccessLocation,
    canPlaceWorldItem,
  });

  const executeMove = (request) => {
    const changedWorldContainerUids = new Set();

    const sourceItem = locationController.getItem(request?.source);

    if (request?.source?.locationType === "worldItem" && getItemData(sourceItem?.itemId)?.movable === false) {
      return {
        success: false,
        reason: "move-rejected",
      };
    }

    for (const location of [request?.source, request?.destination]) {
      if (location?.locationType !== "containerSlot") {
        continue;
      }

      const worldRoot = findWorldRootContaining(location.parentContainerUid);
      if (worldRoot) {
        changedWorldContainerUids.add(worldRoot.uid);
      }
    }

    const result = moveService.execute(request);

    if (result.success) {
      updatePlayerCarriedWeight(player);
      result.changes = {
        ...result.changes,
        carriedWeight: player.carriedWeight,
        equipment: player.equipment,
        changedWorldContainerUids: [...changedWorldContainerUids],
      };
    }

    return result;
  };

  const splitItemStack = ({ source, itemUid, splitQuantity }) => {
    const item = locationController.getItem(source);
    const itemData = getItemData(item?.itemId);
    if (
      !itemData?.stackable ||
      item?.uid !== itemUid ||
      !Number.isInteger(splitQuantity) ||
      splitQuantity <= 0 ||
      splitQuantity >= item.quantity
    ) {
      return { success: false, reason: "item-changed" };
    }
    if (!canAccessLocation(source)) {
      return { success: false, reason: "invalid-source" };
    }

    const changedWorldContainerUids = new Set();
    let splitItem = null;

    if (source.locationType === "containerSlot") {
      const parentContainer = locationController.getParentContainer(source);
      const capacity = getItemData(parentContainer?.itemId)?.capacity;
      if (!parentContainer || !Number.isInteger(capacity)) {
        return { success: false, reason: "invalid-source" };
      }
      let emptySlotIndex = -1;
      for (let slotIndex = 0; slotIndex < capacity; slotIndex++) {
        if (!parentContainer.content[slotIndex]) {
          emptySlotIndex = slotIndex;
          break;
        }
      }
      if (emptySlotIndex < 0) {
        return { success: false, reason: "no-room" };
      }
      splitItem = createItemInstance(item.itemId, splitQuantity);
      if (!splitItem) {
        return { success: false, reason: "invalid-configuration" };
      }
      parentContainer.content[emptySlotIndex] = splitItem;
      const worldRoot = findWorldRootContaining(parentContainer.uid);
      if (worldRoot) {
        changedWorldContainerUids.add(worldRoot.uid);
      }
    } else if (source.locationType === "worldItem") {
      if (!isNear(player, item, 1) || !isTopWorldItem(item)) {
        return { success: false, reason: "invalid-source" };
      }
      splitItem = createGroundItem(item.itemId, splitQuantity, item.x, item.y, item.z);
      if (!splitItem || !worldItems.add(splitItem)) {
        return { success: false, reason: "move-rejected" };
      }
    } else {
      return { success: false, reason: "invalid-source" };
    }

    item.quantity -= splitQuantity;
    updatePlayerCarriedWeight(player);
    return {
      success: true,
      changes: {
        itemUid,
        splitItemUid: splitItem.uid,
        createdWorldItemUid: source.locationType === "worldItem" ? splitItem.uid : null,
        changedWorldContainerUids: [...changedWorldContainerUids],
        carriedWeight: player.carriedWeight,
        equipment: player.equipment,
      },
      events: [{ type: "inventory-stack-split", itemUid, splitItemUid: splitItem.uid }],
    };
  };

  const insertItems = (containerUid, itemEntries) => {
    const container = findContainerByUid(containerUid);
    const insertionWeight = getRewardItemsTotalWeight(itemEntries);
    updatePlayerCarriedWeight(player);
    if (!container || !Number.isFinite(insertionWeight)) {
      return { success: false, reason: "invalid-configuration" };
    }
    if (insertionWeight > getPlayerRemainingCapacity(player)) {
      return { success: false, reason: "capacity-exceeded" };
    }
    const plan = createContainerInsertionPlan(container, itemEntries);
    if (!plan.success) {
      return { success: false, reason: "no-room" };
    }
    if (!commitContainerInsertionPlan(plan)) {
      return { success: false, reason: "commit-failed" };
    }
    updatePlayerCarriedWeight(player);
    return { success: true, changes: { containerUid, itemEntries: structuredClone(itemEntries) } };
  };

  return Object.freeze({
    canInteractWithWorldItem,
    canUseItemSource,
    executeMove,
    findContainerByUid,
    findItemLocationByUid,
    getItem: locationController.getItem,
    getRemainingCapacity: () => getPlayerRemainingCapacity(player),
    getWorldRootUidForLocation,
    insertItems,
    removeItem: locationController.removeItem,
    refreshWeight: () => updatePlayerCarriedWeight(player),
    splitItemStack,
  });
};
