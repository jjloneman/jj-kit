import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { main } from "./main.ts";

vi.mock(import("node:child_process"), () => ({ execFileSync: vi.fn() }));

vi.mock(import("node:fs"), () => ({
  existsSync: vi.fn(),
  mkdtempSync: vi.fn(),
  readFileSync: vi.fn(),
  realpathSync: Object.assign(vi.fn(), { native: vi.fn() }),
  rmSync: vi.fn(),
}));

/** How the fake commands and files behave in one case. */
type Fakes = {
  /** The changesets `changeset status` lists, or `undefined` to fail. */
  changesets?: { id: string; releases: unknown[] }[];

  /** The Changesets config's text, or `undefined` for no config. */
  config?: string;
};

/** A workspace listing with one released public package. */
const PACKAGES = JSON.stringify([
  { name: "@acme/a", path: "/repo/a", private: false, version: "1.0.0" },
]);

/**
 * Points the mocked commands and files at fakes.
 *
 * @param fakes - how they behave.
 */
function fake(fakes: Fakes): void {
  const { changesets, config } = fakes;

  vi.mocked(existsSync).mockReturnValue(config !== undefined);
  vi.mocked(realpathSync).mockReturnValue("/repo");
  vi.mocked(mkdtempSync).mockImplementation((prefix) => `${prefix}abc`);

  vi.mocked(readFileSync).mockImplementation((file) =>
    file === ".changeset/config.json"
      ? (config ?? "")
      : JSON.stringify({ changesets, releases: [] })
  );

  vi.mocked(execFileSync).mockImplementation((_command, args = []) => {
    if (args.includes("--version")) {
      return "3.0.3\n";
    }

    if (args.includes("status") && changesets === undefined) {
      throw new Error("changeset status exited with 1");
    }

    return args.includes("ls") ? PACKAGES : "";
  });
}

/** @returns every line `main` printed, in order. */
function printed(): string[] {
  return vi.mocked(console.log).mock.calls.map((call) => String(call[0]));
}

describe("main", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  test("deletes every changeset when all are empty", () => {
    // Given - two empty changesets pending, with private packages tagged.
    fake({
      changesets: [
        { id: "empty-one", releases: [] },
        { id: "empty-two", releases: [] },
      ],
      config: '{"privatePackages":{"tag":true,"version":true}}',
    });

    // When - the step runs.
    const code = main({ RUNNER_TEMP: "/runner/temp" });

    // Then - both are deleted from the checkout, and it says why.
    expect(code).toBe(0);

    expect(
      vi
        .mocked(rmSync)
        .mock.calls.filter(([file]) => String(file).startsWith(".changeset"))
    ).toStrictEqual([
      [path.join(".changeset", "empty-one.md")],
      [path.join(".changeset", "empty-two.md")],
    ]);

    expect(printed()).toStrictEqual([
      "::notice::Every pending changeset is empty, so this run publishes " +
        "anything npm doesn't have yet.",
    ]);

    expect(execFileSync).toHaveBeenCalledWith(
      "pnpm",
      [
        "exec",
        "changeset",
        "status",
        "--output=/runner/temp/changeset-status-abc/status.json",
      ],
      { stdio: "inherit" }
    );
  });

  test("leaves a releasing changeset alone, off a runner", () => {
    // Given - a releasing changeset, no config and no `RUNNER_TEMP`.
    fake({ changesets: [{ id: "bump", releases: [{ name: "@acme/a" }] }] });

    // When - the step runs.
    const code = main({});

    // Then - nothing is deleted, and the plan goes under the OS temp folder.
    expect(code).toBe(0);

    expect(rmSync).not.toHaveBeenCalledWith(
      expect.stringMatching(/^\.changeset/u)
    );

    expect(printed()).toStrictEqual([
      "A pending changeset releases a package, so it waits for the version PR.",
    ]);

    expect(mkdtempSync).toHaveBeenCalledWith(
      path.join(tmpdir(), "changeset-status-")
    );
  });

  test("warns and leaves things alone when status fails", () => {
    // Given - `changeset status` fails, as on a detached checkout.
    fake({});

    // When - the step runs.
    const code = main({});

    // Then - it passes, so changesets/action still runs.
    expect(code).toBe(0);

    expect(rmSync).not.toHaveBeenCalledWith(
      expect.stringMatching(/^\.changeset/u)
    );

    expect(printed()).toStrictEqual([
      "::warning::Couldn't read the pending changesets, so they're left as " +
        "they are: changeset status failed; see its output above.",
    ]);
  });

  test("warns when the temp folder can't be made", () => {
    // Given - a temp folder that throws something odd.
    fake({ changesets: [] });
    const odd: unknown = "odd\nthrow";

    vi.mocked(mkdtempSync).mockImplementation(() => {
      throw odd;
    });

    // When - the step runs.
    const code = main({ RUNNER_TEMP: "/read-only" });

    // Then - it warns with the escaped value, and passes.
    expect(code).toBe(0);

    expect(printed()).toStrictEqual([
      "::warning::Couldn't read the pending changesets, so they're left as " +
        "they are: odd%0Athrow",
    ]);
  });

  test("fails on @changesets/cli older than 3", () => {
    // Given - version 2 of the CLI.
    fake({ changesets: [] });
    vi.mocked(execFileSync).mockReturnValue("2.29.1\n");

    // When - the step runs.
    const code = main({});

    // Then - it fails, as the docs promise, without reading anything.
    expect(code).toBe(1);

    expect(printed()).toStrictEqual([
      "::error::The kit's actions need @changesets/cli 3 or later, but found " +
        "2.29.1.",
    ]);
  });

  test("fails when deleting a changeset throws", () => {
    // Given - an empty changeset that can't be deleted.
    fake({ changesets: [{ id: "empty-one", releases: [] }] });

    vi.mocked(rmSync).mockImplementation((file) => {
      if (String(file).startsWith(".changeset")) {
        throw new Error("permission denied");
      }
    });

    // When - the step runs.
    const code = main({});

    // Then - it fails, rather than run from a half-deleted set.
    expect(code).toBe(1);
    expect(printed()).toStrictEqual(["::error::permission denied"]);
  });
});
