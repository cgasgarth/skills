# Codex idle compaction

A small Bun service that asks the running ChatGPT desktop app to compact idle
Codex tasks. All files are stored in `/Users/cgas/.codex/idle-compact/`.

## Behavior

- Checks local task databases read-only once per minute. Checks use no model tokens.
- Considers tasks completed within the last 24 hours, after installation.
- Requires more than 100,000 tokens in the latest request usage (input plus output),
  not cumulative task usage. Missing or unreadable usage is skipped.
- Compacts after 25 idle minutes, normally at 25–26 minutes. Skips after 29 minutes.
- Skips active, failed, interrupted, archived, and subagent tasks, queued work,
  and compaction-only turns. Records each attempt before sending; does not retry it.
- Starts at macOS login. ChatGPT must be running with the task loaded; hidden or
  minimized is fine. The service does not open the app or bring windows forward.
- Does not prevent or wake from sleep. ChatGPT's separate `prevent_idle_sleep`
  setting may prevent idle sleep while the app performs compaction.

Compaction uses model tokens; savings are not guaranteed. The desktop connection
uses a private interface that an app update can change. The final idle check and
compaction request are separate operations, so a new turn can start between them.

## Files

| File | Purpose |
| --- | --- |
| `policy.ts` | Timing values and eligibility rules |
| `service.ts` | Task checks and compaction requests |
| `usage.ts` | Latest request token count from the local task log |
| `ipc.ts` | Local connection to the desktop app |
| `com.cgas.codex-idle-compact.plist` | macOS startup definition |
| `state.json` | Installation time and previous attempts |
| `service.log`, `error.log` | Activity and errors |
| `idle-compact.test.ts` | Tests |

The startup file is linked from
`/Users/cgas/Library/LaunchAgents/com.cgas.codex-idle-compact.plist`.

## Commands

```sh
# Status and read-only connection check
launchctl print gui/$(id -u)/com.cgas.codex-idle-compact
bun /Users/cgas/.codex/idle-compact/service.ts --check

# Restart after changing code or timing values
launchctl kickstart -k gui/$(id -u)/com.cgas.codex-idle-compact

# Stop until the next login
launchctl bootout gui/$(id -u) /Users/cgas/Library/LaunchAgents/com.cgas.codex-idle-compact.plist

# Start again after stopping
launchctl bootstrap gui/$(id -u) /Users/cgas/Library/LaunchAgents/com.cgas.codex-idle-compact.plist
```

To disable future login starts, stop the service and remove the LaunchAgents link.

## Model settings

`../model-catalog.json` stores the per-model limits, including the GPT-6
700,000-token compaction limit. The local `config.toml` must contain
`model_catalog_json = "/Users/cgas/.codex/model-catalog.json"`. Restart the app
after changing the catalog. This catalog is a fixed snapshot; refresh it when
model definitions change.

Git excludes the live `config.toml` because it contains credentials. Logs and
`state.json` are also local. On a new installation, create `state.json` with
`{"enabledAt": <current Unix time in milliseconds>, "attempts": {}}` before
starting the service.
