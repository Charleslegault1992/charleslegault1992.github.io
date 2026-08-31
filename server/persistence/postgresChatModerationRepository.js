const toSafeInteger = (value, fieldName) => {
  const numberValue = typeof value === "number" ? value : Number(value);

  if (!Number.isSafeInteger(numberValue)) {
    throw new RangeError(`PostgreSQL returned an invalid ${fieldName}.`);
  }

  return numberValue;
};

const mapMuteRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    accountId: row.account_id,
    mutedUntil: toSafeInteger(row.muted_until, "chat mute muted_until"),
    reason: row.reason,
    moderatorAccountId: row.moderator_account_id,
    createdAt: toSafeInteger(row.created_at, "chat mute created_at"),
  };
};

export const createPostgresChatModerationRepository = ({ database } = {}) => {
  if (!database || typeof database.query !== "function") {
    throw new TypeError("The PostgreSQL chat moderation repository requires a database.");
  }

  const mute = async (accountId, mutedUntil, reason, moderatorAccountId, now = Date.now()) => {
    if (
      typeof accountId !== "string" ||
      accountId === "" ||
      !Number.isSafeInteger(mutedUntil) ||
      mutedUntil <= now ||
      typeof moderatorAccountId !== "string" ||
      moderatorAccountId === ""
    ) {
      return false;
    }

    await database.query({
      name: "chat-mute-upsert-v1",
      text: `
        INSERT INTO game.chat_mutes (
          account_id,
          muted_until,
          reason,
          moderator_account_id,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (account_id)
        DO UPDATE SET
          muted_until = EXCLUDED.muted_until,
          reason = EXCLUDED.reason,
          moderator_account_id = EXCLUDED.moderator_account_id,
          created_at = EXCLUDED.created_at
      `,
      values: [accountId, mutedUntil, String(reason ?? "").slice(0, 160), moderatorAccountId, now],
    });

    return true;
  };

  const getActiveMute = async (accountId, now = Date.now()) => {
    const result = await database.query({
      name: "chat-mute-active-v1",
      text: `
        SELECT
          account_id,
          muted_until,
          reason,
          moderator_account_id,
          created_at
        FROM game.chat_mutes
        WHERE account_id = $1
          AND muted_until > $2
      `,
      values: [accountId, now],
    });

    return mapMuteRow(result.rows[0]);
  };

  const listActiveMutes = async (now = Date.now()) => {
    const result = await database.query({
      name: "chat-mute-list-active-v1",

      text: `
        SELECT
          account_id,
          muted_until,
          reason,
          moderator_account_id,
          created_at
        FROM game.chat_mutes
        WHERE muted_until > $1
        ORDER BY account_id ASC
      `,

      values: [now],
    });

    return result.rows.map(mapMuteRow);
  };

  const unmute = async (accountId) => {
    const result = await database.query({
      name: "chat-mute-delete-v1",
      text: `
        DELETE FROM game.chat_mutes
        WHERE account_id = $1
      `,
      values: [accountId],
    });

    return result.rowCount === 1;
  };

  const pruneExpired = async (now = Date.now()) => {
    const result = await database.query({
      name: "chat-mute-prune-v1",
      text: `
        DELETE FROM game.chat_mutes
        WHERE muted_until <= $1
      `,
      values: [now],
    });

    return result.rowCount;
  };

  return Object.freeze({
    mute,
    getActiveMute,
    listActiveMutes,
    unmute,
    pruneExpired,
  });
};
