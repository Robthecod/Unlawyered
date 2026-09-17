/**
 * UNLAWYERED server entrypoint.
 */
import { config, ensureDataDir } from "./config.js";
import { createApp } from "./app.js";

ensureDataDir();

const app = createApp();

app.listen(config.port, config.host, () => {
  console.log(`[unlawyered] API listening on http://${config.host}:${config.port}`);
  console.log(`[unlawyered] data dir: ${config.dataDir}`);
});
