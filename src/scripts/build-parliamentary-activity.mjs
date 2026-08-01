import {spawnSync} from "node:child_process";
import path from "node:path";
import {fileURLToPath} from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const scripts = [
  "build-members-lookup.mjs",
  "build-recent-contributions.mjs",
  "build-recent-questions.mjs",
];

for (const script of scripts) {
  const result = spawnSync(process.execPath, [path.join(scriptDir, script)], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
