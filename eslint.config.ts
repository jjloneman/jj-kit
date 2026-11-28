/*
 * Copied from okf-tools until the kit ships its own ESLint config.
 *
 * - #10 replaces this file with `@jjloneman/kit-eslint-config`.
 */
import type { Linter } from "eslint";

import jsPlugin from "@eslint/js";
import jsoncPlugin from "eslint-plugin-jsonc";
import perfectionistPlugin from "eslint-plugin-perfectionist";
import tsdocPlugin from "eslint-plugin-tsdoc";
import ymlPlugin from "eslint-plugin-yml";
import { defineConfig, globalIgnores, includeIgnoreFile } from "eslint/config";
import { createHash } from "node:crypto";
import { globSync, readFileSync } from "node:fs";
import path from "node:path";
import { configs as tsConfigs } from "typescript-eslint";

import { PINNED_USES } from "./eslint-rules/pinned-uses.ts";
import kitPlugin from "./packages/eslint-plugin/src/index.ts";

/** The `.json` files whose tools read comments, linted as JSONC. */
const JSONC_FILES: string[] = [
  "**/tsconfig.json",
  ".vscode/*.json",
  "packages/tsconfig/{base,bundler,lib,node}.json",
];

/*
 * The kit's plugin is imported from source, so linting never needs the
 * package built first, and its version names that source.
 *
 * - The version is rewritten on the one plugin object, rather than on a copy,
 *   since `recommended` registers that object as `jj-kit`, and ESLint refuses
 *   two different objects under one key.
 */
kitPlugin.meta.version = sourceVersion({
  base: kitPlugin.meta.version,
  pattern: "packages/eslint-plugin/src/**/*.ts",
});

/** The repo's local rules, which no kit package ships. */
const LOCAL_PLUGIN = {
  meta: {
    name: "jj-kit-local-rules",
    version: sourceVersion({ base: "0.0.0", pattern: "eslint-rules/*.ts" }),
  },
  rules: {
    "pinned-uses": PINNED_USES,
  },
};

/**
 * One `yml/sort-keys` option: the mappings whose path matches `pathPattern`
 * list `keys` first, in that order, then any other key alphabetized.
 *
 * @returns the rule option.
 */
function documentedOrder({
  keys,
  pathPattern,
}: {
  /** The keys whose order carries meaning, in that order. */
  keys: readonly string[];

  /**
   * A regex source matched against a mapping's path, such as
   * `jobs.lint.steps[0]`; the root mapping's path is empty.
   */
  pathPattern: string;
}): {
  order: ({ order: { caseSensitive: boolean; type: "asc" } } | string)[];
  pathPattern: string;
} {
  return {
    order: [...keys, { order: { caseSensitive: false, type: "asc" } }],
    pathPattern,
  };
}

/**
 * Builds a version for a plugin loaded from source: `base`, then a short hash
 * of the source as SemVer build metadata.
 *
 * - ESLint's cache keys a plugin by its `meta` name and version, which stay
 *   the same while the source changes, so `.eslintcache` would serve an
 *   unchanged file's old verdict after a rule edit; the hash changes the key
 *   whenever the source does.
 *
 * - Any build metadata already on `base` is dropped first, so a config that
 *   ESLint loads twice in one process, as an editor's server may, still gets
 *   one hash.
 *
 * - Test files are left out, since editing one changes no rule.
 *
 * @returns the version, such as `0.0.0+1a2b3c4d5e6f`.
 */
function sourceVersion({
  base,
  pattern,
}: {
  /** The plugin's own version, such as `0.0.0`. */
  base: string;

  /** A glob of the plugin's source files, relative to the repo root. */
  pattern: string;
}): string {
  const hash = createHash("sha256")
    .update(
      globSync(pattern, { cwd: import.meta.dirname })
        .filter((file) => !file.endsWith(".test.ts"))
        .sort()
        .map((file) =>
          readFileSync(path.join(import.meta.dirname, file), "utf8")
        )
        .join("\0")
    )
    .digest("hex")
    .slice(0, 12);

  return `${base.replace(/\+.*$/u, "")}+${hash}`;
}

