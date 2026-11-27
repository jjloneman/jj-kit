import type { SpawnSyncReturns } from "node:child_process";

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

/** One fixture project's case: its sources and the errors tsc must report. */
type Case = {
  /** What the case shows, which names the test. */
  description: string;

  /** The TypeScript error codes tsc must report, such as `TS2835`. */
  expected: string[];

  /** The fixture's source files, by path relative to its `src/`. */
  files: Record<string, string>;
};

/** The options a fixture's `tsconfig.json` sets on top of its bases. */
type CompilerOptions = Record<string, unknown>;

/** An entry point that reads a browser global, so it needs the DOM types. */
const DOM_GLOBAL: string = source(
  "export const title: string = document.title;"
);

/** A helper module every fixture may import, with a value and a type. */
const HELPER: string = source(
  "export type Shape = { name?: string };",
  "",
  "export function one(): number {",
  "  return 1;",
  "}"
);

/** An entry point that imports the helper with no file extension. */
const IMPORT_BARE: string = source(
  'import { one } from "./helper";',
  "",
  "export const two: number = one() + 1;"
);

/** An entry point that imports the helper by its `.ts` file name. */
const IMPORT_TS: string = source(
  'import { one } from "./helper.ts";',
  "",
  "export const two: number = one() + 1;"
);

/** An export with no return type, which `isolatedDeclarations` rejects. */
const MISSING_RETURN_TYPE: string = source(
  "export function double(value: number) {",
  "  return value * 2;",
  "}"
);

/** An entry point that reads a Node global, so it needs Node's types. */
const NODE_GLOBAL: string = source(
  "export const version: string = process.version;"
);

/** This package's folder, which each fixture links in by its npm name. */
const PACKAGE_DIR: string = path.resolve(import.meta.dirname, "..");

/** Resolves the packages a fixture links into its own `node_modules`. */
const REQUIRE: NodeJS.Require = createRequire(import.meta.url);

/** The current test's fixture project, which each test gets fresh. */
let root = "";

/**
 * Link a package from this package's own `node_modules` into the fixture's.
 *
 * @param name - the package's npm name, such as `@types/node`.
 */
function linkDependency(name: string): void {
  const target = path.dirname(REQUIRE.resolve(`${name}/package.json`));
  linkInto({ name, target });
}

/** Symlink `target` into the fixture's `node_modules` as `name`. */
function linkInto({
  name,
  target,
}: {
  /** The package's npm name, which becomes its folder. */
  name: string;

  /** The folder the link points at. */
  target: string;
}): void {
  const link = path.join(root, "node_modules", name);
  mkdirSync(path.dirname(link), { recursive: true });
  symlinkSync(target, link, "dir");
}

/**
 * Run the fixture's own tsc, failing the test if it couldn't start.
 *
 * @param args - tsc's arguments, such as `["--showConfig"]`.
 * @returns what tsc printed and its exit status.
 */
function runTsc(args: string[]): SpawnSyncReturns<string> {
  const tsc = path.join(
    path.dirname(REQUIRE.resolve("typescript/package.json")),
    "bin",
    "tsc"
  );
  const result = spawnSync(
    process.execPath,
    [tsc, "--project", root, ...args],
    { encoding: "utf8" }
  );

  expect(result.error).toBeUndefined();
  expect(result.stderr).toBe("");

  return result;
}

/**
 * Join lines into a source file that ends with a newline.
 *
 * @param lines - the file's lines, without their newlines.
 * @returns the file's text, such as `"const a = 1;\n"`.
 */
function source(...lines: string[]): string {
  return `${lines.join("\n")}\n`;
}

/**
 * Write the fixture project and run tsc over it.
 *
 * @returns the error codes tsc reported, in order, such as `["TS2835"]`.
 */
function typecheck({
  bases,
  compilerOptions = {},
  files,
}: {
  /** The bases the fixture's `tsconfig.json` extends, such as `node.json`. */
  bases: string[];

  /** Options the fixture sets on top of its bases. */
  compilerOptions?: CompilerOptions;

  /** The fixture's source files, by path relative to its `src/`. */
  files: Record<string, string>;
}): string[] {
  writeProject({ bases, compilerOptions, files });
  const result = runTsc(["--pretty", "false"]);
  const codes = [...result.stdout.matchAll(/error (?<code>TS\d+):/gu)].map(
    (match) => match.groups?.code ?? ""
  );

  // tsc exits non-zero exactly when it reports errors.
  expect(result.status !== 0, result.stdout).toBe(codes.length > 0);

  return codes;
}

