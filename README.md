# dsh-minder-hooks

A capture-first hooks bridge for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`). It records what your dsh assistant does - every session start, tool call, and pre-tool check - to a local JSONL file on your own machine, and it runs the full [minder](https://github.com/xyzzing/minder) supervision hooks when minder is installed.

Nothing is sent anywhere. There is no network code in this package.

## What you get

| Without minder installed | With minder installed |
|---|---|
| Every hook event appended, redacted, to `~/.local/state/dsh-minder-hooks/events.jsonl` | minder's full hook set: failure spotting, escalation context, second-opinion budgets - plus minder's own evidence store |

The plugin picks this automatically (mode `auto`): if it finds minder's hook config at `~/.local/share/minder/dsh/hooks.json`, it mounts minder's hooks; otherwise it mounts capture-only hooks. You can force either with the `configPath` option in the profile patch.

## Install

```sh
dsh plugin --profile <your-profile> add dsh-minder-hooks
```

Until the package is on npm, install from this repository instead:

```sh
dsh plugin --profile <your-profile> add github:xyzzing/dsh-minder-hooks
```

The `dsh plugin` command installs the package into the profile and adds it to the profile's bundle list. Uninstall by removing the bundle from the profile's package.json and running `pnpm remove dsh-minder-hooks` in the profile directory (or by removing the plugin directory's entry the same way you added it).

To see the capture working, run any task in that profile and then look at the store:

```sh
tail -3 ~/.local/state/dsh-minder-hooks/events.jsonl
```

## What is stored, exactly

One JSON object per line: a timestamp and the hook event dsh handed over (tool name, input summary, session identifiers). Values under keys named like `key`, `token`, `secret`, `password`, or `authorization` are replaced with `[redacted]` before the line is written. The file rotates at 10 MiB (one `.old` generation kept). The capture hook always exits 0 and never prints: a broken capture must never break the session it watches, and empty stdout means the harness never mistakes capture for advice.

## Where events appear (and where they can't)

- In **headless** runs (`dsh --profile X "task"`), the session-start hook
  fires; tool-phase hooks (PreToolUse / PostToolUse) do not - headless
  emits no agent events on this dsh line.
- On the **web host**, all three hook phases fire. This is the same
  contract minder's own hooks run in production.
- Tool-phase hooks run inside dsh's file sandbox, where only the session
  workspace is writable. When the state directory is not writable from a
  hook, events land in `dsh-minder-hooks.jsonl` in the session workspace
  instead of being lost.
- The hook process environment is dsh-controlled: per-hook environment
  variables do not propagate. To relocate the store, edit the rendered
  `hooks.json` in the state directory.

## If the plugin does not mount

On some dsh versions (observed on 0.1.5-rc.2 with the web host), a package entry carrying a cordis `inject` export can silently fail to mount. If your sessions show no capture file, use the file-entry fallback that ships in this package:

1. Copy `bridge-loader.mjs` into the profile directory (next to `cordis.patch.yml`).
2. In the profile's `cordis.patch.yml`, replace the plugin-name insert with:

```yaml
- insert:
    - name: ./bridge-loader.mjs
      config:
        defaultTimeoutMs: 600000
```

This is the same construction minder itself uses.

## Using it with minder

minder (https://github.com/xyzzing/minder) is a supervisor for AI assistants: it watches the work an assistant does, escalates retries on evidence, budgets second opinions, and keeps an append-only record. Installing minder upgrades this plugin from capture-only to full supervision with no plugin changes - the plugin detects minder's hook config and mounts it. Removing minder drops the plugin back to capture-only, automatically.

## License

MIT.