const CONFIG: Linter.Config[] = defineConfig(
  /*
   * ESLint doesn't read `.gitignore` on its own, so load it — one list of
   * ignored paths, which can't drift from git's.
   *
   * - Without it, `eslint .` lints gitignored dotfiles such as a per-user
   *   `.vscode/settings.json`, and `lint:fix` rewrites them.
   */
  includeIgnoreFile(path.resolve(import.meta.dirname, ".gitignore")),

  // Tracked, but rewritten by pnpm on every install.
  globalIgnores(["pnpm-lock.yaml"]),

  /*
   * TypeScript, with the full typed presets.
   *
   * - Every linted file must belong to a project, and the project service
   *   resolves one only by walking up to the nearest config named exactly
   *   `tsconfig.json` — so a new top-level directory of `.ts` files must be
   *   added to that config's `include`, or linting it errors.
   *
   * - Typed rules make a file's verdict depend on the types it imports, which
   *   `.eslintcache` can't see: a file whose own content is unchanged is served
   *   from the cache even when an imported type changed underneath it. Delete
   *   `.eslintcache` when a local result looks impossible.
   *
   * - Scoped by `files` through `extends`, so no JS or typed rule ever runs
   *   against the JSON and YAML files below.
   */
  {
    extends: [
      jsPlugin.configs.recommended,
      tsConfigs.strictTypeChecked,
      tsConfigs.stylisticTypeChecked,
      perfectionistPlugin.configs["recommended-alphabetical"],

      // The kit's own rules, such as `jj-kit/no-dotted-jsdoc-param`, which
      // reports a dotted `@param options.key` no editor tooltip reads.
      kitPlugin.configs.recommended,
    ],
    files: ["**/*.mts", "**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      tsdoc: tsdocPlugin,
    },
    rules: {
      // The stylistic preset defaults to `interface`; the repo prefers `type`.
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],

      "@typescript-eslint/consistent-type-imports": [
        "error",
        { fixStyle: "separate-type-imports", prefer: "type-imports" },
      ],

      /*
       * A boolean variable or parameter reads as a question: `isEmpty`,
       * `hasKey`, `shouldTrim`, and a module-level constant is
       * `SCREAMING_SNAKE_CASE`.
       *
       * - Destructured bindings are exempt, since their name is the source
       *   object's key and renaming it at the binding site only hides that.
       *
       * - An entry with `types` outranks one without, and among the rest the
       *   one with the most modifiers wins: so a boolean constant keeps the
       *   `isX` form, and the destructured exemption repeats `const` and
       *   `global` to outrank the constant entry.
       *
       * - A module-level function is a `function` declaration, which this rule
       *   doesn't reach, rather than an arrow bound to a constant.
       */
      "@typescript-eslint/naming-convention": [
        "error",
        {
          format: ["PascalCase"],

          // Auxiliary verbs that open a yes/no question, singular and plural.
          prefix: [
            "are",
            "can",
            "did",
            "does",
            "has",
            "have",
            "is",
            "should",
            "was",
            "were",
            "will",
          ],
          selector: ["parameter", "variable"],
          types: ["boolean"],
        },
        {
          format: null,
          modifiers: ["destructured"],
          selector: ["parameter", "variable"],
        },
        {
          format: null,
          modifiers: ["const", "destructured", "global"],
          selector: "variable",
        },
        {
          format: ["UPPER_CASE"],
          modifiers: ["const", "global"],
          selector: "variable",
        },
      ],

      // An unused name is kept with a `_` prefix rather than dropped, so a
      // skipped tuple element or parameter still says what it is.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],

      /*
       * Numbers interpolate safely; the rule's worth is catching `undefined`,
       * `null`, and `[object Object]` slipping into a string.
       *
       * - Without this, every number in a template needs a `String()` wrapper
       *   that changes nothing: `${count}` reads the same as
       *   `${String(count)}` and prints the same.
       */
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true },
      ],

      // A brace-less guard reads fine until a second statement is added to it,
      // at which point that one runs unconditionally.
      curly: ["error", "all"],

      // `Boolean(value)` over `!!value`, `Number(value)` over `+value`, and
      // `String(value)` over `"" + value`; autofixable.
      "no-implicit-coercion": "error",

      // Rewrite as a named helper whose guards read top to bottom, or a lookup
      // keyed by the discriminant.
      "no-nested-ternary": "error",

      "object-shorthand": ["error", "always"],

      // A named group says what it captured; `match[2]` makes the reader
      // count parentheses.
      "prefer-named-capture-group": "error",

      "tsdoc/syntax": "error",
    },

    /*
     * Every perfectionist rule sorts case-insensitively, so `fallback` sorts
     * before `Options`.
     *
     * - Where an order carries meaning (a `Set`'s iteration order, a module
     *   read top to bottom), disable the rule on that line with a comment
     *   saying why, rather than turning it off here.
     */
    settings: {
      perfectionist: { ignoreCase: true },
    },
  },

  /*
   * JSON keys stay alphabetized at every level, like object keys in
   * TypeScript.
   *
   * - `package.json` included: npm and pnpm read its fields by name, so their
   *   order carries no meaning.
   *
   * - `tsconfig.json`, `kit-tsconfig`'s bases and VS Code's `.vscode/*.json`
   *   are JSONC — their tools read comments in them — so they get the JSONC
   *   preset, which allows them.
   */
  {
    extends: [jsoncPlugin.configs["flat/recommended-with-json"]],
    files: ["**/*.json"],
    ignores: JSONC_FILES,
  },
  {
    extends: [jsoncPlugin.configs["flat/recommended-with-jsonc"]],
    files: ["**/*.jsonc", ...JSONC_FILES],
  },
  {
    extends: [jsoncPlugin.configs["flat/prettier"]],
    files: ["**/*.json", "**/*.jsonc"],
    rules: {
      "jsonc/sort-keys": ["error", "asc", { caseSensitive: false }],
    },
  },

  // YAML keys stay alphabetized too; `flat/prettier` defers formatting to
  // Prettier.
  {
    extends: [
      ymlPlugin.configs["flat/recommended"],
      ymlPlugin.configs["flat/prettier"],
    ],
    files: ["**/*.yaml", "**/*.yml"],
    rules: {
      "yml/sort-keys": ["error", "asc", { caseSensitive: false }],
    },
  },

  /*
   * GitHub's YAML files read in their documented order instead: a workflow
   * opens with `name` and `on`, a step with `name` and `uses`, and an issue
   * form with `name`, `description`, `title`, and `labels`.
   *
   * - Each mapping lists its well-known keys first, in that order; any other
   *   key follows, alphabetized.
   *
   * - The first `pathPattern` matching a mapping's path wins, so the
   *   alphabetical fallback comes last.
   */
  {
    files: [".github/**/*.yml", "actions/*/action.yml"],
    plugins: { local: LOCAL_PLUGIN },
    rules: {
      // Every `uses:` is a local path or a full-SHA pin with its tag, so an
      // upstream can't move a tag under the kit's actions or its workflows.
      "local/pinned-uses": "error",

      "yml/sort-keys": [
        "error",

        // A workflow's or an action's top level.
        documentedOrder({
          keys: [
            "name",
            "description",
            "title",
            "labels",
            "on",
            "inputs",
            "outputs",
            "concurrency",
            "permissions",
            "env",
            "defaults",
            "jobs",
            "runs",
          ],
          pathPattern: "^$",
        }),
        documentedOrder({
          keys: [
            "name",
            "if",
            "needs",
            "runs-on",
            "permissions",
            "strategy",
            "outputs",
            "env",
            "steps",
          ],
          pathPattern: String.raw`^jobs(?:\.[^.[]+|\[[^\]]+\])$`,
        }),
        documentedOrder({
          keys: ["name", "id", "if", "uses", "with", "env", "shell", "run"],
          pathPattern: String.raw`\.steps\[\d+\]$`,
        }),
        documentedOrder({ keys: ["using", "steps"], pathPattern: "^runs$" }),
        documentedOrder({
          keys: ["cron", "timezone"],
          pathPattern: String.raw`^on\.schedule\[\d+\]$`,
        }),
        documentedOrder({ keys: [], pathPattern: ".*" }),
      ],
    },
  }
);

export default CONFIG;
