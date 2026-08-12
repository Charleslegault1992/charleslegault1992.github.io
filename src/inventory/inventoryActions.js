import { getRewardItemsTotalWeight } from "./inventoryTransactions.js";
import { commitContainerInsertionPlan, createContainerInsertionPlan } from "./inventoryTransactions.js";
import { createGameAction, rejectGameAction, succeedGameAction } from "../actions/gameAction.js";

export const INVENTORY_ACTION_TYPE = Object.freeze({
  insertItems: "inventory.insert-items",
  moveItem: "inventory.move-item",
});

export const INVENTORY_ACTION_REASON = Object.freeze({
  invalidRequest: "invalid-request",
  containerNotFound: "container-not-found",
  invalidConfiguration: "invalid-configuration",
  capacityExceeded: "capacity-exceeded",
  noRoom: "no-room",
  commitFailed: "commit-failed",
  invalidSource: "invalid-source",
  invalidDestination: "invalid-destination",
  itemChanged: "item-changed",
  moveRejected: "move-rejected",
});

const isValidItemLocation = (location, allowWorldTile = false) => {
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

export const createMoveItemAction = (source, destination, itemUid) => {
  if (!isValidItemLocation(source) || !isValidItemLocation(destination, true) || !Number.isInteger(itemUid)) {
    return null;
  }
  return createGameAction(INVENTORY_ACTION_TYPE.moveItem, {
    source,
    destination,
    itemUid,
  });
};

export const createInsertItemsAction = (containerUid, itemEntries) => {
  if (!Number.isInteger(containerUid) || !Array.isArray(itemEntries)) {
    return null;
  }
  return createGameAction(INVENTORY_ACTION_TYPE.insertItems, {
    containerUid,
    itemEntries,
  });
};

export const executeInsertItemsAction = (action, context) => {
  const containerUid = action?.payload?.containerUid;
  const itemEntries = action?.payload?.itemEntries;
  if (!Number.isInteger(containerUid) || !Array.isArray(itemEntries)) {
    return rejectGameAction(action, INVENTORY_ACTION_REASON.invalidRequest);
  }

  const container = context?.findContainerByUid?.(containerUid) ?? null;
  if (!container) {
    return rejectGameAction(action, INVENTORY_ACTION_REASON.containerNotFound);
  }

  const insertionWeight = getRewardItemsTotalWeight(itemEntries);
  if (!Number.isFinite(insertionWeight)) {
    return rejectGameAction(action, INVENTORY_ACTION_REASON.invalidConfiguration);
  }

  const remainingCapacity = context?.getRemainingCapacity?.() ?? Number.POSITIVE_INFINITY;
  if (!Number.isFinite(remainingCapacity) || insertionWeight > remainingCapacity) {
    return rejectGameAction(action, INVENTORY_ACTION_REASON.capacityExceeded);
  }

  const insertionPlan = createContainerInsertionPlan(container, itemEntries);
  if (!insertionPlan.success) {
    return rejectGameAction(action, INVENTORY_ACTION_REASON.noRoom);
  }
  if (!commitContainerInsertionPlan(insertionPlan)) {
    return rejectGameAction(action, INVENTORY_ACTION_REASON.commitFailed);
  }

  return succeedGameAction(action, {
    containerUid,
    insertedItems: structuredClone(itemEntries),
    addedWeight: insertionWeight,
  }, [
    {
      type: "inventory-items-inserted",
      containerUid,
    },
  ]);
};

export const executeMoveItemAction = (action, context) => {
  const source = action?.payload?.source;
  const destination = action?.payload?.destination;
  const itemUid = action?.payload?.itemUid;
  if (!isValidItemLocation(source)) {
    return rejectGameAction(action, INVENTORY_ACTION_REASON.invalidSource);
  }
  if (!isValidItemLocation(destination, true)) {
    return rejectGameAction(action, INVENTORY_ACTION_REASON.invalidDestination);
  }
  if (!Number.isInteger(itemUid) || typeof context?.executeMove !== "function") {
    return rejectGameAction(action, INVENTORY_ACTION_REASON.invalidRequest);
  }

  const moveResult = context.executeMove({ source, destination, itemUid });
  if (!moveResult?.success) {
    return rejectGameAction(action, moveResult?.reason ?? INVENTORY_ACTION_REASON.moveRejected);
  }
  return succeedGameAction(
    action,
    moveResult.changes ?? null,
    Array.isArray(moveResult.events) ? moveResult.events : [],
  );
};

export const registerInventoryActionHandlers = (dispatcher) => {
  const didRegisterInsert = dispatcher?.register?.(INVENTORY_ACTION_TYPE.insertItems, executeInsertItemsAction) === true;
  const didRegisterMove = dispatcher?.register?.(INVENTORY_ACTION_TYPE.moveItem, executeMoveItemAction) === true;
  return didRegisterInsert && didRegisterMove;
};
