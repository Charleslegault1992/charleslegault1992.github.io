const assertPoolStats = (stats) => {
  if (
    !stats ||
    !Number.isInteger(stats.total) ||
    !Number.isInteger(stats.idle) ||
    !Number.isInteger(stats.waiting) ||
    stats.total < 0 ||
    stats.idle < 0 ||
    stats.waiting < 0
  ) {
    throw new TypeError(
      "PostgreSQL pool stats are invalid.",
    );
  }
};

export const createPostgresPoolPressureMonitor =
  ({
    getPoolStats,

    logger = console,

    intervalMs = 30000,

    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval,
  } = {}) => {
    if (
      typeof getPoolStats !==
      "function"
    ) {
      throw new TypeError(
        "PostgreSQL pool monitor requires getPoolStats.",
      );
    }

    if (
      !logger ||
      typeof logger.log !==
        "function" ||
      typeof logger.warn !==
        "function"
    ) {
      throw new TypeError(
        "PostgreSQL pool monitor logger is invalid.",
      );
    }

    if (
      !Number.isInteger(
        intervalMs,
      ) ||
      intervalMs < 1000
    ) {
      throw new RangeError(
        "PostgreSQL pool monitor interval must be at least 1000 ms.",
      );
    }

    let timer = null;
    let wasPressured = false;

    const sample = () => {
      const stats =
        getPoolStats();

      assertPoolStats(stats);

      const pressured =
        stats.waiting > 0;

      if (
        pressured &&
        !wasPressured
      ) {
        logger.warn(
          `PostgreSQL pool pressure detected: ${stats.total} total, ${stats.idle} idle, ${stats.waiting} waiting.`,
        );
      } else if (
        !pressured &&
        wasPressured
      ) {
        logger.log(
          `PostgreSQL pool pressure recovered: ${stats.total} total, ${stats.idle} idle, ${stats.waiting} waiting.`,
        );
      }

      wasPressured =
        pressured;

      return Object.freeze({
        ...stats,
        pressured,
      });
    };

    const start = () => {
      if (timer) {
        return;
      }

      timer =
        setIntervalFn(
          sample,
          intervalMs,
        );

      timer?.unref?.();
    };

    const stop = () => {
      if (!timer) {
        return;
      }

      clearIntervalFn(timer);

      timer = null;
      wasPressured = false;
    };

    return Object.freeze({
      sample,
      start,
      stop,
    });
  };