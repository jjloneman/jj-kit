import type { ChangelogFunctions as UpstreamChangelogFunctions } from "@changesets/types";

import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import CHANGELOG_FUNCTIONS, {
  formatReleaseLine,
  getDependencyReleaseLine,
  getReleaseLine,
  parseConventionalSubject,
  readCommitSubject,
} from "./index.ts";

/** A full hash that no scratch repo holds. */
const HASH = "b4fc42d0d5a0e1f2c3b4a5968778695a4b3c2d1e";

/** A second full hash, for lines that name several commits. */
const OTHER_HASH = "0a1b2c3d4e5f60718293a4b5c6d7e8f901234567";

/** The current test's scratch repo, which each test gets fresh. */
let root = "";

/**
 * Write a file in the scratch repo and commit everything with `message`.
 *
 * @returns the new commit's full hash.
 */
function commitFile({
  filePath,
  message,
}: {
  /** The file to write, relative to the repo root. */
  filePath: string;

  /** The commit message, which may hold a body after a blank line. */
  message: string;
}): string {
  const absolutePath = path.join(root, filePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${message}\n`);
  git("add", "--all");
  git("commit", "--quiet", "-m", message);

  return git("rev-parse", "HEAD").trim();
}

/**
 * Run git in the scratch repo.
 *
 * @returns what git printed to stdout.
 */
function git(...args: string[]): string {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

// A fresh repo per test, with its own identity and no hooks or signing, so
// no test depends on the machine's git config or on the subject cache.
beforeEach(() => {
  root = realpathSync(mkdtempSync(path.join(tmpdir(), "kit-changelog-")));
  git("init", "--quiet", "--initial-branch", "main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  git("config", "commit.gpgsign", "false");
  git("config", "core.hooksPath", ".git/hooks");
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { force: true, recursive: true });
});

describe("default export", () => {
  test("holds both functions changesets calls", () => {
    // Given - the module's default export

    // When - reading its functions
    const { getDependencyReleaseLine: dependencyLine, getReleaseLine: line } =
      CHANGELOG_FUNCTIONS;

    // Then - the named exports
    expect(dependencyLine).toBe(getDependencyReleaseLine);
    expect(line).toBe(getReleaseLine);
  });

  test("fits changesets' own type", () => {
    // Given - the default export, typed as changesets types its formatter;
    // the typecheck fails here if changesets' signatures stop accepting it
    const functions: UpstreamChangelogFunctions = CHANGELOG_FUNCTIONS;

    // When - reading it back

    // Then - the same object
    expect(functions).toBe(CHANGELOG_FUNCTIONS);
  });
});

describe("formatReleaseLine", () => {
  test.each([
    {
      description: "a gitmoji, a scope, and the short hash",
      expected: "- ✨ **eslint-config:** Add a preset. (b4fc42d)",
      subject: "feat(eslint-config): ✨ add a preset (#2)",
    },
    {
      description: "no scope",
      expected: "- 🔧 Add a preset. (b4fc42d)",
      subject: "fix: 🔧 fix a bug",
    },
    {
      description: "no gitmoji",
      expected: "- **eslint-config:** Add a preset. (b4fc42d)",
      subject: "feat(eslint-config): add a preset",
    },
    {
      description: "a breaking change",
      expected: "- ✨ **tsconfig:** **Breaking:** Add a preset. (b4fc42d)",
      subject: "feat(tsconfig)!: ✨ drop node.json",
    },
    {
      description: "a scope holding Markdown formatting",
      expected: String.raw`- 🔧 **\*\_a\_:** Add a preset. (b4fc42d)`,
      subject: "fix(*_a_): 🔧 fix a bug",
    },
    {
      description: "a subject that doesn't parse, keeping the hash",
      expected: "- Add a preset. (b4fc42d)",
      subject: "Merge branch 'main'",
    },
  ])("builds a line from $description", ({ expected, subject }) => {
    // Given - a changeset added by a commit with that subject
    const changeset = { commit: HASH, summary: "Add a preset.\n" };

    // When - formatting its line
    const line = formatReleaseLine({
      changeset,
      lookup: { status: "found", subject },
    });

    // Then - the expected line
    expect(line).toBe(expected);
  });

  test("falls back to the bare summary for a commit git has no record of", () => {
    // Given - a changeset whose commit is missing, such as one from before a
    // squash
    const changeset = { commit: HASH, summary: "Add a preset." };

    // When - formatting its line
    const line = formatReleaseLine({
      changeset,
      lookup: { status: "missing" },
    });

    // Then - the summary alone, with no hash
    expect(line).toBe("- Add a preset.");
  });

  test("keeps the hash of a commit git couldn't read", () => {
    // Given - a changeset whose commit git failed to read for another reason
    const changeset = { commit: HASH, summary: "Add a preset." };

    // When - formatting its line
    const line = formatReleaseLine({
      changeset,
      lookup: { status: "unreadable" },
    });

    // Then - the summary and hash, with no gitmoji or scope
    expect(line).toBe("- Add a preset. (b4fc42d)");
  });

  test("leaves out an empty summary", () => {
    // Given - a changeset with a blank summary
    const changeset = { commit: HASH, summary: "  \n" };

    // When - formatting its line
    const line = formatReleaseLine({
      changeset,
      lookup: { status: "found", subject: "feat: ✨ add" },
    });

    // Then - no double space where the summary would be
    expect(line).toBe("- ✨ (b4fc42d)");
  });

  test("formats a changeset with no commit", () => {
    // Given - an uncommitted changeset, which has no hash or lookup
    const changeset = { summary: "Add a preset." };

    // When - formatting its line
    const line = formatReleaseLine({ changeset, lookup: undefined });

    // Then - the summary alone
    expect(line).toBe("- Add a preset.");
  });

  test("indents a summary's later lines under the bullet", () => {
    // Given - a summary with a blank line and a list
    const changeset = {
      commit: HASH,
      summary: "Add a preset.\n\n- one  \n- two\n",
    };

    // When - formatting its line
    const line = formatReleaseLine({
      changeset,
      lookup: { status: "found", subject: "feat: ✨ add" },
    });

    // Then - the later lines are indented, and the blank one stays empty
    expect(line).toBe("- ✨ Add a preset. (b4fc42d)\n\n  - one\n  - two");
  });
});

describe("getDependencyReleaseLine", () => {
  test("returns nothing when no dependency was bumped", () => {
    // Given - a changeset but no bumped dependency

    // When - asking for the dependency lines
    const line = getDependencyReleaseLine([{ commit: HASH, summary: "x" }], []);

    // Then - an empty line, which changesets leaves out
    expect(line).toBe("");
  });

  test("lists each changeset's hash once, then each bumped dependency", () => {
    // Given - three changesets, two from one commit, and two bumps
    const changesets = [
      { commit: HASH, summary: "a" },
      { commit: OTHER_HASH, summary: "b" },
      { commit: HASH, summary: "c" },
    ];
    const dependenciesUpdated = [
      { name: "@jjloneman/kit-eslint-plugin", newVersion: "1.2.0" },
      { name: "@jjloneman/kit-tsconfig", newVersion: "2.0.0" },
    ];

    // When - asking for the dependency lines
    const line = getDependencyReleaseLine(changesets, dependenciesUpdated);

    // Then - one line naming both commits, then a sub-item per bump
    expect(line).toBe(
      [
        "- Updated dependencies [b4fc42d, 0a1b2c3]",
        "  - @jjloneman/kit-eslint-plugin@1.2.0",
        "  - @jjloneman/kit-tsconfig@2.0.0",
      ].join("\n")
    );
  });

  test("leaves out a dependency with no new version", () => {
    // Given - one real bump and one `none` release with no new version
    const dependenciesUpdated = [
      { name: "@jjloneman/kit-eslint-plugin", newVersion: "1.2.0" },
      { name: "@jjloneman/kit-tsconfig", newVersion: undefined },
    ];

    // When - asking for the dependency lines
    const line = getDependencyReleaseLine(
      [{ commit: HASH, summary: "a" }],
      dependenciesUpdated
    );

    // Then - only the real bump
    expect(line).toBe(
      "- Updated dependencies [b4fc42d]\n  - @jjloneman/kit-eslint-plugin@1.2.0"
    );
  });

  test("returns nothing when no dependency has a new version", () => {
    // Given - only a `none` release
    const dependenciesUpdated = [{ name: "@jjloneman/kit-tsconfig" }];

    // When - asking for the dependency lines
    const line = getDependencyReleaseLine(
      [{ commit: HASH, summary: "a" }],
      dependenciesUpdated
    );

    // Then - an empty line, which changesets leaves out
    expect(line).toBe("");
  });

  test("leaves the brackets off when no changeset has a commit", () => {
    // Given - an uncommitted changeset and one bump
    const dependenciesUpdated = [
      { name: "@jjloneman/kit-eslint-plugin", newVersion: "1.2.0" },
    ];

    // When - asking for the dependency lines
    const line = getDependencyReleaseLine(
      [{ summary: "a" }],
      dependenciesUpdated
    );

    // Then - the line without hashes
    expect(line).toBe(
      "- Updated dependencies\n  - @jjloneman/kit-eslint-plugin@1.2.0"
    );
  });
});

describe("getReleaseLine", () => {
  test("reads the commit from the directory changesets runs in", () => {
    // Given - a changeset committed with a conventional subject, and the
    // process running from that repo
    const hash = commitFile({
      filePath: ".changeset/a.md",
      message: "feat(eslint-config): ✨ add a preset (#2)",
    });
    vi.spyOn(process, "cwd").mockReturnValue(root);

    // When - changesets asks for its line
    const line = getReleaseLine({ commit: hash, summary: "Add a preset." });

    // Then - the line carries the commit's gitmoji, scope, and short hash
    expect(line).toBe(
      `- ✨ **eslint-config:** Add a preset. (${hash.slice(0, 7)})`
    );
  });

  test("falls back to the bare summary for a commit git can't find", () => {
    // Given - a hash from before a squash, which isn't in the repo
    vi.spyOn(process, "cwd").mockReturnValue(root);

    // When - changesets asks for its line
    const line = getReleaseLine({ commit: HASH, summary: "Add a preset." });

    // Then - the summary alone
    expect(line).toBe("- Add a preset.");
  });

  test("formats a changeset git found no commit for", () => {
    // Given - an uncommitted changeset, which has no hash
    const cwd = vi.spyOn(process, "cwd");

    // When - changesets asks for its line
    const line = getReleaseLine({ summary: "Add a preset." });

    // Then - the summary alone, without asking git
    expect(line).toBe("- Add a preset.");
    expect(cwd).not.toHaveBeenCalled();
  });
});

describe("parseConventionalSubject", () => {
  test.each([
    {
      description: "a gitmoji with a variation selector",
      expected: { gitmoji: "🏗️", isBreaking: false, scope: "cli" },
      subject: "refactor(cli): 🏗️ split run",
    },
    {
      description: "a breaking-change marker",
      expected: { gitmoji: "✨", isBreaking: true, scope: "cli" },
      subject: "feat(cli)!: ✨ drop --all",
    },
    {
      description: "a gitmoji with a skin tone",
      expected: { gitmoji: "👍🏽", isBreaking: false },
      subject: "feat: 👍🏽 add x",
    },
    {
      description: "a joined gitmoji",
      expected: { gitmoji: "🧑‍💻", isBreaking: false },
      subject: "chore: 🧑‍💻 improve tooling",
    },
    {
      description: "a gitmoji followed by two spaces",
      expected: { gitmoji: "✨", isBreaking: false },
      subject: "feat: ✨  add x",
    },
    {
      description: "a plain first word, which isn't a gitmoji",
      expected: { isBreaking: false, scope: "cli" },
      subject: "feat(cli): add --all",
    },
    {
      description: "a subject with no type",
      expected: { isBreaking: false },
      subject: "✨ add --all",
    },
    {
      description: "a gitmoji with no description after it",
      expected: { isBreaking: false, scope: "cli" },
      subject: "feat(cli): ✨",
    },
  ])("reads $description", ({ expected, subject }) => {
    // Given - the subject

    // When - parsing it
    const parts = parseConventionalSubject(subject);

    // Then - the parts it holds
    expect(parts).toStrictEqual(expected);
  });
});

describe("readCommitSubject", () => {
  test("reads a commit's subject line", () => {
    // Given - a commit with a body
    const hash = commitFile({
      filePath: "a.md",
      message: "docs: 📝 add a\n\n- body line",
    });

    // When - reading its subject
    const lookup = readCommitSubject({ cwd: root, hash });

    // Then - the first line only
    expect(lookup).toStrictEqual({
      status: "found",
      subject: "docs: 📝 add a",
    });
  });

  test("reads each commit only once", () => {
    // Given - a commit whose subject was already read, then amended away and
    // pruned, so git itself no longer has it
    const hash = commitFile({ filePath: "a.md", message: "docs: 📝 add a" });
    readCommitSubject({ cwd: root, hash });
    git("commit", "--quiet", "--amend", "-m", "docs: 📝 renamed");
    git("reflog", "expire", "--expire=now", "--all");
    git("gc", "--quiet", "--prune=now");
    expect(() => git("cat-file", "-e", hash)).toThrow();

    // When - reading it again
    const lookup = readCommitSubject({ cwd: root, hash });

    // Then - the first answer, without asking git again
    expect(lookup).toStrictEqual({
      status: "found",
      subject: "docs: 📝 add a",
    });
  });

  test("reports a hash git can't find as missing, quietly", () => {
    // Given - a hash that isn't in the repo
    commitFile({ filePath: "a.md", message: "docs: 📝 add a" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    // When - reading its subject
    const lookup = readCommitSubject({ cwd: root, hash: HASH });

    // Then - missing, and no warning, since that's expected after a squash
    expect(lookup).toStrictEqual({ status: "missing" });
    expect(warn).not.toHaveBeenCalled();
  });

  test("never reads a hash as a git option", () => {
    // Given - a "hash" that git would read as `--output`
    commitFile({ filePath: "a.md", message: "docs: 📝 add a" });
    const hash = `--output=${path.join(root, "written")}`;

    // When - reading its subject
    const lookup = readCommitSubject({ cwd: root, hash });

    // Then - missing, and no file written
    expect(lookup).toStrictEqual({ status: "missing" });
    expect(git("status", "--porcelain")).toBe("");
  });

  test("warns, and reports unreadable, when git fails for another reason", () => {
    // Given - a directory that isn't a repo
    rmSync(path.join(root, ".git"), { force: true, recursive: true });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    // When - reading a commit there
    const lookup = readCommitSubject({ cwd: root, hash: HASH });

    // Then - unreadable, with a warning naming git's error
    expect(lookup).toStrictEqual({ status: "unreadable" });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("not a git repository")
    );
  });
});
