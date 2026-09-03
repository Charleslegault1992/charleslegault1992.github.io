export const raidChestsDatabase = Object.freeze({
  raid_chest_01: {
    chestId: "raid_chest_01",

    itemId: "raidChest",

    loot: [
      /*
       * Toujours entre 10 et 35 gold.
       */
      {
        itemId: "goldCoin",
        chance: 100,
        minQuantity: 10,
        maxQuantity: 35,
      },

      /*
       * Toujours 1 ou 2 torches.
       *
       * Torch n'est pas stackable,
       * donc le système créera 1 ou 2
       * instances différentes.
       */
      {
        itemId: "torch",
        chance: 100,
        minQuantity: 1,
        maxQuantity: 2,
      },

      /*
       * Deuxième sword la moins forte.
       */
      {
        itemId: "shortSword",
        chance: 12,
        minQuantity: 1,
        maxQuantity: 1,
      },

      /*
       * Petite healing rune.
       */
      {
        itemId: "smallHealingRune",
        chance: 35,
        minQuantity: 1,
        maxQuantity: 1,
      },

      {
        itemId: "healthPotion",
        chance: 30,
        minQuantity: 1,
        maxQuantity: 1,
      },

      {
        itemId: "manaPotion",
        chance: 30,
        minQuantity: 1,
        maxQuantity: 1,
      },
    ],
  },
});

export const getRaidChestData = (chestId) => {
  return raidChestsDatabase[chestId] ?? null;
};