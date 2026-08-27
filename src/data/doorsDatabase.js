export const DOOR_WALL_SIDE = Object.freeze({
  lower: "lower",
  upper: "upper",
});

const woodenDoorClosed = Object.freeze({
  frame: Object.freeze({ x: 1856, y: 128, width: 192, height: 192 }),
  offsetX: -64,
  offsetY: 0,
});

export const doorsDatabase = Object.freeze({
  woodenDoor: Object.freeze({
    tilesetImage: "house1.png",
    variants: Object.freeze({
      lower: Object.freeze({
        closed: woodenDoorClosed,
        open: Object.freeze({
          frame: Object.freeze({ x: 1856, y: 320, width: 192, height: 192 }),
          offsetX: 0,
          offsetY: -64,
        }),
      }),
      upper: Object.freeze({
        closed: woodenDoorClosed,
        open: Object.freeze({
          frame: Object.freeze({ x: 1856, y: 512, width: 192, height: 192 }),
          offsetX: -64,
          offsetY: 0,
        }),
      }),
    }),
  }),
});

export const getDoorData = (doorType) => doorsDatabase[doorType] ?? null;

export const getDoorVariantData = (doorType, wallSide) => getDoorData(doorType)?.variants?.[wallSide] ?? null;
