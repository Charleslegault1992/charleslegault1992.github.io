import { applyPlayerLevelLoss } from "./playerProgressionModel.js";

export const applyPlayerDeathState = (player, spawnPosition) => {
  if (
    !player ||
    !Number.isFinite(player.maxHp) ||
    !Number.isFinite(player.experience) ||
    !Number.isInteger(spawnPosition?.x) ||
    !Number.isInteger(spawnPosition?.y) ||
    !Number.isInteger(spawnPosition?.z)
  ) {
    return { success: false, reason: "invalid-player-death-state" };
  }

  const previousPosition = { x: player.x, y: player.y, z: player.z };
  const experienceLost = player.experience - Math.floor(player.experience * 0.9);
  player.experience = Math.max(player.experience - experienceLost, 0);
  const levelLoss = applyPlayerLevelLoss(player);
  player.hp = player.maxHp;
  player.x = spawnPosition.x;
  player.y = spawnPosition.y;
  player.z = spawnPosition.z;
  player.oldX = spawnPosition.x;
  player.oldY = spawnPosition.y;
  player.renderX = spawnPosition.x;
  player.renderY = spawnPosition.y;
  player.moveStartTime = 0;
  player.moveDuration = 0;

  return {
    success: true,
    changes: {
      playerUid: player.uid,
      previousPosition,
      position: { ...spawnPosition },
      hp: player.hp,
      experience: player.experience,
      experienceLost,
      level: player.level,
      levelLoss,
    },
  };
};
