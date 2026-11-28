/*
 * The kit's base Prettier config, which a repo re-exports from its own
 * `prettier.config.ts`.
 *
 * - Plugins are imported modules, not names: Prettier resolves a name from
 *   the consumer's folder, where pnpm's strict `node_modules` hides this
 *   package's own dependencies.
 *
 * - jj-kit loads this file itself under Node's type stripping, so it uses
 *   only erasable syntax and `.ts` import specifiers; consumers load the
 *   built `dist/`, since Node won't strip types under `node_modules`.
 */
import type { Config } from "prettier";

import * as SH_PLUGIN from "prettier-plugin-sh";

/**
 * A Prettier config whose `overrides` and `plugins` are always set.
 *
 * - So a consumer can spread both into its own config with no `?? []`.
 */
export type BaseConfig = {
  /** The per-file overrides, in order; a later match wins. */
  overrides: Override[];

  /**
   * The plugins: the base's own are imported modules, and a consumer may add
   * names of plugins it installs itself.
   */
  plugins: PluginEntry[];
} & Config;

/** One entry of a Prettier config's `overrides`. */
export type Override = NonNullable<Config["overrides"]>[number];

/** One entry of a Prettier config's `plugins`: a module, a name or a URL. */
export type PluginEntry = NonNullable<Config["plugins"]>[number];

/**
 * The file extensions Prettier 3 parses as JSONC, the one JSON parser that
 * honors `trailingComma`.
 *
 * - Plain `.json` files, `tsconfig.json` included, go to the `json` parser,
 *   which never prints trailing commas, so they need no entry.
 *
 * - Frozen with its override.
 *
 * - A test checks this list against Prettier's own `getSupportInfo()`, so a
 *   Prettier release that adds one fails it.
 */
const JSONC_FILES: string[] = [
  "*.code-snippets",
  "*.code-workspace",
  "*.hujson",
  "*.jsonc",
  "*.sublime-build",
  "*.sublime-color-scheme",
  "*.sublime-commands",
  "*.sublime-completions",
  "*.sublime-keymap",
  "*.sublime-macro",
  "*.sublime-menu",
  "*.sublime-mousemap",
  "*.sublime-project",
  "*.sublime-settings",
  "*.sublime-theme",
  "*.sublime-workspace",
  "*.sublime_metrics",
  "*.sublime_session",
];

/**
 * The base's overrides, each frozen down to its `options`, so a consumer
 * can't change them for every other config in the same process.
 *
 * - Spread them into a config's own `overrides` to keep them.
 */
export const OVERRIDES: readonly Override[] = Object.freeze(
  (
    [
      /*
       * Git hooks are shell scripts with no extension, so Prettier can't infer
       * a parser from the filename.
       *
       * - Matched by `!(*.*)` (extensionless files only) rather than
       *   `.githooks/*`, so a non-shell file added later keeps its own parser.
       */
      {
        files: ".githooks/!(*.*)",
        options: { parser: "sh" },
      },

      // JSONC files are hand-edited, so keep them free of the trailing commas
      // the es5 default would add.
      {
        files: JSONC_FILES,
        options: { trailingComma: "none" },
      },
    ] satisfies Override[]
  ).map((override) => freezeOverride(override))
);

/** The base's plugins, frozen for the same reason as {@link OVERRIDES}. */
export const PLUGINS: readonly PluginEntry[] = Object.freeze([SH_PLUGIN]);

/** The base config, with its own copies of the two frozen lists. */
const CONFIG: BaseConfig = {
  overrides: [...OVERRIDES],
  plugins: [...PLUGINS],
  trailingComma: "es5",
};

/**
 * Freezes an override, its `files` and its `options`, the objects a consumer
 * could reach through a spread copy of {@link OVERRIDES}.
 *
 * @param override - the override to freeze.
 * @returns the same override, frozen.
 */
function freezeOverride(override: Override): Override {
  Object.freeze(override.files);
  Object.freeze(override.options);

  return Object.freeze(override);
}

export default CONFIG;
