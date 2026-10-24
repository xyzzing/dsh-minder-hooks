// minder-style file-entry fallback for hosts where a package entry carrying
// a cordis `inject` export silently never mounts (observed on dsh
// 0.1.5-rc.2 web host). Copy this file into the profile directory (next to
// cordis.patch.yml), then use a `name: ./bridge-loader.mjs` insert instead
// of the package-name insert. See README, "If the plugin does not mount".
import * as bridge from "@deepseek-ai/dsh-hooks-claude-code";
export const inject = bridge.inject;
export const Config = bridge.Config;
export const name = "dsh-minder-hooks-bridge";
export function apply(ctx, config) {
  return bridge.apply(ctx, config);
}
