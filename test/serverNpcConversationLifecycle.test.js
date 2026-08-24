import assert from "node:assert/strict";
import test from "node:test";

import { TILE_SIZE } from "../src/core/gameConstants.js";
import { createServerNpcConversationService } from "../server/serverNpcConversationService.js";

test("walking away from an NPC does not force the chat panel open", () => {
  const npc = { uid: "npc-ben", npcId: "ben", x: 0, y: 0, z: 0 };
  const player = {
    uid: "player-one",
    name: "Charles",
    language: "fr",
    x: 0,
    y: 0,
    z: 0,
    bank: { goldBalance: 0 },
  };
  const service = createServerNpcConversationService({
    npcs: new Map([[npc.uid, npc]]),
    playersByUid: new Map([[player.uid, player]]),
    getInventory: () => null,
  });

  assert.equal(service.handleSpeech("salut", player, 1000).success, true);
  const repeatedGreeting = service.handleSpeech("salut", player, 1001);
  assert.equal(repeatedGreeting.success, true);
  assert.deepEqual(repeatedGreeting.events, []);
  player.x = TILE_SIZE * 10;

  const departureEvent = service.update(1100).find((event) => event.type === "npc-spoke");

  assert.equal(departureEvent?.openChat, false);
  assert.equal(departureEvent?.conversationActive, false);
});
