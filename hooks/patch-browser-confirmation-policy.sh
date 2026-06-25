#!/usr/bin/env bash
set -euo pipefail

LOG_PATH="/Users/cgas/.codex/hooks/session-start-policy-detect.log"
mkdir -p "$(dirname "$LOG_PATH")"

python3 - <<'PY' >> "$LOG_PATH" 2>&1
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import json, re, sys

ROOTS = [
    Path('/Users/cgas/.codex/plugins/cache/openai-bundled'),
    Path('/Users/cgas/.codex/.tmp/bundled-marketplaces/openai-bundled/plugins'),
]
TARGET_SUFFIXES = [
    ('chrome', 'skills/control-chrome/SKILL.md'),
    ('browser', 'skills/control-in-app-browser/SKILL.md'),
    ('computer-use', 'skills/computer-use/SKILL.md'),
]

DESCRIPTION_LINE = 'Blocking confirmation required immediately before the action.'
DESCRIPTION_NEW = 'Blocking confirmation required immediately before the action, unless the user has explicitly approved an ongoing communication or messaging task (see User-Approved Ongoing Tasks below).'

HEADING_CB = '#### 2) Always Confirm at Action-Time (Even If Pre-Approved)'
HEADING_CB_NEW = '#### 2) Always Confirm at Action-Time (Even If Pre-Approved) \u2014 with User-Approved Ongoing Task Exception'

HEADING_CU = '### 2) Always Confirm at Action-Time (Even If Pre-Approved)'
HEADING_CU_NEW = '### 2) Always Confirm at Action-Time (Even If Pre-Approved) \u2014 with User-Approved Ongoing Task Exception'

ITEM_9_END = '''  - edit appointments/reservations (cancel/delete handled under deletion)
- **[10]'''

ITEM_9_EXCEPTION = '''  - edit appointments/reservations (cancel/delete handled under deletion)
  - **User-approved ongoing task exception:** If the user explicitly approved an ongoing messaging/communication task to a specific party, further messages within that approved scope do not require re-confirmation (see User-Approved Ongoing Tasks below).
- **[10]'''

USER_APPROVED_SECTION_CB = '''

### User-Approved Ongoing Tasks

If the user explicitly approves an ongoing task that involves communicating with a specific third party (e.g., "continue chatting with support", "keep messaging this person", "reply to all emails from X"), you may continue sending messages within that approved scope without asking for approval before each individual message. A new approval or re-confirmation is required only if:

- The conversation materially changes scope or topic
- A new third party is involved
- The message includes sensitive or private information not previously approved
- The action involves purchases, payments, or financial transactions
- The action changes permissions or access settings
- The action uploads personal files or deletes nontrivial data
- The action installs software or browser extensions
- The action saves passwords or payment methods
- Any other action introduces material new risk beyond the originally approved scope

This exception applies to item **[9]** (Representational communication to third parties) in the Always Confirm section above.
'''

# For Computer Use, use #### sub-heading level under ## section
USER_APPROVED_SECTION_CU = '''

#### User-Approved Ongoing Tasks

If the user explicitly approves an ongoing task that involves communicating with a specific third party (e.g., "continue chatting with support", "keep messaging this person", "reply to all emails from X"), you may continue sending messages within that approved scope without asking for approval before each individual message. A new approval or re-confirmation is required only if:

- The conversation materially changes scope or topic
- A new third party is involved
- The message includes sensitive or private information not previously approved
- The action involves purchases, payments, or financial transactions
- The action changes permissions or access settings
- The action uploads personal files or deletes nontrivial data
- The action installs software or browser extensions
- The action saves passwords or payment methods
- Any other action introduces material new risk beyond the originally approved scope

This exception applies to item **[9]** (Representational communication to third parties) in the Always Confirm section above.
'''

HYGIENE_CB_SEP = '\n\n---\n\n### Browser Use Confirmation Hygiene\n'
HYGIENE_CU_SEP = '\n\n---\n\n## Computer Use Confirmation Hygiene\n'


def patch_file(path: Path) -> dict:
    result = {'path': str(path), 'patched': False, 'changes': []}

    if not path.exists():
        result['error'] = 'file not found'
        return result

    original = path.read_text(errors='replace')
    text = original

    is_cu = 'computer-use' in str(path)

    if is_cu:
        if HEADING_CU in text:
            if HEADING_CU_NEW not in text:
                text = text.replace(HEADING_CU, HEADING_CU_NEW)
                result['changes'].append('heading')
        # Also patch the CU-level heading for description
    else:
        if HEADING_CB in text and HEADING_CB_NEW not in text:
            text = text.replace(HEADING_CB, HEADING_CB_NEW)
            result['changes'].append('heading')

    # 2. Description line (replace first occurrence)
    if DESCRIPTION_LINE in text and 'unless the user has explicitly approved' not in text:
        text = text.replace(DESCRIPTION_LINE, DESCRIPTION_NEW, 1)
        result['changes'].append('description')

    # 3. Item [9] exception
    if ITEM_9_END in text and 'User-approved ongoing task exception' not in text:
        text = text.replace(ITEM_9_END, ITEM_9_EXCEPTION)
        result['changes'].append('item_9_exception')

    # 4. User-Approved section
    if is_cu:
        if HYGIENE_CU_SEP in text and '#### User-Approved Ongoing Tasks' not in text:
            text = text.replace(HYGIENE_CU_SEP, USER_APPROVED_SECTION_CU + '\n\n---\n\n## Computer Use Confirmation Hygiene\n')
            result['changes'].append('user_approved_section')
    else:
        if HYGIENE_CB_SEP in text and '### User-Approved Ongoing Tasks' not in text:
            text = text.replace(HYGIENE_CB_SEP, USER_APPROVED_SECTION_CB + '\n\n---\n\n### Browser Use Confirmation Hygiene\n')
            result['changes'].append('user_approved_section')

    if text == original:
        result['patched'] = False
        if not result['changes']:
            result['status'] = 'already_patched_or_no_match'
    else:
        path.write_text(text)
        result['patched'] = True
        result['status'] = 'patched'

    return result


records = []
for root in ROOTS:
    for plugin, suffix in TARGET_SUFFIXES:
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
            records.append(patch_file(path))

summary = {
    'timestamp': datetime.now(timezone.utc).isoformat(),
    'event': 'SessionStart browser confirmation policy patch',
    'mutated_files': any(r.get('patched') for r in records),
    'records': records,
}
print(json.dumps(summary, sort_keys=True))
PY

exit 0
