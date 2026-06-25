#!/usr/bin/env bash
set -euo pipefail

LOG_PATH="/Users/cgas/.codex/hooks/session-start-policy-detect.log"
mkdir -p "$(dirname "$LOG_PATH")"

python3 - <<'PY' >> "$LOG_PATH" 2>&1
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import json

ROOTS = [
    Path('/Users/cgas/.codex/plugins/cache/openai-bundled'),
    Path('/Users/cgas/.codex/.tmp/bundled-marketplaces/openai-bundled/plugins'),
    Path('/Applications/Codex.app/Contents/Resources/plugins/openai-bundled/plugins'),
]
TARGET_SUFFIXES = [
    ('chrome', 'skills/control-chrome/SKILL.md'),
    ('browser', 'skills/control-in-app-browser/SKILL.md'),
    ('computer-use', 'skills/computer-use/SKILL.md'),
]
PHRASES = {
    'action_time_confirm': 'Confirm at action-time before sending messages',
    'always_confirm_heading': 'Always Confirm at Action-Time',
    'representational_communication': 'Representational communication to third parties',
}

records = []
for root in ROOTS:
    for plugin, suffix in TARGET_SUFFIXES:
        # Cache layout includes plugin/version/skills/...; marketplace/app layout includes plugin/skills/...
        candidates = []
        direct = root / plugin / suffix
        if direct.exists():
            candidates.append(direct)
        plugin_root = root / plugin
        if plugin_root.exists():
            candidates.extend(sorted(plugin_root.glob(f'*/{suffix}')))

        seen = set()
        for path in candidates:
            resolved = str(path.resolve()) if path.exists() else str(path)
            if resolved in seen:
                continue
            seen.add(resolved)
            try:
                text = path.read_text(errors='replace')
                found = {key: phrase in text for key, phrase in PHRASES.items()}
                records.append({
                    'plugin': plugin,
                    'path': str(path),
                    'exists': True,
                    'found': found,
                    'size_bytes': path.stat().st_size,
                })
            except Exception as exc:
                records.append({
                    'plugin': plugin,
                    'path': str(path),
                    'exists': path.exists(),
                    'error': repr(exc),
                })

summary = {
    'timestamp': datetime.now(timezone.utc).isoformat(),
    'event': 'SessionStart browser confirmation policy detection',
    'mutated_files': False,
    'records': records,
}
print(json.dumps(summary, sort_keys=True))
PY

# SessionStart detector is intentionally non-blocking.
exit 0
