import assert from "node:assert/strict";
import test from "node:test";

import { createHmacAuthService } from "../server/auth/hmacAuthService.js";

test("signed authentication tokens carry a verified account identity", () => {
  let now = 1000;
  const auth = createHmacAuthService({ secret: "a-strong-test-secret", now: () => now });
  const token = auth.issueToken({ accountId: "account-1", expiresAt: 2000 });

  assert.deepEqual(auth.verifyToken(token), { accountId: "account-1", expiresAt: 2000 });
  assert.equal(auth.verifyToken(`${token}changed`), null);
  now = 2000;
  assert.equal(auth.verifyToken(token), null);
});
