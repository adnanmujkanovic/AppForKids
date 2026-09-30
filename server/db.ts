// SQLite persistence (node:sqlite). All SQL lives behind this module and the repositories
// that use it, so moving to PostgreSQL later is a contained change.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS families (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS parents (
  id TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES families(id), email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, role TEXT NOT NULL, family_id TEXT NOT NULL, parent_id TEXT, child_id TEXT,
  created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS children (
  id TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES families(id), name TEXT NOT NULL, age INTEGER NOT NULL,
  avatar TEXT NOT NULL, experience TEXT NOT NULL, interests TEXT NOT NULL, help_level TEXT NOT NULL,
  permissions TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY, child_id TEXT NOT NULL REFERENCES children(id), type TEXT NOT NULL, title TEXT NOT NULL,
  emoji TEXT NOT NULL, idea TEXT NOT NULL, description TEXT NOT NULL, topic TEXT NOT NULL, spec TEXT NOT NULL,
  version INTEGER NOT NULL, remixed_from TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS project_versions (
  project_id TEXT NOT NULL, version INTEGER NOT NULL, spec TEXT NOT NULL, summary TEXT NOT NULL,
  author TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (project_id, version));
CREATE TABLE IF NOT EXISTS journal (
  id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL, kind TEXT NOT NULL, text TEXT NOT NULL,
  created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT, child_id TEXT NOT NULL, thread TEXT NOT NULL, role TEXT NOT NULL,
  content TEXT NOT NULL, meta TEXT, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS messages_thread ON messages(child_id, thread, id);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, child_id TEXT NOT NULL, type TEXT NOT NULL, project_id TEXT,
  topic TEXT, data TEXT, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS events_child ON events(child_id, type);
CREATE TABLE IF NOT EXISTS medals (
  child_id TEXT NOT NULL, medal_id TEXT NOT NULL, project_id TEXT, created_at TEXT NOT NULL,
  PRIMARY KEY (child_id, medal_id));
CREATE TABLE IF NOT EXISTS skills (
  child_id TEXT NOT NULL, concept TEXT NOT NULL, project_id TEXT, created_at TEXT NOT NULL,
  PRIMARY KEY (child_id, concept));
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY, child_id TEXT NOT NULL, emoji TEXT NOT NULL, text TEXT NOT NULL, link TEXT,
  read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS shares (
  token TEXT PRIMARY KEY, project_id TEXT NOT NULL, child_id TEXT NOT NULL, audience TEXT NOT NULL,
  allow_remix INTEGER NOT NULL, status TEXT NOT NULL, version INTEGER NOT NULL, slug TEXT,
  views INTEGER NOT NULL DEFAULT 0, plays INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS safety_events (
  id TEXT PRIMARY KEY, child_id TEXT NOT NULL, severity TEXT NOT NULL, category TEXT NOT NULL,
  summary TEXT NOT NULL, excerpt TEXT NOT NULL, reviewed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY, family_id TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY, family_id TEXT NOT NULL, child_id TEXT NOT NULL, contact_id TEXT NOT NULL,
  subject TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ai_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, child_id TEXT, op TEXT NOT NULL, provider TEXT NOT NULL,
  ok INTEGER NOT NULL, ms INTEGER NOT NULL, input_tokens INTEGER, output_tokens INTEGER, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS friend_invites (
  code TEXT PRIMARY KEY, family_id TEXT NOT NULL, child_id TEXT NOT NULL, used_by TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS friends (
  child_id TEXT NOT NULL, friend_id TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (child_id, friend_id));
CREATE TABLE IF NOT EXISTS inbox (
  id TEXT PRIMARY KEY, token TEXT NOT NULL, from_child TEXT NOT NULL, to_child TEXT NOT NULL, note TEXT NOT NULL,
  seen INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL, child_id TEXT NOT NULL, kind TEXT NOT NULL,
  value TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE (project_id, child_id, kind, value));
CREATE TABLE IF NOT EXISTS collaborators (
  project_id TEXT NOT NULL, child_id TEXT NOT NULL, role TEXT NOT NULL, created_at TEXT NOT NULL,
  PRIMARY KEY (project_id, child_id));
CREATE TABLE IF NOT EXISTS project_tasks (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, text TEXT NOT NULL, assignee TEXT, done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY, child_id TEXT NOT NULL, title TEXT NOT NULL, steps TEXT NOT NULL, created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS connectors (
  family_id TEXT NOT NULL, kind TEXT NOT NULL, account TEXT NOT NULL, secret TEXT NOT NULL, created_at TEXT NOT NULL,
  PRIMARY KEY (family_id, kind));
CREATE TABLE IF NOT EXISTS deployments (
  project_id TEXT PRIMARY KEY, repo TEXT NOT NULL, repo_url TEXT NOT NULL, pages_url TEXT, version INTEGER NOT NULL,
  updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS detective_cases (
  id TEXT PRIMARY KEY, child_id TEXT NOT NULL, data TEXT NOT NULL, solved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL);
`;

let db: DatabaseSync | null = null;

export function openDb(path = process.env.SPARKFORGE_DB ?? "data/sparkforge.db"): DatabaseSync {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  // Additive migrations for databases created by earlier versions.
  addColumn("project_versions", "by_child", "TEXT");
  addColumn("outbox", "status", "TEXT NOT NULL DEFAULT 'kept'");
  return db;
}

function addColumn(table: string, column: string, def: string) {
  const cols = db!.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) db!.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
}

export function getDb(): DatabaseSync {
  return db ?? openDb();
}

type Param = string | number | null;
export const all = <T>(sql: string, ...params: Param[]) => getDb().prepare(sql).all(...params) as T[];
export const one = <T>(sql: string, ...params: Param[]) => getDb().prepare(sql).get(...params) as T | undefined;
export const run = (sql: string, ...params: Param[]) => getDb().prepare(sql).run(...params);

export function tx<T>(fn: () => T): T {
  const d = getDb();
  d.exec("BEGIN");
  try {
    const out = fn();
    d.exec("COMMIT");
    return out;
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}

export const now = () => new Date().toISOString();
export const newId = (prefix: string) => `${prefix}_${randomBytes(9).toString("base64url")}`;
export const newToken = () => randomBytes(24).toString("base64url");
