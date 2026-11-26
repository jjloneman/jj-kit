import { describe, expect, test, vi } from "vitest";

import type { PublishEntry } from "./publish-plan.ts";

import { decideRelease } from "./decide.ts";

/** Where the kept plan was written. */
const FILE = "/tmp/plan/publish-plan.json";

/** A new action, at the version no version PR has bumped yet. */
const NEW_ACTION: PublishEntry = {
  kind: "tag-only",
  name: "new-action",
  version: "0.0.0",
};

/** A new public package, at the version no version PR has bumped yet. */
const NEW_PACKAGE: PublishEntry = {
  kind: "publish",
  name: "@acme/new",
  version: "0.0.0",
};

/** A publish of a released public package. */
const PUBLISH: PublishEntry = {
  kind: "publish",
  name: "@acme/a",
  version: "1.1.0",
};

/** A tag of a released private package. */
const TAG: PublishEntry = { kind: "tag-only", name: "b", version: "0.2.0" };

describe("decideRelease", () => {
  test("opens the version PR for a releasing changeset", () => {
    // Given - a releasing changeset beside an empty one.
    const readPlan = vi.fn(() => ({
      entries: [PUBLISH],
      file: FILE,
      held: [],
    }));

    // When - it decides.
    const decision = decideRelease({
      changesets: [
        { id: "bump", releases: [{ name: "@acme/a", type: "minor" }] },
        { id: "docs", releases: [] },
      ],
      readPlan,
    });

    // Then - the version PR comes first, and the registry isn't asked.
    expect(decision).toStrictEqual({
      next: "version",
      planFile: "",
      reason:
        "A pending changeset releases a package, so the version PR comes " +
        "first.",
      shouldAnnotate: false,
      shouldBuild: false,
    });

    expect(readPlan).not.toHaveBeenCalled();
  });

  test("does nothing when the plan is empty", () => {
    // Given - an empty changeset, and nothing waiting.

    // When - it decides.
    const decision = decideRelease({
      changesets: [{ id: "docs", releases: [] }],
      readPlan: () => ({ entries: [], file: FILE, held: [] }),
    });

    // Then - nothing runs, so nothing builds.
    expect(decision).toStrictEqual({
      next: "none",
      planFile: FILE,
      reason: "Nothing is waiting to publish or tag.",
      shouldAnnotate: false,
      shouldBuild: false,
    });
  });

  test("does nothing, with a notice, when only 0.0.0 entries wait", () => {
    // Given - a new package and a new action, and nothing else.

    // When - it decides.
    const decision = decideRelease({
      changesets: [],
      readPlan: () => ({
        entries: [],
        file: FILE,
        held: [NEW_PACKAGE, NEW_ACTION],
      }),
    });

    // Then - nothing is released, with a notice naming both.
    expect(decision).toStrictEqual({
      next: "none",
      planFile: FILE,
      reason:
        "Holding back @acme/new, new-action, at 0.0.0 or depending on a " +
        "package that is, until a version PR bumps them.",
      shouldAnnotate: true,
      shouldBuild: false,
    });
  });

  test("publishes the rest past a 0.0.0 entry", () => {
    // Given - a version PR's merge, with a new action left at 0.0.0.

    // When - it decides.
    const decision = decideRelease({
      changesets: [],
      readPlan: () => ({ entries: [PUBLISH], file: FILE, held: [NEW_ACTION] }),
    });

    // Then - it publishes the bumped package, and names the held action.
    expect(decision).toStrictEqual({
      next: "publish",
      planFile: FILE,
      reason:
        "Publishing or tagging @acme/a@1.1.0. Holding back new-action, at " +
        "0.0.0 or depending on a package that is, until a version PR bumps " +
        "it.",
      shouldAnnotate: true,
      shouldBuild: true,
    });
  });

  test("publishes past empty changesets, building for npm", () => {
    // Given - an empty changeset, a publish and a tag waiting.

    // When - it decides.
    const decision = decideRelease({
      changesets: [{ id: "docs", releases: [] }],
      readPlan: () => ({ entries: [PUBLISH, TAG], file: FILE, held: [] }),
    });

    // Then - it publishes both, and builds.
    expect(decision).toStrictEqual({
      next: "publish",
      planFile: FILE,
      reason: "Publishing or tagging @acme/a@1.1.0, b@0.2.0.",
      shouldAnnotate: true,
      shouldBuild: true,
    });
  });

  test("tags without building", () => {
    // Given - only a tag waiting.

    // When - it decides.
    const decision = decideRelease({
      changesets: [],
      readPlan: () => ({ entries: [TAG], file: FILE, held: [] }),
    });

    // Then - it publishes, with nothing to build.
    expect(decision).toStrictEqual({
      next: "publish",
      planFile: FILE,
      reason: "Publishing or tagging b@0.2.0.",
      shouldAnnotate: true,
      shouldBuild: false,
    });
  });
});
