export const IDLE_MS = 25 * 60_000;
export const EXPIRE_MS = 29 * 60_000;
export const RECENT_MS = 24 * 60 * 60_000;
export const POLL_MS = 60_000;
export function candidateSince(now: number, enabledAt: number) {
  return Math.floor(Math.max(enabledAt, now - RECENT_MS) / 1000);
}
export type Turn = { thread_id: string; turn_id: string; status: string; completed_at: number | null; rollout_ordinal: number; first_user_item_id: string | null };
export function eligible(turn: Turn, now: number, enabledAt: number, attempted: boolean, queued: boolean) {
  if (attempted || queued || turn.status !== 'completed' || !turn.completed_at || !turn.first_user_item_id) return false;
  const completed = turn.completed_at * 1000;
  return completed >= enabledAt && now - completed >= IDLE_MS && now - completed < EXPIRE_MS;
}
