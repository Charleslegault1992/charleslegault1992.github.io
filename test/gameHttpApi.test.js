import assert from "node:assert/strict";
import test from "node:test";

import { createHmacAuthService } from "../server/auth/hmacAuthService.js";
import { createPasswordService } from "../server/auth/passwordService.js";
import { createGameServer } from "../server/gameServer.js";
import { createGameHttpApi } from "../server/http/gameHttpApi.js";
import { createSqliteAccountRepository } from "../server/persistence/sqliteAccountRepository.js";
import { createSqliteCharacterRepository } from "../server/persistence/sqliteCharacterRepository.js";
import { createGameAccountApiClient } from "../src/network/gameAccountApiClient.js";

const createRuntimeStub = () => ({
  connectClient: () => ({ success: true, playerUid: "player:test" }),
  disconnectClient: () => {},
  dispatchAction: (_session, action) => ({ success: true, requestId: action.requestId }),
  createSnapshotForClient: () => ({ revision: 0, self: { uid: "player:test" } }),
  getDeltasForClient: () => [],
  update: () => {},
});

test("the HTTP account flow owns character creation and deletion", async (testContext) => {
  const accounts = createSqliteAccountRepository({ databasePath: ":memory:" });
  const characters = createSqliteCharacterRepository({ databasePath: ":memory:" });
  const auth = createHmacAuthService({ secret: "http-api-test-secret" });
  const api = createGameHttpApi({
    accountRepository: accounts,
    characterRepository: characters,
    authService: auth,
    passwordService: createPasswordService(),
    googleIdentityService: {
      isConfigured: () => true,
      verifyCredential: async (credential) => credential === "valid-google-credential"
        ? {
            provider: "google",
            subject: "google-user-123",
            email: "charles@example.com",
            displayName: "Charles",
          }
        : null,
    },
  });
  const server = createGameServer({
    runtime: createRuntimeStub(),
    authenticateClient: () => null,
    handleHttpRequest: api,
    port: 0,
  });
  await server.start();
  testContext.after(async () => {
    await server.stop();
    accounts.close();
    characters.close();
  });
  const client = createGameAccountApiClient({ baseUrl: `http://127.0.0.1:${server.getAddress().port}` });

  const registration = await client.register("Charles_92", "strong-password");
  client.clearToken();
  const rejectedLogin = await client.login("Charles_92", "wrong-password");
  const login = await client.login("Charles_92", "strong-password");
  const refreshedSession = await client.refreshToken();
  const created = await client.createCharacter({ name: "Ari Vale", appearanceId: "female" });
  const duplicateName = await client.createCharacter({ name: "ari vale", appearanceId: "male" });
  const listed = await client.listCharacters();
  const deleted = await client.deleteCharacter(created.character.characterId);
  const emptyList = await client.listCharacters();
  const googleLogin = await client.loginWithGoogle("valid-google-credential");
  const repeatedGoogleLogin = await client.loginWithGoogle("valid-google-credential");
  const rejectedGoogleLogin = await client.loginWithGoogle("invalid-google-credential");

  assert.equal(registration.success, true);
  assert.equal(registration.accountId, "charles_92");
  assert.equal(rejectedLogin.statusCode, 401);
  assert.equal(login.success, true);
  assert.equal(refreshedSession.success, true);
  assert.equal(refreshedSession.accountId, "charles_92");
  assert.equal(created.statusCode, 201);
  assert.equal(duplicateName.reason, "character-name-taken");
  assert.equal(listed.characters[0].name, "Ari Vale");
  assert.equal(deleted.success, true);
  assert.deepEqual(emptyList.characters, []);
  assert.equal(googleLogin.success, true);
  assert.match(googleLogin.accountId, /^google_[a-f0-9]{24}$/);
  assert.equal(repeatedGoogleLogin.accountId, googleLogin.accountId);
  assert.equal(rejectedGoogleLogin.statusCode, 401);
});
