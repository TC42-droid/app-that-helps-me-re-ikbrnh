import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

function getDB(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('clockin.db');
  }
  return db;
}

export interface WorkSession {
  id: string;
  date: string;
  start_time: string;
  end_time: string | null;
  notes: string;
  created_at: string;
}

function generateId(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15) +
    Date.now().toString(36)
  );
}

export function initDB(): void {
  console.log('[DB] Initializing database...');
  const database = getDB();
  database.execSync(`
    CREATE TABLE IF NOT EXISTS work_sessions (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );
  `);
  console.log('[DB] Database initialized successfully');
}

export function clockIn(): string {
  const database = getDB();
  const id = generateId();
  const now = new Date().toISOString();
  const date = now.split('T')[0];
  console.log('[DB] Clocking in — id:', id, 'at:', now);
  database.runSync(
    'INSERT INTO work_sessions (id, date, start_time, end_time, notes, created_at) VALUES (?, ?, ?, NULL, ?, ?)',
    [id, date, now, '', now]
  );
  console.log('[DB] Clock in recorded successfully');
  return id;
}

export function clockOut(id: string): void {
  const database = getDB();
  const now = new Date().toISOString();
  console.log('[DB] Clocking out — id:', id, 'at:', now);
  database.runSync(
    'UPDATE work_sessions SET end_time = ? WHERE id = ?',
    [now, id]
  );
  console.log('[DB] Clock out recorded successfully');
}

export function getActiveSession(): WorkSession | null {
  const database = getDB();
  const result = database.getFirstSync<WorkSession>(
    'SELECT * FROM work_sessions WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 1'
  );
  console.log('[DB] Active session:', result ? result.id : 'none');
  return result ?? null;
}

export function getTodaySessions(): WorkSession[] {
  const database = getDB();
  const today = new Date().toISOString().split('T')[0];
  const results = database.getAllSync<WorkSession>(
    'SELECT * FROM work_sessions WHERE date = ? ORDER BY start_time ASC',
    [today]
  );
  console.log('[DB] Today sessions count:', results.length);
  return results;
}

export function getAllSessions(): WorkSession[] {
  const database = getDB();
  const results = database.getAllSync<WorkSession>(
    'SELECT * FROM work_sessions ORDER BY start_time DESC'
  );
  console.log('[DB] All sessions count:', results.length);
  return results;
}

export function getSessionById(id: string): WorkSession | null {
  const database = getDB();
  const result = database.getFirstSync<WorkSession>(
    'SELECT * FROM work_sessions WHERE id = ?',
    [id]
  );
  console.log('[DB] Get session by id:', id, '— found:', !!result);
  return result ?? null;
}

export function updateSessionNotes(id: string, notes: string): void {
  const database = getDB();
  console.log('[DB] Updating notes for session:', id);
  database.runSync(
    'UPDATE work_sessions SET notes = ? WHERE id = ?',
    [notes, id]
  );
  console.log('[DB] Notes updated successfully');
}

export function deleteSession(id: string): void {
  const database = getDB();
  console.log('[DB] Deleting session:', id);
  database.runSync('DELETE FROM work_sessions WHERE id = ?', [id]);
  console.log('[DB] Session deleted successfully');
}

export function computeDurationMinutes(start: string, end: string | null): number {
  if (!end) return 0;
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  return Math.max(0, Math.floor((endMs - startMs) / 60000));
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(isoDate: string): string {
  const date = new Date(isoDate + 'T00:00:00');
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}
