import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { renameSync } from 'node:fs';
import { contextAboveMinimum } from "./usage";
import { DesktopIPC } from './ipc';
import { eligible, candidateSince, POLL_MS, type Turn } from './policy';

const base = '/Users/cgas/.codex';
const statePath = join(base, 'idle-compact/state.json');
type State = { enabledAt: number; attempts: Record<string, { at: number; result: string }> };
const state: State = await Bun.file(statePath).json();
const history = new Database(join(base, 'thread_history_1.sqlite'), { readonly: true });
const threads = new Database(join(base, 'state_5.sqlite'), { readonly: true });
const queue = new Database(join(base, 'queue_1.sqlite'), { readonly: true });
const latest = history.query<Turn, [string]>('SELECT thread_id, turn_id, status, completed_at, rollout_ordinal, first_user_item_id FROM thread_turns WHERE thread_id = ? ORDER BY rollout_ordinal DESC LIMIT 1');
const candidates = history.query<{ thread_id: string }, [number]>('SELECT DISTINCT thread_id FROM thread_turns WHERE completed_at >= ?');
const threadInfo = threads.query<{ archived: number; source: string; agent_path: string | null; rollout_path: string }, [string]>('SELECT archived, source, agent_path, rollout_path FROM threads WHERE id = ?');
const queued = queue.query<{ n: number }, [string]>('SELECT count(*) AS n FROM queued_items WHERE thread_id = ?');
const key = (turn: Turn) => `${turn.thread_id}:${turn.turn_id}`;
function canCompact(turn: Turn | null): turn is Turn {
  if (!turn) return false;
  const info = threadInfo.get(turn.thread_id);
  if (!info || info.archived || info.agent_path && info.agent_path !== '/root' || /subagent/i.test(info.source)) return false;
  return eligible(turn, Date.now(), state.enabledAt, !!state.attempts[key(turn)], !!queued.get(turn.thread_id)?.n);
}
async function save() {
  await Bun.write(statePath + '.tmp', JSON.stringify(state, null, 2) + '\n');
  renameSync(statePath + '.tmp', statePath);
}
function log(message: string) { console.log(`${new Date().toISOString()} ${message}`); }
async function tick(dryRun = false) {
  let ipc: DesktopIPC | undefined;
  try {
    for (const { thread_id } of candidates.all(candidateSince(Date.now(), state.enabledAt))) {
      const turn = latest.get(thread_id);
      if (!canCompact(turn)) continue;
      if (!await contextAboveMinimum(threadInfo.get(thread_id)!.rollout_path)) continue;
      if (dryRun) { log(`eligible ${thread_id}`); continue; }
      if (!ipc) { ipc = new DesktopIPC(); await ipc.connect(join(base, 'ipc/ipc.sock')); }
      let owner: string;
      try { owner = await ipc.owner(thread_id); } catch { continue; } // No live owner: do not resume or start a task.
      const fresh = latest.get(thread_id);
      if (!canCompact(fresh) || fresh.turn_id !== turn.turn_id) continue;
      if (!await contextAboveMinimum(threadInfo.get(thread_id)!.rollout_path)) continue;
      // Persist before dispatch. An uncertain result must never send a second write.
      state.attempts[key(turn)] = { at: Date.now(), result: 'dispatching' };
      await save();
      try {
        await ipc.compact(thread_id, owner);
        state.attempts[key(turn)].result = 'accepted';
        log(`compaction accepted ${thread_id}`);
      } catch (error) {
        state.attempts[key(turn)].result = `failed: ${String(error)}`;
        log(`compaction failed ${thread_id}: ${String(error)}`);
      }
      await save();
    }
  } finally { ipc?.close(); }
}
if (process.argv.includes('--check')) {
  await tick(true);
  const ipc = new DesktopIPC();
  try {
    await ipc.connect(join(base, 'ipc/ipc.sock'));
    const thread = process.argv[process.argv.indexOf('--check') + 1];
    if (thread) log(`owner found ${await ipc.owner(thread)}`);
    log('database and desktop IPC checks passed; no compaction sent');
  } finally { ipc.close(); }
} else {
  log('started; idle=25m, dispatch cutoff=29m, recent=24h, poll=60s, context>45000');
  let lastError = '';
  while (true) {
    try { await tick(); lastError = ''; }
    catch (error) { const message = String(error); if (message !== lastError) log(message); lastError = message; }
    await Bun.sleep(POLL_MS);
  }
}
