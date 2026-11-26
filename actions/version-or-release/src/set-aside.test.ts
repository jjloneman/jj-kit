import { describe, expect, test } from "vitest";

import { decideSetAside, parseWorkspacePackages } from "./set-aside.ts";

/** A released public package. */
const RELEASED = {
  isPrivate: false,
  name: "@acme/a",
  path: "/repo/a",
  version: "1.2.0",
};

/** A config with Changesets' defaults. */
const NO_CONFIG = {
  ignore: [],
  isPrivateTagged: false,
  isPrivateVersioned: false,
};

/** A config that tags private packages and ignores `@acme/docs`. */
const TAGS_PRIVATE = {
  ignore: ["@acme/docs"],
  isPrivateTagged: true,
  isPrivateVersioned: true,
};

/** An empty changeset. */
const EMPTY = { id: "empty-one", releases: [] };

describe("decideSetAside", () => {
  test.each([
    {
      changesets: [],
      config: NO_CONFIG,
      description: "leaves things alone with nothing pending",
      ids: [],
      packages: [RELEASED],
      reason: "No changeset is pending.",
      shouldAnnotate: false,
    },
    {
      changesets: [EMPTY, { id: "bump-a", releases: [{ name: "@acme/a" }] }],
      config: NO_CONFIG,
      description: "waits for the version PR while one releases",
      ids: [],
      packages: [RELEASED],
      reason:
        "A pending changeset releases a package, so it waits for the version " +
        "PR.",
      shouldAnnotate: false,
    },
    {
      changesets: [EMPTY],
      config: NO_CONFIG,
      description: "holds back while a public package is unreleased",
      ids: [],
      packages: [
        RELEASED,
        {
          isPrivate: false,
          name: "@acme/new",
          path: "/repo/new",
          version: "0.0.0",
        },
      ],
      reason:
        "Every pending changeset is empty, but @acme/new is still at 0.0.0, " +
        "so nothing is released until its version PR.",
      shouldAnnotate: true,
    },
    {
      changesets: [EMPTY],
      config: TAGS_PRIVATE,
      description: "holds back while a tagged private package is unreleased",
      ids: [],
      packages: [
        RELEASED,
        {
          isPrivate: true,
          name: "an-action",
          path: "/repo/action",
          version: "0.0.0",
        },
      ],
      reason:
        "Every pending changeset is empty, but an-action is still at 0.0.0, " +
        "so nothing is released until its version PR.",
      shouldAnnotate: true,
    },
    {
      changesets: [EMPTY],
      config: TAGS_PRIVATE,
      description: "ignores an unreleased package the config ignores",
      ids: ["empty-one"],
      packages: [
        RELEASED,
        {
          isPrivate: false,
          name: "@acme/docs",
          path: "/repo/docs",
          version: "0.0.0",
        },
      ],
      reason:
        "Every pending changeset is empty, so this run publishes anything npm " +
        "doesn't have yet.",
      shouldAnnotate: true,
    },
    {
      changesets: [EMPTY, { id: "bump-node-26.1", releases: [] }],
      config: NO_CONFIG,
      description: "sets aside only-empty changesets",
      ids: ["empty-one", "bump-node-26.1"],
      packages: [
        RELEASED,
        {
          isPrivate: true,
          name: "an-app",
          path: "/repo/app",
          version: "0.0.0",
        },
        {
          isPrivate: true,
          name: undefined,
          path: "/repo/tools",
          version: undefined,
        },
      ],
      reason:
        "Every pending changeset is empty, so this run publishes anything npm " +
        "doesn't have yet.",
      shouldAnnotate: true,
    },
  ])(
    "$description",
    ({ changesets, config, ids, packages, reason, shouldAnnotate }) => {
      // Given - the pending changesets and the workspace's packages.

      // When - it decides.
      const decision = decideSetAside({
        changesets,
        config,
        packages,
      });

      // Then - it sets aside the expected changesets, and says why.
      expect(decision).toStrictEqual({ ids, reason, shouldAnnotate });
    }
  );
});

describe("parseWorkspacePackages", () => {
  test("reads each package, leaving out a monorepo's root", () => {
    // Given - pnpm's listing, with a nameless root and a nameless package.
    const text = JSON.stringify([
      { path: "/repo", private: true, version: "0.0.0" },
      { name: "@acme/a", path: "/repo/a", private: false, version: "1.0.0" },
      { path: "/repo/b", version: "2.0.0" },
    ]);

    // When - it's parsed.
    const packages = parseWorkspacePackages({ rootDir: "/repo/", text });

    // Then - the root is gone, matched despite the trailing slash.
    expect(packages).toStrictEqual([
      { isPrivate: false, name: "@acme/a", path: "/repo/a", version: "1.0.0" },
      { isPrivate: false, name: undefined, path: "/repo/b", version: "2.0.0" },
    ]);
  });

  test("keeps the root of a single-package repo", () => {
    // Given - pnpm's listing of a repo whose root is its only package.
    const text = JSON.stringify([{ name: "solo", path: "/repo" }]);

    // When - it's parsed.
    const packages = parseWorkspacePackages({ rootDir: "/repo", text });

    // Then - the root stays.
    expect(packages).toStrictEqual([
      { isPrivate: false, name: "solo", path: "/repo", version: undefined },
    ]);
  });

  test.each([
    { description: "an object", text: "{}" },
    { description: "an entry that isn't an object", text: "[1]" },
    { description: "an entry without a path", text: '[{"name":"a"}]' },
    { description: "a path that isn't a string", text: '[{"path":1}]' },
  ])("rejects $description", ({ text }) => {
    // Given - output that isn't a package listing.

    // When - it's parsed.
    const parse = (): unknown => parseWorkspacePackages({ rootDir: "/", text });

    // Then - it throws rather than guess.
    expect(parse).toThrow(TypeError);
  });
});
