import { ESLint } from "eslint";
import path from "node:path";
import { describe, expect, test } from "vitest";

/** A 40-character commit SHA, fabricated. */
const SHA = "0123456789abcdef0123456789abcdef01234567";

/** Lints YAML through the repo's own config, as `pnpm lint` does. */
const LINTER = new ESLint({ cwd: path.dirname(import.meta.dirname) });

/**
 * Lints one workflow step's `uses:` line under a given file path.
 *
 * @returns the `local/pinned-uses` message ids it reports, in order.
 */
async function pinnedUsesMessages({
  filePath,
  line,
}: {
  /** Where the YAML would live, relative to the repo root. */
  filePath: string;

  /** The step's `uses:` line, after `- `. */
  line: string;
}): Promise<string[]> {
  const yaml = [
    "name: x",
    "on: push",
    "jobs:",
    "  a:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    `      - ${line}`,
    "",
  ].join("\n");
  const [result] = await LINTER.lintText(yaml, { filePath });

  return (result?.messages ?? [])
    .filter((message) => message.ruleId === "local/pinned-uses")
    .map((message) => message.messageId ?? "");
}

describe("pinned-uses", () => {
  test.each([
    {
      description: "a full SHA with its tag",
      line: `uses: a/b@${SHA} # v1.2.3`,
    },
    {
      description: "a sub-action's full SHA with its tag",
      line: `uses: a/b/pack@${SHA} # v1.2.3`,
    },
    { description: "a local path", line: "uses: ./actions/setup" },
    {
      description: "a digest-pinned image",
      line: `uses: docker://alpine@sha256:${SHA}${SHA.slice(0, 24)}`,
    },
  ])("accepts $description", async ({ line }) => {
    // Given - a step whose `uses:` is pinned
    // When - it's linted as a workflow
    const messages = await pinnedUsesMessages({
      filePath: ".github/workflows/zz.yml",
      line,
    });

    // Then - the rule reports nothing
    expect(messages).toStrictEqual([]);
  });

  test.each([
    { description: "a tag", expected: "sha", line: "uses: a/b@v1.2.3" },
    { description: "a short SHA", expected: "sha", line: "uses: a/b@0123456" },
    {
      description: "a local path that climbs out",
      expected: "sha",
      line: "uses: ./../x",
    },
    {
      description: "an image by tag",
      expected: "sha",
      line: "uses: docker://alpine:3",
    },
    {
      description: "a full SHA with no comment",
      expected: "tag",
      line: `uses: a/b@${SHA}`,
    },
    {
      description: "a full SHA with a tag missing its v",
      expected: "tag",
      line: `uses: a/b@${SHA} # 1.2.3`,
    },
    {
      description: "a full SHA with a short tag",
      expected: "tag",
      line: `uses: a/b@${SHA} # v1`,
    },
  ])("reports $description", async ({ expected, line }) => {
    // Given - a step whose `uses:` an upstream could move, or Renovate can't read
    // When - it's linted as a workflow
    const messages = await pinnedUsesMessages({
      filePath: ".github/workflows/zz.yml",
      line,
    });

    // Then - the rule reports it once, with the matching message
    expect(messages).toStrictEqual([expected]);
  });

  test("checks an action's own action.yml too", async () => {
    // Given - a tag pin in an action's file
    // When - it's linted as `actions/<name>/action.yml`
    const messages = await pinnedUsesMessages({
      filePath: "actions/zz/action.yml",
      line: "uses: a/b@v1.2.3",
    });

    // Then - the rule reports it
    expect(messages).toStrictEqual(["sha"]);
  });
});
