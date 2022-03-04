import { DB } from "https://deno.land/x/sqlite/mod.ts";

try {
  await Deno.remove("test_knowledge_checklist.db");
} catch {
  // nothing to remove
}

const db = new DB("./test_knowledge_checklist.db");

await db.query(`
  CREATE TABLE learning_objectives(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cohort_id INTEGER NOT NULL,
    topic TEXT NOT NULL,
    learning_objective TEXT NOT NULL,
    not_confident TEXT DEFAULT '.',
    confident TEXT DEFAULT '.'
  )`);

await db.query(
  `CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    cohort_id INTEGER NOT NULL,
    encrypted_password TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    admin BOOLEAN NOT NULL
  )`
);

await db.query(
  `CREATE TABLE sessions (
    id TEXT PRIMARY KEY NOT NULL,
    created_at DATETIME NOT NULL,
    user_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    isAdmin BOOLEAN NOT NULL
  )`
);

await db.query(
  `CREATE TABLE results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    cohort_id INTEGER NOT NULL,
    topic TEXT NOT NULL,
    learning_objective TEXT NOT NULL,
    score INTEGER DEFAULT 1,
    isActive BOOLEAN DEFAULT FALSE,
    not_confident TEXT NOT NULL,
    confident TEXT NOT NULL
    )`
);
