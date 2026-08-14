import assert from "node:assert/strict";
import test from "node:test";

import { createGameAccountSession } from "../src/network/gameAccountSession.js";

test("online account sessions persist the token and selected character", async () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const fetchRequest = async (url) => new Response(JSON.stringify({
    success: true,
    accountId: "charles",
    token: "signed-token",
    characters: [],
  }), { status: url.pathname === "/auth/login" ? 200 : 200 });
  const firstSession = createGameAccountSession({ apiBaseUrl: "http://game.test", storage, fetchRequest });
  const login = await firstSession.login("charles", "password123");
  firstSession.selectCharacter({ characterId: "one", name: "Ari" });

  const restoredSession = createGameAccountSession({ apiBaseUrl: "http://game.test", storage, fetchRequest });
  assert.equal(login.success, true);
  assert.equal(restoredSession.getAuthToken(), "signed-token");
  assert.equal(restoredSession.getActiveCharacter().characterId, "one");
});

test("Google account sessions use the server-issued game token", async () => {
  const requests = [];
  const storage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  const fetchRequest = async (url, options) => {
    requests.push({ pathname: url.pathname, body: JSON.parse(options.body) });
    return new Response(JSON.stringify({
      success: true,
      accountId: "google_account",
      token: "game-token",
    }), { status: 200 });
  };
  const session = createGameAccountSession({ apiBaseUrl: "http://game.test", storage, fetchRequest });

  const result = await session.loginWithGoogle("google-id-token");

  assert.equal(result.success, true);
  assert.equal(session.getAccountId(), "google_account");
  assert.equal(session.getAuthToken(), "game-token");
  assert.deepEqual(requests, [{ pathname: "/auth/google", body: { credential: "google-id-token" } }]);
});
