import { describe, expect, test } from "vitest";

import {
  isIgnored,
  isReleased,
  readChangesetConfig,
} from "./changeset-config.ts";

describe("readChangesetConfig", () => {
  test.each([
    {
      description: "no config",
      expected: {
        ignore: [],
        isPrivateTagged: false,
        isPrivateVersioned: false,
      },
      text: undefined,
    },
    {
      description: "a config that isn't an object",
      expected: {
        ignore: [],
        isPrivateTagged: false,
        isPrivateVersioned: false,
      },
      text: "null",
    },
    {
      description: "privatePackages true, with an ignore list",
      expected: {
        ignore: ["@acme/docs"],
        isPrivateTagged: true,
        isPrivateVersioned: true,
      },
      text: '{"ignore":["@acme/docs"],"privatePackages":true}',
    },
    {
      description: "privatePackages false",
      expected: {
        ignore: [],
        isPrivateTagged: false,
        isPrivateVersioned: false,
      },
      text: '{"privatePackages":false}',
    },
    {
      description: "an object with both",
      expected: { ignore: [], isPrivateTagged: true, isPrivateVersioned: true },
      text: '{"privatePackages":{"tag":true,"version":true}}',
    },
    {
      description: "an object with version only",
      expected: {
        ignore: [],
        isPrivateTagged: false,
        isPrivateVersioned: true,
      },
      text: '{"privatePackages":{"version":true}}',
    },
  ])("reads $description", ({ expected, text }) => {
    // Given - the config's text.

    // When - it's read.
    const config = readChangesetConfig(text);

    // Then - each setting is as written, or Changesets' default.
    expect(config).toStrictEqual(expected);
  });

  test.each([
    {
      description: "a privatePackages string",
      error: "privatePackages isn't valid",
      text: '{"privatePackages":"yes"}',
    },
    {
      description: "a null privatePackages",
      error: "privatePackages isn't valid",
      text: '{"privatePackages":null}',
    },
    {
      description: "an ignore that isn't a list",
      error: "ignore isn't valid",
      text: '{"ignore":"a"}',
    },
    {
      description: "an ignore entry that isn't a string",
      error: "ignore isn't valid",
      text: '{"ignore":[1]}',
    },
  ])("rejects $description", ({ error, text }) => {
    // Given - a setting of the wrong type.

    // When - it's read.
    const read = (): unknown => readChangesetConfig(text);

    // Then - it throws rather than guess.
    expect(read).toThrow(error);
  });
});

describe("isIgnored", () => {
  test.each([
    { description: "an exact name", name: "@acme/docs", shouldMatch: true },
    { description: "a glob", name: "@acme/example-a", shouldMatch: true },
    { description: "another package", name: "@acme/a", shouldMatch: false },
    {
      description: "a name a negation takes back",
      name: "@acme/example-core",
      shouldMatch: false,
    },
  ])("matches $description: $shouldMatch", ({ name, shouldMatch }) => {
    // Given - a config ignoring a name and a glob, less one negated name.
    const config = readChangesetConfig(
      '{"ignore":["@acme/docs","@acme/example-*","!@acme/example-core"]}'
    );

    // When - a name is checked.
    const isMatch = isIgnored({ config, name });

    // Then - only the ignored names match.
    expect(isMatch).toBe(shouldMatch);
  });
});

test("a later entry ignores a name again", () => {
  // Given - a negation before the glob that covers it.
  const config = readChangesetConfig('{"ignore":["!@acme/new","@acme/*"]}');

  // When - the negated name is checked.
  const isMatch = isIgnored({ config, name: "@acme/new" });

  // Then - the later glob wins, as in Changesets.
  expect(isMatch).toBe(true);
});

describe("isReleased", () => {
  /** A config ignoring `@acme/docs`. */
  const CONFIG = readChangesetConfig('{"ignore":["@acme/docs"]}');

  test.each([
    {
      description: "a public package",
      isPrivate: false,
      isPrivateAllowed: false,
      name: "@acme/a",
      shouldRelease: true,
      version: "1.0.0",
    },
    {
      description: "a private package, private not allowed",
      isPrivate: true,
      isPrivateAllowed: false,
      name: "@acme/a",
      shouldRelease: false,
      version: "1.0.0",
    },
    {
      description: "a private package, private allowed",
      isPrivate: true,
      isPrivateAllowed: true,
      name: "@acme/a",
      shouldRelease: true,
      version: "1.0.0",
    },
    {
      description: "an ignored package",
      isPrivate: false,
      isPrivateAllowed: false,
      name: "@acme/docs",
      shouldRelease: false,
      version: "1.0.0",
    },
    {
      description: "a nameless package",
      isPrivate: false,
      isPrivateAllowed: false,
      name: undefined,
      shouldRelease: false,
      version: "1.0.0",
    },
    {
      description: "an empty name",
      isPrivate: false,
      isPrivateAllowed: false,
      name: "",
      shouldRelease: false,
      version: "1.0.0",
    },
    {
      description: "a versionless package",
      isPrivate: false,
      isPrivateAllowed: false,
      name: "@acme/a",
      shouldRelease: false,
      version: undefined,
    },
    {
      description: "an empty version",
      isPrivate: false,
      isPrivateAllowed: false,
      name: "@acme/a",
      shouldRelease: false,
      version: "",
    },
  ])(
    "$description: $shouldRelease",
    ({ isPrivate, isPrivateAllowed, name, shouldRelease, version }) => {
      // Given - a package's name, version and privacy.

      // When - Changesets' skip rule is applied.
      const isResult = isReleased({
        config: CONFIG,
        isPrivate,
        isPrivateAllowed,
        name,
        version,
      });

      // Then - only a named, versioned, allowed, unignored package releases.
      expect(isResult).toBe(shouldRelease);
    }
  );
});
