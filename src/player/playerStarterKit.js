import { updatePlayerCarriedWeight } from "../inventory/inventoryWeight.js";
import { createItemInstance } from "../items/itemFactory.js";

const hasAnyEquippedItem = (player) => {
  return Object.values(player?.equipment ?? {}).some((item) => item !== null);
};

export const applyPlayerStarterKit = (player) => {
  if (!player?.equipment || player.progress?.starterKitGranted === true) {
    return false;
  }

  player.progress ??= {};
  if (hasAnyEquippedItem(player)) {
    player.progress.starterKitGranted = true;
    return true;
  }

  const backpack = createItemInstance("bag", 1);
  const mace = createItemInstance("mace", 1);
  const torch = createItemInstance("torch", 1);
  const apple = createItemInstance("apple", 1);
  const healthPotion = createItemInstance("healthPotion", 1);
  const manaPotion = createItemInstance("manaPotion", 1);
  if (!backpack || !mace || !torch || !apple || !healthPotion || !manaPotion) {
    return false;
  }

  backpack.content[0] = apple;
  backpack.content[1] = healthPotion;
  backpack.content[2] = manaPotion;
  player.equipment.backpack = backpack;
  player.equipment.weapon = mace;
  player.equipment.ammo = torch;
  player.progress.starterKitGranted = true;
  updatePlayerCarriedWeight(player);
  return true;
};
