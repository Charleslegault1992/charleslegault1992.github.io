/* ==================================================== */
//#region     -----  TILESETS - SELECTION  -----
/* ==================================================== */
const TILED_FLIPPED_HORIZONTALLY_FLAG = 0x80000000;
const TILED_FLIPPED_VERTICALLY_FLAG = 0x40000000;
const TILED_FLIPPED_DIAGONALLY_FLAG = 0x20000000;
const TILED_ROTATED_HEXAGONAL_120_FLAG = 0x10000000;
const TILED_GID_MASK = 0x0fffffff;

export const decodeTiledGid = (rawGid) => {
  if (!Number.isInteger(rawGid) || rawGid <= 0 || rawGid > 0xffffffff) {
    return null;
  }

  const unsignedGid = rawGid >>> 0;
  const gid = unsignedGid & TILED_GID_MASK;
  if (gid <= 0) {
    return null;
  }

  return {
    gid,
    flipHorizontal: (unsignedGid & TILED_FLIPPED_HORIZONTALLY_FLAG) !== 0,
    flipVertical: (unsignedGid & TILED_FLIPPED_VERTICALLY_FLAG) !== 0,
    flipDiagonal: (unsignedGid & TILED_FLIPPED_DIAGONALLY_FLAG) !== 0,
    rotateHexagonal120: (unsignedGid & TILED_ROTATED_HEXAGONAL_120_FLAG) !== 0,
  };
};

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
//#endregion  -----  TILESETS - SELECTION  -----

/* ==================================================== */
//#region     -----  GID - LOCAL TILE  -----
/* ==================================================== */
const getLocalTileIdFromGid = (tileset, gid) => {
  if (!Number.isFinite(tileset?.firstgid) || gid <= 0 || !Number.isFinite(gid) || gid < tileset.firstgid) {
    return null;
  }
  return gid - tileset.firstgid;
};
//#endregion  -----  GID - LOCAL TILE  -----

/* ==================================================== */
//#region     -----  TILESET - SOURCE RECT  -----
/* ==================================================== */
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
//#endregion  -----  TILESET - SOURCE RECT  -----

/* ==================================================== */
//#region     -----  RENDER DATA  -----
/* ==================================================== */
export const getTileRenderDataFromGid = (tiledTilesets, gid) => {
  if (!Array.isArray(tiledTilesets)) {
    return null;
  }

  const decodedGid = decodeTiledGid(gid);
  if (!decodedGid) {
    return null;
  }

  const tileset = getTilesetForGid(tiledTilesets, decodedGid.gid);
  if (!tileset) {
    return null;
  }

  const localTileId = getLocalTileIdFromGid(tileset, decodedGid.gid);
  if (
    !Number.isInteger(localTileId) ||
    (Number.isInteger(tileset.tilecount) && localTileId >= tileset.tilecount)
  ) {
    return null;
  }

  const sourcePosition = getTileSourcePositionInTileset(tileset, localTileId);
  if (!sourcePosition) {
    return null;
  }

  return {
    rawGid: gid,
    ...decodedGid,
    tileset,
    localTileId,
    ...sourcePosition,
  };
};
//#endregion  -----  RENDER DATA  -----
