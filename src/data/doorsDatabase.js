export const doorsDatabase = Object.freeze({
  woodenDoor: Object.freeze({
    tilesetImage: "house1.png",
    closed: Object.freeze({
      frame: Object.freeze({ x: 1664, y: 0, width: 192, height: 192 }),
      offsetX: -64,
      offsetY: 0,
    }),
    open: Object.freeze({
      frame: Object.freeze({ x: 1664, y: 256, width: 192, height: 192 }),
      offsetX: 0,
      offsetY: -64,
    }),
  }),
});

export const getDoorData = (doorType) => doorsDatabase[doorType] ?? null;
