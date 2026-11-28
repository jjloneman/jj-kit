import type { ESLint, Linter, Rule } from "eslint";

import PACKAGE from "../package.json" with { type: "json" };
import { NO_DOTTED_JSDOC_PARAM } from "./no-dotted-jsdoc-param.ts";

/** The plugin's flat-config shape, with the members it always sets. */
export type KitPlugin = {
  /** Ready-made configs, each registering the plugin under `jj-kit`. */
  configs: {
    /**
     * Every rule the kit ships, turned on as an error; read-only, since it's
     * a getter.
     */
    readonly recommended: Linter.Config;
  };

  /** Identifies the plugin to ESLint, in caches and in `--print-config`. */
  meta: {
    /** The npm package's name. */
    name: string;

    /**
     * The prefix of every rule ID, `jj-kit`, which `defineConfig` uses to
     * rename `recommended`'s rules when a repo registers the plugin under
     * another key.
     */
    namespace: string;

    /** The npm package's version. */
    version: string;
  };

  /** The rules, keyed by their name without the namespace. */
  rules: {
    /** Reports a dotted TSDoc `@param options.key`. */
    "no-dotted-jsdoc-param": Rule.RuleModule;
  };
} & ESLint.Plugin;

/** The key `recommended` registers the plugin under, and each rule's prefix. */
const NAMESPACE = "jj-kit";

/**
 * The plugin, ready to register under `plugins` or to extend through
 * `configs.recommended`.
 *
 * - `recommended` is a getter, since it registers this same object, which
 *   doesn't exist yet while the literal is built: a repo that also registers
 *   the plugin by hand under `jj-kit` hands ESLint the same object twice,
 *   which flat config accepts.
 */
const PLUGIN: KitPlugin = {
  configs: {
    /**
     * Reads the `recommended` config, built once below.
     *
     * @returns the config.
     */
    get recommended(): Linter.Config {
      return RECOMMENDED;
    },
  },
  meta: {
    name: PACKAGE.name,
    namespace: NAMESPACE,
    version: PACKAGE.version,
  },
  rules: { "no-dotted-jsdoc-param": NO_DOTTED_JSDOC_PARAM },
};

/*
 * Every rule the plugin ships, on as an error.
 *
 * - Built from `PLUGIN.rules`, so a new rule is on the day it's added.
 *
 * - No `files`, as in ESLint's own plugin docs and typescript-eslint's
 *   rules: the repo scopes it with `extends` beside its own `files`, which
 *   intersect with any `files` set here, so a fixed list would silently skip
 *   a `.vue` or `.svelte` file the repo names.
 */
const RECOMMENDED: Linter.Config = {
  name: `${NAMESPACE}/recommended`,
  plugins: { [NAMESPACE]: PLUGIN },
  rules: Object.fromEntries(
    Object.keys(PLUGIN.rules).map((rule): [string, Linter.RuleEntry] => [
      `${NAMESPACE}/${rule}`,
      "error",
    ])
  ),
};

export { NO_DOTTED_JSDOC_PARAM };

export default PLUGIN;
