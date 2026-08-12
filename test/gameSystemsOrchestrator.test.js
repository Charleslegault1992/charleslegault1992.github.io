import test from "node:test";
import assert from "node:assert/strict";

import { createGameSystemsOrchestrator } from "../src/core/gameSystemsOrchestrator.js";

test("the systems orchestrator preserves update and render order", () => {
  const calls = [];
  const orchestrator = createGameSystemsOrchestrator({
    createLogicContext: (now) => ({ now, activeMonsters: [1, 2] }),
    createRenderContext: (now) => ({ now, cameraX: 4 }),
    logicSystems: [
      (context) => calls.push(`logic-a:${context.now}:${context.activeMonsters.length}`),
      (context) => calls.push(`logic-b:${context.now}`),
    ],
    renderSystems: [
      (context) => calls.push(`render-a:${context.cameraX}`),
      (context) => calls.push(`render-b:${context.now}`),
    ],
  });

  orchestrator.update(10);
  orchestrator.render(20);

  assert.deepEqual(calls, ["logic-a:10:2", "logic-b:10", "render-a:4", "render-b:20"]);
});

