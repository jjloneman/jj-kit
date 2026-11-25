import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, test, vi } from "vitest";

import { readCommitSubject } from "./index.ts";

/** What one mocked git call does: print `stdout`, or throw `thrown`. */
type GitOutcome = { stdout: string } | { thrown: unknown };

const { outcomes } = vi.hoisted((): { outcomes: GitOutcome[] } => ({
  outcomes: [],
}));

// Stands in for git behaving in ways no real test machine shows, one queued
// outcome per call.
vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(() => {
    const outcome = outcomes.shift();

    if (outcome === undefined || "thrown" in outcome) {
      throw outcome?.thrown;
    }

    return outcome.stdout;
  }),
}));

afterEach(() => {
  outcomes.length = 0;
  vi.restoreAllMocks();
});

describe("readCommitSubject when git misbehaves", () => {
  test.each([
    {
      cwd: "/no-git-binary",
      description: "no git binary",
      expected: "spawn git ENOENT",
      queued: [
        {
          thrown: Object.assign(new Error("spawn git ENOENT"), {
            code: "ENOENT",
          }),
        },
      ],
    },
    {
      cwd: "/thrown-string",
      description: "a thrown value that isn't an Error",
      expected: "killed",
      queued: [{ thrown: "killed" }],
    },
    {
      cwd: "/log-fails",
      description: "a commit git finds but then can't log",
      expected: "fatal: bad object",
      queued: [
        { stdout: "b4fc42d0d5a0e1f2c3b4a5968778695a4b3c2d1e\n" },
        {
          thrown: Object.assign(new Error("fatal: bad object"), {
            status: 128,
          }),
        },
      ],
    },
  ])(
    "warns, and reports unreadable, given $description",
    ({ cwd, expected, queued }) => {
      // Given - git behaving that way, in a directory no other test reads
      outcomes.push(...queued);
      const warn = vi
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);

      // When - reading a commit
      const lookup = readCommitSubject({ cwd, hash: "b4fc42d" });

      // Then - unreadable, with a warning naming the failure
      expect(lookup).toStrictEqual({ status: "unreadable" });
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(expected));
    }
  );

  test("reads the subject without gpg's check, and never waits", () => {
    // Given - git finding the commit and printing its subject
    outcomes.push(
      { stdout: "b4fc42d0d5a0e1f2c3b4a5968778695a4b3c2d1e\n" },
      { stdout: "feat: ✨ add x\n" }
    );

    // When - reading a commit
    const lookup = readCommitSubject({ cwd: "/options", hash: "b4fc42d" });

    // Then - the subject, read by the full hash with signatures off, and
    // git run with no lazy fetch, no prompt, and a timeout
    expect(lookup).toStrictEqual({
      status: "found",
      subject: "feat: ✨ add x",
    });
    const [, args, options] = vi.mocked(execFileSync).mock.lastCall ?? [];
    expect(args).toStrictEqual([
      "log",
      "-1",
      "--format=%s",
      "--no-show-signature",
      "b4fc42d0d5a0e1f2c3b4a5968778695a4b3c2d1e",
      "--",
    ]);
    expect(options).toMatchObject({
      env: { GIT_NO_LAZY_FETCH: "1", GIT_TERMINAL_PROMPT: "0" },
      timeout: 10_000,
    });
  });
});
