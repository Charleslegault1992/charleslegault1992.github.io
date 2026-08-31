const parsePostgresPort = (value) => {
  const port = Number.parseInt(
    String(value ?? "5432"),
    10,
  );

  if (
    !Number.isSafeInteger(port) ||
    port <= 0 ||
    port > 65535
  ) {
    throw new TypeError(
      "GAME_POSTGRES_PORT must be a valid TCP port.",
    );
  }

  return port;
};

const parsePoolMax = (value) => {
  const poolMax = Number.parseInt(
    String(value ?? "8"),
    10,
  );

  if (
    !Number.isSafeInteger(poolMax) ||
    poolMax <= 0 ||
    poolMax > 12
  ) {
    throw new RangeError(
      "GAME_POSTGRES_POOL_MAX must be between 1 and 12.",
    );
  }

  return poolMax;
};

const parseBoolean = (
  value,
  variableName,
  defaultValue = false,
) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return defaultValue;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new TypeError(
    `${variableName} must be "true" or "false".`,
  );
};

const getSharedPostgresOptions = (
  environment,
) => {
  const host = String(
    environment.GAME_POSTGRES_HOST ??
      "127.0.0.1",
  ).trim();

  const database = String(
    environment.GAME_POSTGRES_DATABASE ??
      "nonameyet",
  ).trim();

  if (host === "") {
    throw new TypeError(
      "GAME_POSTGRES_HOST cannot be empty.",
    );
  }

  if (database === "") {
    throw new TypeError(
      "GAME_POSTGRES_DATABASE cannot be empty.",
    );
  }

  return {
    host,

    port: parsePostgresPort(
      environment.GAME_POSTGRES_PORT,
    ),

    database,

    ssl: parseBoolean(
      environment.GAME_POSTGRES_SSL,
      "GAME_POSTGRES_SSL",
      false,
    ),
  };
};

export const getPostgresApplicationOptions = (
  environment = process.env,
) => {
  const shared =
    getSharedPostgresOptions(
      environment,
    );

  const user = String(
    environment.GAME_POSTGRES_APP_USER ??
      "nonameyet_app",
  ).trim();

  const password =
    environment.GAME_POSTGRES_APP_PASSWORD;

  if (user === "") {
    throw new TypeError(
      "GAME_POSTGRES_APP_USER cannot be empty.",
    );
  }

  if (
    typeof password !== "string" ||
    password.length === 0
  ) {
    throw new Error(
      "GAME_POSTGRES_APP_PASSWORD must be provided.",
    );
  }

  const poolMax =
    parsePoolMax(
      environment.GAME_POSTGRES_POOL_MAX,
    );

  return Object.freeze({
    ...shared,

    user,
    password,

    poolMax,
    poolMin:
      Math.min(
        2,
        poolMax,
      ),

    connectionTimeoutMillis: 2000,
    idleTimeoutMillis: 30000,
    queryTimeoutMillis: 6000,

    applicationName:
      "nonameyet-game-server",
  });
};

export const getPostgresMigratorOptions = (
  environment = process.env,
) => {
  const shared =
    getSharedPostgresOptions(
      environment,
    );

  const user = String(
    environment
      .GAME_POSTGRES_MIGRATOR_USER ??
      "nonameyet_migrator",
  ).trim();

  const password =
    environment
      .GAME_POSTGRES_MIGRATOR_PASSWORD;

  if (user === "") {
    throw new TypeError(
      "GAME_POSTGRES_MIGRATOR_USER cannot be empty.",
    );
  }

  if (
    typeof password !== "string" ||
    password.length === 0
  ) {
    throw new Error(
      "GAME_POSTGRES_MIGRATOR_PASSWORD must be provided.",
    );
  }

  return Object.freeze({
    ...shared,

    user,
    password,

    poolMax: 1,
    poolMin: 0,

    connectionTimeoutMillis: 2000,
    idleTimeoutMillis: 1000,
    queryTimeoutMillis: 0,

    applicationName:
      "nonameyet-migrator",
  });
};