// Web in-memory implementation — expo-sqlite is not available on web.
// Data is stored in a module-level array and resets on page refresh.

export interface WorkSession {
  id: string;
  date: string;
  start_time: string;
  end_time: string | null;
  notes: string;
  created_at: string;
}

const sessions: WorkSession[] = [];

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

export function initDB(): void {
  console.log('[DB] Web in-memory store ready');
}

export function clockIn(): string {
  const id = generateId();
  const now = new Date();
  const startTime = now.toISOString();
  const date = now.toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
  const session: WorkSession = {
    id,
    date,
    start_time: startTime,
    end_time: null,
    notes: '',
    created_at: startTime,
  };
  sessions.push(session);
  console.log('[DB] Clock in recorded — id:', id, 'at:', startTime);
  return id;
}

export function clockOut(id: string): void {
  const now = new Date().toISOString();
  const session = sessions.find((s) => s.id === id);
  if (session) {
    session.end_time = now;
    console.log('[DB] Clock out recorded — id:', id, 'at:', now);
  } else {
    console.warn('[DB] clockOut: session not found — id:', id);
  }
}

export function getActiveSession(): WorkSession | null {
  const active = sessions.find((s) => s.end_time === null) ?? null;
  console.log('[DB] Active session:', active ? active.id : 'none');
  return active;
}

export function getTodaySessions(): WorkSession[] {
  const today = new Date().toLocaleDateString('en-CA');
  const results = sessions.filter((s) => s.date === today);
  console.log('[DB] Today sessions count:', results.length);
  return [...results].sort((a, b) => a.start_time.localeCompare(b.start_time));
}

export function getWeeklySessions(): WorkSession[] {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const results = sessions.filter(
    (s) => new Date(s.start_time).getTime() >= sevenDaysAgo
  );
  console.log('[DB] Weekly sessions count:', results.length);
  return [...results].sort((a, b) => b.start_time.localeCompare(a.start_time));
}

export function getAllSessions(): WorkSession[] {
  console.log('[DB] All sessions count:', sessions.length);
  return [...sessions].sort((a, b) => b.start_time.localeCompare(a.start_time));
}

export function getSessionById(id: string): WorkSession | null {
  const result = sessions.find((s) => s.id === id) ?? null;
  console.log('[DB] Get session by id:', id, '— found:', !!result);
  return result;
}

export function updateSessionNotes(id: string, notes: string): void {
  const session = sessions.find((s) => s.id === id);
  if (session) {
    session.notes = notes;
    console.log('[DB] Notes updated for session:', id);
  } else {
    console.warn('[DB] updateSessionNotes: session not found — id:', id);
  }
}

export function deleteSession(id: string): void {
  const index = sessions.findIndex((s) => s.id === id);
  if (index !== -1) {
    sessions.splice(index, 1);
    console.log('[DB] Session deleted:', id);
  } else {
    console.warn('[DB] deleteSession: session not found — id:', id);
  }
}

export function computeDurationMinutes(start: string, end: string | null): number {
  if (!end) return 0;
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  return Math.max(0, Math.floor((endMs - startMs) / 60000));
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
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
