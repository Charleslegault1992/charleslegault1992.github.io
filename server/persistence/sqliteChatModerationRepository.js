import { openGameDatabase } from "./sqliteDatabase.js";

export const createSqliteChatModerationRepository = ({ databasePath = ".data/game.sqlite" } = {}) => {
  const database = openGameDatabase({ databasePath });
  const upsertMute = database.prepare(`
    INSERT INTO chat_mutes (account_id, muted_until, reason, moderator_account_id, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (account_id) DO UPDATE SET
      muted_until = excluded.muted_until,
      reason = excluded.reason,
      moderator_account_id = excluded.moderator_account_id,
      created_at = excluded.created_at
  `);
  const selectMute = database.prepare(`
    SELECT account_id, muted_until, reason, moderator_account_id, created_at
    FROM chat_mutes
    WHERE account_id = ? AND muted_until > ?
  `);
  const deleteMute = database.prepare("DELETE FROM chat_mutes WHERE account_id = ?");
  const deleteExpiredMutes = database.prepare("DELETE FROM chat_mutes WHERE muted_until <= ?");

  return Object.freeze({
    mute(accountId, mutedUntil, reason, moderatorAccountId, now = Date.now()) {
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
      upsertMute.run(accountId, mutedUntil, String(reason ?? "").slice(0, 160), moderatorAccountId, now);
      return true;
    },
    getActiveMute(accountId, now = Date.now()) {
      const row = selectMute.get(accountId, now);
      return row
        ? {
            accountId: row.account_id,
            mutedUntil: row.muted_until,
            reason: row.reason,
            moderatorAccountId: row.moderator_account_id,
            createdAt: row.created_at,
          }
        : null;
    },
    unmute(accountId) {
      return deleteMute.run(accountId).changes === 1;
    },
    pruneExpired(now = Date.now()) {
      return deleteExpiredMutes.run(now).changes;
    },
    close() {
      database.close();
    },
  });
};
