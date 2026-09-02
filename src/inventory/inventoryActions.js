import { getRewardItemsTotalWeight } from "./inventoryTransactions.js";
import { commitContainerInsertionPlan, createContainerInsertionPlan } from "./inventoryTransactions.js";
import { createGameAction, rejectGameAction, succeedGameAction } from "../actions/gameAction.js";
import { isValidItemLocation } from "./itemLocation.js";

export const INVENTORY_ACTION_TYPE = Object.freeze({
  insertItems: "inventory.insert-items",
  moveItem: "inventory.move-item",
  splitItemStack: "inventory.split-item-stack",
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
  notTopOfStack: "not-top-of-stack",
});

export const createMoveItemAction = (source, destination, itemUid) => {
  if (!isValidItemLocation(source) || !isValidItemLocation(destination, { allowWorldTile: true }) || !Number.isInteger(itemUid)) {
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

export const createSplitItemStackAction = (source, itemUid, splitQuantity) => {
  if (
    !isValidItemLocation(source) ||
    !Number.isInteger(itemUid) ||
    !Number.isInteger(splitQuantity) ||
    splitQuantity <= 0
  ) {
    return null;
  }
  return createGameAction(INVENTORY_ACTION_TYPE.splitItemStack, {
    source,
    itemUid,
    splitQuantity,
  });
};

export const executeInsertItemsAction = (action, context) => {
  const containerUid = action?.payload?.containerUid;
  const itemEntries = action?.payload?.itemEntries;
  if (!Number.isInteger(containerUid) || !Array.isArray(itemEntries)) {
    return rejectGameAction(action, INVENTORY_ACTION_REASON.invalidRequest);
  }
  if (typeof context?.canInsertItems === "function" && context.canInsertItems(containerUid, itemEntries) !== true) {
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
  if (!isValidItemLocation(destination, { allowWorldTile: true })) {
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

export const executeSplitItemStackAction = (action, context) => {
  const source = action?.payload?.source;
  const itemUid = action?.payload?.itemUid;
  const splitQuantity = action?.payload?.splitQuantity;
  if (
    !isValidItemLocation(source) ||
    !Number.isInteger(itemUid) ||
    !Number.isInteger(splitQuantity) ||
    splitQuantity <= 0 ||
    typeof context?.executeSplitItemStack !== "function"
  ) {
    return rejectGameAction(action, INVENTORY_ACTION_REASON.invalidRequest);
  }

  const splitResult = context.executeSplitItemStack({ source, itemUid, splitQuantity });
  if (!splitResult?.success) {
    return rejectGameAction(action, splitResult?.reason ?? INVENTORY_ACTION_REASON.moveRejected);
  }
  return succeedGameAction(action, splitResult.changes ?? null, splitResult.events ?? []);
};

export const registerInventoryActionHandlers = (dispatcher) => {
  const didRegisterInsert = dispatcher?.register?.(INVENTORY_ACTION_TYPE.insertItems, executeInsertItemsAction) === true;
  const didRegisterMove = dispatcher?.register?.(INVENTORY_ACTION_TYPE.moveItem, executeMoveItemAction) === true;
  const didRegisterSplit =
    dispatcher?.register?.(INVENTORY_ACTION_TYPE.splitItemStack, executeSplitItemStackAction) === true;
  return didRegisterInsert && didRegisterMove && didRegisterSplit;
};
