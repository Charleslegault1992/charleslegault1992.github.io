import { MAX_ITEM_STACK_SIZE } from "../core/gameConstants.js";
import { itemsDatabase } from "../data/itemsDatabase.js";
import { rewardTablesDatabase } from "../data/questsDatabase.js";
import { createItemInstance } from "../items/itemFactory.js";
import { getItemData } from "../items/itemModel.js";
import { getItemTotalWeight } from "./inventoryWeight.js";

export const visitContainerItems = (containerItem, visitor) => {
  if (!Array.isArray(containerItem?.content) || typeof visitor !== "function") {
    return;
  }
  for (let slotIndex = 0; slotIndex < containerItem.content.length; slotIndex++) {
    const item = containerItem.content[slotIndex];
    if (!item) {
      continue;
    }
    visitor(item, containerItem, slotIndex);
    if (Array.isArray(item.content)) {
      visitContainerItems(item, visitor);
    }
  }
};

export const visitContainerSlots = (containerItem, visitor) => {
  const capacity = getItemData(containerItem?.itemId)?.capacity;
  if (!Array.isArray(containerItem?.content) || !Number.isInteger(capacity) || typeof visitor !== "function") {
    return;
  }
  for (let slotIndex = 0; slotIndex < capacity; slotIndex++) {
    const item = containerItem.content[slotIndex] ?? null;
    visitor(containerItem, slotIndex, item);
    if (Array.isArray(item?.content)) {
      visitContainerSlots(item, visitor);
    }
  }
};

export const getPlayerGoldAmount = (player) => {
  const backpack = player?.equipment?.backpack ?? null;
  if (!backpack) {
    return 0;
  }
  let goldAmount = 0;
  visitContainerItems(backpack, (item) => {
    const currencyValue = getItemData(item.itemId)?.currency?.value;
    if (Number.isInteger(currencyValue) && currencyValue > 0) {
      goldAmount += currencyValue * item.quantity;
    }
  });
  return goldAmount;
};

export const getPlayerBankGoldAmount = (player) => {
  return Number.isSafeInteger(player?.bank?.goldBalance) && player.bank.goldBalance >= 0
    ? player.bank.goldBalance
    : 0;
};

const getCurrencyDataByValueDescending = () => {
  return Object.values(itemsDatabase)
    .filter((itemData) => Number.isInteger(itemData.currency?.value) && itemData.currency.value > 0)
    .sort((firstCurrency, secondCurrency) => secondCurrency.currency.value - firstCurrency.currency.value);
};

export const createCurrencyItemsForGoldAmount = (goldAmount) => {
  if (!Number.isInteger(goldAmount) || goldAmount < 0) {
    return null;
  }
  const currencyItems = [];
  let remainingGold = goldAmount;
  for (const currencyData of getCurrencyDataByValueDescending()) {
    let currencyQuantity = Math.floor(remainingGold / currencyData.currency.value);
    remainingGold %= currencyData.currency.value;
    while (currencyQuantity > 0) {
      const stackQuantity = Math.min(currencyQuantity, MAX_ITEM_STACK_SIZE);
      const item = createItemInstance(currencyData.itemId, stackQuantity);
      if (!item) {
        return null;
      }
      currencyItems.push(item);
      currencyQuantity -= stackQuantity;
    }
  }
  return remainingGold === 0 ? currencyItems : null;
};

export const createPlayerCurrencyValuePlan = (player, goldAmount) => {
  const backpack = player?.equipment?.backpack ?? null;
  const currencyItems = createCurrencyItemsForGoldAmount(goldAmount);
  if (!backpack || !currencyItems) {
    return { success: false };
  }

  const occupiedCurrencySlots = [];
  const emptySlots = [];
  visitContainerSlots(backpack, (containerItem, slotIndex, item) => {
    if (!item) {
      emptySlots.push({ containerItem, slotIndex });
    } else if (Number.isInteger(getItemData(item.itemId)?.currency?.value)) {
      occupiedCurrencySlots.push({ containerItem, slotIndex });
    }
  });

  const availableSlots = [...occupiedCurrencySlots, ...emptySlots];
  if (currencyItems.length > availableSlots.length) {
    return { success: false };
  }
  return {
    success: true,
    slots: availableSlots,
    previousItems: availableSlots.map(({ containerItem, slotIndex }) => containerItem.content[slotIndex] ?? null),
    nextItems: availableSlots.map((_, index) => currencyItems[index] ?? null),
  };
};

