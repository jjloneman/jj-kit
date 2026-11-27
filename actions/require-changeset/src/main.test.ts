import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { Environment } from "../../lib/src/environment.ts";

import { main } from "./main.ts";
import { NO_CHANGESET_ERROR, statusFailureHint } from "./status.ts";

vi.mock(import("node:child_process"), () => ({ execFileSync: vi.fn() }));

vi.mock(import("node:fs"), () => ({
  mkdtempSync: vi.fn(),
  readFileSync: vi.fn(),
  rmSync: vi.fn(),
}));

/** How the fake git, yq and pnpm behave in one case. */
type Fakes = {
  /** The paths `git diff` reports as changed. */
  changed?: string[];

  /** Each revision's files, by revision then path. */
  files?: Record<string, Record<string, string>>;

  /** Whether `origin/<base>` is missing. */
  isBaseMissing?: boolean;

  /** Whether the checkout is shallow. */
  isShallow?: boolean;

  /** What `pnpm pack` lists, by the folder it runs in. */
  packed?: Record<string, string[]>;

  /** What `changeset status` writes, or `undefined` for it to fail. */
  plan?: {
    changesets: { id: string; releases: unknown[] }[];
    releases: { name: string; type: string }[];
  };

  /** A value to throw from `git ls-tree`, for unexpected errors. */
  thrown?: unknown;
};

/** A PR from a feature branch in the base repo, into `main`. */
const FEATURE_PR: Environment = {
  BASE: "main",
  HEAD_REF: "feature/gh-1-thing",
  HEAD_REPO: "acme/widgets",
  PR_AUTHOR: "ada",
  RENOVATE_AUTHORS: "renovate[bot]",
  RENOVATE_BRANCHES: "renovate/**",
  REPOSITORY: "acme/widgets",
  RUNNER_TEMP: "/runner/temp",
  SKIP_BRANCHES: "release/*",
  VERSION_PR_AUTHORS: "github-actions[bot]",
};

/** A Renovate PR from the base repo, into `main`. */
const RENOVATE_PR: Environment = {
  ...FEATURE_PR,
  HEAD_REF: "renovate/lodash-4.x",
  PR_AUTHOR: "renovate[bot]",
};

/** A workspace with one package, as JSON, which `yq` passes through. */
const WORKSPACE = JSON.stringify({ packages: ["packages/*"] });

/**
 * Points the mocked commands at fakes.
 *
 * @param fakes - how they behave.
 */
function fake(fakes: Fakes): void {
  const files = fakes.files ?? {};

  vi.mocked(mkdtempSync).mockImplementation((prefix) => `${prefix}abc`);

  // Only the plan's file is read from disk; any other read is a bug.
  vi.mocked(readFileSync).mockImplementation((file) => {
    if (String(file).endsWith("/status.json")) {
      return JSON.stringify(fakes.plan);
    }

    throw new Error(`ENOENT: ${String(file)}`);
  });

  vi.mocked(execFileSync).mockImplementation((command, args = [], options) => {
    const [subcommand, ...rest] = args;

    if (command === "pnpm" && args.includes("--version")) {
      return "3.0.3\n";
    }

    if (command === "pnpm" && subcommand === "pack") {
      const folder = String(options?.cwd);

      return JSON.stringify({
        files: (fakes.packed?.[folder] ?? []).map((file) => ({ path: file })),
      });
    }

    if (command === "pnpm") {
      if (fakes.plan === undefined) {
        throw Object.assign(new Error("changeset status exited with 1"), {
          status: 1,
        });
      }

      return "";
    }

    if (command === "yq") {
      return typeof options?.input === "string" ? options.input : "";
    }

    if (subcommand === "rev-parse" && rest[0] === "--is-shallow-repository") {
      return fakes.isShallow === true ? "true\n" : "false\n";
    }

    if (subcommand === "rev-parse") {
      if (fakes.isBaseMissing === true) {
        throw new Error("exit 1");
      }

      return "base-sha\n";
    }

    if (subcommand === "merge-base") {
      return "base-sha\n";
    }

    if (subcommand === "diff") {
      return (fakes.changed ?? []).map((file) => `${file}\0`).join("");
    }

    if (subcommand === "ls-tree") {
      if ("thrown" in fakes) {
        throw fakes.thrown;
      }

      const revision = rest.at(-1) ?? "";

      return Object.keys(files[revision] ?? {})
        .map((file) => `100644 blob ${revision}:${file}\t${file}\0`)
        .join("");
    }

    // `git cat-file --batch`, where each object id is `<revision>:<path>`.
    const input = typeof options?.input === "string" ? options.input : "";
    const objects = input.split("\n").filter((object) => object !== "");

    return Buffer.concat(
      objects.map((object) => {
        const [revision = "", file = ""] = object.split(":");
        const content = Buffer.from(files[revision]?.[file] ?? "");

        return Buffer.concat([
          Buffer.from(`${object} blob ${String(content.length)}\n`),
          content,
          Buffer.from("\n"),
        ]);
      })
    );
  });
}

