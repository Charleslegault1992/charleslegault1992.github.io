const getPlayerTileStackOrder = (player) => {
  return Number.isSafeInteger(player?.tileStackOrder) ? player.tileStackOrder : 0;
};

const isPlayerAtTile = (player, x, y, z) => {
  return player?.x === x && player?.y === y && player?.z === z;
};

export const getTopPlayerAtTile = (players, x, y, z) => {
  let topPlayer = null;
  for (const player of players ?? []) {
    if (!isPlayerAtTile(player, x, y, z)) {
      continue;
    }
    if (!topPlayer || getPlayerTileStackOrder(player) >= getPlayerTileStackOrder(topPlayer)) {
      topPlayer = player;
    }
  }
  return topPlayer;
};

const uniquePlayersByUid = new Map();
const playersByTileKey = new Map();
const tilePlayerListPool = [];
const offsetsByUid = new Map();

export const getPlayerTileStackRenderOffsets = (players) => {
  uniquePlayersByUid.clear();
  offsetsByUid.clear();

  for (const player of players ?? []) {
    if (player?.uid != null) {
      uniquePlayersByUid.set(player.uid, player);
    }
  }

  // Recycle array pool from previous call
  for (const list of playersByTileKey.values()) {
    list.length = 0;
    tilePlayerListPool.push(list);
  }
  playersByTileKey.clear();

  for (const player of uniquePlayersByUid.values()) {
    const tileKey = `${player.z}:${player.x}:${player.y}`;
    let stackedPlayers = playersByTileKey.get(tileKey);
    if (!stackedPlayers) {
      stackedPlayers = tilePlayerListPool.pop() ?? [];
      playersByTileKey.set(tileKey, stackedPlayers);
    }
    stackedPlayers.push(player);
  }

  for (const stackedPlayers of playersByTileKey.values()) {
    if (stackedPlayers.length > 1) {
      stackedPlayers.sort((first, second) => getPlayerTileStackOrder(first) - getPlayerTileStackOrder(second));
    }
    for (let index = 0; index < stackedPlayers.length; index++) {
      const offset = index === 0 ? 0 : (index / stackedPlayers.length) * 0.9;
      offsetsByUid.set(stackedPlayers[index].uid, offset);
    }
  }
  return offsetsByUid;
};

export const getPlayerTileStackRenderOffset = (targetPlayer, players) => {
  if (!targetPlayer) {
    return 0;
  }
  return getPlayerTileStackRenderOffsets(players).get(targetPlayer.uid) ?? 0;
};
