import {
  createAuthoritativeWorldRuntime,
} from "./authoritativeWorldRuntime.js";

import {
  createHmacAuthService,
} from "./auth/hmacAuthService.js";

import {
  createPasswordService,
} from "./auth/passwordService.js";

import {
  createGoogleIdentityService,
} from "./auth/googleIdentityService.js";

import {
  createGameServer,
} from "./gameServer.js";

import {
  createGameHttpApi,
} from "./http/gameHttpApi.js";

import {
  loadServerWorldMaps,
} from "./loadServerWorldMaps.js";

import {
  createChatModerationService,
} from "./chatModerationService.js";

import {
  createDailyWorldResetScheduler,
} from "./dailyWorldResetScheduler.js";

import {
  getPostgresApplicationOptions,
} from "./persistence/postgresEnvironment.js";

import {
  createPostgresRuntimePersistence,
} from "./persistence/postgresRuntimePersistence.js";

const startGameApplication =
  async () => {
    const port =
      Number.parseInt(
        process.env
          .GAME_SERVER_PORT ??
          "8080",
        10,
      );

    const host =
      process.env
        .GAME_SERVER_HOST ??
      "127.0.0.1";

    const isProduction =
      process.env.NODE_ENV ===
      "production";

    const developmentAuthSecret =
      "development-only-secret-change-me";

    const configuredClientOrigin =
      process.env
        .GAME_CLIENT_ORIGIN
        ?.trim() ??
      "";

    const clientOriginUrl =
      configuredClientOrigin
        ? new URL(
            configuredClientOrigin,
          )
        : null;

    if (
      clientOriginUrl &&
      clientOriginUrl.protocol !==
        "http:" &&
      clientOriginUrl.protocol !==
        "https:"
    ) {
      throw new Error(
        "GAME_CLIENT_ORIGIN must use http or https.",
      );
    }

    const clientOrigin =
      clientOriginUrl?.origin ??
      "";

    const authSecret =
      process.env
        .GAME_AUTH_SECRET ??
      developmentAuthSecret;

    if (
      isProduction &&
      (
        !process.env.GAME_AUTH_SECRET ||
        authSecret ===
          developmentAuthSecret
      )
    ) {
      throw new Error(
        "GAME_AUTH_SECRET must use a private production value.",
      );
    }

    if (
      isProduction &&
      !clientOrigin
    ) {
      throw new Error(
        "GAME_CLIENT_ORIGIN must be set in production.",
      );
    }

    if (
      !isProduction &&
      !process.env.GAME_AUTH_SECRET
    ) {
      console.warn(
        "GAME_AUTH_SECRET is not set; using the development-only secret.",
      );
    }

    /*
     * Load static world data before opening
     * any external resources.
     */
    const worldMapsByZ =
      await loadServerWorldMaps();

    const authService =
      createHmacAuthService({
        secret:
          authSecret,
      });

    /*
     * This is now the ONLY persistence
     * composition used by the game server.
     *
     * It health-checks PostgreSQL and
     * verifies schema + permissions before
     * returning the repositories.
     */
    const persistence =
      await createPostgresRuntimePersistence({
        databaseOptions:
          getPostgresApplicationOptions(),
      });

    let server = null;
    let resetScheduler = null;
    let isStopping = false;

    try {
      const {
        accountRepository,
        characterRepository,
        chatModerationRepository,
      } = persistence;

      const moderatorAccountIds =
        (
          process.env
            .GAME_MODERATOR_ACCOUNTS ??
          ""
        )
          .split(",")
          .map(
            (accountId) =>
              accountId.trim(),
          )
          .filter(Boolean);

      const chatModerationService =
        createChatModerationService({
          repository:
            chatModerationRepository,

          moderatorAccountIds,
        });

      const moderationInitialization =
        await chatModerationService
          .initialize(
            Date.now(),
          );

      console.log(
        `Chat moderation ready: ${moderationInitialization.activeMuteCount} active mute(s), ${moderationInitialization.prunedCount} expired row(s) pruned.`,
      );

      const runtime =
        createAuthoritativeWorldRuntime({
          worldMapsByZ,

          characterRepository,

          chatModerationService,

          allowCharacterAutoCreate:
            process.env
              .GAME_ALLOW_CHARACTER_AUTOCREATE ===
            "true",
        });

      const passwordService =
        createPasswordService();

      const googleIdentityService =
        createGoogleIdentityService({
          clientId:
            process.env
              .GAME_GOOGLE_CLIENT_ID ??
            "",
        });

      const httpApi =
        createGameHttpApi({
          accountRepository,
          characterRepository,

          authService,
          passwordService,
          googleIdentityService,

          allowedOrigin:
            clientOrigin,

          isCharacterOnline: (
            accountId,
            characterId,
          ) =>
            runtime.isCharacterBusy(
              accountId,
              characterId,
            ),
        });

      server =
        createGameServer({
          runtime,

          authenticateClient:
            (hello) =>
              authService
                .verifyToken(
                  hello?.authToken,
                ),

          handleHttpRequest:
            httpApi,

          allowedOrigin:
            clientOrigin,

          host,
          port,
        });

      const stop = async ({
        exitCode = 0,

        closeCode = 1001,

        closeReason =
          "Server stopping",
      } = {}) => {
        if (isStopping) {
          return;
        }

        isStopping = true;

        resetScheduler?.stop();

        const forceExitTimer =
          setTimeout(
            () =>
              process.exit(
                exitCode ||
                  1,
              ),
            25000,
          );

        forceExitTimer.unref();

        let finalExitCode =
          exitCode;

        try {
          /*
           * Stop new gameplay first.
           *
           * gameServer.stop() waits for
           * asynchronous disconnect saves.
           */
          await server.stop({
            closeCode,
            closeReason,
          });

          /*
           * Flush anything authoritative
           * still remaining in RAM:
           * combat logout avatars,
           * failed removals, etc.
           */
          const playerSaveResult =
            await runtime
              .saveAllPlayerPersistence();

          if (
            !playerSaveResult.success
          ) {
            finalExitCode =
              finalExitCode ||
              1;

            console.error(
              "Final player persistence failed:",
              playerSaveResult
                .failedPlayerUids,
            );
          }

          /*
           * No new chat command can enter
           * after server.stop().
           */
          const moderationSaveResult =
            await chatModerationService
              .flushPersistence();

          if (
            !moderationSaveResult.success
          ) {
            finalExitCode =
              finalExitCode ||
              1;

            console.error(
              "Final chat moderation persistence failed:",
              moderationSaveResult
                .failedAccountIds,
            );
          }

          /*
           * One Pool owns all PostgreSQL
           * connections and is closed once,
           * after every persistence queue.
           */
          await persistence.close();

          clearTimeout(
            forceExitTimer,
          );

          process.exit(
            finalExitCode,
          );
        } catch (error) {
          console.error(
            "Graceful server shutdown failed:",
            error,
          );

          try {
            await persistence.close();
          } catch (
            persistenceCloseError
          ) {
            console.error(
              "PostgreSQL pool shutdown failed:",
              persistenceCloseError,
            );
          }

          clearTimeout(
            forceExitTimer,
          );

          process.exit(
            finalExitCode ||
              1,
          );
        }
      };

      /*
       * PostgreSQL MUST be ready before the
       * game begins listening.
       */
      await server.start();

      const address =
        server.getAddress();

      console.log(
        `Game server listening on ws://${address.address}:${address.port}/game`,
      );

      const poolStats =
        persistence
          .getPoolStats();

      console.log(
        `PostgreSQL pool: ${poolStats.total} total, ${poolStats.idle} idle, ${poolStats.waiting} waiting.`,
      );

      resetScheduler =
        createDailyWorldResetScheduler({
          onWarning:
            (minutes) => {
              runtime
                .announceSystemMessage({
                  en:
                    `Daily world reset in ${minutes} minute${minutes === 1 ? "" : "s"}.`,

                  fr:
                    `Reset quotidien du monde dans ${minutes} minute${minutes === 1 ? "" : "s"}.`,
                });
            },

          onReset:
            () =>
              stop({
                exitCode: 75,

                closeCode: 1012,

                closeReason:
                  "Daily world reset",
              }),
        });

      console.log(
        `Next daily world reset: ${new Date(resetScheduler.nextResetAt).toISOString()}`,
      );

      process.on(
        "SIGINT",
        () => {
          void stop();
        },
      );

      process.on(
        "SIGTERM",
        () => {
          void stop();
        },
      );
    } catch (error) {
      resetScheduler?.stop();

      if (server) {
        try {
          await server.stop();
        } catch (
          serverStopError
        ) {
          console.error(
            "Server cleanup after startup failure failed:",
            serverStopError,
          );
        }
      }

      try {
        await persistence.close();
      } catch (
        persistenceCloseError
      ) {
        console.error(
          "PostgreSQL cleanup after startup failure failed:",
          persistenceCloseError,
        );
      }

      throw error;
    }
  };

try {
  await startGameApplication();
} catch (error) {
  console.error(
    "Game server startup failed:",
    error,
  );

  process.exit(1);
}