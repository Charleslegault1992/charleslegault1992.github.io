import assert from "node:assert/strict";
import test from "node:test";

import { createPasswordService } from "../server/auth/passwordService.js";

test("passwords are salted and verified without storing plaintext", async () => {
  const passwords = createPasswordService();
  const firstHash = await passwords.hashPassword("correct-horse-battery-staple");
  const secondHash = await passwords.hashPassword("correct-horse-battery-staple");

  assert.notEqual(firstHash, secondHash);
  assert.equal(firstHash.includes("correct-horse"), false);
  assert.equal(await passwords.verifyPassword("correct-horse-battery-staple", firstHash), true);
  assert.equal(await passwords.verifyPassword("wrong-password", firstHash), false);
});
