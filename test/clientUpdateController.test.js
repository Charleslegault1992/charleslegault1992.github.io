import assert from "node:assert/strict";
import test from "node:test";

import { createClientUpdateController } from "../src/update/clientUpdateController.js";

const installBrowserGlobals = () => {
  const sessionValues = new Map();
  const keys = ["document", "navigator", "sessionStorage", "window"];
  const previousDescriptors = new Map(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const defineGlobal = (key, value) => {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  };
  defineGlobal("document", { visibilityState: "visible" });
  defineGlobal("navigator", { onLine: true });
  defineGlobal("sessionStorage", {
    getItem: (key) => sessionValues.get(key) ?? null,
    removeItem: (key) => sessionValues.delete(key),
    setItem: (key, value) => sessionValues.set(key, value),
  });
  defineGlobal("window", { location: { href: "https://game.test/", origin: "https://game.test" } });
  return () => {
    for (const [key, descriptor] of previousDescriptors) {
      if (!descriptor) {
        delete globalThis[key];
      } else {
        Object.defineProperty(globalThis, key, descriptor);
      }
    }
  };
};

test("the update controller reloads once when a different build is published", async () => {
  const restoreGlobals = installBrowserGlobals();
  let reloadBuildId = null;
  try {
    const controller = createClientUpdateController({
      fetchVersion: async () => ({ ok: true, json: async () => ({ buildId: "next-build" }) }),
      reload: (buildId) => {
        reloadBuildId = buildId;
      },
    });

    assert.equal(await controller.checkForUpdate(), true);
    assert.equal(reloadBuildId, "next-build");
    reloadBuildId = null;
    assert.equal(await controller.checkForUpdate(), false);
    assert.equal(reloadBuildId, null);
  } finally {
    restoreGlobals();
  }
});
