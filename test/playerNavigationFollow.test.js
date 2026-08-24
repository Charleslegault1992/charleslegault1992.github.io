import assert from "node:assert/strict";
import test from "node:test";

import {
  createPlayerNavigationController,
  PLAYER_NAVIGATION_MODE,
  playerNavigationState,
} from "../src/player/playerNavigationController.js";
import { combatTargetState } from "../src/state/clientRuntimeState.js";
import { playerState } from "../src/state/playerState.js";

test("follow navigation supports a selected remote player", () => {
  Object.assign(playerState, { uid: "self", x: 0, y: 0, z: 0, hp: 100 });
  const remotePlayer = { uid: "remote", x: 64, y: 0, z: 0, hp: 100 };
  combatTargetState.monsterUid = null;
  combatTargetState.playerUid = "remote";
  playerNavigationState.followEnabled = true;
  let lostPlayerTarget = false;

  const controller = createPlayerNavigationController({
    findMonsterByUid: () => null,
    findPlayerByUid: (uid) => (uid === remotePlayer.uid ? remotePlayer : null),
    loseSelectedMonsterTarget() {},
    loseSelectedPlayerTarget() {
      lostPlayerTarget = true;
    },
    updatePlayerInventory() {},
    showGameStatusMessage() {},
  });

  assert.equal(controller.startFollow("player", remotePlayer.uid), true);
  assert.equal(playerNavigationState.mode, PLAYER_NAVIGATION_MODE.follow);
  assert.equal(playerNavigationState.followTargetType, "player");
  assert.equal(playerNavigationState.followTargetUid, remotePlayer.uid);

  controller.updateFollow(1000);
  assert.equal(playerNavigationState.mode, PLAYER_NAVIGATION_MODE.follow);

  remotePlayer.z = -1;
  controller.updateFollow(1100);
  assert.equal(lostPlayerTarget, true);
});
