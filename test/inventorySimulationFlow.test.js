import assert from "node:assert/strict";
import test from "node:test";

import { createMoveItemAction } from "../src/inventory/inventoryActions.js";
import { createItemLocationController } from "../src/inventory/itemLocationController.js";
import { createItemInstance } from "../src/items/itemFactory.js";
import { createGameSimulation } from "../src/simulation/gameSimulation.js";
import { createLocalGameTransport } from "../src/simulation/localGameTransport.js";

const createInventoryFlowFixture = () => {
  const bag = createItemInstance("bag", 1);
  const apple = createItemInstance("apple", 1);
  const sword = createItemInstance("sword", 1);
  bag.content[0] = apple;
  const equipment = { backpack: bag, weapon: sword };
  const worldItemsByUid = new Map();

  const locationController = createItemLocationController({
    equipment,
    findContainerByUid: (uid) => (uid === bag.uid ? bag : null),
    findWorldItemByUid: (uid) => worldItemsByUid.get(uid) ?? null,
    removeWorldItem: (uid) => worldItemsByUid.delete(uid),
    addWorldItem: (item) => {
      if (worldItemsByUid.has(item.uid)) {
        return false;
      }
      worldItemsByUid.set(item.uid, item);
      return true;
    },
    positionWorldItem: (destination, item) => {
      item.x = destination.x;
      item.y = destination.y;
      item.z = destination.z;
      return true;
    },
    canEquipItem: (item, slotName) => item.itemId === "sword" && slotName === "weapon",
    setEquipmentItem: (location, item) => {
      equipment[location.equipmentSlotName] = item;
      return true;
    },
  });

  const executeMoveItem = ({ source, destination, itemUid }) => {
    const item = locationController.getItem(source);
    if (!item || item.uid !== itemUid) {
      return { success: false, reason: "item-changed" };
    }
    const removedItem = locationController.removeItem(source);
    if (!removedItem) {
      return { success: false, reason: "invalid-source" };
    }
    const placementResult = locationController.placeItem(destination, removedItem);
    if (!placementResult) {
      locationController.placeItem(source, removedItem);
      return { success: false, reason: "invalid-destination" };
    }
    return {
      success: true,
      changes: { itemUid, destination },
      events: [{ type: "inventory-move-completed" }],
    };
  };

  const simulation = createGameSimulation({
    state: {
      player: { uid: "player-1", hp: 100, x: 0, y: 0, z: 0 },
      monstersByUid: new Map(),
      timing: { nextPlayerMoveTime: 0, nextPlayerAttackTime: 0 },
    },
    rules: {},
    commands: { executeMoveItem },
  });

  return {
    apple,
    bag,
    equipment,
    sword,
    transport: createLocalGameTransport({ simulation }),
    worldItemsByUid,
  };
};

test("equipment, containers and ground items move through the simulation transport", () => {
  const { apple, bag, equipment, sword, transport, worldItemsByUid } = createInventoryFlowFixture();
  const equipmentSource = { locationType: "equipmentSlot", equipmentSlotName: "weapon" };
  const worldDestination = { locationType: "worldTile", x: 64, y: 0, z: 0 };

  const droppedSword = transport.send(createMoveItemAction(equipmentSource, worldDestination, sword.uid));

  assert.equal(droppedSword.success, true);
  assert.equal(equipment.weapon, null);
  assert.equal(worldItemsByUid.get(sword.uid), sword);

  const containerSource = { locationType: "containerSlot", parentContainerUid: bag.uid, slotIndex: 0 };
  const emptyWorldDestination = { locationType: "worldTile", x: 128, y: 0, z: 0 };
  const droppedApple = transport.send(createMoveItemAction(containerSource, emptyWorldDestination, apple.uid));

  assert.equal(droppedApple.success, true);
  assert.equal(bag.content[0], null);
  assert.equal(worldItemsByUid.get(apple.uid), apple);
});
