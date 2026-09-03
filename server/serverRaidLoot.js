import { getRandomInt } from "../src/core/mathUtils.js";
import { getRaidChestData } from "../src/data/raidChestDatabase.js";
import { createItemInstance } from "../src/items/itemFactory.js";
import { getItemData } from "../src/items/itemModel.js";

/* ==================================================== */
/* RAID LOOT - VALIDATION                               */
/* ==================================================== */

const isValidLootEntry = (entry) => {
  return Boolean(
    entry &&
    typeof entry.itemId === "string" &&
    entry.itemId !== "" &&
    Number.isInteger(entry.chance) &&
    entry.chance >= 0 &&
    entry.chance <= 100 &&
    Number.isInteger(entry.minQuantity) &&
    Number.isInteger(entry.maxQuantity) &&
    entry.minQuantity > 0 &&
    entry.maxQuantity >= entry.minQuantity &&
    getItemData(entry.itemId),
  );
};

/* ==================================================== */
/* RAID LOOT - ROLL                                     */
/* ==================================================== */

const didLootRollSucceed = (chance, randomInt) => {
  if (chance >= 100) {
    return true;
  }

  if (chance <= 0) {
    return false;
  }

  return randomInt(1, 100) <= chance;
};

/* ==================================================== */
/* RAID LOOT - ITEM CREATION                            */
/* ==================================================== */

const createLootInstances = (entry, randomInt) => {
  const itemData = getItemData(entry.itemId);

  if (!itemData) {
    return null;
  }

  const quantity = randomInt(entry.minQuantity, entry.maxQuantity);

  /*
   * Item stackable :
   *
   * 27 gold = une seule instance quantité 27.
   */
  if (itemData.stackable === true) {
    const item = createItemInstance(entry.itemId, quantity);

    return item ? [item] : null;
  }

  /*
   * Item NON stackable :
   *
   * 2 torches =
   * torch uid 1 quantité 1
   * torch uid 2 quantité 1
   *
   * et surtout PAS une torch quantité 2.
   */
  const items = [];

  for (let index = 0; index < quantity; index++) {
    const item = createItemInstance(entry.itemId, 1);

    if (!item) {
      return null;
    }

    items.push(item);
  }

  return items;
};

/* ==================================================== */
/* RAID LOOT - CREATE CHEST CONTENT                     */
/* ==================================================== */

export const createRaidChestContent = (chestId, { randomInt = getRandomInt } = {}) => {
  if (typeof randomInt !== "function") {
    return {
      success: false,
      reason: "invalid-random-source",
    };
  }

  const chestData = getRaidChestData(chestId);

  if (!chestData) {
    return {
      success: false,
      reason: "unknown-raid-chest",
    };
  }

  const chestItemData = getItemData(chestData.itemId);

  if (!chestItemData || chestItemData.container !== true || !Number.isInteger(chestItemData.capacity)) {
    return {
      success: false,
      reason: "invalid-raid-chest-item",
    };
  }

  if (!Array.isArray(chestData.loot) || !chestData.loot.every(isValidLootEntry)) {
    return {
      success: false,
      reason: "invalid-raid-loot-table",
    };
  }

  const content = [];

  for (const entry of chestData.loot) {
    if (!didLootRollSucceed(entry.chance, randomInt)) {
      continue;
    }

    const createdItems = createLootInstances(entry, randomInt);

    if (!createdItems) {
      return {
        success: false,
        reason: "raid-loot-item-creation-failed",
      };
    }

    content.push(...createdItems);
  }

  /*
   * Ne devrait jamais arriver avec notre coffre
   * de 8 slots :
   *
   * gold       = 1
   * torches    = max 2
   * sword      = 1
   * rune       = 1
   * hp potion  = 1
   * mana       = 1
   *
   * maximum = 7 slots
   */
  if (content.length > chestItemData.capacity) {
    return {
      success: false,
      reason: "raid-chest-capacity-exceeded",
    };
  }

  return {
    success: true,

    chestId,

    chestItemId: chestData.itemId,

    content,
  };
};