export const commitPlayerCurrencyValuePlan = (currencyPlan) => {
  if (!currencyPlan?.success || !Array.isArray(currencyPlan.slots)) {
    return false;
  }
  for (let index = 0; index < currencyPlan.slots.length; index++) {
    const { containerItem, slotIndex } = currencyPlan.slots[index];
    containerItem.content[slotIndex] = currencyPlan.nextItems[index];
  }
  return true;
};

export const rollbackPlayerCurrencyValuePlan = (currencyPlan) => {
  if (!currencyPlan?.success || !Array.isArray(currencyPlan.slots)) {
    return false;
  }
  for (let index = 0; index < currencyPlan.slots.length; index++) {
    const { containerItem, slotIndex } = currencyPlan.slots[index];
    containerItem.content[slotIndex] = currencyPlan.previousItems[index];
  }
  return true;
};

export const getPlayerCurrencyValuePlanWeightDifference = (currencyPlan) => {
  if (!currencyPlan?.success || !Array.isArray(currencyPlan.previousItems) || !Array.isArray(currencyPlan.nextItems)) {
    return null;
  }
  const previousWeight = currencyPlan.previousItems.reduce(
    (total, item) => total + (item ? getItemTotalWeight(item) : 0),
    0,
  );
  const nextWeight = currencyPlan.nextItems.reduce((total, item) => total + (item ? getItemTotalWeight(item) : 0), 0);
  return nextWeight - previousWeight;
};

export const createPlayerGoldPaymentPlan = (player, goldAmount) => {
  if (!Number.isInteger(goldAmount) || goldAmount <= 0) {
    return { success: false };
  }
  const remainingGold = getPlayerGoldAmount(player) - goldAmount;
  if (remainingGold < 0) {
    return { success: false };
  }
  return createPlayerCurrencyValuePlan(player, remainingGold);
};

export const createPlayerBackpackItemRemovalPlan = (player, itemId, quantity) => {
  const backpack = player?.equipment?.backpack ?? null;
  if (!backpack || typeof itemId !== "string" || !Number.isInteger(quantity) || quantity <= 0) {
    return { success: false, reason: "configuration" };
  }

  let remainingQuantity = quantity;
  const operations = [];
  visitContainerItems(backpack, (item, containerItem, slotIndex) => {
    if (remainingQuantity <= 0 || item.itemId !== itemId) {
      return;
    }
    const quantityToRemove = Math.min(item.quantity, remainingQuantity);
    operations.push({ containerItem, slotIndex, item, quantity: quantityToRemove });
    remainingQuantity -= quantityToRemove;
  });

  if (remainingQuantity > 0) {
    return { success: false, reason: "quantity" };
  }
  return { success: true, operations };
};

export const commitPlayerBackpackItemRemovalPlan = (removalPlan) => {
  if (!removalPlan?.success || !Array.isArray(removalPlan.operations)) {
    return false;
  }
  for (const operation of removalPlan.operations) {
    if (operation.quantity >= operation.item.quantity) {
      operation.containerItem.content[operation.slotIndex] = null;
    } else {
      operation.item.quantity -= operation.quantity;
    }
  }
  return true;
};

export const rollbackPlayerBackpackItemRemovalPlan = (removalPlan) => {
  if (!removalPlan?.success || !Array.isArray(removalPlan.operations)) {
    return false;
  }
  for (let index = removalPlan.operations.length - 1; index >= 0; index--) {
    const operation = removalPlan.operations[index];
    if (operation.containerItem.content[operation.slotIndex] === null) {
      operation.containerItem.content[operation.slotIndex] = operation.item;
    } else {
      operation.item.quantity += operation.quantity;
    }
  }
  return true;
};

export const spendPlayerGold = (player, goldAmount) => {
  const paymentPlan = createPlayerGoldPaymentPlan(player, goldAmount);
  if (!paymentPlan.success) {
    return false;
  }
  return commitPlayerCurrencyValuePlan(paymentPlan);
};

export const getRewardTableData = (rewardTableId) => {
  if (typeof rewardTableId !== "string" || !(rewardTableId in rewardTablesDatabase)) {
    return null;
  }
  return rewardTablesDatabase[rewardTableId];
};

export const getRewardItemsTotalWeight = (rewardItems) => {
  if (!Array.isArray(rewardItems)) {
    return null;
  }

  let totalWeight = 0;
  for (const rewardItem of rewardItems) {
    const itemData = getItemData(rewardItem?.itemId);
    if (!itemData || !Number.isInteger(rewardItem.quantity) || rewardItem.quantity <= 0) {
      return null;
    }
    totalWeight += itemData.weight * rewardItem.quantity;
  }
  return totalWeight;
};

