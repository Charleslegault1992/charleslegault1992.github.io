export const generateMonsterLoot = (monsterData, { createItem, randomInt }) => {
  if (!Array.isArray(monsterData?.loot) || typeof createItem !== "function" || typeof randomInt !== "function") {
    return [];
  }
  const items = [];
  for (const lootEntry of monsterData.loot) {
    if (randomInt(1, 100) > lootEntry.chance) {
      continue;
    }
    const item = createItem(
      lootEntry.itemId,
      randomInt(lootEntry.minQuantity, lootEntry.maxQuantity),
    );
    if (item) {
      items.push(item);
    }
  }
  return items;
};

export const applyMonsterExperienceReward = (player, monsterData) => {
  const experience = monsterData?.experience;
  if (!player || !Number.isFinite(player.experience) || !Number.isFinite(experience) || experience <= 0) {
    return 0;
  }
  player.experience += experience;
  return experience;
};
