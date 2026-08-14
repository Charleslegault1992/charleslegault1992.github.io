import { randomUUID } from "node:crypto";

import { createPlayerState } from "../../src/state/playerState.js";
import {
  normalizeCharacterAppearanceColors,
  normalizeCharacterAppearanceParts,
} from "../../src/characterSaveStore.js";

const JSON_BODY_LIMIT_BYTES = 16 * 1024;
const AUTH_ATTEMPT_LIMIT = 10;
const AUTH_ATTEMPT_WINDOW_MS = 60 * 1000;
const CHARACTER_NAME_PATTERN = /^[\p{L}][\p{L}' -]{1,22}[\p{L}]$/u;

const writeJson = (response, statusCode, payload, extraHeaders = {}) => {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...extraHeaders,
  });
  response.end(JSON.stringify(payload));
};

const readJsonBody = async (request) => {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > JSON_BODY_LIMIT_BYTES) {
      return null;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
};

const getBearerIdentity = (request, authService) => {
  const authorization = request.headers.authorization;
  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) {
    return null;
  }
  return authService.verifyToken(authorization.slice(7));
};

const createCharacterSnapshot = (body) => {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!CHARACTER_NAME_PATTERN.test(name)) {
    return null;
  }
  const player = createPlayerState();
  player.name = name;
  if (body.appearanceId === "male" || body.appearanceId === "female") {
    player.appearanceId = body.appearanceId;
  }
  if (body.appearanceParts && typeof body.appearanceParts === "object") {
    player.appearanceParts = normalizeCharacterAppearanceParts(body.appearanceParts);
  }
  if (body.appearanceColors && typeof body.appearanceColors === "object") {
    player.appearanceColors = normalizeCharacterAppearanceColors(body.appearanceColors);
  }
  return player;
};

