import { createHash } from "node:crypto";

import {
  ACCOUNT_EMAIL_PATTERN,
  ACCOUNT_ID_PATTERN,
  EXTERNAL_PASSWORD_HASH,
  EXTERNAL_PROVIDER_PATTERN,
  normalizeAccountEmail,
  normalizeAccountId,
} from "./accountRepositoryRules.js";

const toSafeInteger = (value, fieldName) => {
  const numberValue = typeof value === "number"
    ? value
    : Number(value);

  if (!Number.isSafeInteger(numberValue)) {
    throw new RangeError(
      `PostgreSQL returned an invalid ${fieldName}.`,
    );
  }

  return numberValue;
};

const mapAccountRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    accountId: row.account_id,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: toSafeInteger(row.created_at, "account created_at"),
  };
};

const updateExternalIdentityProfile = async (
  database,
  provider,
  subject,
  email,
  displayName,
  now,
) => {
  const result = await database.query({
    name: "account-external-identity-update-v1",
    text: `
      UPDATE game.external_identities
      SET
        email = $3,
        display_name = $4,
        updated_at = $5
      WHERE provider = $1
        AND subject = $2
      RETURNING account_id
    `,
    values: [
      provider,
      subject,
      email,
      displayName,
      now,
    ],
  });

  return result.rows[0]?.account_id ?? null;
};

