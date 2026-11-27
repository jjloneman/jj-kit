import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  packFiles,
  parseCatFileBatch,
  parsePackList,
  readRevisions,
} from "./readers.ts";

vi.mock(import("node:child_process"), () => ({ execFileSync: vi.fn() }));

/** A revision's listing: a manifest, a source file and a submodule. */
const LISTING = [
  "100644 blob k1\t.changeset/config.json",
  "100644 blob m1\tpackage.json",
  "100644 blob s1\tsrc/index.ts",
  "160000 commit c1\tpackage.json-sub",
  "",
].join("\0");

/**
 * Writes objects the way `git cat-file --batch` prints them.
 *
 * @param objects - each object's id and content.
 * @returns the output.
 */
function batch(objects: Record<string, string>): Buffer<ArrayBuffer> {
  return Buffer.concat(
    Object.entries(objects).map(([object, content]) => {
      const bytes = Buffer.from(content);

      return Buffer.concat([
        Buffer.from(`${object} blob ${String(bytes.length)}\n`),
        bytes,
        Buffer.from("\n"),
      ]);
    })
  );
}

describe("parseCatFileBatch", () => {
  test("reads each object by its byte length, newlines and all", () => {
    // Given - two objects, one holding a newline and a multibyte character.
    const output = batch({ a: "line\nnext ✓", b: "" });

    // When - it's parsed.
    const texts = parseCatFileBatch(output);

    // Then - each object's text comes back whole.
    expect([...texts]).toStrictEqual([
      ["a", "line\nnext ✓"],
      ["b", ""],
    ]);
  });

  test.each([
    {
      description: "a missing object",
      error: 'printed "abc missing" where',
      output: Buffer.from("abc missing\n"),
    },
    {
      description: "a cut-off object",
      error: 'printed "abc blob 10" where',
      output: Buffer.from("abc blob 10\nshort\n"),
    },
    {
      description: "a header with no newline",
      error: "printed no header where",
      output: Buffer.from("abc blob 1"),
    },
  ])("throws on $description", ({ error, output }) => {
    // Given - output that isn't a whole object.

    // When - it's parsed.
    const parse = (): unknown => parseCatFileBatch(output);

    // Then - it throws rather than guess.
    expect(parse).toThrow(error);
  });
});

describe("parsePackList", () => {
  test("skips warnings printed around the JSON", () => {
    // Given - a warning, the list as pnpm pretty-prints it, and a warning
    // that holds a `}`.
    const output = `WARN Unsupported engine\n${JSON.stringify(
      { files: [{ path: "action.yml" }] },
      undefined,
      2
    )}\nWARN wanted: {"node":">=27"}\n`;

    // When - it's parsed.
    const files = parsePackList({ folder: "actions/a", output });

    // Then - the list is read between them.
    expect([...files]).toStrictEqual(["action.yml"]);
  });

  test("closes the object at its own brace, past braces in strings", () => {
    // Given - a path holding a brace and an escaped quote, then a warning
    // holding a brace.
    const output = `${JSON.stringify({
      files: [{ path: 'a"}.js' }, { path: "b\\" }],
    })}\nWARN wanted: {"node":">=27"}\n`;

    // When - it's parsed.
    const files = parsePackList({ folder: "actions/a", output });

    // Then - both paths come back whole.
    expect([...files]).toStrictEqual(['a"}.js', "b\\"]);
  });

  test("reads each file's path", () => {
    // Given - what `pnpm pack --dry-run --json` prints.
    const output = JSON.stringify({
      files: [{ path: "package.json" }, { path: "src/index.ts" }],
      name: "a",
    });

    // When - it's parsed.
    const files = parsePackList({ folder: "packages/a", output });

    // Then - the paths come back.
    expect([...files]).toStrictEqual(["package.json", "src/index.ts"]);
  });

  test.each([
    { description: "no JSON at all", output: "WARN x" },
    { description: "an object that never closes", output: "{ files" },
    { description: "an object that doesn't parse", output: "{ files: [] }" },
    { description: "null", output: "null" },
    { description: "no files", output: "{}" },
    { description: "files that aren't a list", output: '{"files":{}}' },
    { description: "an entry that isn't an object", output: '{"files":[1]}' },
    { description: "an entry with no path", output: '{"files":[{}]}' },
    {
      description: "a path that isn't a string",
      output: '{"files":[{"path":1}]}',
    },
  ])("throws on $description", ({ output }) => {
    // Given - output of the wrong shape.

    // When - it's parsed.
    const parse = (): unknown =>
      parsePackList({ folder: "packages/a", output });

    // Then - it throws, naming the folder.
    expect(parse).toThrow("pnpm pack in packages/a printed no file list.");
  });
});

