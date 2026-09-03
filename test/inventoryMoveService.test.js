import test from "node:test";
import assert from "node:assert/strict";
import { createInventoryMoveService, INVENTORY_MOVE_REASON } from "../src/inventory/inventoryMoveService.js";
import { createItemLocationController } from "../src/inventory/itemLocationController.js";
import { getItemTotalWeight } from "../src/inventory/inventoryWeight.js";
import { getItemData } from "../src/items/itemModel.js";

const item = (uid, itemId, quantity = 1, content = undefined) => ({
  uid,
  itemId,
  quantity,
  ...(content ? { content } : {}),
});

const createFixture = () => {
  const backpack = item(1, "bag", 1, Array(8).fill(null));
  const equipment = {
    necklace: null,
    helmet: null,
    armor: null,
    shield: null,
    weapon: null,
    legs: null,
    ammo: null,
    ring: null,
    boots: null,
    backpack,
  };
  const worldItems = new Map();

  const findInside = (root, uid) => {
    if (root?.uid === uid) {
      return root;
    }
    for (const child of root?.content ?? []) {
      const found = findInside(child, uid);
      if (found) {
        return found;
      }
    }
    return null;
  };
  const findContainerByUid = (uid) => {
    for (const root of [...Object.values(equipment), ...worldItems.values()]) {
      const found = findInside(root, uid);
      if (found) {
        return found;
      }
    }
    return null;
  };
  const setEquipmentItem = (location, nextItem) => {
    equipment[location.equipmentSlotName] = nextItem;
    return true;
  };
  const controller = createItemLocationController({
    equipment,
    findContainerByUid,
    findWorldItemByUid: (uid) => worldItems.get(uid) ?? null,
    removeWorldItem: (uid) => worldItems.delete(uid),
    addWorldItem: (worldItem) => {
      worldItems.set(worldItem.uid, worldItem);
      return true;
    },
    positionWorldItem: (destination, worldItem) => {
      worldItem.x = destination.x;
      worldItem.y = destination.y;
      worldItem.z = destination.z;
      return true;
    },
    canEquipItem: (equipmentItem, slotName) => getItemData(equipmentItem.itemId)?.equipmentSlot?.includes(slotName) === true,
    setEquipmentItem,
  });

  const findLocationInside = (root, uid) => {
    for (let slotIndex = 0; slotIndex < (root?.content?.length ?? 0); slotIndex++) {
      const child = root.content[slotIndex];
      if (child?.uid === uid) {
        return { locationType: "containerSlot", parentContainerUid: root.uid, slotIndex };
      }
      const nested = findLocationInside(child, uid);
      if (nested) {
        return nested;
      }
    }
    return null;
  };
  const findItemLocationByUid = (uid) => {
    if (worldItems.has(uid)) {
      return { locationType: "worldItem", itemUid: uid };
    }
    for (const [slotName, equipmentItem] of Object.entries(equipment)) {
      if (equipmentItem?.uid === uid) {
        return { locationType: "equipmentSlot", equipmentSlotName: slotName };
      }
      const nested = findLocationInside(equipmentItem, uid);
      if (nested) {
        return nested;
      }
    }
    for (const worldItem of worldItems.values()) {
      const nested = findLocationInside(worldItem, uid);
      if (nested) {
        return nested;
      }
    }
    return null;
  };
  const isCarried = (location) => {
    if (location.locationType === "equipmentSlot") {
      return true;
    }
    if (location.locationType !== "containerSlot") {
      return false;
    }
    const parent = findContainerByUid(location.parentContainerUid);
    return Object.values(equipment).some((root) => findInside(root, parent?.uid));
  };

  let remainingCapacity = 1000;
  const service = createInventoryMoveService({
    getItem: controller.getItem,
    getParentContainer: controller.getParentContainer,
    removeItem: controller.removeItem,
    placeItem: controller.placeItem,
    findItemLocationByUid,
    isLocationCarriedByPlayer: isCarried,
    getRemainingCapacity: () => remainingCapacity,
    getItemTotalWeight,
    canEquipItem: (equipmentItem, slotName) => getItemData(equipmentItem.itemId)?.equipmentSlot?.includes(slotName) === true,
    canInteractWithWorldItem: () => true,
    canPlaceWorldItem: () => true,
  });

  return {
    backpack,
    equipment,
    service,
    worldItems,
    setRemainingCapacity: (capacity) => {
      remainingCapacity = capacity;
    },
  };
};

test("moves a world item into an empty carried container slot", () => {
  const fixture = createFixture();
  const apple = { ...item(2, "apple"), x: 64, y: 64, z: 0 };
  fixture.worldItems.set(apple.uid, apple);

  const result = fixture.service.execute({
    source: { locationType: "worldItem", itemUid: apple.uid },
    destination: { locationType: "containerSlot", parentContainerUid: fixture.backpack.uid, slotIndex: 0 },
    itemUid: apple.uid,
  });

  assert.equal(result.success, true);
  assert.equal(fixture.backpack.content[0], apple);
  assert.equal(fixture.worldItems.has(apple.uid), false);
});

