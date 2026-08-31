import assert from "node:assert/strict";

import {
  randomUUID,
} from "node:crypto";

import {
  unlinkSync,
} from "node:fs";

import {
  tmpdir,
} from "node:os";

import {
  join,
} from "node:path";

import test from "node:test";

import {
  createChatModerationService,
} from "../server/chatModerationService.js";

import {
  createSqliteAccountRepository,
} from "../server/persistence/sqliteAccountRepository.js";

import {
  createSqliteChatModerationRepository,
} from "../server/persistence/sqliteChatModerationRepository.js";

const createDeferred = () => {
  let resolve;
  let reject;

  const promise =
    new Promise(
      (
        resolvePromise,
        rejectPromise,
      ) => {
        resolve =
          resolvePromise;

        reject =
          rejectPromise;
      },
    );

  return {
    promise,
    resolve,
    reject,
  };
};

const createChatContext = () => {
  const moderator = {
    uid:
      "player:moderator:one",

    name:
      "Mod",
  };

  const target = {
    uid:
      "player:target:one",

    name:
      "Target",
  };

  const playersByUid =
    new Map([
      [
        moderator.uid,
        moderator,
      ],

      [
        target.uid,
        target,
      ],
    ]);

  const sessionsByPlayerUid =
    new Map([
      [
        moderator.uid,
        {
          accountId:
            "moderator",
        },
      ],

      [
        target.uid,
        {
          accountId:
            "target",
        },
      ],
    ]);

  return {
    moderator,
    target,
    playersByUid,
    sessionsByPlayerUid,
    moderatorSession:
      sessionsByPlayerUid.get(
        moderator.uid,
      ),

    targetSession:
      sessionsByPlayerUid.get(
        target.uid,
      ),
  };
};

test("chat mutes persist and moderator commands stay private", async () => {
  const databasePath =
    join(
      tmpdir(),

      `nonameyet-chat-${randomUUID()}.sqlite`,
    );

  const accounts =
    createSqliteAccountRepository({
      databasePath,
    });

  const repository =
    createSqliteChatModerationRepository({
      databasePath,
    });

  accounts.create(
    "moderator",
    "moderator@example.com",
    "test-hash",
    1,
  );

  accounts.create(
    "target",
    "target@example.com",
    "test-hash",
    1,
  );

  const service =
    createChatModerationService({
      repository,

      moderatorAccountIds: [
        "moderator",
      ],
    });

  await service.initialize(500);

  const {
    moderator,
    target,
    moderatorSession,
    targetSession,
    playersByUid,
    sessionsByPlayerUid,
  } =
    createChatContext();

  const muteResult =
    service.handleMessage({
      session:
        moderatorSession,

      player:
        moderator,

      payload: {
        text:
          "/mute Target 5 testing",
      },

      playersByUid,
      sessionsByPlayerUid,
      now: 1000,
    });

  /*
   * RAM changes immediately before the
   * durable write even finishes.
   */
  const blockedResult =
    service.handleMessage({
      session:
        targetSession,

      player:
        target,

      payload: {
        text: "hello",
      },

      playersByUid,
      sessionsByPlayerUid,
      now: 2000,
    });

  assert.equal(
    muteResult.success,
    true,
  );

  assert.equal(
    muteResult.events[0]
      .recipientPlayerUid,
    moderator.uid,
  );

  assert.equal(
    blockedResult.reason,
    "chat-muted",
  );

  const flushResult =
    await service
      .flushPersistence();

  assert.equal(
    flushResult.success,
    true,
  );

  assert.equal(
    repository
      .getActiveMute(
        "target",
        2000,
      )
      .reason,
    "testing",
  );

  repository.close();
  accounts.close();

  unlinkSync(databasePath);
});

test("chat moderation loads all active mutes once and never reads persistence for normal messages", async () => {
  let listCalls = 0;
  let pruneCalls = 0;

  const repository = {
    async listActiveMutes() {
      listCalls += 1;

      return [
        {
          accountId:
            "target",

          mutedUntil:
            10000,

          reason:
            "persisted",

          moderatorAccountId:
            "moderator",

          createdAt:
            100,
        },
      ];
    },

    async pruneExpired() {
      pruneCalls += 1;
      return 0;
    },

    async mute() {
      return true;
    },

    async unmute() {
      return true;
    },

    getActiveMute() {
      throw new Error(
        "Hot-path database read must never happen.",
      );
    },
  };

  const service =
    createChatModerationService({
      repository,
    });

  const initialization =
    await service.initialize(
      1000,
    );

  const {
    target,
    targetSession,
    playersByUid,
    sessionsByPlayerUid,
  } =
    createChatContext();

  for (
    let index = 0;
    index < 50;
    index += 1
  ) {
    const result =
      service.handleMessage({
        session:
          targetSession,

        player:
          target,

        payload: {
          text:
            `message ${index}`,
        },

        playersByUid,
        sessionsByPlayerUid,

        now:
          2000 + index,
      });

    assert.equal(
      result.reason,
      "chat-muted",
    );
  }

  assert.equal(
    initialization.activeMuteCount,
    1,
  );

  assert.equal(
    listCalls,
    1,
  );

  assert.equal(
    pruneCalls,
    1,
  );
});

