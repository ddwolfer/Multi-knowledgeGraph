/**
 * SQLite database initialization — knowledge graph schema
 * Tables: nodes, edges, episodes, episode_steps + FTS5 + sqlite-vec
 */

import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { fileURLToPath } from 'url';
import { dirname, join, isAbsolute } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let DB_PATH = join(__dirname, '..', 'knowledge.db');
let db = null;

export function setDbPath(customPath) {
  if (db) throw new Error('setDbPath must be called before getDb()');
  DB_PATH = isAbsolute(customPath) ? customPath : join(__dirname, '..', customPath);
}

export function getDbPath() {
  return DB_PATH;
}

export function getDb() {
  if (db) return db;

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Load sqlite-vec extension
  sqliteVec.load(db);

  // Create schema
  db.exec(`
    -- Knowledge nodes
    CREATE TABLE IF NOT EXISTS nodes (
      id           TEXT PRIMARY KEY,
      type         TEXT NOT NULL CHECK(type IN ('rule','procedure','observation','insight','core','preference')),
      trust        TEXT NOT NULL CHECK(trust IN ('principle','pattern','inference')),
      name         TEXT NOT NULL,
      content      TEXT NOT NULL,
      source       TEXT,
      quote        TEXT,
      metadata     TEXT,
      valid_from   TEXT,
      valid_until  TEXT,
      access_count INTEGER DEFAULT 0,
      last_accessed TEXT,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );

    -- Causal edges (A-MEM style: relation_type + reasoning + weight)
    CREATE TABLE IF NOT EXISTS edges (
      id             TEXT PRIMARY KEY,
      source_id      TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      target_id      TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      relation_type  TEXT NOT NULL CHECK(relation_type IN (
        'must_precede','causes','implies','aligns_to','contradicts',
        'refines','observed_in','reason_for','tends_to','requires_reading'
      )),
      reasoning      TEXT,
      weight         REAL DEFAULT 1.0,
      source_session TEXT,
      valid_from     TEXT,
      valid_until    TEXT,
      created_at     TEXT NOT NULL
    );

    -- Procedural memory: episodes
    CREATE TABLE IF NOT EXISTS episodes (
      id         TEXT PRIMARY KEY,
      type       TEXT NOT NULL CHECK(type IN ('success','failure','lesson')),
      context    TEXT,
      summary    TEXT NOT NULL,
      outcome    TEXT,
      session_id TEXT,
      created_at TEXT NOT NULL
    );

    -- Episode steps
    CREATE TABLE IF NOT EXISTS episode_steps (
      id         TEXT PRIMARY KEY,
      episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
      step_order INTEGER NOT NULL,
      element    TEXT,
      action     TEXT NOT NULL,
      decision   TEXT,
      reason     TEXT,
      result     TEXT
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
    CREATE INDEX IF NOT EXISTS idx_nodes_trust ON nodes(trust);
    CREATE INDEX IF NOT EXISTS idx_nodes_valid ON nodes(valid_until);
    CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
    CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
    CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(relation_type);
    CREATE INDEX IF NOT EXISTS idx_episodes_type ON episodes(type);
    CREATE INDEX IF NOT EXISTS idx_episode_steps_episode ON episode_steps(episode_id);
  `);

  // Migration: add decay columns (safe on existing DBs — ALTER TABLE ADD COLUMN is non-destructive)
  const cols = db.prepare('PRAGMA table_info(nodes)').all().map(c => c.name);
  if (!cols.includes('stability')) {
    db.exec('ALTER TABLE nodes ADD COLUMN stability REAL DEFAULT NULL');
  }
  if (!cols.includes('memory_level')) {
    db.exec('ALTER TABLE nodes ADD COLUMN memory_level INTEGER DEFAULT 1');
  }

  // FTS5 full-text index.
  //
  // trigram, not unicode61. unicode61 treats an unbroken run of CJK as one
  // token, so a document containing 「測試綠燈只證明斷言成立」 does not match a
  // query for 「測試綠燈」 -- only the entire run, verbatim. In practice Chinese
  // search returned nothing unless the user typed a complete run by accident.
  // trigram indexes every 3-character substring, which is what makes CJK
  // searchable at all.
  //
  // Consequence for callers: query terms must be at least 3 characters.
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS fts_nodes USING fts5(
      node_id UNINDEXED,
      name,
      content,
      tokenize='trigram'
    );
  `);

  rebuildFtsIfStale(db);

  // sqlite-vec vector index (1024 dim for Qwen3-Embedding-0.6B)
  // vec0 tables can't use IF NOT EXISTS, check manually
  const vecTableExists = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='vec_nodes'`
  ).get();

  if (!vecTableExists) {
    db.exec(`
      CREATE VIRTUAL TABLE vec_nodes USING vec0(
        node_id TEXT,
        embedding float[1024]
      );
    `);
  }

  return db;
}

/**
 * Rebuild fts_nodes when it was created with the old tokenizer.
 *
 * The index is derived from nodes, so dropping and refilling it loses
 * nothing. Only runs on a writable connection -- hooks open read-only, and
 * a stale index there degrades results rather than failing, which is the
 * right trade for a hook that must never block the user.
 */
export function rebuildFtsIfStale(handle) {
  const row = handle.prepare(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='fts_nodes'`
  ).get();
  if (!row || /trigram/.test(row.sql)) return false;

  handle.exec(`
    DROP TABLE fts_nodes;
    CREATE VIRTUAL TABLE fts_nodes USING fts5(
      node_id UNINDEXED,
      name,
      content,
      tokenize='trigram'
    );
    INSERT INTO fts_nodes (node_id, name, content)
      SELECT id, name, content FROM nodes;
  `);
  return true;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
