/*
 * Formats fabricated files the way a consumer's Prettier run would: from a
 * scratch folder whose own `prettier.config.ts` loads this package's source.
 *
 * - Going through the config file, not `format()` with the config object,
 *   is what applies `overrides`, which only `resolveConfig` matches.
 */
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { format, resolveConfig } from "prettier";

/** The package's `src/`, which the scratch configs import. */
const SOURCE_DIR: string = path.resolve(import.meta.dirname, "../src");

/** One scratch folder holding a `prettier.config.ts`. */
export type Scratch = {
  /**
   * Formats `text` as the file at `filePath` would be.
   *
   * @returns Prettier's output.
   */
  format: (options: {
    /** The file's path, relative to the scratch folder. */
    filePath: string;

    /** The file's contents. */
    text: string;
  }) => Promise<string>;

  /** Removes the scratch folder. */
  remove: () => void;
};

/**
 * Creates a scratch folder whose `prettier.config.ts` holds `configSource`.
 *
 * @param configSource - the config's source, where `{{src}}` stands for the
 *   URL of this package's `src/` folder.
 * @returns the folder's helpers.
 */
export function createScratch(configSource: string): Scratch {
  const root = realpathSync(
    mkdtempSync(path.join(tmpdir(), "kit-prettier-config-"))
  );
  const sourceUrl = pathToFileURL(SOURCE_DIR).href;

  writeFileSync(
    path.join(root, "prettier.config.ts"),
    configSource.replaceAll("{{src}}", sourceUrl)
  );

  return {
    format: async ({ filePath, text }) => {
      const absolutePath = path.join(root, filePath);
      mkdirSync(path.dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, text);
      const options = await resolveConfig(absolutePath, {
        editorconfig: false,
      });

      return format(text, { ...options, filepath: absolutePath });
    },
    remove: () => {
      rmSync(root, { force: true, recursive: true });
    },
  };
}
