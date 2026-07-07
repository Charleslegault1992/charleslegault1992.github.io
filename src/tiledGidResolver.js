const getTilesetForGid = (tiledTilesets, gid) => {
  if (!Number.isFinite(gid) || gid <= 0 || !Array.isArray(tiledTilesets)) {
    return null;
  }

  let bestTileset = null;

  for (const tileset of tiledTilesets) {
    if (!Number.isFinite(tileset?.firstgid)) {
      continue;
    }
    if (tileset.firstgid <= gid) {
      if (!bestTileset) {
        bestTileset = tileset;
      } else {
        if (tileset.firstgid > bestTileset.firstgid) {
          bestTileset = tileset;
        }
      }
    }
  }
  return bestTileset;
};

const getLocalTileIdFromGid = (tileset, gid) => {
  if (!Number.isFinite(tileset?.firstgid) || gid <= 0 || !Number.isFinite(gid) || gid < tileset.firstgid) {
    return null;
  }
  return gid - tileset.firstgid;
};

const getTileSourcePositionInTileset = (tileset, localTileId) => {
  if (
    !Number.isFinite(tileset?.columns) ||
    !Number.isInteger(localTileId) ||
    !Number.isFinite(tileset?.tilewidth) ||
    !Number.isFinite(tileset?.tileheight) ||
    tileset.columns <= 0 ||
    tileset.tilewidth <= 0 ||
    tileset.tileheight <= 0 ||
    localTileId < 0
  ) {
    return null;
  }
  const tilesetColumns = tileset.columns;
  const tilewidth = tileset.tilewidth;
  const tileheight = tileset.tileheight;
  const spacing = tileset.spacing ?? 0;
  const margin = tileset.margin ?? 0;

  const tileCol = localTileId % tilesetColumns;
  const tileRow = Math.floor(localTileId / tilesetColumns);
  const sourceX = margin + tileCol * (tilewidth + spacing);
  const sourceY = margin + tileRow * (tileheight + spacing);

  return {
    sourceX,
    sourceY,
    sourceWidth: tilewidth,
    sourceHeight: tileheight,
  };
};

export const getTileRenderDataFromGid = (tiledTilesets, gid) => {
  if (!Number.isFinite(gid) || gid <= 0 || !Array.isArray(tiledTilesets)) {
    return null;
  }

  const tileset = getTilesetForGid(tiledTilesets, gid);
  if (!tileset) {
    return null;
  }

  const localTileId = getLocalTileIdFromGid(tileset, gid);
  if (!Number.isInteger(localTileId)) {
    return null;
  }

  const sourcePosition = getTileSourcePositionInTileset(tileset, localTileId);
  if (!sourcePosition) {
    return null;
  }

  return {
    gid,
    tileset,
    localTileId,
    ...sourcePosition,
  };
};
