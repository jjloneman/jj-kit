import { describe, expect, test } from "vitest";

import { readDependencies } from "./workspace.ts";

describe("readDependencies", () => {
  test("maps each package to what it installs with it", () => {
    // Given - a root without a name, and two packages.
    const manifests: Record<string, string> = {
      "/repo": JSON.stringify({ private: true }),
      "/repo/a": JSON.stringify({
        dependencies: { "@acme/b": "workspace:^" },
        devDependencies: { vitest: "5.1.0" },
        name: "@acme/a",
        optionalDependencies: { fsevents: "2.3.3" },
        peerDependencies: { react: "^19.0.0" },
      }),
      "/repo/b": JSON.stringify({ dependencies: null, name: "@acme/b" }),
    };
    const listing = JSON.stringify([
      { path: "/repo" },
      { path: "/repo/a" },
      { path: "/repo/b" },
    ]);

    // When - it's read.
    const dependencies = readDependencies({
      listing,
      readManifest: (folder) => manifests[folder] ?? "",
    });

    // Then - dev dependencies are left out, and so is the nameless root.
    expect(dependencies).toStrictEqual(
      new Map([
        ["@acme/a", ["@acme/b", "fsevents", "react"]],
        ["@acme/b", []],
      ])
    );
  });

  test("skips a manifest that isn't an object", () => {
    // Given - a package whose manifest is `null`.
    const listing = JSON.stringify([{ path: "/repo/a" }]);

    // When - it's read.
    const dependencies = readDependencies({
      listing,
      readManifest: () => "null",
    });

    // Then - nothing is mapped.
    expect(dependencies).toStrictEqual(new Map());
  });

  test("throws when pnpm lists no packages", () => {
    // Given - a listing that isn't a list.

    // When - it's read.
    const read = (): unknown =>
      readDependencies({ listing: "{}", readManifest: () => "{}" });

    // Then - it says so.
    expect(read).toThrow("pnpm listed no packages.");
  });

  test.each([
    { description: "null", entry: null },
    { description: "no path", entry: { name: "a" } },
    { description: "a path that isn't text", entry: { path: 1 } },
  ])("throws on an entry with $description", ({ entry }) => {
    // Given - a listing with one malformed entry.
    const listing = JSON.stringify([entry]);

    // When - it's read.
    const read = (): unknown =>
      readDependencies({ listing, readManifest: () => "{}" });

    // Then - it says so.
    expect(read).toThrow("pnpm listed a package without a path.");
  });
});
