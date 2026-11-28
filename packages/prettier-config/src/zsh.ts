/*
 * A variant of the base config for repos with zsh scripts, which Prettier's
 * shell parser reads as bash unless told otherwise.
 */
import { LangVariant } from "sh-syntax";

import type { BaseConfig } from "./index.ts";

import CONFIG, { OVERRIDES, PLUGINS } from "./index.ts";

/**
 * Builds the base config plus an override that parses `files` as zsh.
 *
 * - The zsh override goes last, so it wins over the base's own, such as a git
 *   hook that's also listed in `files`.
 *
 * @example `createZshConfig({ files: ["bin/*", "lib/*.zsh"] })`
 * @returns a new config, whose arrays and zsh override the caller may change;
 *   the base's own overrides inside it stay frozen.
 */
export function createZshConfig({
  files,
}: {
  /** The globs to parse as zsh, as an override's `files` takes them. */
  files: readonly string[] | string;
}): BaseConfig {
  return {
    ...CONFIG,
    overrides: [
      ...OVERRIDES,
      {
        files: typeof files === "string" ? files : [...files],
        options: { parser: "sh", variant: LangVariant.LangZsh },
      },
    ],
    plugins: [...PLUGINS],
  };
}
