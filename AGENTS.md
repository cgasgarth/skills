# Global Codex Instructions

- Keep routine command, script, hook, poll, and validation output token-efficient by default. On success, prefer a compact summary over full logs, full JSON, long file lists, repeated green status, or unchanged state dumps.
- On failure, surface bounded actionable detail: the failing step, a short error excerpt, and the next action or blocker. Do not dump full logs unless they are needed to make the next decision.
- For repeated noisy commands, prefer compact wrappers or summary modes so unchanged success output stays small.
- Do not repeat unchanged status summaries in thread updates. Only restate command or CI state when it changed, unblocked work, proved a fix, or exposed a blocker.
- Use `ast-grep` (`sg`) for syntax-aware code searches and structural rewrites. Prefer `rg` for plain text, filenames, and quick literal discovery; use `sg --lang <language> -p '<pattern>'` when the query depends on code structure.