test("asynchronous mute persistence cannot create a window where the target may speak", async () => {
  const deferred =
    createDeferred();

  const repository = {
    async listActiveMutes() {
      return [];
    },

    async pruneExpired() {
      return 0;
    },

    mute() {
      return deferred.promise;
    },

    async unmute() {
      return true;
    },
  };

  const service =
    createChatModerationService({
      repository,

      moderatorAccountIds: [
        "moderator",
      ],
    });

  await service.initialize(
    1000,
  );

  const context =
    createChatContext();

  const muteResult =
    service.handleMessage({
      session:
        context.moderatorSession,

      player:
        context.moderator,

      payload: {
        text:
          "/mute Target 5 async",
      },

      playersByUid:
        context.playersByUid,

      sessionsByPlayerUid:
        context
          .sessionsByPlayerUid,

      now:
        2000,
    });

  assert.equal(
    muteResult.success,
    true,
  );

  const blockedImmediately =
    service.handleMessage({
      session:
        context.targetSession,

      player:
        context.target,

      payload: {
        text:
          "trying before postgres",
      },

      playersByUid:
        context.playersByUid,

      sessionsByPlayerUid:
        context
          .sessionsByPlayerUid,

      now:
        2001,
    });

  assert.equal(
    blockedImmediately.reason,
    "chat-muted",
  );

  deferred.resolve(true);

  const flushResult =
    await service
      .flushPersistence();

  assert.equal(
    flushResult.success,
    true,
  );
});

test("mute and unmute persistence for one account are always serialized in command order", async () => {
  const firstWrite =
    createDeferred();

  const calls = [];

  const repository = {
    async listActiveMutes() {
      return [];
    },

    async pruneExpired() {
      return 0;
    },

    mute() {
      calls.push("mute");
      return firstWrite.promise;
    },

    async unmute() {
      calls.push("unmute");
      return true;
    },
  };

  const service =
    createChatModerationService({
      repository,

      moderatorAccountIds: [
        "moderator",
      ],
    });

  await service.initialize(
    1000,
  );

  const context =
    createChatContext();

  service.handleMessage({
    session:
      context.moderatorSession,

    player:
      context.moderator,

    payload: {
      text:
        "/mute Target 5 test",
    },

    playersByUid:
      context.playersByUid,

    sessionsByPlayerUid:
      context
        .sessionsByPlayerUid,

    now:
      2000,
  });

  service.handleMessage({
    session:
      context.moderatorSession,

    player:
      context.moderator,

    payload: {
      text:
        "/unmute Target",
    },

    playersByUid:
      context.playersByUid,

    sessionsByPlayerUid:
      context
        .sessionsByPlayerUid,

    now:
      2001,
  });

  /*
   * unmute cannot hit persistence while
   * mute for the same account is active.
   */
  assert.deepEqual(
    calls,
    [
      "mute",
    ],
  );

  /*
   * But the RAM state changed immediately.
   */
  const messageResult =
    service.handleMessage({
      session:
        context.targetSession,

      player:
        context.target,

      payload: {
        text:
          "I can speak now",
      },

      playersByUid:
        context.playersByUid,

      sessionsByPlayerUid:
        context
          .sessionsByPlayerUid,

      now:
        2002,
    });

  assert.equal(
    messageResult,
    null,
  );

  firstWrite.resolve(true);

  const flushResult =
    await service
      .flushPersistence();

  assert.equal(
    flushResult.success,
    true,
  );

  assert.deepEqual(
    calls,
    [
      "mute",
      "unmute",
    ],
  );
});

test("expired cached mutes disappear without a database lookup", async () => {
  let listCalls = 0;

  const repository = {
    async listActiveMutes() {
      listCalls += 1;

      return [
        {
          accountId:
            "target",

          mutedUntil:
            1500,

          reason:
            "short mute",

          moderatorAccountId:
            "moderator",

          createdAt:
            500,
        },
      ];
    },

    async pruneExpired() {
      return 0;
    },

    async mute() {
      return true;
    },

    async unmute() {
      return true;
    },
  };

  const service =
    createChatModerationService({
      repository,
    });

  await service.initialize(
    1000,
  );

  assert.equal(
    service.getActiveMute(
      "target",
      1200,
    )?.reason,
    "short mute",
  );

  assert.equal(
    service.getActiveMute(
      "target",
      1600,
    ),
    null,
  );

  assert.equal(
    service.getActiveMute(
      "target",
      1700,
    ),
    null,
  );

  assert.equal(
    listCalls,
    1,
  );
});

test("chat moderation flush retries the latest failed durable state once", async () => {
  let muteCalls = 0;

  const loggedErrors = [];

  const repository = {
    async listActiveMutes() {
      return [];
    },

    async pruneExpired() {
      return 0;
    },

    async mute() {
      muteCalls += 1;

      if (muteCalls === 1) {
        throw new Error(
          "temporary database failure",
        );
      }

      return true;
    },

    async unmute() {
      return true;
    },
  };

  const service =
    createChatModerationService({
      repository,

      moderatorAccountIds: [
        "moderator",
      ],

      logger: {
        error(...argumentsList) {
          loggedErrors.push(
            argumentsList,
          );
        },
      },
    });

  await service.initialize(
    1000,
  );

  const context =
    createChatContext();

  service.handleMessage({
    session:
      context.moderatorSession,

    player:
      context.moderator,

    payload: {
      text:
        "/mute Target 5 retry",
    },

    playersByUid:
      context.playersByUid,

    sessionsByPlayerUid:
      context
        .sessionsByPlayerUid,

    now:
      2000,
  });

  const result =
    await service
      .flushPersistence();

  assert.deepEqual(
    result,
    {
      success: true,
      failedAccountIds: [],
    },
  );

  assert.equal(
    muteCalls,
    2,
  );

  assert.equal(
    loggedErrors.length,
    1,
  );
});