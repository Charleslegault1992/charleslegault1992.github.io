import assert from "node:assert/strict";
import test from "node:test";

import { createGoogleIdentityService } from "../server/auth/googleIdentityService.js";

test("Google credentials are verified for the configured web client", async () => {
  const calls = [];
  const service = createGoogleIdentityService({
    clientId: "web-client.apps.googleusercontent.com",
    tokenVerifier: {
      verifyIdToken: async (options) => {
        calls.push(options);
        return {
          getPayload: () => ({
            sub: "google-subject",
            email: "charles@example.com",
            name: "Charles",
          }),
        };
      },
    },
  });

  const identity = await service.verifyCredential("signed-google-token");

  assert.deepEqual(calls, [{
    idToken: "signed-google-token",
    audience: "web-client.apps.googleusercontent.com",
  }]);
  assert.deepEqual(identity, {
    provider: "google",
    subject: "google-subject",
    email: "charles@example.com",
    displayName: "Charles",
  });
});

test("Google authentication stays disabled without a client ID", async () => {
  const service = createGoogleIdentityService();

  assert.equal(service.isConfigured(), false);
  assert.equal(await service.verifyCredential("credential"), null);
});
