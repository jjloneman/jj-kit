import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { main } from "./main.ts";

vi.mock(import("node:child_process"), () => ({ execFileSync: vi.fn() }));

vi.mock(import("node:fs"), () => ({
  appendFileSync: vi.fn(),
  mkdtempSync: vi.fn(),
  readFileSync: vi.fn(),
  rmSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

/** How the fake commands and files behave in one case. */
type Fakes = {
  /** The changesets `changeset status` lists, or `undefined` to fail. */
  changesets?: { id: string; releases: unknown[] }[];

  /** The publish plan's text, or `undefined` for `publish-plan` to fail. */
  plan?: string;
};

/** A plan with one publish of a released package. */
const PLAN = JSON.stringify({
  plan: [[{ kind: "publish", name: "@acme/a", version: "1.1.0" }]],
  version: 1,
});

/**
 * Points the mocked commands and files at fakes.
 *
 * @param fakes - how they behave.
 */
function fake(fakes: Fakes): void {
  const { changesets, plan } = fakes;

  vi.mocked(mkdtempSync).mockImplementation((prefix) => `${prefix}abc`);

  vi.mocked(readFileSync).mockImplementation((file) => {
    if (String(file).endsWith("status.json")) {
      return JSON.stringify({ changesets, releases: [] });
    }

    return String(file) === path.join("/repo/a", "package.json")
      ? JSON.stringify({ name: "new-action" })
      : (plan ?? "");
  });

  vi.mocked(execFileSync).mockImplementation((_command, args = []) => {
    if (args.includes("--version")) {
      return "3.0.3\n";
    }

    if (args.includes("status") && changesets === undefined) {
      throw new Error("changeset status exited with 1");
    }

    if (args.includes("publish-plan") && plan === undefined) {
      throw new Error("changeset publish-plan exited with 1");
    }

    return args.includes("ls") ? JSON.stringify([{ path: "/repo/a" }]) : "";
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

  test("publishes what the plan lists, past an empty changeset", () => {
    // Given - an empty changeset, and a publish waiting.
    fake({ changesets: [{ id: "docs", releases: [] }], plan: PLAN });

    // When - the step runs on a runner.
    const code = main({
      GITHUB_OUTPUT: "/runner/output",
      RUNNER_TEMP: "/runner/temp",
    });

    // Then - it keeps the checked plan for the pack step, and removes the raw
    // one.
    expect(code).toBe(0);

    expect(appendFileSync).toHaveBeenCalledWith(
      "/runner/output",
      "next=publish\n" +
        "plan-file=/runner/temp/changesets-publish-plan-abc/publish-plan.json\n" +
        "should-build=true\n"
    );

    expect(execFileSync).toHaveBeenCalledWith(
      "pnpm",
      [
        "exec",
        "changeset",
        "publish-plan",
        "--output=/runner/temp/changesets-publish-plan-abc/raw-publish-plan.json",
      ],
      { stdio: "inherit" }
    );

    expect(writeFileSync).toHaveBeenCalledWith(
      "/runner/temp/changesets-publish-plan-abc/publish-plan.json",
      JSON.stringify(JSON.parse(PLAN), undefined, 2)
    );

    expect(rmSync).toHaveBeenCalledWith(
      "/runner/temp/changesets-publish-plan-abc/raw-publish-plan.json",
      { force: true }
    );

    expect(rmSync).not.toHaveBeenCalledWith(
      "/runner/temp/changesets-publish-plan-abc",
      expect.anything()
    );

    expect(printed()).toStrictEqual([
      "::notice::Publishing or tagging @acme/a@1.1.0.",
    ]);
  });

  test("opens the version PR without asking the registry, off a runner", () => {
    // Given - a releasing changeset, and no `RUNNER_TEMP`.
    fake({ changesets: [{ id: "bump", releases: [{ name: "@acme/a" }] }] });

    // When - the step runs.
    const code = main({ GITHUB_OUTPUT: "/out" });

    // Then - it logs why, under the OS temp folder, and never plans.
    expect(code).toBe(0);

    expect(appendFileSync).toHaveBeenCalledWith(
      "/out",
      "next=version\nplan-file=\nshould-build=false\n"
    );

    expect(mkdtempSync).toHaveBeenCalledWith(
      path.join(tmpdir(), "changeset-status-")
    );

    expect(mkdtempSync).not.toHaveBeenCalledWith(
      path.join(tmpdir(), "changesets-publish-plan-")
    );

    expect(execFileSync).not.toHaveBeenCalledWith(
      "pnpm",
      expect.arrayContaining(["publish-plan"]),
      expect.anything()
    );

    expect(printed()).toStrictEqual([
      "A pending changeset releases a package, so the version PR comes first.",
    ]);
  });

  test("does nothing, removing the plan, when only 0.0.0 entries wait", () => {
    // Given - a new action alone in the plan.
    fake({
      changesets: [],
      plan: JSON.stringify({
        plan: [[{ kind: "tag-only", name: "new-action", version: "0.0.0" }]],
        version: 1,
      }),
    });

    // When - the step runs.
    const code = main({ GITHUB_OUTPUT: "/out", RUNNER_TEMP: "/tmp/run" });

    // Then - nothing publishes, the folder goes, and a notice names it.
    expect(code).toBe(0);

    expect(appendFileSync).toHaveBeenCalledWith(
      "/out",
      "next=none\nplan-file=\nshould-build=false\n"
    );

    expect(rmSync).toHaveBeenCalledWith(
      "/tmp/run/changesets-publish-plan-abc",
      {
        force: true,
        recursive: true,
      }
    );

    expect(printed()).toStrictEqual([
      "::notice::Holding back new-action, at 0.0.0 or depending on a package " +
        "that is, until a version PR bumps it.",
    ]);
  });

  test.each([
    { description: "unset", env: {} },
    { description: "empty", env: { GITHUB_OUTPUT: "" } },
  ])("fails with GITHUB_OUTPUT $description", ({ env }) => {
    // Given - nowhere to write the outputs.
    fake({ changesets: [], plan: PLAN });

    // When - the step runs.
    const code = main(env);

    // Then - it fails before reading the changesets or the plan.
    expect(code).toBe(1);

    expect(execFileSync).not.toHaveBeenCalledWith(
      "pnpm",
      expect.arrayContaining(["status"]),
      expect.anything()
    );

    expect(execFileSync).not.toHaveBeenCalledWith(
      "pnpm",
      expect.arrayContaining(["publish-plan"]),
      expect.anything()
    );

    expect(printed()).toStrictEqual([
      "::error::GITHUB_OUTPUT isn't set, so there's nowhere to write.",
    ]);
  });

  test("fails when status fails", () => {
    // Given - `changeset status` fails.
    fake({});

    // When - the step runs.
    const code = main({ GITHUB_OUTPUT: "/out" });

    // Then - it fails rather than guess.
    expect(code).toBe(1);
    expect(appendFileSync).not.toHaveBeenCalled();

    expect(printed()).toStrictEqual([
      "::error::changeset status failed; see its output above.",
    ]);
  });

  test("fails when publish-plan fails", () => {
    // Given - no changesets, and `changeset publish-plan` fails.
    fake({ changesets: [] });

    // When - the step runs.
    const code = main({ GITHUB_OUTPUT: "/out" });

    // Then - it fails rather than guess, and removes the plan's folder.
    expect(code).toBe(1);
    expect(appendFileSync).not.toHaveBeenCalled();

    expect(rmSync).toHaveBeenCalledWith(
      path.join(tmpdir(), "changesets-publish-plan-abc"),
      { force: true, recursive: true }
    );

    expect(printed()).toStrictEqual([
      "::error::changeset publish-plan exited with 1",
    ]);
  });

  test("fails on a plan of another format, removing it", () => {
    // Given - a plan in a format the actions don't read.
    fake({ changesets: [], plan: '{"plan":[],"version":2}' });

    // When - the step runs.
    const code = main({ GITHUB_OUTPUT: "/out" });

    // Then - it fails, and the plan's folder is removed all the same.
    expect(code).toBe(1);

    expect(rmSync).toHaveBeenCalledWith(
      path.join(tmpdir(), "changesets-publish-plan-abc"),
      { force: true, recursive: true }
    );

    expect(printed()).toStrictEqual([
      "::error::The publish plan isn't format 1, the only one the actions " +
        "read.",
    ]);
  });

  test("fails on @changesets/cli older than 3", () => {
    // Given - version 2 of the CLI.
    fake({ changesets: [] });
    vi.mocked(execFileSync).mockReturnValue("2.29.1\n");

    // When - the step runs.
    const code = main({ GITHUB_OUTPUT: "/out" });

    // Then - it fails without reading anything.
    expect(code).toBe(1);

    expect(printed()).toStrictEqual([
      "::error::The kit's actions need @changesets/cli 3 or later, but found " +
        "2.29.1.",
    ]);
  });
});