test("redirects an external non-stackable item to the first free slot instead of swapping", () => {
  const fixture = createFixture();
  const potionInBag = item(2, "healthPotion");
  const swordOnGround = { ...item(3, "sword"), x: 64, y: 64, z: 0 };
  fixture.backpack.content[0] = potionInBag;
  fixture.worldItems.set(swordOnGround.uid, swordOnGround);

  const result = fixture.service.execute({
    source: { locationType: "worldItem", itemUid: swordOnGround.uid },
    destination: { locationType: "containerSlot", parentContainerUid: fixture.backpack.uid, slotIndex: 0 },
    itemUid: swordOnGround.uid,
  });

  assert.equal(result.success, true);
  assert.equal(fixture.backpack.content[0], potionInBag);
  assert.equal(fixture.backpack.content[1], swordOnGround);
});

test("stacks an external item before using an empty slot", () => {
  const fixture = createFixture();
  const bagGold = item(2, "goldCoin", 80);
  const groundGold = { ...item(3, "goldCoin", 20), x: 64, y: 64, z: 0 };
  fixture.backpack.content[0] = bagGold;
  fixture.worldItems.set(groundGold.uid, groundGold);

  const result = fixture.service.execute({
    source: { locationType: "worldItem", itemUid: groundGold.uid },
    destination: { locationType: "containerSlot", parentContainerUid: fixture.backpack.uid, slotIndex: 0 },
    itemUid: groundGold.uid,
  });

  assert.equal(result.success, true);
  assert.equal(bagGold.quantity, 100);
  assert.equal(fixture.worldItems.has(groundGold.uid), false);
});

test("rejects moving a container inside one of its descendants", () => {
  const fixture = createFixture();
  const innerBag = item(2, "bag", 1, Array(8).fill(null));
  fixture.backpack.content[0] = innerBag;

  const result = fixture.service.execute({
    source: { locationType: "equipmentSlot", equipmentSlotName: "backpack" },
    destination: { locationType: "containerSlot", parentContainerUid: innerBag.uid, slotIndex: 0 },
    itemUid: fixture.backpack.uid,
  });

  assert.deepEqual(result, { success: false, reason: INVENTORY_MOVE_REASON.invalidDestination });
  assert.equal(fixture.equipment.backpack, fixture.backpack);
});

test("rejects external weight that exceeds player capacity without mutating state", () => {
  const fixture = createFixture();
  const sword = { ...item(2, "sword"), x: 64, y: 64, z: 0 };
  fixture.worldItems.set(sword.uid, sword);
  fixture.setRemainingCapacity(0);

  const result = fixture.service.execute({
    source: { locationType: "worldItem", itemUid: sword.uid },
    destination: { locationType: "containerSlot", parentContainerUid: fixture.backpack.uid, slotIndex: 0 },
    itemUid: sword.uid,
  });

  assert.deepEqual(result, { success: false, reason: INVENTORY_MOVE_REASON.capacityExceeded });
  assert.equal(fixture.worldItems.get(sword.uid), sword);
  assert.equal(fixture.backpack.content[0], null);
});

test("reward-only raid chest permits loot withdrawal but rejects every insertion path", () => {
  const fixture = createFixture();
  const apple = item(2, "apple");
  const rewardGold = item(3, "goldCoin", 20);
  const nestedBag = item(4, "bag", 1, Array(8).fill(null));
  const raidChest = {
    ...item(5, "raidChest", 1, [rewardGold, nestedBag, ...Array(6).fill(null)]),
    x: 64,
    y: 64,
    z: 0,
  };
  fixture.backpack.content[0] = apple;
  fixture.worldItems.set(raidChest.uid, raidChest);

  const directSlotResult = fixture.service.execute({
    source: { locationType: "containerSlot", parentContainerUid: fixture.backpack.uid, slotIndex: 0 },
    destination: { locationType: "containerSlot", parentContainerUid: raidChest.uid, slotIndex: 2 },
    itemUid: apple.uid,
  });
  assert.deepEqual(directSlotResult, { success: false, reason: INVENTORY_MOVE_REASON.invalidDestination });

  const containerIconResult = fixture.service.execute({
    source: { locationType: "containerSlot", parentContainerUid: fixture.backpack.uid, slotIndex: 0 },
    destination: { locationType: "worldItem", itemUid: raidChest.uid },
    itemUid: apple.uid,
  });
  assert.deepEqual(containerIconResult, { success: false, reason: INVENTORY_MOVE_REASON.invalidDestination });

  const nestedResult = fixture.service.execute({
    source: { locationType: "containerSlot", parentContainerUid: fixture.backpack.uid, slotIndex: 0 },
    destination: { locationType: "containerSlot", parentContainerUid: nestedBag.uid, slotIndex: 0 },
    itemUid: apple.uid,
  });
  assert.deepEqual(nestedResult, { success: false, reason: INVENTORY_MOVE_REASON.invalidDestination });

  const withdrawalResult = fixture.service.execute({
    source: { locationType: "containerSlot", parentContainerUid: raidChest.uid, slotIndex: 0 },
    destination: { locationType: "containerSlot", parentContainerUid: fixture.backpack.uid, slotIndex: 1 },
    itemUid: rewardGold.uid,
  });
  assert.equal(withdrawalResult.success, true);
  assert.equal(fixture.backpack.content[1], rewardGold);
  assert.equal(raidChest.content[0], null);
  assert.equal(fixture.backpack.content[0], apple);
});
