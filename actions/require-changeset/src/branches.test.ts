import { describe, expect, test } from "vitest";

import { classifyPullRequest, parseLines } from "./branches.ts";

/** The base repo every same-repo case shares. */
const REPO = "acme/widgets";

describe("classifyPullRequest", () => {
  test.each([
    {
      author: "ada",
      description: "a feature branch needs a check",
      expected: "check",
      headRef: "feature/gh-1-thing",
      headRepo: REPO,
    },
    {
      author: "github-actions[bot]",
      description: "the version PR skips",
      expected: "version-pr",
      headRef: "changeset-release/main",
      headRepo: REPO,
    },
    {
      author: "github-actions[bot]",
      description: "a fork's version-PR branch is checked",
      expected: "check",
      headRef: "changeset-release/main",
      headRepo: "mallory/widgets",
    },
    {
      author: "ada",
      description: "a version-PR branch for another base is checked",
      expected: "check",
      headRef: "changeset-release/next",
      headRepo: REPO,
    },
    {
      author: "renovate[bot]",
      description: "a Renovate branch from Renovate takes the Renovate path",
      expected: "renovate",
      headRef: "renovate/vitest-5.x",
      headRepo: REPO,
    },
    {
      author: "ada",
      description: "a person's version-PR branch is checked",
      expected: "check",
      headRef: "changeset-release/main",
      headRepo: REPO,
    },
    {
      author: "renovate[bot]",
      description: "a branch matching another Renovate glob takes it too",
      expected: "renovate",
      headRef: "deps/vitest",
      headRepo: REPO,
    },
    {
      author: "renovate[bot]",
      description: "a nested Renovate branch takes the Renovate path",
      expected: "renovate",
      headRef: "renovate/major/vitest",
      headRepo: REPO,
    },
    {
      author: "ada",
      description: "a person's Renovate-named branch is checked",
      expected: "check",
      headRef: "renovate/vitest-5.x",
      headRepo: REPO,
    },
    {
      author: "renovate[bot]",
      description: "a fork's Renovate branch is checked",
      expected: "check",
      headRef: "renovate/vitest-5.x",
      headRepo: "mallory/widgets",
    },
    {
      author: "renovate[bot]",
      description: "a branch merely starting with renovate is checked",
      expected: "check",
      headRef: "renovate-other",
      headRepo: REPO,
    },
    {
      author: "ada",
      description: "a branch matching skip-branches skips",
      expected: "skip-branch",
      headRef: "release/1.x",
      headRepo: REPO,
    },
    {
      author: "ada",
      description: "a fork's branch matching skip-branches is checked",
      expected: "check",
      headRef: "release/1.x",
      headRepo: "mallory/widgets",
    },
    {
      author: "ada",
      description: "skip-branches' `*` stops at a slash",
      expected: "check",
      headRef: "release/1.x/hotfix",
      headRepo: REPO,
    },
  ])("$description", ({ author, expected, headRef, headRepo }) => {
    // Given - a PR into `main`, with `release/*` skipped.
    const pullRequest = {
      author,
      base: "main",
      headRef,
      headRepo,
      renovateAuthors: ["renovate[bot]"],
      renovateBranches: ["renovate/**", "deps/*"],
      repo: REPO,
      skipBranches: ["release/*"],
      versionPrAuthors: ["github-actions[bot]"],
    };

    // When - it's classified.
    const kind = classifyPullRequest(pullRequest);

    // Then - it takes the expected path.
    expect(kind).toBe(expected);
  });
});

describe("parseLines", () => {
  test("keeps each non-blank line, trimmed", () => {
    // Given - an input with padding and blank lines.
    const text = "\n  renovate[bot]\n\n self-hosted[bot]  \n";

    // When - it's parsed.
    const lines = parseLines(text);

    // Then - only the trimmed names remain.
    expect(lines).toStrictEqual(["renovate[bot]", "self-hosted[bot]"]);
  });
});
