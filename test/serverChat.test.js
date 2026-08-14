import assert from "node:assert/strict";
import test from "node:test";

import { createSendChatMessageAction } from "../src/actions/gameplayActions.js";
import { createAuthoritativeWorldRuntime } from "../server/authoritativeWorldRuntime.js";
import { loadServerWorldMaps } from "../server/loadServerWorldMaps.js";

test("authoritative chat assigns the speaker and reaches nearby players", async () => {
  const worldMapsByZ = await loadServerWorldMaps();
  let now = 1000;
  const runtime = createAuthoritativeWorldRuntime({ worldMapsByZ, now: () => now });
  const senderSession = {};
  const receiverSession = {};
  senderSession.playerUid = runtime.connectClient(senderSession, {
    accountId: "chat",
    characterId: "sender",
    name: "Sender",
  }).playerUid;
  receiverSession.playerUid = runtime.connectClient(receiverSession, {
    accountId: "chat",
    characterId: "receiver",
    name: "Receiver",
  }).playerUid;
  const sender = runtime.getPlayer(senderSession.playerUid);
  const receiver = runtime.getPlayer(receiverSession.playerUid);
  Object.assign(receiver, { x: sender.x, y: sender.y, z: sender.z });
  const snapshot = runtime.createSnapshotForClient(receiverSession);

  now += 1000;
  runtime.update(now);
  const result = runtime.dispatchAction(senderSession, createSendChatMessageAction("local", "hello nearby", 0));
  const delta = runtime.getDeltasForClient(receiverSession, snapshot.revision)[0];
  const chatEvent = delta.events.find((event) => event.type === "chat-message");

  assert.equal(result.success, true);
  assert.equal(chatEvent.playerUid, sender.uid);
  assert.equal(chatEvent.speakerName, "Sender");
  assert.equal(chatEvent.text, "hello nearby");
});
