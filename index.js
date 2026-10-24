/**
 * dsh-minder-hooks: capture-first hooks bridge for the DeepSeek Harness.
 *
 * Mounts the @deepseek-ai/dsh-hooks-claude-code bridge against a hooks.json
 * chosen at load time:
 * - an explicit configPath in the plugin config always wins;
 * - mode "minder" forces minder's hooks.json (full supervision: escalation,
 *   second opinions, memory) — requires minder to be installed;
 * - mode "capture" forces the bundled capture-only hooks;
 * - mode "auto" (default) uses minder's hooks when minder is installed and
 *   capture-only otherwise, so the plugin never breaks on a machine that
 *   does not have minder.
 *
 * Capture-only means: every hook event is appended, redacted, to a local
 * JSONL file under ~/.local/state/dsh-minder-hooks/. Nothing is sent
 * anywhere; there is no network code in this package.
 *
 * Known host quirk (observed on dsh 0.1.5-rc.2): package entries carrying a
 * cordis `inject` export can silently never mount in the web host. minder
 * works around this with a file-entry loader next to cordis.patch.yml. This
 * package ships bridge-loader.mjs for users who hit the same bug; see the
 * README's "If the plugin does not mount" section.
 *
 * @module dsh-minder-hooks
 */
import * as bridge from "@deepseek-ai/dsh-hooks-claude-code";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import z from "@deepseek-ai/schemastery";

const here = path.dirname(fileURLToPath(import.meta.url));
export const STATE_DIR = path.join(
  os.homedir(),
  ".local",
  "state",
  "dsh-minder-hooks",
);
const MINDER_HOOKS = path.join(
  os.homedir(),
  ".local",
  "share",
  "minder",
  "dsh",
  "hooks.json",
);

export const name = "dsh-minder-hooks";
export const inject = bridge.inject;

export const Config = z.object({
  mode: z.union(["auto", "capture", "minder"]).default("auto")
    .description(
      "auto: full minder hooks when minder is installed, capture-only "
      + "otherwise; capture and minder force one path",
    ),
  configPath: z.string().hidden()
    .description("explicit hooks.json override; wins over mode"),
  defaultTimeoutMs: z.number().default(600000),
});

function renderCaptureHooks() {
  const template = JSON.parse(
    fs.readFileSync(path.join(here, "hooks-capture.template.json"), "utf8"),
  );
  const script = path.join(here, "capture_hook.py");
  const rendered = JSON.parse(
    JSON.stringify(template).replaceAll("__CAPTURE_SCRIPT__", script),
  );
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const out = path.join(STATE_DIR, "hooks.json");
  const tmp = out + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(rendered, null, 2) + "\n", {
    mode: 0o600,
  });
  fs.renameSync(tmp, out);
  return out;
}

function resolveConfigPath(config) {
  if (config.configPath) return config.configPath;
  const mode = config.mode ?? "auto";
  if (mode === "minder") return MINDER_HOOKS;
  if (mode === "capture") return renderCaptureHooks();
  return fs.existsSync(MINDER_HOOKS) ? MINDER_HOOKS : renderCaptureHooks();
}

export function apply(ctx, config) {
  return bridge.apply(ctx, {
    configPath: resolveConfigPath(config),
    defaultTimeoutMs: config.defaultTimeoutMs ?? 600000,
  });
}
