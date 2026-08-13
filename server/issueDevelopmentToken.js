import { createHmacAuthService } from "./auth/hmacAuthService.js";

const secret = process.env.GAME_AUTH_SECRET ?? "development-only-secret-change-me";
const accountId = process.env.GAME_AUTH_ACCOUNT_ID ?? "local-account";
const lifetimeMinutes = Number.parseInt(process.env.GAME_AUTH_TOKEN_MINUTES ?? "1440", 10);
if (!Number.isInteger(lifetimeMinutes) || lifetimeMinutes <= 0 || lifetimeMinutes > 10080) {
  throw new Error("GAME_AUTH_TOKEN_MINUTES must be between 1 and 10080.");
}

const authService = createHmacAuthService({ secret });
const token = authService.issueToken({
  accountId,
  expiresAt: Date.now() + lifetimeMinutes * 60 * 1000,
});
if (!token) {
  throw new Error("Unable to issue the development authentication token.");
}

console.log(token);
