import {
  createCoalescingAsyncQueue,
} from "./persistence/coalescingAsyncQueue.js";

const MAX_MUTE_MINUTES =
  7 * 24 * 60;

const MAX_CHAT_PERSISTENCE_CONCURRENCY =
  2;

const normalizeAccountId = (
  accountId,
) => {
  return String(accountId ?? "")
    .trim()
    .toLocaleLowerCase();
};

const createPrivateSystemEvent = (
  playerUid,
  text,
  createdAt,
) => ({
  type: "chat-system-message",
  channelId: "logs",
  recipientPlayerUid: playerUid,
  text,
  createdAt,
  visibility: "private",
});

const normalizeMuteRecord = (
  mute,
) => {
  const accountId =
    normalizeAccountId(
      mute?.accountId,
    );

  if (
    accountId === "" ||
    !Number.isSafeInteger(
      mute?.mutedUntil,
    ) ||
    typeof mute?.reason !==
      "string" ||
    typeof mute?.moderatorAccountId !==
      "string" ||
    mute.moderatorAccountId === "" ||
    !Number.isSafeInteger(
      mute?.createdAt,
    )
  ) {
    throw new TypeError(
      "Invalid persisted chat mute.",
    );
  }

  return {
    accountId,
    mutedUntil:
      mute.mutedUntil,

    reason:
      mute.reason.slice(
        0,
        160,
      ),

    moderatorAccountId:
      mute.moderatorAccountId,

    createdAt:
      mute.createdAt,
  };
};

