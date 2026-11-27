import { execFileSync } from "node:child_process";

import type { Tree } from "./ships.ts";

import { describeError } from "../../lib/src/annotate.ts";
import { MAX_BUFFER } from "../../lib/src/environment.ts";
import { isAnalyzedFile } from "./ships.ts";

/** One file in a revision's listing, as `git ls-tree` prints it. */
type Entry = {
  /** The file's object id, or `undefined` when it isn't a blob. */
  blob: string | undefined;

  /** The file's path, relative to the repo root. */
  path: string;
};

/** The part of a `git ls-tree` line before its tab, for a blob. */
const LS_TREE_BLOB = /^\d+ blob (?<object>\S+)$/u;

/** The header `git cat-file --batch` prints before an object's content. */
const BATCH_HEADER = /^(?<object>\S+) blob (?<size>\d+)$/u;

/**
 * Runs git and returns what it prints.
 *
 * @param args - git's arguments.
 * @returns its stdout, untrimmed.
 */
export function git(args: readonly string[]): string {
  return execFileSync("git", args, {
    encoding: "utf8",
    maxBuffer: MAX_BUFFER,
  });
}

/**
 * Lists the files a package publishes, through
 * `pnpm pack --dry-run --json --ignore-scripts --ignore-pnpmfile`, run in its
 * folder.
 *
 * - Scripts and the `.pnpmfile.cjs` stay off, since on a Renovate PR either is
 *   the PR's own code; without the flag, pack loads the pnpmfile (checked
 *   with pnpm 12.22).
 *
 * - The PR's `.npmrc` still applies, as it does to the job's install.
 *
 * - It reads the working tree, which the checkout leaves at `HEAD`, so an
 *   unbuilt `dist/` is missing from the list.
 *
 * - A failed run throws with pnpm's own error, then the pnpm the check needs,
 *   since an older pnpm lacks `pack --dry-run`.
 *
 * @param folder - the package's folder, such as `packages/a`, or `.`.
 * @returns each file's path, relative to the folder pnpm packs: the package's
 *   own, or its `publishConfig.directory`.
 */
export function packFiles(folder: string): ReadonlySet<string> {
  let output: string;

  try {
    output = execFileSync(
      "pnpm",
      ["pack", "--dry-run", "--json", "--ignore-scripts", "--ignore-pnpmfile"],
      { cwd: folder, encoding: "utf8", maxBuffer: MAX_BUFFER }
    );
  } catch (error: unknown) {
    // With `--json`, pnpm prints its own error to stdout, not stderr.
    const printed =
      error instanceof Error &&
      "stdout" in error &&
      typeof error.stdout === "string"
        ? error.stdout.trim()
        : "";

    throw new Error(
      `pnpm pack failed in ${folder}: ` +
        [describeError(error), printed]
          .filter((part) => part !== "")
          .join("\n") +
        " (a Renovate PR's check needs pnpm 10.26 or later)",
      { cause: error }
    );
  }

  return parsePackList({ folder, output });
}

/**
 * Reads `git cat-file --batch`'s output by byte length, since a file may hold
 * any bytes, newlines included.
 *
 * - Each object is a `<id> blob <size>` header line, its content, and a
 *   newline.
 *
 * - Anything else, such as `<id> missing` or a cut-off object, throws.
 *
 * @param output - what the command printed.
 * @returns each object's text, by id.
 */
export function parseCatFileBatch(output: Buffer): Map<string, string> {
  const texts = new Map<string, string>();
  let offset = 0;

  while (offset < output.length) {
    const end = output.indexOf(0x0a, offset);
    const header = end === -1 ? "" : output.toString("utf8", offset, end);
    const groups = BATCH_HEADER.exec(header)?.groups;
    const start = end + 1;
    const size = Number(groups?.size);

    // A cut-off object has no newline where its content should end.
    if (groups?.object === undefined || output[start + size] !== 0x0a) {
      throw new Error(
        `git cat-file printed ${header === "" ? "no header" : `"${header}"`} ` +
          "where an object was expected."
      );
    }

    texts.set(groups.object, output.toString("utf8", start, start + size));
    offset = start + size + 1;
  }

  return texts;
}

/**
 * Reads what `pnpm pack --dry-run --json` printed for one package: the JSON
 * object from the first line that opens one to the brace that closes it, so a
 * warning pnpm prints before or after it, such as an engine mismatch, doesn't
 * fail the check.
 *
 * @returns each file's path, relative to the folder pnpm packed.
 */
