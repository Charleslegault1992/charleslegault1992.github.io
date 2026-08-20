import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createChatModerationService } from "../server/chatModerationService.js";
import { createSqliteAccountRepository } from "../server/persistence/sqliteAccountRepository.js";
import { createSqliteChatModerationRepository } from "../server/persistence/sqliteChatModerationRepository.js";

test("chat mutes persist and moderator commands stay private", () => {
  const databasePath = join(tmpdir(), `nonameyet-chat-${randomUUID()}.sqlite`);
  const accounts = createSqliteAccountRepository({ databasePath });
  const repository = createSqliteChatModerationRepository({ databasePath });
  accounts.create("moderator", "moderator@example.com", "test-hash", 1);
  accounts.create("target", "target@example.com", "test-hash", 1);
  const service = createChatModerationService({ repository, moderatorAccountIds: ["moderator"] });
  const moderator = { uid: "player:moderator:one", name: "Mod" };
  const target = { uid: "player:target:one", name: "Target" };
  const playersByUid = new Map([[moderator.uid, moderator], [target.uid, target]]);
  const sessionsByPlayerUid = new Map([
    [moderator.uid, { accountId: "moderator" }],
    [target.uid, { accountId: "target" }],
  ]);

  const muteResult = service.handleMessage({
    session: sessionsByPlayerUid.get(moderator.uid),
    player: moderator,
    payload: { text: "/mute Target 5 testing" },
    playersByUid,
    sessionsByPlayerUid,
    now: 1000,
  });
  const blockedResult = service.handleMessage({
    session: sessionsByPlayerUid.get(target.uid),
    player: target,
    payload: { text: "hello" },
    playersByUid,
    sessionsByPlayerUid,
    now: 2000,
  });

  assert.equal(muteResult.success, true);
  assert.equal(muteResult.events[0].recipientPlayerUid, moderator.uid);
  assert.equal(repository.getActiveMute("target", 2000).reason, "testing");
  assert.equal(blockedResult.reason, "chat-muted");

  repository.close();
  accounts.close();
  unlinkSync(databasePath);
});
