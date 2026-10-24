# dsh-minder-hooks

Capture-first hooks for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`): a record of what your AI agent does, on your machine, in a file you can read.

## The problem

An AI agent works by running things - editing files, starting processes,
reading your project. When the result is wrong, the question that matters
is "what exactly did it do?" In a plain dsh install, the honest answer is:
dig through session archives by hand. There is no simple, local,
machine-readable trail of hook events.

Wiring one yourself means learning dsh's hook phases, writing a command
that behaves inside dsh's file sandbox, and steering around a host quirk
where package entries silently fail to mount on some dsh versions.

## What this gives you

One install:

- every hook event - session start, tool calls, pre-tool checks -
  appended to a local JSONL file, with sensitive-looking values redacted
  before the line is written;
- capture that cannot break your session (the hook always exits 0 and
  never prints) and cannot leak (there is no network code in this
  package);
- automatic upgrade: when [minder](https://github.com/xyzzing/minder) is
  installed, the plugin mounts minder's full supervision hooks instead -
  failure spotting, escalation context, second-opinion budgets - with no
  plugin changes, and drops back to capture if minder goes away.

## Install

```sh
dsh plugin --profile <your-profile> add github:xyzzing/dsh-minder-hooks
```

The `dsh plugin` command installs the package into the profile; dsh
brings the layer in the next time the profile boots. Until the package
is on npm, this git form is the supported install.

To see capture working, run any task in that profile, then:

```sh
tail -3 ~/.local/state/dsh-minder-hooks/events.jsonl
```

## What is stored, exactly

One JSON object per line: a timestamp and the hook event dsh handed over
(tool name, input summary, session identifiers). Values under keys named
like `key`, `token`, `secret`, `password`, or `authorization` are
replaced with `[redacted]` before writing. The file rotates at 10 MiB
(one `.old` generation kept).

## Where events appear (and where they can't)

- In **headless** runs, the session-start hook fires; tool-phase hooks
  (PreToolUse / PostToolUse) do not - headless emits no agent events on
  this dsh line.
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

On some dsh versions (observed on 0.1.5-rc.2 with the web host), a
package entry carrying a cordis `inject` export can silently fail to
mount. If your sessions show no capture file, use the file-entry
fallback that ships in this package:

1. Copy `bridge-loader.mjs` into the profile directory (next to
   `cordis.patch.yml`).
2. In the profile's `cordis.patch.yml`, replace the plugin-name insert
   with:

```yaml
- insert:
    - name: ./bridge-loader.mjs
      config:
        defaultTimeoutMs: 600000
```

This is the same construction minder itself uses.

## Using it with minder

[minder](https://github.com/xyzzing/minder) is a supervisor for AI
assistants: it watches the work an assistant does, escalates retries on
evidence, budgets second opinions, and keeps an append-only record.
Installing minder upgrades this plugin from capture-only to full
supervision with no plugin changes. Removing minder drops the plugin
back to capture-only, automatically.

## License

MIT.