export const createContainerInsertionPlan = (containerItem, itemEntries) => {
  const containerData = getItemData(containerItem?.itemId);
  if (
    !containerItem?.content ||
    !containerData?.capacity ||
    containerData.acceptsItems === false ||
    !Array.isArray(itemEntries)
  ) {
    return { success: false, reason: "container" };
  }

  const simulatedSlots = Array.from({ length: containerData.capacity }, (_, slotIndex) => {
    const slotItem = containerItem.content[slotIndex];
    return slotItem ? { itemId: slotItem.itemId, quantity: slotItem.quantity } : null;
  });
  const operations = [];

  for (const itemEntry of itemEntries) {
    const itemData = getItemData(itemEntry?.itemId);
    if (!itemData || !Number.isInteger(itemEntry.quantity) || itemEntry.quantity <= 0) {
      return { success: false, reason: "configuration" };
    }

    let remainingQuantity = itemEntry.quantity;
    if (itemData.stackable) {
      for (let slotIndex = 0; slotIndex < simulatedSlots.length && remainingQuantity > 0; slotIndex++) {
        const simulatedItem = simulatedSlots[slotIndex];
        if (!simulatedItem || simulatedItem.itemId !== itemEntry.itemId || simulatedItem.quantity >= MAX_ITEM_STACK_SIZE) {
          continue;
        }
        const quantityToStack = Math.min(MAX_ITEM_STACK_SIZE - simulatedItem.quantity, remainingQuantity);
        simulatedItem.quantity += quantityToStack;
        remainingQuantity -= quantityToStack;
        operations.push({ type: "stack", slotIndex, itemId: itemEntry.itemId, quantity: quantityToStack });
      }

      while (remainingQuantity > 0) {
        const slotIndex = simulatedSlots.findIndex((slotItem) => slotItem === null);
        if (slotIndex === -1) {
          return { success: false, reason: "space" };
        }
        const quantityToCreate = Math.min(remainingQuantity, MAX_ITEM_STACK_SIZE);
        simulatedSlots[slotIndex] = { itemId: itemEntry.itemId, quantity: quantityToCreate };
        remainingQuantity -= quantityToCreate;
        operations.push({ type: "create", slotIndex, itemId: itemEntry.itemId, quantity: quantityToCreate });
      }
      continue;
    }

    while (remainingQuantity > 0) {
      const slotIndex = simulatedSlots.findIndex((slotItem) => slotItem === null);
      if (slotIndex === -1) {
        return { success: false, reason: "space" };
      }
      simulatedSlots[slotIndex] = { itemId: itemEntry.itemId, quantity: 1 };
      remainingQuantity--;
      operations.push({ type: "create", slotIndex, itemId: itemEntry.itemId, quantity: 1 });
    }
  }

  return { success: true, containerItem, operations };
};

export const commitContainerInsertionPlan = (insertionPlan) => {
  if (!insertionPlan?.success || !insertionPlan.containerItem?.content || !Array.isArray(insertionPlan.operations)) {
    return false;
  }

  const createdItemsByOperationIndex = new Map();
  for (let operationIndex = 0; operationIndex < insertionPlan.operations.length; operationIndex++) {
    const operation = insertionPlan.operations[operationIndex];
    if (operation.type === "stack") {
      const slotItem = insertionPlan.containerItem.content[operation.slotIndex];
      if (!slotItem || slotItem.itemId !== operation.itemId) {
        return false;
      }
      continue;
    }
    if (operation.type === "create") {
      if (insertionPlan.containerItem.content[operation.slotIndex]) {
        return false;
      }
      const item = createItemInstance(operation.itemId, operation.quantity);
      if (!item) {
        return false;
      }
      createdItemsByOperationIndex.set(operationIndex, item);
    }
  }

  for (let operationIndex = 0; operationIndex < insertionPlan.operations.length; operationIndex++) {
    const operation = insertionPlan.operations[operationIndex];
    if (operation.type === "stack") {
      insertionPlan.containerItem.content[operation.slotIndex].quantity += operation.quantity;
    } else if (operation.type === "create") {
      insertionPlan.containerItem.content[operation.slotIndex] = createdItemsByOperationIndex.get(operationIndex);
    }
  }
  return true;
};
