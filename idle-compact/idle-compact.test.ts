import { test, expect } from 'bun:test';
import { createServer } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eligible, candidateSince, IDLE_MS, EXPIRE_MS, RECENT_MS, type Turn } from './policy';
import { DesktopIPC } from './ipc';

const ended = 1_800_000_000_000;
const turn: Turn = { thread_id: 'thread', turn_id: 'turn', status: 'completed', completed_at: ended / 1000, rollout_ordinal: 1, first_user_item_id: 'user' };
test('candidate scan is limited to the last 24 hours and never before installation', () => {
  expect(candidateSince(ended, ended - 2 * RECENT_MS)).toBe((ended - RECENT_MS) / 1000);
  expect(candidateSince(ended, ended - 60_000)).toBe((ended - 60_000) / 1000);
});
test('dispatch window starts at 25 minutes and closes before cache expiry', () => {
  expect(eligible(turn, ended + IDLE_MS - 1, ended, false, false)).toBe(false);
  expect(eligible(turn, ended + IDLE_MS, ended, false, false)).toBe(true);
  expect(eligible(turn, ended + EXPIRE_MS, ended, false, false)).toBe(false);
});
test('active, failed, queued, old and compaction-only turns are not eligible', () => {
  const now = ended + IDLE_MS;
  for (const status of ['inProgress', 'failed', 'interrupted']) expect(eligible({ ...turn, status }, now, ended, false, false)).toBe(false);
  expect(eligible(turn, now, ended, false, true)).toBe(false);
  expect(eligible(turn, now, ended + 1, false, false)).toBe(false);
  expect(eligible({ ...turn, first_user_item_id: null }, now, ended, false, false)).toBe(false);
});
test('persisted attempts prevent a second write after restart or a lost reply', () => {
  const saved = JSON.parse(JSON.stringify({ attempts: { 'thread:turn': { result: 'dispatching' } } }));
  expect(eligible(turn, ended + IDLE_MS, ended, !!saved.attempts['thread:turn'], false)).toBe(false);
  expect(eligible({ ...turn, turn_id: 'new-turn' }, ended + IDLE_MS, ended, !!saved.attempts['thread:new-turn'], false)).toBe(true);
});
test('desktop IPC routes compaction to the discovered owner and handles split frames', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'codex-idle-test-'));
  const path = join(dir, 'ipc.sock');
  const calls: any[] = [];
  const server = createServer(socket => {
    let buffer = Buffer.alloc(0);
    socket.on('data', data => {
      buffer = Buffer.concat([buffer, data]);
      while (buffer.length >= 4 && buffer.length >= buffer.readUInt32LE(0) + 4) {
        const size = buffer.readUInt32LE(0);
        const request = JSON.parse(buffer.subarray(4, size + 4).toString());
        buffer = buffer.subarray(size + 4);
        calls.push(request);
        const result = request.method === 'initialize' ? { clientId: 'timer' } : request.method === 'thread-owner-discovery' ? {} : { ok: true };
        const payload = Buffer.from(JSON.stringify({ type: 'response', requestId: request.requestId, resultType: 'success', handledByClientId: 'owner', result }));
        const frame = Buffer.alloc(4 + payload.length); frame.writeUInt32LE(payload.length); payload.copy(frame, 4);
        socket.write(frame.subarray(0, 2)); socket.write(frame.subarray(2));
      }
    });
  });
  await new Promise<void>(resolve => server.listen(path, resolve));
  const ipc = new DesktopIPC();
  try {
    await ipc.connect(path);
    await ipc.compact('thread', await ipc.owner('thread'));
    expect(calls.map(call => call.method)).toEqual(['initialize', 'thread-owner-discovery', 'thread-follower-compact-thread']);
    expect(calls[2].targetClientId).toBe('owner');
    expect(calls[2].params).toEqual({ conversationId: 'thread' });
    expect(calls[2].version).toBe(1);
  } finally {
    ipc.close();
    await new Promise<void>(resolve => server.close(() => resolve()));
    rmSync(dir, { recursive: true });
  }
});

test('context threshold uses latest request and skips unknown usage', async () => {
  const { contextAboveMinimum } = await import('./usage');
  const dir = mkdtempSync(join(tmpdir(), 'codex-usage-test-'));
  const path = join(dir, 'rollout.jsonl');
  const event = (tokens: number) => JSON.stringify({ type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { total_tokens: 900_000 }, last_token_usage: { total_tokens: tokens } } } });
  try {
    for (const tokens of [100, 45_000, 45_001]) {
      await Bun.write(path, event(80_000) + '\n' + event(tokens) + '\n');
      expect(await contextAboveMinimum(path)).toBe(tokens > 45_000);
    }
    await Bun.write(path, '{}\n');
    expect(await contextAboveMinimum(path)).toBe(false);
    await Bun.write(path, 'incomplete');
    expect(await contextAboveMinimum(path)).toBe(false);
    expect(await contextAboveMinimum(join(dir, 'missing'))).toBe(false);
  } finally { rmSync(dir, { recursive: true }); }
});
