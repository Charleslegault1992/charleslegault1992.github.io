export const doorsDatabase = Object.freeze({
  woodenDoor: Object.freeze({
    tilesetImage: "housefurniture.png",
    closed: Object.freeze({
      anchorCol: 1,
      anchorRow: 0,
      tiles: Object.freeze([
        Object.freeze({ localTileId: 0, col: 0, row: 0 }),
        Object.freeze({ localTileId: 1, col: 1, row: 0 }),
        Object.freeze({ localTileId: 2, col: 2, row: 0 }),
        Object.freeze({ localTileId: 22, col: 0, row: 1 }),
        Object.freeze({ localTileId: 23, col: 1, row: 1 }),
        Object.freeze({ localTileId: 24, col: 2, row: 1 }),
      ]),
    }),
    open: Object.freeze({
      anchorCol: 0,
      anchorRow: 1,
      tiles: Object.freeze([
        Object.freeze({ localTileId: 3, col: 0, row: 0 }),
        Object.freeze({ localTileId: 25, col: 0, row: 1 }),
        Object.freeze({ localTileId: 47, col: 0, row: 2 }),
      ]),
    }),
  }),
});

export const getDoorData = (doorType) => doorsDatabase[doorType] ?? null;
