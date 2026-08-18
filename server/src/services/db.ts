import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(process.cwd(), 'data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'sop-compass.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT CHECK(role IN ('admin', 'user')) NOT NULL DEFAULT 'user',
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sop_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    version TEXT DEFAULT '1.0',
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    extracted_text TEXT,
    uploaded_by INTEGER REFERENCES users(id),
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS llm_settings (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    provider TEXT NOT NULL DEFAULT 'anthropic',
    api_key TEXT,
    model TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
    base_url TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS comparison_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    submitted_filename TEXT NOT NULL,
    submitted_filepath TEXT NOT NULL,
    submitted_text TEXT,
    sop_id INTEGER REFERENCES sop_documents(id),
    status TEXT CHECK(status IN ('pending', 'processing', 'complete', 'error')) DEFAULT 'pending',
    compliance_score INTEGER,
    summary TEXT,
    gap_analysis TEXT,
    recommendations TEXT,
    matched_sections TEXT,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
  );
`);

// Create user_properties table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS user_properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, property)
  );

  CREATE TABLE IF NOT EXISTS brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, brand_id)
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed default categories
const defaultCategories = ['HR', 'Finance', 'Operations', 'Legal', 'IT', 'Safety', 'Quality', 'Other'];
const insertCat = db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)');
for (const cat of defaultCategories) insertCat.run(cat);

// Migrations — add columns that didn't exist in the original schema
const reportCols = (db.prepare('PRAGMA table_info(comparison_reports)').all() as { name: string }[]).map(c => c.name);
if (!reportCols.includes('scheduled_at')) {
  db.prepare('ALTER TABLE comparison_reports ADD COLUMN scheduled_at DATETIME DEFAULT NULL').run();
}

const userCols = (db.prepare('PRAGMA table_info(users)').all() as { name: string }[]).map(c => c.name);
if (!userCols.includes('login')) {
  db.prepare('ALTER TABLE users ADD COLUMN login TEXT DEFAULT NULL').run();
}

const sopCols = (db.prepare('PRAGMA table_info(sop_documents)').all() as { name: string }[]).map(c => c.name);
if (!sopCols.includes('brand')) {
  db.prepare('ALTER TABLE sop_documents ADD COLUMN brand TEXT DEFAULT NULL').run();
}
if (!sopCols.includes('property')) {
  db.prepare('ALTER TABLE sop_documents ADD COLUMN property TEXT DEFAULT NULL').run();
}

// Seed default LLM settings row if absent
db.prepare(`
  INSERT OR IGNORE INTO llm_settings (id, provider, api_key, model)
  VALUES (1, 'anthropic', NULL, 'claude-sonnet-4-20250514')
`).run();

export default db;
