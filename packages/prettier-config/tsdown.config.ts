import type { UserConfig } from "tsdown";

import { defineConfig } from "tsdown";

/*
 * ESM only, for Node 26: Prettier loads a config with `import()`.
 *
 * - Declarations come from tsc, not Oxc: Oxc widens a `const` literal's type.
 *
 * - Declaration maps point at the shipped `src/`, so go-to-definition lands
 *   on the TypeScript source.
 *
 * - The plugins and `sh-syntax` stay external, as dependencies, so a
 *   consumer's lockfile pins them.
 */
const CONFIG: UserConfig = defineConfig({
  dts: { generator: "tsc", sourcemap: true },
  entry: ["src/index.ts", "src/zsh.ts"],

  // `"type": "module"` already makes `.js` ESM, the name `exports` uses.
  fixedExtension: false,
  format: "esm",
  platform: "node",
  target: "node26",
});

export default CONFIG;
