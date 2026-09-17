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
  },
});