export const createPostgresAccountRepository = ({
  database,
} = {}) => {
  if (
    !database ||
    typeof database.query !== "function" ||
    typeof database.transaction !== "function"
  ) {
    throw new TypeError(
      "The PostgreSQL account repository requires a database.",
    );
  }

  const create = async (
    accountId,
    email,
    passwordHash,
    now = Date.now(),
  ) => {
    const normalizedAccountId = normalizeAccountId(accountId);
    const normalizedEmail = normalizeAccountEmail(email);

    if (!ACCOUNT_ID_PATTERN.test(normalizedAccountId)) {
      return {
        success: false,
        reason: "invalid-account",
      };
    }

    if (
      !ACCOUNT_EMAIL_PATTERN.test(normalizedEmail) ||
      normalizedEmail.length > 320
    ) {
      return {
        success: false,
        reason: "invalid-email",
      };
    }

    if (
      typeof passwordHash !== "string" ||
      passwordHash === "" ||
      !Number.isFinite(now)
    ) {
      return {
        success: false,
        reason: "invalid-credentials",
      };
    }

    const insertResult = await database.query({
      name: "account-create-v1",
      text: `
        INSERT INTO game.accounts (
          account_id,
          email,
          password_hash,
          created_at
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING
        RETURNING account_id, email
      `,
      values: [
        normalizedAccountId,
        normalizedEmail,
        passwordHash,
        now,
      ],
    });

    if (insertResult.rowCount === 1) {
      return {
        success: true,
        accountId: normalizedAccountId,
        email: normalizedEmail,
      };
    }

    const conflictResult = await database.query({
      name: "account-create-conflict-v1",
      text: `
        SELECT
          EXISTS (
            SELECT 1
            FROM game.accounts
            WHERE email = $1
          ) AS email_exists,
          EXISTS (
            SELECT 1
            FROM game.accounts
            WHERE account_id = $2
          ) AS account_exists
      `,
      values: [
        normalizedEmail,
        normalizedAccountId,
      ],
    });

    const conflict = conflictResult.rows[0];

    if (conflict?.email_exists) {
      return {
        success: false,
        reason: "email-already-exists",
      };
    }

    return {
      success: false,
      reason: "account-already-exists",
    };
  };

  const find = async (accountId) => {
    const normalizedAccountId = normalizeAccountId(accountId);

    if (!ACCOUNT_ID_PATTERN.test(normalizedAccountId)) {
      return null;
    }

    const result = await database.query({
      name: "account-find-v1",
      text: `
        SELECT
          account_id,
          email,
          password_hash,
          created_at
        FROM game.accounts
        WHERE account_id = $1
      `,
      values: [
        normalizedAccountId,
      ],
    });

    return mapAccountRow(result.rows[0]);
  };

  const findByLogin = async (login) => {
    const normalizedLogin = String(login ?? "")
      .trim()
      .toLocaleLowerCase();

    const isEmail = ACCOUNT_EMAIL_PATTERN.test(normalizedLogin);

    const result = await database.query({
      name: isEmail
        ? "account-find-by-email-v1"
        : "account-find-by-id-v1",
      text: isEmail
        ? `
          SELECT
            account_id,
            email,
            password_hash,
            created_at
          FROM game.accounts
          WHERE email = $1
        `
        : `
          SELECT
            account_id,
            email,
            password_hash,
            created_at
          FROM game.accounts
          WHERE account_id = $1
        `,
      values: [
        normalizedLogin,
      ],
    });

    return mapAccountRow(result.rows[0]);
  };

  const findOrCreateExternalIdentity = async (
    identity,
    now = Date.now(),
  ) => {
    const provider = String(identity?.provider ?? "")
      .trim()
      .toLocaleLowerCase();

    const subject = String(identity?.subject ?? "")
      .trim();

    const email = String(identity?.email ?? "")
      .trim()
      .slice(0, 320);

    const displayName = String(identity?.displayName ?? "")
      .trim()
      .slice(0, 200);

    if (
      !EXTERNAL_PROVIDER_PATTERN.test(provider) ||
      subject === "" ||
      subject.length > 255 ||
      !Number.isFinite(now)
    ) {
      return {
        success: false,
        reason: "invalid-external-identity",
      };
    }

    const existingAccountId = await updateExternalIdentityProfile(
      database,
      provider,
      subject,
      email,
      displayName,
      now,
    );

    if (existingAccountId) {
      return {
        success: true,
        accountId: existingAccountId,
        wasCreated: false,
      };
    }

    const accountHash = createHash("sha256")
      .update(`${provider}\0${subject}`)
      .digest("hex")
      .slice(0, 24);

    const accountId = `${provider}_${accountHash}`;

    try {
      return await database.transaction(
        async (transactionDatabase) => {
          const identityCreatedWhileWaiting =
            await updateExternalIdentityProfile(
              transactionDatabase,
              provider,
              subject,
              email,
              displayName,
              now,
            );

          if (identityCreatedWhileWaiting) {
            return {
              success: true,
              accountId: identityCreatedWhileWaiting,
              wasCreated: false,
            };
          }

          const accountInsertResult =
            await transactionDatabase.query({
              name: "account-external-account-create-v1",
              text: `
                INSERT INTO game.accounts (
                  account_id,
                  email,
                  password_hash,
                  created_at
                )
                VALUES ($1, '', $2, $3)
                ON CONFLICT (account_id) DO NOTHING
                RETURNING account_id
              `,
              values: [
                accountId,
                EXTERNAL_PASSWORD_HASH,
                now,
              ],
            });

          if (accountInsertResult.rowCount !== 1) {
            const identityAfterAccountConflict =
              await updateExternalIdentityProfile(
                transactionDatabase,
                provider,
                subject,
                email,
                displayName,
                now,
              );

            if (identityAfterAccountConflict) {
              return {
                success: true,
                accountId: identityAfterAccountConflict,
                wasCreated: false,
              };
            }

            throw new Error(
              "External account identifier collision.",
            );
          }

          const identityInsertResult =
            await transactionDatabase.query({
              name: "account-external-identity-create-v1",
              text: `
                INSERT INTO game.external_identities (
                  provider,
                  subject,
                  account_id,
                  email,
                  display_name,
                  created_at,
                  updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $6)
                ON CONFLICT (provider, subject) DO NOTHING
                RETURNING account_id
              `,
              values: [
                provider,
                subject,
                accountId,
                email,
                displayName,
                now,
              ],
            });

          if (identityInsertResult.rowCount === 1) {
            return {
              success: true,
              accountId,
              wasCreated: true,
            };
          }

          const identityCreatedDuringInsert =
            await updateExternalIdentityProfile(
              transactionDatabase,
              provider,
              subject,
              email,
              displayName,
              now,
            );

          if (identityCreatedDuringInsert) {
            return {
              success: true,
              accountId: identityCreatedDuringInsert,
              wasCreated: false,
            };
          }

          throw new Error(
            "External identity creation conflict.",
          );
        },
      );
    } catch {
      return {
        success: false,
        reason: "external-account-creation-failed",
      };
    }
  };

  return Object.freeze({
    create,
    find,
    findByLogin,
    findOrCreateExternalIdentity,
  });
};