import { afterEach, describe, expect, test, vi } from "vitest";

import { main } from "./main.ts";

vi.mock(import("./main.ts"), () => ({ main: vi.fn(() => 3) }));

describe("index", () => {
  afterEach(() => {
    process.exitCode = undefined;
  });

  test("runs the check and exits with its code", async () => {
    // Given - a check that returns 3.

    // When - the entry point loads.
    await import("./index.ts");

    // Then - it ran the check on the environment and kept its code.
    expect(main).toHaveBeenCalledWith(process.env);
    expect(process.exitCode).toBe(3);
  });
});