describe("packFiles", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  test("includes what pnpm printed when pack fails", () => {
    // Given - a pnpm that prints its error as JSON on stdout.
    vi.mocked(execFileSync).mockImplementation(() => {
      throw Object.assign(new Error("Command failed: pnpm pack"), {
        stdout: '{"error":{"code":"ERR_PNPM_NO_IMPORTER_MANIFEST_FOUND"}}\n',
      });
    });

    // When - a folder is packed.
    const pack = (): unknown => packFiles("actions/a");

    // Then - pnpm's own error is in the message.
    expect(pack).toThrow(
      "pnpm pack failed in actions/a: Command failed: pnpm pack\n" +
        '{"error":{"code":"ERR_PNPM_NO_IMPORTER_MANIFEST_FOUND"}} (a ' +
        "Renovate PR's check needs pnpm 10.26 or later)"
    );
  });

  test("names the pnpm it needs when pack fails", () => {
    // Given - a pnpm that rejects the options.
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("Unknown option: 'dry-run'");
    });

    // When - a folder is packed.
    const pack = (): unknown => packFiles("actions/a");

    // Then - it throws with pnpm's own message first, then the floor.
    expect(pack).toThrow(
      "pnpm pack failed in actions/a: Unknown option: 'dry-run' (a Renovate " +
        "PR's check needs pnpm 10.26 or later)"
    );
  });

  test("packs the folder with scripts and the pnpmfile off", () => {
    // Given - pnpm prints a file list.
    vi.mocked(execFileSync).mockReturnValue(
      JSON.stringify({ files: [{ path: "action.yml" }] })
    );

    // When - a folder is packed.
    const files = packFiles("actions/a");

    // Then - it ran in the folder, without scripts.
    expect([...files]).toStrictEqual(["action.yml"]);

    expect(execFileSync).toHaveBeenCalledWith(
      "pnpm",
      ["pack", "--dry-run", "--json", "--ignore-scripts", "--ignore-pnpmfile"],
      expect.objectContaining({ cwd: "actions/a" })
    );
  });
});

describe("readRevisions", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  /** The base's listing: its own manifest, and no source file. */
  const BASE_LISTING = ["100644 blob m0\tpackage.json", ""].join("\0");

  /** Fakes git: each revision's listing, then the batch. */
  function fakeGit(): void {
    vi.mocked(execFileSync).mockImplementation((_command, args = []) => {
      if (args[0] === "ls-tree") {
        return args.at(-1) === "HEAD" ? LISTING : BASE_LISTING;
      }

      return batch({ k1: "{}", m0: '{"version":"1"}', m1: '{"version":"2"}' });
    });
  }

  test("reads both revisions' manifests in one batch", () => {
    // Given - two revisions, each with a manifest.
    fakeGit();

    // When - they're read.
    const { after, before } = readRevisions({ after: "HEAD", before: "base" });

    // Then - one batch asked for the config's and both manifests' blobs and
    // nothing else, and each revision reads its own.
    expect(execFileSync).toHaveBeenCalledWith(
      "git",
      ["cat-file", "--batch"],
      expect.objectContaining({ input: "k1\nm1\nm0\n" })
    );

    expect(after.read(".changeset/config.json")).toBe("{}");
    expect(after.isSubmodule("package.json-sub")).toBe(true);
    expect(after.isSubmodule("package.json")).toBe(false);
    expect(after.read("package.json")).toBe('{"version":"2"}');
    expect(before.read("package.json")).toBe('{"version":"1"}');
    expect(before.read("src/index.ts")).toBeUndefined();
    expect(after.list()).toContain("src/index.ts");
  });

  test.each([
    { description: "a source file", file: "src/index.ts" },
    { description: "a submodule", file: "package.json-sub" },
  ])("throws for $description it didn't read", ({ file }) => {
    // Given - a head with a source file and a submodule, neither batched.
    fakeGit();

    // When - one is read.
    const { after } = readRevisions({ after: "HEAD", before: "base" });
    const read = (): unknown => after.read(file);

    // Then - it throws rather than answer that the file is absent.
    expect(read).toThrow(`${file} wasn't read from HEAD;`);
  });
});
