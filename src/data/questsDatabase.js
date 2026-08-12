/* ---------- DATABASE - RECOMPENSES ---------- */

export const rewardTablesDatabase = {
  tiro_cave_spider_reward: {
    rewardTableId: "tiro_cave_spider_reward",
    items: [
      { itemId: "healthPotion", quantity: 1 },
      { itemId: "sword", quantity: 1 },
      { itemId: "torch", quantity: 1 },
    ],
  },
};

/* ---------- DATABASE - QUETES ---------- */

export const QUEST_STATUS = {
  started: "started",
  completed: "completed",
};

export const questsDatabase = {
  tiro_cave_spider_treasure: {
    questId: "tiro_cave_spider_treasure",
    name: "Spider Cave Treasure",
    description: "You found the treasure hidden in the spider cave.",
  },
};
