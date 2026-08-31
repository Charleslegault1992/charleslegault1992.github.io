import assert from "node:assert/strict";
import test from "node:test";

import {
  createCoalescingAsyncQueue,
} from "../server/persistence/coalescingAsyncQueue.js";

const createDeferred = () => {
  let resolve;
  let reject;

  const promise = new Promise(
    (resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    },
  );

  return {
    promise,
    resolve,
    reject,
  };
};

test("coalescing queue never exceeds its configured concurrency", async () => {
  const started = [];
  const deferredByKey = new Map();

  const queue =
    createCoalescingAsyncQueue({
      maxConcurrency: 2,

      worker(key) {
        started.push(key);

        const deferred =
          createDeferred();

        deferredByKey.set(
          key,
          deferred,
        );

        return deferred.promise;
      },
    });

  queue.enqueue("a", 1);
  queue.enqueue("b", 2);
  queue.enqueue("c", 3);
  queue.enqueue("d", 4);

  assert.deepEqual(
    started,
    [
      "a",
      "b",
    ],
  );

  assert.equal(
    queue.getStats().active,
    2,
  );

  deferredByKey
    .get("a")
    .resolve(true);

  await Promise.resolve();

  assert.deepEqual(
    started,
    [
      "a",
      "b",
      "c",
    ],
  );

  deferredByKey
    .get("b")
    .resolve(true);

  await Promise.resolve();

  deferredByKey
    .get("c")
    .resolve(true);

  await Promise.resolve();

  deferredByKey
    .get("d")
    .resolve(true);

  await queue.flush();

  assert.deepEqual(
    queue.getStats(),
    {
      active: 0,
      pending: 0,
      ready: 0,
      maxConcurrency: 2,
    },
  );
});

test("coalescing queue keeps only the latest pending value for one key", async () => {
  const first =
    createDeferred();

  const values = [];

  let callCount = 0;

  const queue =
    createCoalescingAsyncQueue({
      maxConcurrency: 1,

      worker(_key, value) {
        callCount += 1;
        values.push(value);

        if (callCount === 1) {
          return first.promise;
        }

        return true;
      },
    });

  queue.enqueue(
    "player-1",
    {
      revision: 1,
    },
  );

  queue.enqueue(
    "player-1",
    {
      revision: 2,
    },
  );

  queue.enqueue(
    "player-1",
    {
      revision: 3,
    },
  );

  assert.deepEqual(
    values,
    [
      {
        revision: 1,
      },
    ],
  );

  first.resolve(true);

  await queue.flush();

  assert.deepEqual(
    values,
    [
      {
        revision: 1,
      },
      {
        revision: 3,
      },
    ],
  );
});

test("enqueueAndWait waits for the coalesced latest pending value", async () => {
  const first =
    createDeferred();

  const values = [];

  const queue =
    createCoalescingAsyncQueue({
      maxConcurrency: 1,

      worker(_key, value) {
        values.push(value);

        if (values.length === 1) {
          return first.promise;
        }

        return value;
      },
    });

  queue.enqueue(
    "player-1",
    1,
  );

  const waiting =
    queue.enqueueAndWait(
      "player-1",
      2,
    );

  queue.enqueue(
    "player-1",
    3,
  );

  first.resolve(true);

  const result =
    await waiting;

  assert.equal(
    result,
    3,
  );

  assert.deepEqual(
    values,
    [
      1,
      3,
    ],
  );
});

test("synchronous workers remain synchronous for the SQLite transition", () => {
  const values = [];

  const queue =
    createCoalescingAsyncQueue({
      maxConcurrency: 2,

      worker(key, value) {
        values.push({
          key,
          value,
        });

        return true;
      },
    });

  queue.enqueue(
    "one",
    1,
  );

  queue.enqueue(
    "two",
    2,
  );

  assert.deepEqual(
    values,
    [
      {
        key: "one",
        value: 1,
      },
      {
        key: "two",
        value: 2,
      },
    ],
  );

  assert.equal(
    queue.getStats().active,
    0,
  );
});