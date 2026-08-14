import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { runSqliteMigrations } from "./sqliteMigrations.js";

export const openGameDatabase = ({ databasePath = ".data/game.sqlite" } = {}) => {
  if (typeof databasePath !== "string" || databasePath === "") {
    throw new TypeError("A SQLite database path is required.");
  }
  if (databasePath !== ":memory:") {
    mkdirSync(dirname(databasePath), { recursive: true });
  }
  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec("PRAGMA busy_timeout = 5000;");
  runSqliteMigrations(database);
  return database;
};
