import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";

import { tempFolder } from "./environment.ts";

describe("tempFolder", () => {
  test.each([
    {
      description: "the runner's folder",
      env: { RUNNER_TEMP: "/runner/temp" },
      expected: "/runner/temp",
    },
    { description: "the OS's with none", env: {}, expected: tmpdir() },
    {
      description: "the OS's with an empty one",
      env: { RUNNER_TEMP: "" },
      expected: tmpdir(),
    },
  ])("picks $description", ({ env, expected }) => {
    // Given - the step's environment.

    // When - the folder is picked.
    const folder = tempFolder(env);

    // Then - it's the expected one.
    expect(folder).toBe(expected);
  });
});
