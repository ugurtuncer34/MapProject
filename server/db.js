import initSqlJs from 'sql.js';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'geo-life.db');

let db;

export async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS Locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      city TEXT NOT NULL,
      country TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      visit_date TEXT NOT NULL,
      duration_days INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS Connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_location_id INTEGER NOT NULL,
      destination_location_id INTEGER NOT NULL,
      dates TEXT NOT NULL DEFAULT '[]',
      visit_dates TEXT NOT NULL DEFAULT '[]',
      FOREIGN KEY (source_location_id) REFERENCES Locations(id) ON DELETE CASCADE,
      FOREIGN KEY (destination_location_id) REFERENCES Locations(id) ON DELETE CASCADE
    )
  `);

  // Migration: add columns if missing
  try { db.run(`ALTER TABLE Connections ADD COLUMN dates TEXT NOT NULL DEFAULT '[]'`); } catch (_) {}
  try { db.run(`ALTER TABLE Connections ADD COLUMN visit_dates TEXT NOT NULL DEFAULT '[]'`); } catch (_) {}

  return db;
}

export function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data.buffer);
  writeFileSync(dbPath, buffer);
}

export default { getDb, saveDb };
