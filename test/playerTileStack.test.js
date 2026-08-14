import assert from "node:assert/strict";
import test from "node:test";

import { getPlayerTileStackRenderOffset, getTopPlayerAtTile } from "../src/player/playerTileStack.js";

test("the most recent player on a shared tile is targeted and rendered on top", () => {
  const firstPlayer = { uid: "player:first", x: 64, y: 128, z: -1, tileStackOrder: 12 };
  const secondPlayer = { uid: "player:second", x: 64, y: 128, z: -1, tileStackOrder: 18 };
  const players = [firstPlayer, secondPlayer];

  assert.equal(getTopPlayerAtTile(players, 64, 128, -1), secondPlayer);
  assert.ok(
    getPlayerTileStackRenderOffset(secondPlayer, players) >
      getPlayerTileStackRenderOffset(firstPlayer, players),
  );
});