export const createGameHttpApi = ({
  accountRepository,
  characterRepository,
  authService,
  passwordService,
  googleIdentityService = null,
  tokenLifetimeMs = 15 * 60 * 1000,
  allowedOrigin = "",
  now = () => Date.now(),
  isCharacterOnline = () => false,
} = {}) => {
  if (!accountRepository || !characterRepository || !authService || !passwordService) {
    throw new TypeError("The HTTP game API requires authentication and persistence services.");
  }

  const corsHeaders = allowedOrigin ? { "access-control-allow-origin": allowedOrigin, vary: "origin" } : {};
  const issueToken = (accountId) => authService.issueToken({ accountId, expiresAt: now() + tokenLifetimeMs });
  const authAttemptsByAddress = new Map();
  const dummyPasswordHashPromise = passwordService.hashPassword("dummy-auth-password");

  const getRequestAddress = (request) => {
    const socketAddress = request.socket?.remoteAddress ?? "unknown";
    const isLoopbackProxy = socketAddress === "127.0.0.1" || socketAddress === "::1" || socketAddress === "::ffff:127.0.0.1";
    const forwardedAddress = request.headers["x-forwarded-for"];
    if (isLoopbackProxy && typeof forwardedAddress === "string") {
      return forwardedAddress.split(",")[0].trim() || socketAddress;
    }
    return socketAddress;
  };

  const consumeAuthAttempt = (request) => {
    const address = getRequestAddress(request);
    const requestedAt = now();
    let state = authAttemptsByAddress.get(address);
    if (!state || requestedAt - state.startedAt >= AUTH_ATTEMPT_WINDOW_MS) {
      state = { startedAt: requestedAt, count: 0 };
      authAttemptsByAddress.set(address, state);
    }
    state.count += 1;
    if (authAttemptsByAddress.size > 10000) {
      authAttemptsByAddress.delete(authAttemptsByAddress.keys().next().value);
    }
    return state.count <= AUTH_ATTEMPT_LIMIT;
  };

  return async (request, response) => {
    const url = new URL(request.url, "http://game.local");
    if (request.method === "OPTIONS" && allowedOrigin) {
      response.writeHead(204, {
        ...corsHeaders,
        "access-control-allow-headers": "authorization, content-type",
        "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
      });
      response.end();
      return true;
    }

    if (request.method === "POST" && ["/auth/register", "/auth/login"].includes(url.pathname)) {
      if (!consumeAuthAttempt(request)) {
        writeJson(response, 429, { success: false, reason: "too-many-attempts" }, {
          ...corsHeaders,
          "retry-after": "60",
        });
        return true;
      }
      const body = await readJsonBody(request);
      const accountId = String(body?.accountId ?? "").trim().toLocaleLowerCase();
      const password = body?.password;
      if (url.pathname === "/auth/register") {
        const passwordHash = await passwordService.hashPassword(password);
        const result = passwordHash ? accountRepository.create(accountId, passwordHash, now()) : null;
        if (!result?.success) {
          writeJson(response, result?.reason === "account-already-exists" ? 409 : 400, {
            success: false,
            reason: result?.reason ?? "invalid-credentials",
          }, corsHeaders);
          return true;
        }
      } else {
        const account = accountRepository.find(accountId);
        const passwordHash = account?.passwordHash ?? await dummyPasswordHashPromise;
        const passwordMatches = await passwordService.verifyPassword(password, passwordHash);
        if (!account || !passwordMatches) {
          writeJson(response, 401, { success: false, reason: "invalid-credentials" }, corsHeaders);
          return true;
        }
      }
      writeJson(response, 200, { success: true, accountId, token: issueToken(accountId) }, corsHeaders);
      return true;
    }

    if (request.method === "POST" && url.pathname === "/auth/google") {
      if (!consumeAuthAttempt(request)) {
        writeJson(response, 429, { success: false, reason: "too-many-attempts" }, {
          ...corsHeaders,
          "retry-after": "60",
        });
        return true;
      }
      if (!googleIdentityService?.isConfigured?.()) {
        writeJson(response, 503, { success: false, reason: "google-auth-unavailable" }, corsHeaders);
        return true;
      }
      const body = await readJsonBody(request);
      const externalIdentity = await googleIdentityService.verifyCredential(body?.credential);
      if (!externalIdentity) {
        writeJson(response, 401, { success: false, reason: "google-auth-failed" }, corsHeaders);
        return true;
      }
      const result = accountRepository.findOrCreateExternalIdentity(externalIdentity, now());
      if (!result?.success) {
        writeJson(response, 500, {
          success: false,
          reason: result?.reason ?? "external-account-creation-failed",
        }, corsHeaders);
        return true;
      }
      writeJson(response, 200, {
        success: true,
        accountId: result.accountId,
        token: issueToken(result.accountId),
      }, corsHeaders);
      return true;
    }

    if (request.method === "POST" && url.pathname === "/auth/refresh") {
      const identity = getBearerIdentity(request, authService);
      if (!identity) {
        writeJson(response, 401, { success: false, reason: "authentication-required" }, corsHeaders);
        return true;
      }
      writeJson(response, 200, {
        success: true,
        accountId: identity.accountId,
        token: issueToken(identity.accountId),
      }, corsHeaders);
      return true;
    }

    if (url.pathname === "/characters") {
      const identity = getBearerIdentity(request, authService);
      if (!identity) {
        writeJson(response, 401, { success: false, reason: "authentication-required" }, corsHeaders);
        return true;
      }
      if (request.method === "GET") {
        writeJson(response, 200, {
          success: true,
          characters: characterRepository.list(identity.accountId),
        }, corsHeaders);
        return true;
      }
      if (request.method === "POST") {
        const snapshot = createCharacterSnapshot(await readJsonBody(request));
        if (!snapshot) {
          writeJson(response, 400, { success: false, reason: "invalid-character" }, corsHeaders);
          return true;
        }
        const characterId = randomUUID();
        const result = characterRepository.save(identity.accountId, characterId, snapshot, null, now());
        writeJson(response, result.success ? 201 : 409, {
          success: result.success,
          reason: result.reason ?? null,
          character: result.success
            ? characterRepository.list(identity.accountId).find((entry) => entry.characterId === characterId)
            : null,
        }, corsHeaders);
        return true;
      }
    }

    const characterMatch = url.pathname.match(/^\/characters\/([a-zA-Z0-9_-]{1,40})$/);
    if (request.method === "DELETE" && characterMatch) {
      const identity = getBearerIdentity(request, authService);
      if (!identity) {
        writeJson(response, 401, { success: false, reason: "authentication-required" }, corsHeaders);
        return true;
      }
      const characterId = characterMatch[1];
      if (isCharacterOnline(identity.accountId, characterId)) {
        writeJson(response, 409, { success: false, reason: "character-online" }, corsHeaders);
        return true;
      }
      const deleted = characterRepository.delete(identity.accountId, characterId);
      writeJson(response, deleted ? 200 : 404, {
        success: deleted,
        reason: deleted ? null : "character-not-found",
      }, corsHeaders);
      return true;
    }

    return false;
  };
};
