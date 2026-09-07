import { createConnection, type Socket } from 'node:net';
import { randomUUID } from 'node:crypto';

// Desktop IPC, verified against ChatGPT's bundled IpcClient and follower handler.
// This is a private protocol: unknown versions/errors fail without a retrying write.
export class DesktopIPC {
  socket!: Socket;
  clientId = 'initializing-client';
  buffer = Buffer.alloc(0);
  pending = new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  async connect(path: string) {
    this.socket = createConnection(path);
    this.socket.on('data', chunk => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      while (this.buffer.length >= 4) {
        const size = this.buffer.readUInt32LE(0);
        if (size > 256 * 1024 * 1024) { this.close(); return; }
        if (this.buffer.length < size + 4) return;
        const data = this.buffer.subarray(4, size + 4);
        this.buffer = this.buffer.subarray(size + 4);
        try {
          const message = JSON.parse(data.toString());
          if (message.type !== 'response') continue;
          const pending = this.pending.get(message.requestId);
          if (!pending) continue;
          clearTimeout(pending.timer);
          this.pending.delete(message.requestId);
          if (message.resultType === 'success') pending.resolve(message);
          else pending.reject(new Error(message.error || 'IPC request failed'));
        } catch { this.close(); }
      }
    });
    this.socket.on('error', error => this.rejectPending(error));
    this.socket.on('close', () => this.rejectPending(new Error('IPC connection closed')));
    await new Promise<void>((resolve, reject) => {
      this.socket.once('connect', resolve);
      this.socket.once('error', reject);
    });
    const response = await this.request('initialize', { clientType: 'idle-compact' }, 0);
    this.clientId = response.result.clientId;
  }
  request(method: string, params: unknown, version = 1, targetClientId?: string): Promise<any> {
    const requestId = randomUUID();
    const payload = Buffer.from(JSON.stringify({ type: 'request', requestId, sourceClientId: this.clientId, method, params, version, targetClientId, timeoutMs: 5000 }));
    const frame = Buffer.alloc(4 + payload.length);
    frame.writeUInt32LE(payload.length); payload.copy(frame, 4);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(requestId); reject(new Error('IPC timeout')); }, 6000);
      this.pending.set(requestId, { resolve, reject, timer });
      this.socket.write(frame);
    });
  }
  async owner(threadId: string) {
    const response = await this.request('thread-owner-discovery', { hostId: 'local', conversationId: threadId });
    return response.handledByClientId as string;
  }
  async compact(threadId: string, owner: string) {
    const response = await this.request('thread-follower-compact-thread', { conversationId: threadId }, 1, owner);
    if (response.result?.ok !== true) throw new Error('Compaction was not acknowledged');
  }
  rejectPending(error: Error) {
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error); }
    this.pending.clear();
  }
  close() { this.socket?.destroy(); this.rejectPending(new Error('IPC closed')); }
}
