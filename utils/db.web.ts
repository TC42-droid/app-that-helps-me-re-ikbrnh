// Web stub — expo-sqlite is not supported on web.
// All functions return safe empty values so the UI renders without crashing.

export interface WorkSession {
  id: string;
  date: string;
  start_time: string;
  end_time: string | null;
  notes: string;
  created_at: string;
}

export function initDB(): void {
  console.log('[DB] Web stub — SQLite not available on web');
}

export function clockIn(): string {
  console.log('[DB] Web stub — clockIn called');
  return '';
}

export function clockOut(_id: string): void {
  console.log('[DB] Web stub — clockOut called');
}

export function getActiveSession(): WorkSession | null {
  return null;
}

export function getTodaySessions(): WorkSession[] {
  return [];
}

export function getAllSessions(): WorkSession[] {
  return [];
}

export function getSessionById(_id: string): WorkSession | null {
  return null;
}

export function updateSessionNotes(_id: string, _notes: string): void {
  console.log('[DB] Web stub — updateSessionNotes called');
}

export function deleteSession(_id: string): void {
  console.log('[DB] Web stub — deleteSession called');
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
