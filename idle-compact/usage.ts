import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

export const MIN_CONTEXT_TOKENS = 100_000;

// Use the latest request size, not cumulative usage across the task.
export async function contextAboveMinimum(path: string): Promise<boolean> {
  let tokens: unknown;
  const lines = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      const event = JSON.parse(line);
      if (event.type === 'event_msg' && event.payload?.type === 'token_count') {
        tokens = event.payload.info?.last_token_usage?.total_tokens;
      }
    }
  } catch {
    return false;
  } finally {
    lines.close();
  }
  return typeof tokens === 'number' && Number.isFinite(tokens) && tokens > MIN_CONTEXT_TOKENS;
}
