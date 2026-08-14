import { createHash } from "node:crypto";

import { openGameDatabase } from "./sqliteDatabase.js";

const ACCOUNT_ID_PATTERN = /^[a-z0-9_-]{3,40}$/;
const EXTERNAL_PROVIDER_PATTERN = /^[a-z0-9_-]{1,30}$/;
const EXTERNAL_PASSWORD_HASH = "external-login-only";

export const normalizeAccountId = (accountId) => String(accountId ?? "").trim().toLocaleLowerCase();

export const createSqliteAccountRepository = ({ databasePath = ".data/game.sqlite" } = {}) => {
  const database = openGameDatabase({ databasePath });
  const insertAccount = database.prepare(`
    INSERT INTO accounts (account_id, password_hash, created_at)
    VALUES (?, ?, ?)
    ON CONFLICT (account_id) DO NOTHING
  `);
  const selectAccount = database.prepare(`
    SELECT account_id, password_hash, created_at
    FROM accounts
    WHERE account_id = ?
  `);
  const selectExternalIdentity = database.prepare(`
    SELECT account_id, email, display_name, created_at, updated_at
    FROM external_identities
    WHERE provider = ? AND subject = ?
  `);
  const insertExternalIdentity = database.prepare(`
    INSERT INTO external_identities (
      provider, subject, account_id, email, display_name, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const updateExternalIdentityProfile = database.prepare(`
    UPDATE external_identities
    SET email = ?, display_name = ?, updated_at = ?
    WHERE provider = ? AND subject = ?
  `);

  const findExternalIdentity = (provider, subject) => {
    const row = selectExternalIdentity.get(provider, subject);
    return row
      ? {
          accountId: row.account_id,
          email: row.email,
          displayName: row.display_name,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }
      : null;
  };

  return Object.freeze({
    create(accountId, passwordHash, now = Date.now()) {
      const normalizedAccountId = normalizeAccountId(accountId);
      if (
        !ACCOUNT_ID_PATTERN.test(normalizedAccountId) ||
        typeof passwordHash !== "string" ||
        passwordHash === "" ||
        !Number.isFinite(now)
      ) {
        return { success: false, reason: "invalid-account" };
      }
      const result = insertAccount.run(normalizedAccountId, passwordHash, now);
      return result.changes === 1
        ? { success: true, accountId: normalizedAccountId }
        : { success: false, reason: "account-already-exists" };
    },
    find(accountId) {
      const normalizedAccountId = normalizeAccountId(accountId);
      if (!ACCOUNT_ID_PATTERN.test(normalizedAccountId)) {
        return null;
      }
      const row = selectAccount.get(normalizedAccountId);
      return row
        ? { accountId: row.account_id, passwordHash: row.password_hash, createdAt: row.created_at }
        : null;
    },
    findOrCreateExternalIdentity(identity, now = Date.now()) {
      const provider = String(identity?.provider ?? "").trim().toLocaleLowerCase();
      const subject = String(identity?.subject ?? "").trim();
      const email = String(identity?.email ?? "").trim().slice(0, 320);
      const displayName = String(identity?.displayName ?? "").trim().slice(0, 200);
      if (
        !EXTERNAL_PROVIDER_PATTERN.test(provider) ||
        subject === "" ||
        subject.length > 255 ||
        !Number.isFinite(now)
      ) {
        return { success: false, reason: "invalid-external-identity" };
      }

      const existingIdentity = findExternalIdentity(provider, subject);
      if (existingIdentity) {
        updateExternalIdentityProfile.run(email, displayName, now, provider, subject);
        return { success: true, accountId: existingIdentity.accountId, wasCreated: false };
      }

      const accountHash = createHash("sha256").update(`${provider}\0${subject}`).digest("hex").slice(0, 24);
      const accountId = `${provider}_${accountHash}`;
      database.exec("BEGIN IMMEDIATE;");
      try {
        const identityCreatedWhileWaiting = findExternalIdentity(provider, subject);
        if (identityCreatedWhileWaiting) {
          database.exec("COMMIT;");
          return { success: true, accountId: identityCreatedWhileWaiting.accountId, wasCreated: false };
        }
        if (insertAccount.run(accountId, EXTERNAL_PASSWORD_HASH, now).changes !== 1) {
          throw new Error("External account identifier collision.");
        }
        insertExternalIdentity.run(provider, subject, accountId, email, displayName, now, now);
        database.exec("COMMIT;");
        return { success: true, accountId, wasCreated: true };
      } catch {
        database.exec("ROLLBACK;");
        return { success: false, reason: "external-account-creation-failed" };
      }
    },
    close() {
      database.close();
    },
  });
};