export function parsePackList({
  folder,
  output,
}: {
  /** The package's folder, for the error message. */
  folder: string;

  /** What the command printed. */
  output: string;
}): ReadonlySet<string> {
  const start = output.search(/^\{/mu);
  const rest = output.slice(start);
  const end = start === -1 ? -1 : objectEnd(rest);
  const parsed = end === -1 ? undefined : parseJson(rest.slice(0, end + 1));
  const files =
    typeof parsed === "object" && parsed !== null && "files" in parsed
      ? parsed.files
      : undefined;

  if (
    !Array.isArray(files) ||
    !files.every(
      (file: unknown): file is { path: string } =>
        typeof file === "object" &&
        file !== null &&
        "path" in file &&
        typeof file.path === "string"
    )
  ) {
    throw new TypeError(`pnpm pack in ${folder} printed no file list.`);
  }

  return new Set(files.map((file) => file.path));
}

/**
 * Reads the change's and the base's manifests through git, so both sides see
 * the same ones whatever a step before this one, or a symlink, does to the
 * working tree; `pnpm pack`'s list still reflects the working tree.
 *
 * - Every manifest, workspace file and Changesets config in either revision,
 *   all the analysis reads (see `isAnalyzedFile`), comes from one
 *   `git cat-file --batch`.
 *
 * - It reads every tracked `package.json`, fixtures included, rather than
 *   parse the workspace's globs first, which would cost a second call to save
 *   a few small files.
 *
 * @returns both revisions' trees, whose `read` throws for a listed path it
 *   didn't read, such as a source file or a submodule.
 */
export function readRevisions({
  after,
  before,
}: {
  /** The revision with the change, such as `HEAD`. */
  after: string;

  /** The revision without it, such as the merge base. */
  before: string;
}): { after: Tree; before: Tree } {
  const listings = {
    after: listTree(after),
    before: listTree(before),
  };
  const preloaded = new Set(
    [...listings.after, ...listings.before].flatMap((entry) =>
      entry.blob !== undefined && isAnalyzedFile(entry.path) ? [entry.blob] : []
    )
  );
  const texts = parseCatFileBatch(
    execFileSync("git", ["cat-file", "--batch"], {
      input: [...preloaded].map((blob) => `${blob}\n`).join(""),
      maxBuffer: MAX_BUFFER,
    })
  );

  return {
    after: treeOf({ entries: listings.after, revision: after, texts }),
    before: treeOf({ entries: listings.before, revision: before, texts }),
  };
}

/**
 * Splits git's `-z` output into its entries, dropping the empty one after the
 * last NUL.
 *
 * @param output - what git printed.
 * @returns each entry.
 */
export function splitNul(output: string): string[] {
  return output.split("\0").filter((entry) => entry !== "");
}

/**
 * Lists every file in a revision, through `git ls-tree -r -z`.
 *
 * @param revision - the commit to list.
 * @returns each file's path, and its object id when it's a blob.
 */
function listTree(revision: string): Entry[] {
  return splitNul(git(["ls-tree", "-r", "-z", revision])).map((line) => {
    const tab = line.indexOf("\t");

    return {
      blob: LS_TREE_BLOB.exec(line.slice(0, tab))?.groups?.object,
      path: line.slice(tab + 1),
    };
  });
}

/**
 * Finds where the JSON value a text opens with closes, by counting brackets
 * outside strings, so a reader can cut it out in one pass.
 *
 * @param text - text that opens with `{`.
 * @returns the closing bracket's index, or `-1` when the value never closes.
 */
function objectEnd(text: string): number {
  let depth = 0;
  let isEscaped = false;
  let isInString = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text.charAt(index);

    if (isInString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === "\\") {
        isEscaped = true;
      } else if (char === '"') {
        isInString = false;
      }
    } else if (char === '"') {
      isInString = true;
    } else if (char === "{" || char === "[") {
      depth += 1;
    } else if (char === "}" || char === "]") {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

/**
 * Parses JSON, where text that isn't JSON reads as `undefined`, so the caller
 * reports it with its own message.
 *
 * @param text - the text to parse.
 * @returns the parsed value, or `undefined`.
 */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Builds one revision's tree over the texts read up front.
 *
 * @returns the revision's tree.
 */
function treeOf({
  entries,
  revision,
  texts,
}: {
  /** The revision's listing. */
  entries: readonly Entry[];

  /** The revision, for the error message. */
  revision: string;

  /** The texts read up front, by object id. */
  texts: ReadonlyMap<string, string>;
}): Tree {
  const listed = entries.map((entry) => entry.path);
  const listedSet = new Set(listed);
  const read = new Map(
    entries.flatMap((entry) => {
      const text = entry.blob === undefined ? undefined : texts.get(entry.blob);

      return text === undefined ? [] : [[entry.path, text] as const];
    })
  );

  const submodules = new Set(
    entries.flatMap((entry) => (entry.blob === undefined ? [entry.path] : []))
  );

  return {
    has: (file) => listedSet.has(file),
    isSubmodule: (file) => submodules.has(file),
    list: () => listed,
    read: (file) => {
      if (!listedSet.has(file)) {
        return undefined;
      }

      const text = read.get(file);

      // The analysis reads only what's batched up front, so another path is
      // a bug in the caller, not a file to read on its own.
      if (text === undefined) {
        throw new Error(
          `${file} wasn't read from ${revision}; only manifests, the ` +
            "workspace file and the Changesets config are."
        );
      }

      return text;
    },
  };
}
