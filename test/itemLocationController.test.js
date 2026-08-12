import assert from "node:assert/strict";
import test from "node:test";

import { createItemLocationController } from "../src/inventory/itemLocationController.js";

const createControllerFixture = () => {
  const apple = { uid: 2, itemId: "apple", quantity: 1 };
  const bag = { uid: 1, itemId: "bag", quantity: 1, content: [apple, null] };
  const worldItemsByUid = new Map([[3, { uid: 3, itemId: "cheese", quantity: 1 }]]);
  const equipment = { weapon: null };
  const controller = createItemLocationController({
    equipment,
    findContainerByUid: (uid) => (uid === bag.uid ? bag : null),
    findWorldItemByUid: (uid) => worldItemsByUid.get(uid) ?? null,
    removeWorldItem: (uid) => worldItemsByUid.delete(uid),
    addWorldItem: (item) => {
      worldItemsByUid.set(item.uid, item);
      return true;
    },
    positionWorldItem: (destination, item) => {
      Object.assign(item, destination);
      return true;
    },
    canEquipItem: () => true,
    setEquipmentItem: (location, item) => {
      equipment[location.equipmentSlotName] = item;
      return true;
    },
  });
  return { apple, bag, controller, equipment, worldItemsByUid };
};

test("an item location resolves and mutates a container slot", () => {
  const { apple, bag, controller } = createControllerFixture();
  const location = { locationType: "containerSlot", parentContainerUid: bag.uid, slotIndex: 0 };

  assert.equal(controller.getItem(location), apple);
  assert.equal(controller.removeItem(location), apple);
  assert.equal(bag.content[0], null);
  assert.equal(controller.placeItem(location, apple), true);
  assert.equal(bag.content[0], apple);
});

test("moving an item to equipment returns the displaced item", () => {
  const { apple, controller, equipment } = createControllerFixture();
  const sword = { uid: 4, itemId: "sword", quantity: 1 };
  equipment.weapon = sword;

  const displaced = controller.placeItem(
    { locationType: "equipmentSlot", equipmentSlotName: "weapon" },
    apple,
  );

  assert.equal(displaced, sword);
  assert.equal(equipment.weapon, apple);
});

test("world removal and placement use the injected world boundary", () => {
  const { controller, worldItemsByUid } = createControllerFixture();
  const cheese = controller.removeItem({ locationType: "worldItem", itemUid: 3 });
  assert.equal(worldItemsByUid.has(3), false);

  const destination = { locationType: "worldTile", x: 128, y: 192, z: -1 };
  assert.equal(controller.placeItem(destination, cheese), true);
  assert.equal(worldItemsByUid.get(3), cheese);
  assert.deepEqual(
    { x: cheese.x, y: cheese.y, z: cheese.z },
    { x: 128, y: 192, z: -1 },
  );
});
