import { describe, expect, test } from "vitest";

import {
  judgeReleasePlan,
  NO_CHANGESET_ERROR,
  statusFailureHint,
} from "./status.ts";

describe("judgeReleasePlan", () => {
  test.each([
    {
      changesets: [],
      description: "a PR with no changeset fails",
      expected: NO_CHANGESET_ERROR,
      releases: [],
      shippedPackages: [],
    },
    {
      changesets: [{ id: "empty", releases: [] }],
      description: "a PR with an empty changeset passes",
      expected: undefined,
      releases: [],
      shippedPackages: [],
    },
    {
      changesets: [{ id: "empty", releases: [] }],
      description: "a shipping Renovate PR with an empty changeset fails",
      expected:
        "This Renovate PR changes what @acme/a ships. Add a " +
        "`pnpm changeset` to its branch that bumps it.",
      releases: [],
      shippedPackages: ["@acme/a"],
    },
    {
      changesets: [{ id: "bump-b", releases: [] }],
      description: "a changeset releasing another package fails",
      expected:
        "This Renovate PR changes what @acme/a, @acme/c ships. Add a " +
        "`pnpm changeset` to its branch that bumps each of them.",
      releases: [{ name: "@acme/b", type: "minor" }],
      shippedPackages: ["@acme/a", "@acme/c"],
    },
    {
      changesets: [{ id: "none-a", releases: [] }],
      description: "a changeset naming the package with none fails",
      expected:
        "This Renovate PR changes what @acme/a ships. Add a " +
        "`pnpm changeset` to its branch that bumps it.",
      releases: [{ name: "@acme/a", type: "none" }],
      shippedPackages: ["@acme/a"],
    },
    {
      changesets: [{ id: "bump-a", releases: [] }],
      description: "a changeset releasing each shipped package passes",
      expected: undefined,
      releases: [
        { name: "@acme/a", type: "patch" },
        { name: "@acme/b", type: "minor" },
      ],
      shippedPackages: ["@acme/a"],
    },
  ])("$description", ({ changesets, expected, releases, shippedPackages }) => {
    // Given - the PR's release plan and the packages it ships.
    const plan = { changesets, releases };

    // When - it's judged.
    const error = judgeReleasePlan({ plan, shippedPackages });

    // Then - it gets the expected verdict.
    expect(error).toBe(expected);
  });
});

describe("statusFailureHint", () => {
  test.each([
    {
      description: "a plain PR gets the changeset hint",
      expected:
        "`changeset status` failed; see its output above. If this PR adds " +
        "no changeset, run `pnpm changeset`, or `pnpm changeset --empty` if " +
        "it releases nothing.",
      shippedPackages: [],
    },
    {
      description: "a shipping Renovate PR gets the Renovate hint",
      expected:
        "`changeset status` failed; see its output above. This Renovate PR " +
        "changes what @acme/a ships. Add a `pnpm changeset` to its branch " +
        "that bumps it.",
      shippedPackages: ["@acme/a"],
    },
  ])("$description", ({ expected, shippedPackages }) => {
    // Given - the packages the PR ships, if any.

    // When - the hint is built.
    const hint = statusFailureHint(shippedPackages);

    // Then - it fits the PR.
    expect(hint).toBe(expected);
  });
});