export const createChatModerationService = ({
  repository = null,
  moderatorAccountIds = [],
  logger = console,
} = {}) => {
  if (
    repository &&
    (
      typeof repository.mute !==
        "function" ||
      typeof repository.unmute !==
        "function" ||
      typeof repository
        .listActiveMutes !==
        "function" ||
      typeof repository
        .pruneExpired !==
        "function"
    )
  ) {
    throw new TypeError(
      "The chat moderation repository is invalid.",
    );
  }

  if (
    !logger ||
    typeof logger.error !==
      "function"
  ) {
    throw new TypeError(
      "The chat moderation logger is invalid.",
    );
  }

  const moderators =
    new Set(
      moderatorAccountIds.map(
        normalizeAccountId,
      ),
    );

  const activeMutesByAccountId =
    new Map();

  const failedPersistenceByAccountId =
    new Map();

  let initializationPromise =
    null;

  let initializationResult =
    repository
      ? null
      : Object.freeze({
          activeMuteCount: 0,
          prunedCount: 0,
        });

  const persistenceQueue =
    createCoalescingAsyncQueue({
      maxConcurrency:
        MAX_CHAT_PERSISTENCE_CONCURRENCY,

      async worker(
        accountId,
        operation,
      ) {
        if (!repository) {
          failedPersistenceByAccountId
            .delete(accountId);

          return true;
        }

        if (
          operation.type ===
          "mute"
        ) {
          const result =
            await repository.mute(
              accountId,
              operation.mutedUntil,
              operation.reason,
              operation
                .moderatorAccountId,
              operation.createdAt,
            );

          if (result !== true) {
            throw new Error(
              `Chat mute persistence was rejected for ${accountId}.`,
            );
          }
        } else if (
          operation.type ===
          "unmute"
        ) {
          /*
           * false is acceptable here:
           * the desired durable state is
           * simply "no mute exists".
           */
          await repository.unmute(
            accountId,
          );
        } else {
          throw new Error(
            "Unsupported chat moderation persistence operation.",
          );
        }

        failedPersistenceByAccountId
          .delete(accountId);

        return true;
      },

      onError(
        error,
        accountId,
        operation,
      ) {
        /*
         * Per-key queue ordering means this
         * represents the latest failed durable
         * state once the queue becomes idle.
         */
        failedPersistenceByAccountId
          .set(
            accountId,
            operation,
          );

        logger.error(
          `Chat moderation persistence failed for ${accountId}:`,
          error,
        );
      },
    });

  const ensureInitialized = () => {
    if (!initializationResult) {
      throw new Error(
        "Chat moderation service must be initialized before use.",
      );
    }
  };

  const initialize = (
    now = Date.now(),
  ) => {
    if (initializationResult) {
      return Promise.resolve(
        initializationResult,
      );
    }

    if (initializationPromise) {
      return initializationPromise;
    }

    if (
      !Number.isSafeInteger(now)
    ) {
      return Promise.reject(
        new TypeError(
          "Chat moderation initialization requires a valid timestamp.",
        ),
      );
    }

    initializationPromise =
      (async () => {
        const persistedMutes =
          await repository
            .listActiveMutes(now);

        if (
          !Array.isArray(
            persistedMutes,
          )
        ) {
          throw new TypeError(
            "Chat moderation repository returned an invalid mute list.",
          );
        }

        const nextMutes =
          new Map();

        for (
          const persistedMute
          of persistedMutes
        ) {
          const mute =
            normalizeMuteRecord(
              persistedMute,
            );

          if (
            mute.mutedUntil <= now
          ) {
            continue;
          }

          nextMutes.set(
            mute.accountId,
            mute,
          );
        }

        const prunedCount =
          await repository
            .pruneExpired(now);

        if (
          !Number.isSafeInteger(
            prunedCount,
          ) ||
          prunedCount < 0
        ) {
          throw new TypeError(
            "Chat moderation repository returned an invalid prune count.",
          );
        }

        activeMutesByAccountId
          .clear();

        for (
          const [
            accountId,
            mute,
          ]
          of nextMutes
        ) {
          activeMutesByAccountId
            .set(
              accountId,
              mute,
            );
        }

        initializationResult =
          Object.freeze({
            activeMuteCount:
              activeMutesByAccountId
                .size,

            prunedCount,
          });

        return initializationResult;
      })()
        .catch((error) => {
          initializationPromise =
            null;

          throw error;
        });

    return initializationPromise;
  };

  const isModerator = (
    session,
  ) => {
    return moderators.has(
      normalizeAccountId(
        session?.accountId,
      ),
    );
  };

  const getActiveMute = (
    accountId,
    now,
  ) => {
    ensureInitialized();

    const normalizedAccountId =
      normalizeAccountId(
        accountId,
      );

    const mute =
      activeMutesByAccountId.get(
        normalizedAccountId,
      ) ?? null;

    if (!mute) {
      return null;
    }

    if (
      mute.mutedUntil <= now
    ) {
      /*
       * Lazy expiration is RAM-only.
       *
       * PostgreSQL cleanup happens through
       * pruneExpired at startup; an expired
       * row is harmless in the meantime.
       */
      activeMutesByAccountId.delete(
        normalizedAccountId,
      );

      return null;
    }

    return mute;
  };

  const queueMutePersistence = (
    mute,
  ) => {
    persistenceQueue.enqueue(
      mute.accountId,
      {
        type: "mute",
        mutedUntil:
          mute.mutedUntil,
        reason:
          mute.reason,
        moderatorAccountId:
          mute.moderatorAccountId,
        createdAt:
          mute.createdAt,
      },
    );
  };

  const queueUnmutePersistence = (
    accountId,
  ) => {
    persistenceQueue.enqueue(
      accountId,
      {
        type: "unmute",
      },
    );
  };

  const findOnlineTarget = (
    name,
    playersByUid,
    sessionsByPlayerUid,
  ) => {
    const normalizedName =
      String(name ?? "")
        .trim()
        .toLocaleLowerCase();

    for (
      const player
      of playersByUid.values()
    ) {
      if (
        player.name
          .toLocaleLowerCase() ===
        normalizedName
      ) {
        return {
          player,

          session:
            sessionsByPlayerUid
              .get(player.uid) ??
            null,
        };
      }
    }

    return null;
  };

  const handleCommand = ({
    session,
    player,
    text,
    playersByUid,
    sessionsByPlayerUid,
    now,
  }) => {
    const [
      commandName = "",
      ...args
    ] =
      text
        .slice(1)
        .trim()
        .split(/\s+/);

    const command =
      commandName
        .toLocaleLowerCase();

    if (command === "who") {
      const names =
        [...playersByUid.values()]
          .map(
            (onlinePlayer) =>
              onlinePlayer.name,
          )
          .sort();

      return {
        success: true,

        events: [
          createPrivateSystemEvent(
            player.uid,
            `Online (${names.length}): ${names.join(", ")}`,
            now,
          ),
        ],
      };
    }

    if (
      ![
        "mute",
        "unmute",
        "announce",
      ].includes(command)
    ) {
      return {
        success: false,
        reason:
          "unknown-chat-command",
      };
    }

    if (!isModerator(session)) {
      return {
        success: false,
        reason:
          "chat-command-forbidden",
      };
    }

    if (
      command === "announce"
    ) {
      const announcement =
        args
          .join(" ")
          .trim();

      return announcement
        ? {
            success: true,

            events: [
              {
                type:
                  "chat-system-message",

                channelId:
                  "global",

                text:
                  announcement,

                createdAt:
                  now,

                visibility:
                  "global",
              },
            ],
          }
        : {
            success: false,
            reason:
              "invalid-chat-command",
          };
    }

    const target =
      findOnlineTarget(
        args[0],
        playersByUid,
        sessionsByPlayerUid,
      );

    if (
      !target?.session?.accountId
    ) {
      return {
        success: false,
        reason:
          "chat-target-not-found",
      };
    }

    const targetAccountId =
      normalizeAccountId(
        target.session.accountId,
      );

    if (
      command === "unmute"
    ) {
      /*
       * RAM is authoritative immediately.
       */
      activeMutesByAccountId.delete(
        targetAccountId,
      );

      queueUnmutePersistence(
        targetAccountId,
      );

      return {
        success: true,

        events: [
          createPrivateSystemEvent(
            player.uid,
            `${target.player.name} can speak again.`,
            now,
          ),
        ],
      };
    }

    const durationMinutes =
      Number.parseInt(
        args[1],
        10,
      );

    if (
      !Number.isSafeInteger(
        durationMinutes,
      ) ||
      durationMinutes <= 0 ||
      durationMinutes >
        MAX_MUTE_MINUTES
    ) {
      return {
        success: false,
        reason:
          "invalid-mute-duration",
      };
    }

    const reason =
      (
        args
          .slice(2)
          .join(" ")
          .trim() ||
        "No reason provided"
      ).slice(
        0,
        160,
      );

    const mute =
      {
        accountId:
          targetAccountId,

        mutedUntil:
          now +
          durationMinutes *
            60 *
            1000,

        reason,

        moderatorAccountId:
          normalizeAccountId(
            session.accountId,
          ),

        createdAt:
          now,
      };

    /*
     * Immediate authoritative change.
     * The target cannot send another
     * message while PostgreSQL is still
     * performing the write.
     */
    activeMutesByAccountId.set(
      targetAccountId,
      mute,
    );

    queueMutePersistence(
      mute,
    );

    return {
      success: true,

      events: [
        createPrivateSystemEvent(
          player.uid,

          `${target.player.name} muted for ${durationMinutes} minute(s).`,

          now,
        ),

        createPrivateSystemEvent(
          target.player.uid,
          `You were muted: ${reason}`,
          now,
        ),
      ],
    };
  };

  const handleMessage = ({
    session,
    player,
    payload,
    playersByUid,
    sessionsByPlayerUid,
    now,
  }) => {
    ensureInitialized();

    if (
      payload.text.startsWith("/")
    ) {
      return handleCommand({
        session,
        player,
        text:
          payload.text,
        playersByUid,
        sessionsByPlayerUid,
        now,
      });
    }

    const activeMute =
      getActiveMute(
        session.accountId,
        now,
      );

    if (activeMute) {
      return {
        success: false,
        reason: "chat-muted",

        changes: {
          mutedUntil:
            activeMute.mutedUntil,
        },
      };
    }

    return null;
  };

  const flushPersistence =
    async () => {
      /*
       * First finish everything already
       * queued.
       */
      await persistenceQueue.flush();

      /*
       * Retry each latest failed durable
       * state exactly once during flush.
       *
       * This handles a short PostgreSQL
       * hiccup without creating an
       * infinite shutdown retry loop.
       */
      if (
        failedPersistenceByAccountId
          .size > 0
      ) {
        const retryOperations =
          [
            ...failedPersistenceByAccountId
              .entries(),
          ];

        for (
          const [
            accountId,
            operation,
          ]
          of retryOperations
        ) {
          persistenceQueue.enqueue(
            accountId,
            operation,
          );
        }

        await persistenceQueue.flush();
      }

      const failedAccountIds =
        [
          ...failedPersistenceByAccountId
            .keys(),
        ].sort();

      return Object.freeze({
        success:
          failedAccountIds.length ===
          0,

        failedAccountIds,
      });
    };

  const getStats = () => {
    return Object.freeze({
      initialized:
        initializationResult !==
        null,

      activeMutes:
        activeMutesByAccountId
          .size,

      failedPersistence:
        failedPersistenceByAccountId
          .size,

      persistenceQueue:
        persistenceQueue
          .getStats(),
    });
  };

  return Object.freeze({
    initialize,
    handleMessage,
    getActiveMute,
    flushPersistence,
    getStats,
  });
};