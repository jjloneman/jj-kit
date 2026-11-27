import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  checkChangesetsCli,
  runChangesetJson,
  runChangesetStatus,
} from "./changeset-status.ts";

vi.mock(import("node:child_process"), () => ({ execFileSync: vi.fn() }));

vi.mock(import("node:fs"), () => ({
  mkdtempSync: vi.fn(),
  readFileSync: vi.fn(),
  rmSync: vi.fn(),
}));

/**
 * Fakes `changeset`: `--version` prints a version, and `status` fails or
 * succeeds.
 */
function fakeChangeset({
  isStatusFailing = false,
  version = "3.0.3",
}: {
  /** Whether `changeset status` exits non-zero. */
  isStatusFailing?: boolean;

  /** What `changeset --version` prints. */
  version?: string;
}): void {
  vi.mocked(mkdtempSync).mockImplementation((prefix) => `${prefix}abc`);

  vi.mocked(execFileSync).mockImplementation((_command, args = []) => {
    if (args.includes("--version")) {
      return `${version}\n`;
    }

    if (isStatusFailing) {
      throw Object.assign(new Error("exit 1"), { status: 1 });
    }

    return "";
  });
}

/** A release plan as `changeset status` writes it. */
const PLAN = { changesets: [{ id: "a", releases: [] }], releases: [] };

describe("runChangesetJson", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  test.each([
    { description: "removes", isRemoved: true, shouldKeep: false },
    { description: "keeps, when asked,", isRemoved: false, shouldKeep: true },
  ])(
    "hands read the file, then $description the folder",
    ({ isRemoved, shouldKeep }) => {
      // Given - a command that writes its file.
      fakeChangeset({});
      vi.mocked(readFileSync).mockReturnValue("{}");

      // When - it runs.
      const output = runChangesetJson({
        args: ["publish-plan"],
        env: { RUNNER_TEMP: "/runner/temp" },
        fileName: "plan.json",
        prefix: "plan-",
        read: (written) => written,
        shouldKeep,
      });

      // Then - read got the file and its text, and the folder went or
      // stayed.
      expect(output).toStrictEqual({
        file: "/runner/temp/plan-abc/plan.json",
        folder: "/runner/temp/plan-abc",
        text: "{}",
      });

      expect(vi.mocked(rmSync).mock.calls.length > 0).toBe(isRemoved);
    }
  );

  test("removes the folder and throws when the file can't be read", () => {
    // Given - a command that exits zero but writes no file.
    fakeChangeset({});

    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });

    // When - it runs.
    const run = (): unknown =>
      runChangesetJson({
        args: ["publish-plan"],
        env: { RUNNER_TEMP: "/runner/temp" },
        fileName: "plan.json",
        prefix: "plan-",
        read: (written) => written,
      });

    // Then - the read's error comes through, and the folder is gone.
    expect(run).toThrow("ENOENT");

    expect(rmSync).toHaveBeenCalledWith("/runner/temp/plan-abc", {
      force: true,
      recursive: true,
    });
  });
});

describe("runChangesetJson, when the command can't start", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  test("returns undefined for a command killed by a signal", () => {
    // Given - a command killed on a timeout, so it has a signal but no status.
    vi.mocked(mkdtempSync).mockImplementation((prefix) => `${prefix}abc`);

    vi.mocked(execFileSync).mockImplementation(() => {
      throw Object.assign(new Error("killed"), {
        signal: "SIGKILL",
        status: null,
      });
    });

    // When - it runs.
    const output = runChangesetJson({
      args: ["status"],
      env: {},
      fileName: "status.json",
      prefix: "status-",
      read: (written) => written,
    });

    // Then - it counts as a command that ran and failed.
    expect(output).toBeUndefined();
  });

  test("throws the spawn error and removes the folder", () => {
    // Given - pnpm missing from `PATH`, so the error has no exit status.
    vi.mocked(mkdtempSync).mockImplementation((prefix) => `${prefix}abc`);

    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("spawnSync pnpm ENOENT");
    });

    // When - it runs.
    const run = (): unknown =>
      runChangesetJson({
        args: ["publish-plan"],
        env: { RUNNER_TEMP: "/runner/temp" },
        fileName: "plan.json",
        prefix: "plan-",
        read: (written) => written,
      });

    // Then - the spawn error comes through, and the folder is gone.
    expect(run).toThrow("spawnSync pnpm ENOENT");

    expect(rmSync).toHaveBeenCalledWith("/runner/temp/plan-abc", {
      force: true,
      recursive: true,
    });
  });
});

describe("runChangesetStatus", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  test.each([
    {
      description: "diffs against a ref",
      since: "origin/main",
      sinceArgs: ["--since=origin/main"],
    },
    { description: "reads every changeset", since: undefined, sinceArgs: [] },
  ])("$description and reads the plan", ({ since, sinceArgs }) => {
    // Given - a command that writes a plan.
    fakeChangeset({});
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(PLAN));

    // When - it runs.
    const plan = runChangesetStatus({
      env: { RUNNER_TEMP: "/runner/temp" },
      ...(since === undefined ? {} : { since }),
    });

    // Then - it ran with the right flags, the plan comes back, and the temp
    // folder is gone.
    expect(plan).toStrictEqual(PLAN);

    expect(rmSync).toHaveBeenCalledWith("/runner/temp/changeset-status-abc", {
      force: true,
      recursive: true,
    });

    expect(execFileSync).toHaveBeenCalledWith(
      "pnpm",
      [
        "exec",
        "changeset",
        "status",
        ...sinceArgs,
        "--output=/runner/temp/changeset-status-abc/status.json",
      ],
      { stdio: "inherit" }
    );
  });

  test("returns undefined when the command fails", () => {
    // Given - a command that exits non-zero.
    fakeChangeset({ isStatusFailing: true });

    // When - it runs.
    const plan = runChangesetStatus({ env: {} });

    // Then - there's no plan, nothing was read, and the folder is gone.
    expect(plan).toBeUndefined();
    expect(readFileSync).not.toHaveBeenCalled();
    expect(rmSync).toHaveBeenCalled();
  });
});

describe("checkChangesetsCli", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  test.each([
    { description: "version 3", version: "3.0.3" },
    { description: "a v-prefixed version 4", version: "v4.1.0" },
    {
      description: "a version after a notice line",
      version: "WARN Unsupported engine\n3.2.0",
    },
  ])("accepts $description", ({ version }) => {
    // Given - a new enough `@changesets/cli`.
    fakeChangeset({ version });

    // When - it's checked.
    const check = (): void => {
      checkChangesetsCli();
    };

    // Then - it passes.
    expect(check).not.toThrow();
  });

  test.each([
    { description: "version 2", found: "2.29.1", version: "2.29.1" },
    {
      description: "an unreadable version",
      found: "unknown",
      version: "unknown",
    },
    { description: "no output", found: "none", version: "" },
  ])("refuses $description", ({ found, version }) => {
    // Given - an older or unreadable `@changesets/cli`.
    fakeChangeset({ version });

    // When - it's checked.
    const check = (): void => {
      checkChangesetsCli();
    };

    // Then - it throws, naming what it found.
    expect(check).toThrow(
      `The kit's actions need @changesets/cli 3 or later, but found ${found}.`
    );
  });
});
