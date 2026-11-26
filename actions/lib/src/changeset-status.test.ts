import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { afterEach, describe, expect, test, vi } from "vitest";

import { checkChangesetsCli, runChangesetStatus } from "./changeset-status.ts";

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
      throw new Error("exit 1");
    }

    return "";
  });
}

/** A release plan as `changeset status` writes it. */
const PLAN = { changesets: [{ id: "a", releases: [] }], releases: [] };

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