/**
 * Makes `@acme/a`'s manifest, which depends on `lodash` at a version.
 *
 * @param version - the `lodash` spec.
 * @returns the manifest's text.
 */
function manifest(version: string): string {
  return JSON.stringify({
    dependencies: { lodash: version },
    name: "@acme/a",
    version: "1.0.0",
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

  test("fails outside a pull request", () => {
    // Given - no base or head branch, as on a push.
    fake({});

    // When - the check runs.
    const code = main({ REPOSITORY: "acme/widgets" });

    // Then - it fails with the reason.
    expect(code).toBe(1);

    expect(printed()).toStrictEqual([
      "::error::require-changeset runs on pull_request events only, where " +
        "the base and head branches are known.",
    ]);
  });

  test.each([
    {
      description: "skips the version PR",
      env: {
        ...FEATURE_PR,
        HEAD_REF: "changeset-release/main",
        PR_AUTHOR: "github-actions[bot]",
      },
      message:
        "::notice::Skipped: changeset-release/main is the version PR, which " +
        "only consumes changesets.",
    },
    {
      description: "skips a branch matching skip-branches, escaping it",
      env: { ...FEATURE_PR, HEAD_REF: "release/50%" },
      message: "::notice::Skipped: release/50%25 matches `skip-branches`.",
    },
  ])("$description", ({ env, message }) => {
    // Given - a PR the check skips.
    fake({});

    // When - the check runs.
    const code = main(env);

    // Then - it passes without running git.
    expect(code).toBe(0);
    expect(printed()).toStrictEqual([message]);
    expect(execFileSync).not.toHaveBeenCalled();
  });

  test.each([
    {
      description: "fails on a shallow checkout",
      fakes: { isShallow: true },
      message:
        "::error::The checkout is shallow. Check out with `fetch-depth: 0`, " +
        "so the base branch can be diffed against.",
    },
    {
      description: "fails when the base branch isn't fetched",
      fakes: { isBaseMissing: true },
      message:
        "::error::origin/main isn't fetched. Check out with `fetch-depth: 0`.",
    },
  ])("$description", ({ fakes, message }) => {
    // Given - a checkout without the base branch's history.
    fake(fakes);

    // When - the check runs.
    const code = main(FEATURE_PR);

    // Then - it fails with how to fix the checkout.
    expect(code).toBe(1);
    expect(printed()).toStrictEqual([message]);
  });

  test("passes a PR with a changeset", () => {
    // Given - a release plan listing the PR's changeset.
    fake({ plan: { changesets: [{ id: "a", releases: [] }], releases: [] } });

    // When - the check runs.
    const code = main(FEATURE_PR);

    // Then - it passes, having diffed against the base branch.
    expect(code).toBe(0);
    expect(printed()).toStrictEqual(["This PR adds a changeset."]);

    expect(execFileSync).toHaveBeenCalledWith(
      "pnpm",
      [
        "exec",
        "changeset",
        "status",
        "--since=origin/main",
        "--output=/runner/temp/changeset-status-abc/status.json",
      ],
      { stdio: "inherit" }
    );
  });

  test.each([
    {
      description: "with no RUNNER_TEMP",
      env: { BASE: "main", HEAD_REF: "feature/thing" },
    },
    {
      description: "with an empty RUNNER_TEMP",
      env: { BASE: "main", HEAD_REF: "feature/thing", RUNNER_TEMP: "" },
    },
  ])("writes the plan under the OS temp folder $description", ({ env }) => {
    // Given - only the branches in the environment.
    fake({ plan: { changesets: [{ id: "a", releases: [] }], releases: [] } });

    // When - the check runs.
    const code = main(env);

    // Then - the plan goes under the OS temp folder.
    expect(code).toBe(0);

    expect(mkdtempSync).toHaveBeenCalledWith(
      path.join(tmpdir(), "changeset-status-")
    );
  });

  test("fails a PR with no changeset", () => {
    // Given - a release plan with no changesets.
    fake({ plan: { changesets: [], releases: [] } });

    // When - the check runs.
    const code = main(FEATURE_PR);

    // Then - it fails with the hint.
    expect(code).toBe(1);
    expect(printed()).toStrictEqual([`::error::${NO_CHANGESET_ERROR}`]);
  });

  test("fails when changeset status fails", () => {
    // Given - `changeset status` exits non-zero.
    fake({});

    // When - the check runs.
    const code = main(FEATURE_PR);

    // Then - it fails with the hint.
    expect(code).toBe(1);
    expect(printed()).toStrictEqual([`::error::${statusFailureHint([])}`]);
  });

  test("skips a Renovate PR that ships nothing", () => {
    // Given - a Renovate PR whose package manifest doesn't change.
    const files = {
      "package.json": JSON.stringify({ private: true }),
      "packages/a/package.json": manifest("^4.0.0"),
      "pnpm-workspace.yaml": WORKSPACE,
    };

    fake({
      changed: ["pnpm-lock.yaml"],
      files: { "base-sha": files, HEAD: files },
    });

    // When - the check runs.
    const code = main(RENOVATE_PR);

    // Then - it passes without asking for a changeset.
    expect(code).toBe(0);

    expect(printed()).toStrictEqual([
      "::notice::Skipped: this Renovate PR changes no package's " +
        "dependencies, peer or optional dependencies, or engines, and no " +
        "file a package ships.",
    ]);
  });

  test("reads an empty workspace file as none", () => {
    // Given - a Renovate PR in a repo whose workspace file is empty.
    const files = {
      "package.json": JSON.stringify({ private: true }),
      "pnpm-workspace.yaml": "",
    };

    fake({
      changed: ["pnpm-lock.yaml"],
      files: { "base-sha": files, HEAD: files },
    });

    // When - the check runs.
    const code = main(RENOVATE_PR);

    // Then - it parses and skips the lockfile-only change.
    expect(code).toBe(0);
  });

  test("checks a Renovate PR that changes an unversioned package's file", () => {
    // Given - a Renovate PR that changes a private app's source file.
    const files = {
      "package.json": JSON.stringify({ private: true }),
      "packages/a/package.json": JSON.stringify({ name: "app", private: true }),
      "pnpm-workspace.yaml": WORKSPACE,
    };

    fake({
      changed: ["packages/a/src/index.ts"],
      files: { "base-sha": files, HEAD: files },
      plan: { changesets: [], releases: [] },
    });

    // When - the check runs.
    const code = main(RENOVATE_PR);

    // Then - it needs a changeset like any other PR.
    expect(code).toBe(1);
    expect(printed()).toStrictEqual([`::error::${NO_CHANGESET_ERROR}`]);
  });

  test.each([
    {
      description: "passes a shipping Renovate PR that releases it",
      expected: 0,
      message: "This Renovate PR's changeset releases @acme/a.",
      plan: {
        changesets: [{ id: "a", releases: [] }],
        releases: [{ name: "@acme/a", type: "minor" }],
      },
    },
    {
      description: "fails a shipping Renovate PR that releases another",
      expected: 1,
      message:
        "::error::This Renovate PR changes what @acme/a ships. Add a " +
        "`pnpm changeset` to its branch that bumps it.",
      plan: {
        changesets: [{ id: "a", releases: [] }],
        releases: [{ name: "@acme/b", type: "minor" }],
      },
    },
    {
      description: "names the package when changeset status fails",
      expected: 1,
      message: `::error::${statusFailureHint(["@acme/a"])}`,
      plan: undefined,
    },
  ])("$description", ({ expected, message, plan }) => {
    // Given - a Renovate PR that bumps a package's dependency.
    const base = {
      "packages/a/package.json": manifest("^4.0.0"),
      "pnpm-workspace.yaml": WORKSPACE,
    };

    fake({
      changed: ["packages/a/package.json"],
      files: {
        "base-sha": base,
        HEAD: { ...base, "packages/a/package.json": manifest("^4.1.0") },
      },
      ...(plan === undefined ? {} : { plan }),
    });

    // When - the check runs.
    const code = main(RENOVATE_PR);

    // Then - it needs a changeset that releases a package.
    expect(code).toBe(expected);
    expect(printed()).toStrictEqual([message]);
  });

  test("asks a shipping source change for a release, packing its package", () => {
    // Given - a Renovate PR that changes a file `@acme/a` publishes.
    const files = {
      "packages/a/package.json": manifest("^4.0.0"),
      "packages/a/src/index.ts": "export const a = 1;",
      "pnpm-workspace.yaml": WORKSPACE,
    };

    fake({
      changed: ["packages/a/src/index.ts"],
      files: { "base-sha": files, HEAD: files },
      packed: { "packages/a": ["package.json", "src/index.ts"] },
      plan: {
        changesets: [{ id: "a", releases: [] }],
        releases: [{ name: "@acme/a", type: "patch" }],
      },
    });

    // When - the check runs.
    const code = main(RENOVATE_PR);

    // Then - it packed the package with scripts and the pnpmfile off, and the release passes.
    expect(code).toBe(0);

    expect(execFileSync).toHaveBeenCalledWith(
      "pnpm",
      ["pack", "--dry-run", "--json", "--ignore-scripts", "--ignore-pnpmfile"],
      expect.objectContaining({ cwd: "packages/a" })
    );

    expect(printed()).toStrictEqual([
      "This Renovate PR's changeset releases @acme/a.",
    ]);
  });

  test.each([
    {
      description: "an error",
      message: "::error::git broke",
      thrown: new Error("git broke"),
    },
    {
      description: "a non-error, escaping its line breaks",
      message: "::error::odd%0Athrow%0D",
      thrown: "odd\nthrow\r",
    },
  ])("fails on $description thrown while checking", ({ message, thrown }) => {
    // Given - git throws while reading a Renovate PR's trees.
    fake({ thrown });

    // When - the check runs.
    const code = main(RENOVATE_PR);

    // Then - it fails rather than skip the changeset.
    expect(code).toBe(1);
    expect(printed()).toStrictEqual([message]);
  });
});
