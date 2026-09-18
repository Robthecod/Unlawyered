import os from "node:os";
import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Tests must never touch the real settings store (apps/data). Before this
 * config, a test run could flip the live server's selected provider: e.g.
 * settings.test.ts stores an anthropic test key, and setApiKey() also selects
 * that provider — racing the dev server on the same settings.json.
 *
 * config.ts snapshots UNLAWYERED_DATA_DIR at import time, and vitest applies
 * test.env to process.env in each worker before any test module loads, so the
 * whole suite (and every module import in it) sees the temp dir. A pid suffix
 * keeps concurrent runs isolated; the OS cleans tmpdir eventually.
 */
const dataDir = path.join(os.tmpdir(), `unlawyered-vitest-${process.pid}`);

export default defineConfig({
  test: {
    env: {
      UNLAWYERED_DATA_DIR: dataDir,
    },
    /**
     * All test files share ONE temp settings store (the env var is resolved
     * once, from the parent pid), so files running in parallel workers race
     * on settings.json — e.g. settings.test.ts selecting the anthropic
     * provider mid-run would make api tests suddenly fail with missing-key.
     * The suite takes ~2s, so sequential file execution costs nothing and
     * removes the race deterministically.
     */
    fileParallelism: false,
  },
});
