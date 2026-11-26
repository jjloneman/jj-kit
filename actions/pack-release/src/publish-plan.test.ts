import { describe, expect, test, vi } from "vitest";

import { splitPublishPlan } from "./publish-plan.ts";

/** A workspace whose packages depend on none of each other. */
const NO_DEPENDENCIES = (): ReadonlyMap<string, readonly string[]> => new Map();

describe("splitPublishPlan", () => {
  test("keeps the entries in order, and their fields in the plan", () => {
    // Given - two chunks, a publish and two tags.
    const publish = {
      access: "public",
      kind: "publish",
      name: "@acme/a",
      tag: "latest",
      version: "1.0.0",
    };
    const text = JSON.stringify({
      plan: [
        [publish],
        [
          { kind: "tag-only", name: "b", version: "0.2.0" },
          { kind: "tag-only", name: "c", version: "0.3.0" },
        ],
      ],
      version: 1,
    });

    // When - it's split.
    const plan = splitPublishPlan({ dependenciesOf: NO_DEPENDENCIES, text });

    // Then - nothing is held, and the plan keeps Changesets' fields.
    expect(plan.entries).toStrictEqual([
      { kind: "publish", name: "@acme/a", version: "1.0.0" },
      { kind: "tag-only", name: "b", version: "0.2.0" },
      { kind: "tag-only", name: "c", version: "0.3.0" },
    ]);

    expect(plan.held).toStrictEqual([]);
    expect(JSON.parse(plan.text)).toStrictEqual(JSON.parse(text));
  });

  test("holds back 0.0.0 entries, dropping a chunk left empty", () => {
    // Given - a new package alone in its chunk, beside a tag and a new action.
    const text = JSON.stringify({
      plan: [
        [{ kind: "publish", name: "@acme/new", version: "0.0.0" }],
        [
          { kind: "tag-only", name: "b", version: "0.2.0" },
          { kind: "tag-only", name: "new-action", version: "0.0.0" },
        ],
      ],
      version: 1,
    });

    // When - it's split.
    const plan = splitPublishPlan({ dependenciesOf: NO_DEPENDENCIES, text });

    // Then - both 0.0.0 entries are held, and the kept plan has the tag alone.
    expect(plan.entries).toStrictEqual([
      { kind: "tag-only", name: "b", version: "0.2.0" },
    ]);

    expect(plan.held).toStrictEqual([
      { kind: "publish", name: "@acme/new", version: "0.0.0" },
      { kind: "tag-only", name: "new-action", version: "0.0.0" },
    ]);

    expect(JSON.parse(plan.text)).toStrictEqual({
      plan: [[{ kind: "tag-only", name: "b", version: "0.2.0" }]],
      version: 1,
    });
  });

  test("holds back what depends on a 0.0.0 entry, directly or not", () => {
    // Given - @acme/c depends on @acme/b, which depends on a new package.
    const dependenciesOf = vi.fn(
      () =>
        new Map([
          ["@acme/b", ["@acme/new", "react"]],
          ["@acme/c", ["@acme/b"]],
          ["@acme/d", ["react"]],
        ])
    );
    const text = JSON.stringify({
      plan: [
        [
          { kind: "publish", name: "@acme/new", version: "0.0.0" },
          { kind: "publish", name: "@acme/d", version: "2.0.0" },
        ],
        [{ kind: "publish", name: "@acme/b", version: "1.2.0" }],
        [{ kind: "publish", name: "@acme/c", version: "3.1.0" }],
        [{ kind: "tag-only", name: "e", version: "0.4.0" }],
      ],
      version: 1,
    });

    // When - it's split.
    const plan = splitPublishPlan({ dependenciesOf, text });

    // Then - both dependents are held with it, and the rest publish.
    expect(plan.held.map((entry) => entry.name)).toStrictEqual([
      "@acme/new",
      "@acme/b",
      "@acme/c",
    ]);

    expect(plan.entries.map((entry) => entry.name)).toStrictEqual([
      "@acme/d",
      "e",
    ]);

    expect(dependenciesOf).toHaveBeenCalledOnce();
  });

  test("never reads the workspace when nothing is at 0.0.0", () => {
    // Given - a plan of one released package.
    const dependenciesOf = vi.fn(NO_DEPENDENCIES);
    const text = JSON.stringify({
      plan: [[{ kind: "publish", name: "@acme/a", version: "1.0.0" }]],
      version: 1,
    });

    // When - it's split.
    splitPublishPlan({ dependenciesOf, text });

    // Then - the workspace's manifests aren't read.
    expect(dependenciesOf).not.toHaveBeenCalled();
  });

  test("reads an empty plan", () => {
    // Given - nothing to publish or tag.
    const text = JSON.stringify({ plan: [], version: 1 });

    // When - it's split.
    const plan = splitPublishPlan({ dependenciesOf: NO_DEPENDENCIES, text });

    // Then - there are no entries.
    expect(plan).toStrictEqual({
      entries: [],
      held: [],
      text: JSON.stringify({ plan: [], version: 1 }, undefined, 2),
    });
  });

  test.each([
    { description: "null", value: null },
    { description: "no version", value: { plan: [] } },
    { description: "another format", value: { plan: [], version: 2 } },
  ])("throws on $description", ({ value }) => {
    // Given - a plan that isn't format 1.
    const text = JSON.stringify(value);

    // When - it's split.
    const parse = (): unknown =>
      splitPublishPlan({ dependenciesOf: NO_DEPENDENCIES, text });

    // Then - it names the format it reads.
    expect(parse).toThrow(
      "The publish plan isn't format 1, the only one the actions read."
    );
  });

  test("throws without a list of chunks", () => {
    // Given - a plan that isn't a list.
    const text = JSON.stringify({ plan: {}, version: 1 });

    // When - it's split.
    const parse = (): unknown =>
      splitPublishPlan({ dependenciesOf: NO_DEPENDENCIES, text });

    // Then - it says so.
    expect(parse).toThrow("The publish plan has no list of chunks.");
  });

  test("throws on a chunk that isn't a list", () => {
    // Given - a chunk that's an entry.
    const text = JSON.stringify({
      plan: [{ kind: "tag-only", name: "b", version: "0.2.0" }],
      version: 1,
    });

    // When - it's split.
    const parse = (): unknown =>
      splitPublishPlan({ dependenciesOf: NO_DEPENDENCIES, text });

    // Then - it says so.
    expect(parse).toThrow("The publish plan has a chunk that isn't a list.");
  });

  test.each([
    { description: "a null entry", value: null },
    { description: "no kind", value: { name: "b", version: "0.2.0" } },
    {
      description: "an unknown kind",
      value: { kind: "skip", name: "b", version: "0.2.0" },
    },
    { description: "no name", value: { kind: "tag-only", version: "0.2.0" } },
    {
      description: "a name that isn't text",
      value: { kind: "tag-only", name: 1, version: "0.2.0" },
    },
    { description: "no version", value: { kind: "tag-only", name: "b" } },
    {
      description: "a version that isn't text",
      value: { kind: "tag-only", name: "b", version: 2 },
    },
  ])("throws on $description", ({ value }) => {
    // Given - one malformed entry.
    const text = JSON.stringify({ plan: [[value]], version: 1 });

    // When - it's split.
    const parse = (): unknown =>
      splitPublishPlan({ dependenciesOf: NO_DEPENDENCIES, text });

    // Then - it says what an entry needs.
    expect(parse).toThrow(
      "The publish plan has an entry without a known kind, a name and a " +
        "version."
    );
  });
});
