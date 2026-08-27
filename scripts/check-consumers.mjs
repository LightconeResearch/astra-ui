// Type-checks the sibling consumers against the workspace build so a
// breaking rename in astra-ui fails locally before it lands.
//
//   npm run check:consumers
//
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const consumers = [
  { name: 'jupyterlab-astra', dir: resolve('../jupyterlab-astra') },
  { name: 'astra-theme', dir: resolve('../astra-theme/packages/astra') },
];

let failed = false;
for (const { name, dir } of consumers) {
  if (!existsSync(dir)) {
    console.log(`skip     ${name} (not checked out at ${dir})`);
    continue;
  }
  const result = spawnSync('npx', ['tsc', '--noEmit', '-p', dir], { stdio: 'inherit' });
  if (result.status === 0) console.log(`ok       ${name}`);
  else { failed = true; console.log(`FAILED   ${name}`); }
}
process.exit(failed ? 1 : 0);
