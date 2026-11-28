import { getSupportInfo } from "prettier";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import type { Scratch } from "./format.ts";

import CONFIG, { OVERRIDES, PLUGINS } from "../src/index.ts";
import { createScratch } from "./format.ts";

/** A scratch consumer whose config is the base, re-exported. */
let scratch: Scratch;

beforeAll(() => {
  scratch = createScratch('export { default } from "{{src}}/index.ts";\n');
});

afterAll(() => {
  scratch.remove();
});

describe("the base config", () => {
  test.each([
    {
      description: "an extensionless git hook is formatted as shell",
      expected: '#!/bin/sh\nif [ "$a" = b ]; then echo hi; fi\n',
      filePath: ".githooks/pre-commit",
      text: '#!/bin/sh\nif [ "$a" = b ];then echo hi;fi\n',
    },
    {
      description:
        "a git hook folder's file with an extension keeps its parser",
      expected: "- item\n",
      filePath: ".githooks/notes.md",
      text: "*   item\n",
    },
    {
      description: "a `.jsonc` file loses its trailing comma",
      expected: '{\n  "a": 1,\n  "b": 2\n}\n',
      filePath: "settings.jsonc",
      text: '{\n  "a": 1,\n  "b": 2,\n}\n',
    },
    {
      description: "a `.code-workspace` file, also JSONC, loses its comma",
      expected: '{\n  "a": 1,\n  "b": 2\n}\n',
      filePath: "app.code-workspace",
      text: '{\n  "a": 1,\n  "b": 2,\n}\n',
    },
    {
      description: "TypeScript gets es5 trailing commas",
      expected: "const a = {\n  b: 1,\n  c: 2,\n};\n",
      filePath: "src/a.ts",
      text: "const a = {\n  b: 1,\n  c: 2\n};\n",
    },
  ])("$description", async ({ expected, filePath, text }) => {
    // Given - a fabricated file in a consumer that re-exports the base

    // When - Prettier formats it through the consumer's config
    const output = await scratch.format({ filePath, text });

    // Then - the base's settings for that path apply
    expect(output).toBe(expected);
  });

  test("its JSONC override names every JSONC file Prettier knows", async () => {
    // Given - the languages this Prettier parses with `jsonc`
    const { languages } = await getSupportInfo();
    const expected = languages
      .filter((language) => language.parsers.includes("jsonc"))
      .flatMap((language) => [
        ...(language.extensions ?? []).map((extension) => `*${extension}`),
        ...(language.filenames ?? []),
      ])
      .toSorted();

    // When - reading the override that drops trailing commas
    const override = OVERRIDES.find(
      (entry) => entry.options?.trailingComma === "none"
    );

    // Then - it lists exactly those files
    expect(override?.files).toStrictEqual(expected);
  });

  test("a JSONC file keeps es5 commas without the override", async () => {
    // Given - a consumer that drops the base's JSONC override
    const bare = createScratch(
      [
        'import BASE, { OVERRIDES } from "{{src}}/index.ts";',
        "",
        "export default { ...BASE, overrides: [OVERRIDES[0]] };",
        "",
      ].join("\n")
    );

    // When - Prettier formats a JSONC file through it
    let output: string;

    try {
      output = await bare.format({
        filePath: "settings.jsonc",
        text: '{\n  "a": 1,\n  "b": 2\n}\n',
      });
    } finally {
      bare.remove();
    }

    // Then - the es5 default adds the comma the override keeps out
    expect(output).toBe('{\n  "a": 1,\n  "b": 2,\n}\n');
  });

  test("its overrides are frozen down to their options", () => {
    // Given - the base's exported overrides

    // When - checking each override and the objects inside it
    const isEveryPartFrozen = OVERRIDES.every(
      (override) =>
        Object.isFrozen(override) &&
        Object.isFrozen(override.files) &&
        Object.isFrozen(override.options)
    );

    // Then - a consumer can't change them through a spread copy
    expect(isEveryPartFrozen).toBe(true);
  });

  test("its overrides and plugins are copies of the frozen exports", () => {
    // Given - the base config and its named exports

    // When - comparing them
    const isShared =
      CONFIG.overrides === OVERRIDES || CONFIG.plugins === PLUGINS;

    // Then - the config holds equal copies, and the exports can't change
    expect(isShared).toBe(false);
    expect(CONFIG.overrides).toStrictEqual(OVERRIDES);
    expect(CONFIG.plugins).toStrictEqual(PLUGINS);
    expect(Object.isFrozen(OVERRIDES)).toBe(true);
    expect(Object.isFrozen(PLUGINS)).toBe(true);
  });
});
