import { afterAll, beforeAll, describe, expect, test } from "vitest";

import type { Scratch } from "./format.ts";

import CONFIG, { OVERRIDES } from "../src/index.ts";
import { createZshConfig } from "../src/zsh.ts";
import { createScratch } from "./format.ts";

/** A function that uses zsh's parameter expansion flags, which bash rejects. */
const ZSH_SCRIPT =
  "f() {\n  local -a arr=( ${(s:,:)1} )\n  print -- ${#arr}\n}\n";

/** {@link ZSH_SCRIPT}, as Prettier formats it. */
const ZSH_SCRIPT_FORMATTED =
  "f() {\n  local -a arr=(${(s:,:)1})\n  print -- ${#arr}\n}\n";

/** A scratch consumer whose config parses its scripts and hooks as zsh. */
let scratch: Scratch;

beforeAll(() => {
  scratch = createScratch(
    [
      'import { createZshConfig } from "{{src}}/zsh.ts";',
      "",
      "export default createZshConfig({",
      '  files: [".githooks/*", "lib/*.zsh"],',
      "});",
      "",
    ].join("\n")
  );
});

afterAll(() => {
  scratch.remove();
});

describe("createZshConfig", () => {
  test.each([
    { description: "a listed script", filePath: "lib/split.zsh" },
    {
      description: "a listed git hook, over the base's hook override",
      filePath: ".githooks/pre-push",
    },
  ])("formats $description as zsh", async ({ filePath }) => {
    // Given - a zsh-only construct in a file the config names

    // When - Prettier formats it through the consumer's config
    const output = await scratch.format({ filePath, text: ZSH_SCRIPT });

    // Then - the zsh parser accepts it
    expect(output).toBe(ZSH_SCRIPT_FORMATTED);
  });

  test("leaves a script it doesn't name to the bash parser", async () => {
    // Given - the same construct in a shell file the config doesn't name

    // When - Prettier formats it through the consumer's config
    const formatting = scratch.format({
      filePath: "scripts/split.sh",
      text: ZSH_SCRIPT,
    });

    // Then - the default bash parser rejects it
    await expect(formatting).rejects.toThrow("zsh feature");
  });

  test("returns the base plus one last override, in fresh arrays", () => {
    // Given - the globs to parse as zsh
    const files = ["bin/*"];

    // When - building two configs from them
    const first = createZshConfig({ files });
    const second = createZshConfig({ files });

    // Then - each keeps the base's settings, adds the zsh override last, and
    // shares no array with the base, the other or the caller
    expect(first.trailingComma).toBe(CONFIG.trailingComma);
    expect(first.overrides.slice(0, -1)).toStrictEqual(OVERRIDES);
    expect(first.overrides.at(-1)?.files).toStrictEqual(files);
    expect(first.overrides.at(-1)?.files).not.toBe(files);
    expect(first.overrides).not.toBe(second.overrides);
    expect(first.plugins).not.toBe(CONFIG.plugins);
  });

  test("passes a single glob through as it is", () => {
    // Given - one glob as a string

    // When - building a config from it
    const config = createZshConfig({ files: "bin/*" });

    // Then - the zsh override holds the same string
    expect(config.overrides.at(-1)?.files).toBe("bin/*");
  });
});
