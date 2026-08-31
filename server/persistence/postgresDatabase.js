import pg from "pg";

const { Pool } = pg;

const DEFAULT_POOL_MAX = 8;
const MAX_APP_ROLE_CONNECTIONS = 12;

export const createPostgresPoolConfig = ({
  host = "127.0.0.1",
  port = 5432,
  database = "nonameyet",
  user = "nonameyet_app",
  password,
  poolMax = DEFAULT_POOL_MAX,
  poolMin = Math.min(2, poolMax),
  ssl = false,
  connectionTimeoutMillis = 2000,
  idleTimeoutMillis = 30000,
  queryTimeoutMillis = 6000,
  applicationName = "nonameyet-game-server",
} = {}) => {
  const normalizedHost = String(host ?? "").trim();
  const normalizedDatabase = String(database ?? "").trim();
  const normalizedUser = String(user ?? "").trim();
  const normalizedApplicationName = String(applicationName ?? "").trim();

  if (normalizedHost === "") {
    throw new TypeError("A PostgreSQL host is required.");
  }

  if (!Number.isSafeInteger(port) || port <= 0 || port > 65535) {
    throw new TypeError("A valid PostgreSQL port is required.");
  }

  if (normalizedDatabase === "") {
    throw new TypeError("A PostgreSQL database is required.");
  }

  if (normalizedUser === "") {
    throw new TypeError("A PostgreSQL user is required.");
  }

  if (typeof password !== "string" || password.length === 0) {
    throw new TypeError("A PostgreSQL password is required.");
  }

  if (
    !Number.isSafeInteger(poolMax) ||
    poolMax <= 0 ||
    poolMax > MAX_APP_ROLE_CONNECTIONS
  ) {
    throw new RangeError(
      `PostgreSQL pool size must be between 1 and ${MAX_APP_ROLE_CONNECTIONS}.`,
    );
  }

  if (
    !Number.isSafeInteger(poolMin) ||
    poolMin < 0 ||
    poolMin > poolMax
  ) {
    throw new RangeError(
      "PostgreSQL pool minimum must be between 0 and poolMax.",
    );
  }

  if (
    !Number.isSafeInteger(connectionTimeoutMillis) ||
    connectionTimeoutMillis < 0 ||
    !Number.isSafeInteger(idleTimeoutMillis) ||
    idleTimeoutMillis < 0 ||
    !Number.isSafeInteger(queryTimeoutMillis) ||
    queryTimeoutMillis < 0
  ) {
    throw new RangeError(
      "PostgreSQL timeout values must be non-negative safe integers.",
    );
  }

  if (normalizedApplicationName === "") {
    throw new TypeError(
      "A PostgreSQL application name is required.",
    );
  }

  return Object.freeze({
    host: normalizedHost,
    port,
    database: normalizedDatabase,
    user: normalizedUser,
    password,
    ssl,

    max: poolMax,
    min: poolMin,

    connectionTimeoutMillis,
    idleTimeoutMillis,
    query_timeout: queryTimeoutMillis,

    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,

    application_name: normalizedApplicationName,
  });
};

export const createPostgresDatabase = ({
  PoolClass = Pool,
  logger = console,
  ...poolOptions
} = {}) => {
  const pool = new PoolClass(createPostgresPoolConfig(poolOptions));

  let closePromise = null;

  pool.on("error", (error) => {
    logger.error("Unexpected PostgreSQL idle client error:", error);
  });

  const query = (textOrConfig, values) => {
    return pool.query(textOrConfig, values);
  };

  const transaction = async (work) => {
    if (typeof work !== "function") {
      throw new TypeError("A PostgreSQL transaction callback is required.");
    }

    const client = await pool.connect();
    let transactionStarted = false;
    let destroyClient = false;

    try {
      await client.query("BEGIN");
      transactionStarted = true;

      const transactionDatabase = Object.freeze({
        query(textOrConfig, values) {
          return client.query(textOrConfig, values);
        },
      });

      const result = await work(transactionDatabase);

      await client.query("COMMIT");
      return result;
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          destroyClient = true;
          logger.error("PostgreSQL transaction rollback failed:", rollbackError);
        }
      }

      throw error;
    } finally {
      client.release(destroyClient);
    }
  };

  const healthCheck = async () => {
    const result = await pool.query({
      text: "SELECT 1",
      rowMode: "array",
    });

    return result.rows.length === 1 && result.rows[0][0] === 1;
  };

  const getPoolStats = () => {
    return {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    };
  };

  const close = () => {
    if (!closePromise) {
      closePromise = pool.end();
    }

    return closePromise;
  };

  return Object.freeze({
    query,
    transaction,
    healthCheck,
    getPoolStats,
    close,
  });
};