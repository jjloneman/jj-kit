import type { Linter } from "eslint";

import { Linter as ESLintLinter } from "eslint";
import { defineConfig } from "eslint/config";
import { describe, expect, test } from "vitest";

import PACKAGE from "../package.json" with { type: "json" };
import KIT_PLUGIN, { NO_DOTTED_JSDOC_PARAM } from "./index.ts";

/** A doc block with one dotted `@param`, the rule's one report. */
const DOTTED_SOURCE = [
  "/**",
  " * Formats a label.",
  " *",
  " * @param options.prefix - the text before the label.",
  " */",
  "function label(options) {",
  "  return options.prefix;",
  "}",
].join("\n");

/** Lints flat-config source with no config file of its own. */
const LINTER = new ESLintLinter({ configType: "flat" });

/**
 * Lints {@link DOTTED_SOURCE} under a flat config, as a file named
 * `label.js` unless told otherwise, one of the files ESLint lints when no
 * config names any.
 *
 * @returns the rule IDs it reports, in order.
 */
function reportedRuleIds({
  config,
  filename = "label.js",
}: {
  /** The config array to lint with. */
  config: Linter.Config[];

  /** The linted file's name, which decides the configs that apply. */
  filename?: string;
}): (null | string)[] {
  return LINTER.verify(DOTTED_SOURCE, config, filename).map(
    ({ ruleId }) => ruleId
  );
}

describe("kit-eslint-plugin", () => {
  test("names itself after the package, under the jj-kit namespace", () => {
    // Given - the plugin's default export
    // When - its meta is read
    const { meta } = KIT_PLUGIN;

    // Then - it matches the package and the namespace
    expect(meta).toEqual({
      name: "@jjloneman/kit-eslint-plugin",
      namespace: "jj-kit",
      version: PACKAGE.version,
    });
  });

  test("exports the rule by name as the same object", () => {
    // Given - the named export and the plugin's rule
    // When - they're compared
    // Then - they're one object, so either registration runs the same rule
    expect(NO_DOTTED_JSDOC_PARAM).toBe(
      KIT_PLUGIN.rules["no-dotted-jsdoc-param"]
    );
  });

  test("reports a dotted @param under recommended", () => {
    // Given - a config that only extends recommended
    const config = [KIT_PLUGIN.configs.recommended];

    // When - a dotted @param is linted
    const ruleIds = reportedRuleIds({ config });

    // Then - the rule reports it under the jj-kit namespace
    expect(ruleIds).toEqual(["jj-kit/no-dotted-jsdoc-param"]);
  });

  test("accepts recommended beside a hand registration under jj-kit", () => {
    // Given - the same plugin object registered twice under one key
    const config = [
      { plugins: { "jj-kit": KIT_PLUGIN } },
      KIT_PLUGIN.configs.recommended,
    ];

    // When - a dotted @param is linted
    const ruleIds = reportedRuleIds({ config });

    // Then - ESLint accepts it and reports once
    expect(ruleIds).toEqual(["jj-kit/no-dotted-jsdoc-param"]);
  });

  test("turns every rule the plugin ships on in recommended", () => {
    // Given - the plugin's rules and its recommended config
    const ruleIds = Object.keys(KIT_PLUGIN.rules).map(
      (rule) => `jj-kit/${rule}`
    );

    // When - recommended's rules are read
    const { rules } = KIT_PLUGIN.configs.recommended;

    // Then - each rule is on as an error
    expect(rules).toEqual(
      Object.fromEntries(ruleIds.map((ruleId) => [ruleId, "error"]))
    );
  });

  test("lints whatever files the repo extends recommended for", () => {
    // Given - a repo that extends recommended for `.vue` files only
    const config = defineConfig({
      extends: [KIT_PLUGIN.configs.recommended],
      files: ["**/*.vue"],
    });

    // When - a `.vue` file holding a dotted @param is linted
    const ruleIds = reportedRuleIds({ config, filename: "Label.vue" });

    // Then - recommended sets no `files` of its own to intersect with
    expect(ruleIds).toEqual(["jj-kit/no-dotted-jsdoc-param"]);
  });

  test("declares that the rule lints JavaScript only", () => {
    // Given - the rule's meta
    // When - its languages are read
    const { languages } = NO_DOTTED_JSDOC_PARAM.meta ?? {};

    // Then - ESLint refuses it, with a config error, on any other language
    expect(languages).toEqual(["js/js"]);
  });

  test("types recommended as read-only, since it's a getter", () => {
    // Given - the plugin's configs
    const { configs } = KIT_PLUGIN;

    // When - recommended is assigned
    // Then - the typecheck rejects it, and the runtime throws
    expect(() => {
      // @ts-expect-error -- `recommended` is a getter with no setter.
      configs.recommended = {};
    }).toThrow(TypeError);
  });

  test("renames recommended's rules under another key", () => {
    // Given - a repo that registers the plugin as `docs` and extends its
    // recommended config by string
    const config = defineConfig({
      extends: ["docs/recommended"],
      plugins: { docs: KIT_PLUGIN },
    });

    // When - a dotted @param is linted
    const ruleIds = reportedRuleIds({ config });

    // Then - `meta.namespace` lets defineConfig rename the rule to the key
    expect(ruleIds).toEqual(["docs/no-dotted-jsdoc-param"]);
  });

  test("still registers jj-kit when extended under another key", () => {
    // Given - a repo with another plugin already under `jj-kit`, which
    // registers this one as `docs` and extends its recommended config
    const config = defineConfig(
      { plugins: { "jj-kit": { rules: {} } } },
      { extends: ["docs/recommended"], plugins: { docs: KIT_PLUGIN } }
    );

    // When - a file is linted
    // Then - recommended's own `jj-kit` registration clashes with the repo's
    expect(() => reportedRuleIds({ config })).toThrow(
      'Cannot redefine plugin "jj-kit"'
    );
  });
});
