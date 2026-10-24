#!/usr/bin/env python3
"""dsh-minder-hooks capture hook: append one hook event to a local JSONL file.

Contract: dsh runs this with the hook event JSON on stdin. The event is
redacted (values under key/token/secret/password/authorization-named keys
are dropped), appended to ~/.local/state/dsh-minder-hooks/events.jsonl
(override with DSH_MINDER_HOOKS_DIR), and the process exits 0. Every
failure mode is swallowed: capture must never break the session it
watches. Nothing leaves the machine; there is no network code here.

Rotation: when events.jsonl passes 10 MiB it is renamed to events.jsonl.old
(one generation kept). stdout stays empty so the harness never treats this
hook as advice.
"""
import json
import os
import re
import sys
import time

STATE_DIR = os.environ.get("DSH_MINDER_HOOKS_DIR") or os.path.join(
    os.path.expanduser("~"), ".local", "state", "dsh-minder-hooks"
)
# dsh runs tool-phase hooks inside its file sandbox, where only the session
# workspace (the hook process's cwd) is writable. When the state dir is not
# writable we fall back to a file in the workspace so sandboxed events are
# still captured locally rather than lost to a swallowed EROFS.
WORKSPACE_FALLBACK = "dsh-minder-hooks.jsonl"
MAX_BYTES = 10 * 1024 * 1024
SENSITIVE_KEY = re.compile(r"key|token|secret|password|authorization", re.I)
REDACTED = "[redacted]"


def redact(value):
    if isinstance(value, dict):
        return {
            k: (REDACTED if SENSITIVE_KEY.search(str(k)) else redact(v))
            for k, v in value.items()
        }
    if isinstance(value, list):
        return [redact(item) for item in value]
    return value


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0
    record = {
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "event": redact(payload),
    }
    line = json.dumps(record, ensure_ascii=True) + "\n"
    for target in _targets():
        try:
            out = os.path.join(target, "events.jsonl")
            if os.path.exists(out) and os.path.getsize(out) > MAX_BYTES:
                os.replace(out, out + ".old")
            with open(out, "a", encoding="utf-8") as handle:
                handle.write(line)
            return 0
        except OSError:
            continue
    return 0


def _targets():
    try:
        os.makedirs(STATE_DIR, exist_ok=True)
        return [STATE_DIR, os.getcwd()]
    except OSError:
        return [os.getcwd()]


if __name__ == "__main__":
    sys.exit(main())