/** Write the fixture's `tsconfig.json` and its source files. */
function writeProject({
  bases,
  compilerOptions = {},
  files,
}: {
  /** The bases the fixture's `tsconfig.json` extends, such as `node.json`. */
  bases: string[];

  /** Options the fixture sets on top of its bases. */
  compilerOptions?: CompilerOptions;

  /** The fixture's source files, by path relative to its `src/`. */
  files: Record<string, string>;
}): void {
  const tsconfig = {
    compilerOptions,
    extends: bases.map((base) => `@jjloneman/kit-tsconfig/${base}`),
    include: ["src"],
  };
  writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify(tsconfig));

  for (const [file, text] of Object.entries(files)) {
    writeFileSync(path.join(root, "src", file), text);
  }
}

// A fresh project per test, ESM like a consumer's, which reaches this package
// and Node's types by name through its own `node_modules`.
beforeEach(() => {
  root = realpathSync(mkdtempSync(path.join(tmpdir(), "kit-tsconfig-")));
  mkdirSync(path.join(root, "src"));
  writeFileSync(path.join(root, "package.json"), '{ "type": "module" }');
  linkInto({ name: "@jjloneman/kit-tsconfig", target: PACKAGE_DIR });
  linkDependency("@types/node");
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

describe("each base", () => {
  /** The options every base inherits from `base.json`. */
  const SHARED: CompilerOptions = {
    erasableSyntaxOnly: true,
    exactOptionalPropertyTypes: true,
    lib: ["es2025"],
    noUncheckedIndexedAccess: true,
    skipLibCheck: true,
    strict: true,
    target: "es2025",
    verbatimModuleSyntax: true,
  };

  test.each<{
    /** The base under test, such as `node.json`. */
    base: string;

    /** The options the base must resolve to, on top of `SHARED`. */
    options: CompilerOptions;
  }>([
    { base: "base.json", options: {} },
    {
      base: "node.json",
      options: {
        allowImportingTsExtensions: true,
        module: "nodenext",
        noEmit: true,
        types: ["node"],
      },
    },
    {
      base: "bundler.json",
      options: {
        allowImportingTsExtensions: true,
        module: "esnext",
        moduleResolution: "bundler",
        noEmit: true,
      },
    },
    {
      base: "lib.json",
      options: {
        declaration: true,
        isolatedDeclarations: true,
        module: "nodenext",
        types: ["node"],
      },
    },
  ])("$base sets its options", ({ base, options }) => {
    // Given - a project that extends the base alone
    writeProject({ bases: [base], files: { "index.ts": NODE_GLOBAL } });

    // When - tsc prints the options it resolved
    const shown = JSON.parse(runTsc(["--showConfig"]).stdout) as {
      /** The resolved compiler options. */
      compilerOptions: CompilerOptions;
    };

    // Then - they include the shared checks and the base's own, and only a
    // base that never emits sets noEmit
    expect(shown.compilerOptions).toMatchObject({ ...SHARED, ...options });
    expect(shown.compilerOptions.noEmit).toBe(options.noEmit);
  });
});

describe("base.json", () => {
  test.each<Case>([
    {
      description: "accepts strict, fully typed code",
      expected: [],
      files: {
        "index.ts": source(
          "const pair = [1, 2];",
          "export const total: number = pair.reduce((sum, n) => sum + n, 0);"
        ),
      },
    },
    {
      description: "types ES2025's additions, such as Set methods",
      expected: [],
      files: {
        "index.ts": source(
          "const both = new Set([1]).union(new Set([2]));",
          "export const size: number = both.size;"
        ),
      },
    },
    {
      description: "flags a parameter with an implicit any",
      expected: ["TS7006"],
      files: {
        "index.ts": source(
          "export function echo(value): void {",
          "  void value;",
          "}"
        ),
      },
    },
    {
      description: "flags an unchecked index",
      expected: ["TS2322"],
      files: {
        "index.ts": source(
          "const values: number[] = [];",
          "export const first: number = values[0];"
        ),
      },
    },
    {
      description: "flags an explicit undefined on an optional property",
      expected: ["TS2375"],
      files: {
        "index.ts": source(
          "type Shape = { name?: string };",
          "export const shape: Shape = { name: undefined };"
        ),
      },
    },
    {
      description: "flags an enum, which emits code",
      expected: ["TS1294"],
      files: { "index.ts": source("export enum Color {", "  Red,", "}") },
    },
  ])("$description", ({ expected, files }) => {
    // Given - a project that extends base.json alone

    // When - tsc checks it
    const codes = typecheck({ bases: ["base.json"], files });

    // Then - it reports exactly the expected errors
    expect(codes).toEqual(expected);
  });
});

describe("node.json", () => {
  test.each<Case>([
    {
      description: "accepts an import that names the .ts file",
      expected: [],
      files: { "helper.ts": HELPER, "index.ts": IMPORT_TS },
    },
    {
      description: "flags an import with no extension",
      expected: ["TS2835"],
      files: { "helper.ts": HELPER, "index.ts": IMPORT_BARE },
    },
    {
      description: "flags a type imported without import type",
      expected: ["TS1484"],
      files: {
        "helper.ts": HELPER,
        "index.ts": source(
          'import { Shape } from "./helper.ts";',
          "",
          "export const shape: Shape = {};"
        ),
      },
    },
    {
      description: "loads Node's types",
      expected: [],
      files: { "index.ts": NODE_GLOBAL },
    },
  ])("$description", ({ expected, files }) => {
    // Given - a project that extends node.json

    // When - tsc checks it
    const codes = typecheck({ bases: ["node.json"], files });

    // Then - it reports exactly the expected errors
    expect(codes).toEqual(expected);
  });
});

describe("bundler.json", () => {
  test.each<Case>([
    {
      description: "accepts an import with no extension",
      expected: [],
      files: { "helper.ts": HELPER, "index.ts": IMPORT_BARE },
    },
    {
      description: "accepts an import that names the .ts file",
      expected: [],
      files: { "helper.ts": HELPER, "index.ts": IMPORT_TS },
    },
    {
      description: "loads no Node types",
      expected: ["TS2591"],
      files: { "index.ts": NODE_GLOBAL },
    },
    {
      description: "loads no DOM types",
      expected: ["TS2584"],
      files: { "index.ts": DOM_GLOBAL },
    },
  ])("$description", ({ expected, files }) => {
    // Given - a project that extends bundler.json

    // When - tsc checks it
    const codes = typecheck({ bases: ["bundler.json"], files });

    // Then - it reports exactly the expected errors
    expect(codes).toEqual(expected);
  });

  test("types the DOM once lib adds it", () => {
    // Given - a web app that adds the DOM to lib
    const compilerOptions = { lib: ["es2025", "dom"] };
    const files = {
      "index.ts": source(
        DOM_GLOBAL.trimEnd(),
        "export const keys: string[] = [...new URLSearchParams().keys()];"
      ),
    };

    // When - tsc checks it
    const codes = typecheck({
      bases: ["bundler.json"],
      compilerOptions,
      files,
    });

    // Then - it reports no errors
    expect(codes).toEqual([]);
  });
});

describe("lib.json", () => {
  test.each<Case>([
    {
      description: "flags an export with no return type",
      expected: ["TS9007"],
      files: { "index.ts": MISSING_RETURN_TYPE },
    },
    {
      description:
        "flags an import that names the .ts file, which tsc can't emit",
      expected: ["TS5097"],
      files: { "helper.ts": HELPER, "index.ts": IMPORT_TS },
    },
  ])("$description", ({ expected, files }) => {
    // Given - a project that extends lib.json, with somewhere to emit to
    const compilerOptions = { outDir: "dist", rootDir: "src" };

    // When - tsc checks it
    const codes = typecheck({ bases: ["lib.json"], compilerOptions, files });

    // Then - it reports exactly the expected errors
    expect(codes).toEqual(expected);
  });

  test("emits declarations", () => {
    // Given - a library whose exports are fully typed
    const compilerOptions = { outDir: "dist", rootDir: "src" };
    const files = {
      "helper.ts": HELPER,
      "index.ts": source('export * from "./helper.js";'),
    };

    // When - tsc builds it
    const codes = typecheck({ bases: ["lib.json"], compilerOptions, files });

    // Then - the build is clean and ships its declarations
    expect(codes).toEqual([]);
    expect(existsSync(path.join(root, "dist", "index.d.ts"))).toBe(true);
  });
});

describe("a CommonJS project", () => {
  test.each<{
    /** The base under test, such as `node.json`. */
    base: string;
  }>([{ base: "node.json" }, { base: "lib.json" }])(
    "on $base, flags its value imports and exports",
    ({ base }) => {
      // Given - a package.json with no "type": "module"
      writeFileSync(path.join(root, "package.json"), "{}");
      const files = {
        "index.ts": source(
          'import { readFileSync } from "node:fs";',
          "",
          "export const reader: unknown = readFileSync;"
        ),
      };

      // When - tsc checks it
      const codes = typecheck({ bases: [base], files });

      // Then - it rejects the import and the export
      expect(codes).toEqual(["TS1295", "TS1287"]);
    }
  );
});

describe("lib.json with node.json", () => {
  test.each<Case>([
    {
      description: "accepts an import that names the .ts file",
      expected: [],
      files: { "helper.ts": HELPER, "index.ts": IMPORT_TS },
    },
    {
      description: "still flags an export with no return type",
      expected: ["TS9007"],
      files: { "index.ts": MISSING_RETURN_TYPE },
    },
  ])("$description", ({ expected, files }) => {
    // Given - a project composed as jj-kit's own are

    // When - tsc checks it
    const codes = typecheck({ bases: ["lib.json", "node.json"], files });

    // Then - it reports exactly the expected errors
    expect(codes).toEqual(expected);
  });
});
