const isThenable = (value) => {
  return (
    value !== null &&
    (
      typeof value === "object" ||
      typeof value === "function"
    ) &&
    typeof value.then === "function"
  );
};

export const createCoalescingAsyncQueue = ({
  worker,
  maxConcurrency = 2,
  onError = null,
} = {}) => {
  if (typeof worker !== "function") {
    throw new TypeError(
      "The coalescing async queue requires a worker.",
    );
  }

  if (
    !Number.isSafeInteger(maxConcurrency) ||
    maxConcurrency <= 0
  ) {
    throw new RangeError(
      "Queue maxConcurrency must be a positive safe integer.",
    );
  }

  if (
    onError !== null &&
    typeof onError !== "function"
  ) {
    throw new TypeError(
      "Queue onError must be a function or null.",
    );
  }

  const pendingByKey = new Map();
  const activeKeys = new Set();

  const readyKeys = [];
  const readyKeySet = new Set();

  const idleWaiters = [];

  const isIdle = () => {
    return (
      pendingByKey.size === 0 &&
      activeKeys.size === 0 &&
      readyKeys.length === 0
    );
  };

  const resolveIdleWaiters = () => {
    if (!isIdle()) {
      return;
    }

    while (idleWaiters.length > 0) {
      idleWaiters.shift()();
    }
  };

  const scheduleKey = (key) => {
    if (
      activeKeys.has(key) ||
      readyKeySet.has(key) ||
      !pendingByKey.has(key)
    ) {
      return;
    }

    readyKeySet.add(key);
    readyKeys.push(key);
  };

  const notifyError = (
    error,
    key,
    value,
  ) => {
    if (!onError) {
      return;
    }

    try {
      onError(
        error,
        key,
        value,
      );
    } catch {
      // Error reporting must never break the queue.
    }
  };

  const settleEntry = (
    key,
    entry,
    {
      result,
      error,
    },
  ) => {
    activeKeys.delete(key);

    if (error) {
      notifyError(
        error,
        key,
        entry.value,
      );

      for (const waiter of entry.waiters) {
        waiter.reject(error);
      }
    } else {
      for (const waiter of entry.waiters) {
        waiter.resolve(result);
      }
    }

    if (pendingByKey.has(key)) {
      scheduleKey(key);
    }

    resolveIdleWaiters();
  };

  const runKey = (key) => {
    readyKeySet.delete(key);

    const entry =
      pendingByKey.get(key);

    if (!entry) {
      return true;
    }

    pendingByKey.delete(key);
    activeKeys.add(key);

    let workerResult;

    try {
      workerResult = worker(
        key,
        entry.value,
      );
    } catch (error) {
      settleEntry(
        key,
        entry,
        {
          error,
        },
      );

      return true;
    }

    if (!isThenable(workerResult)) {
      settleEntry(
        key,
        entry,
        {
          result: workerResult,
        },
      );

      return true;
    }

    Promise.resolve(workerResult)
      .then((result) => {
        settleEntry(
          key,
          entry,
          {
            result,
          },
        );

        pump();
      })
      .catch((error) => {
        settleEntry(
          key,
          entry,
          {
            error,
          },
        );

        pump();
      });

    return false;
  };

  const pump = () => {
    while (
      activeKeys.size < maxConcurrency &&
      readyKeys.length > 0
    ) {
      const key = readyKeys.shift();

      if (!readyKeySet.has(key)) {
        continue;
      }

      runKey(key);
    }

    resolveIdleWaiters();
  };

  const enqueueInternal = (
    key,
    value,
    waiter = null,
  ) => {
    if (
      typeof key !== "string" ||
      key === ""
    ) {
      throw new TypeError(
        "Queue keys must be non-empty strings.",
      );
    }

    const existing =
      pendingByKey.get(key);

    if (existing) {
      existing.value = value;

      if (waiter) {
        existing.waiters.push(waiter);
      }
    } else {
      pendingByKey.set(
        key,
        {
          value,
          waiters:
            waiter
              ? [waiter]
              : [],
        },
      );
    }

    scheduleKey(key);
    pump();
  };

  const enqueue = (
    key,
    value,
  ) => {
    enqueueInternal(
      key,
      value,
    );
  };

  const enqueueAndWait = (
    key,
    value,
  ) => {
    return new Promise(
      (resolve, reject) => {
        enqueueInternal(
          key,
          value,
          {
            resolve,
            reject,
          },
        );
      },
    );
  };

  const flush = () => {
    if (isIdle()) {
      return Promise.resolve();
    }

    return new Promise(
      (resolve) => {
        idleWaiters.push(resolve);
      },
    );
  };

  const hasWork = (key) => {
    return (
      activeKeys.has(key) ||
      pendingByKey.has(key)
    );
  };

  const getStats = () => {
    return Object.freeze({
      active: activeKeys.size,
      pending: pendingByKey.size,
      ready: readyKeys.length,
      maxConcurrency,
    });
  };

  return Object.freeze({
    enqueue,
    enqueueAndWait,
    flush,
    hasWork,
    getStats,
  });
};