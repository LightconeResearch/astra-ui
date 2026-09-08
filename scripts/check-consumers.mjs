// Type-checks the sibling consumers against THIS workspace's build of
// @astra-spec/ui (not whatever copy sits in their node_modules),
// so a breaking change here fails locally before it lands.
//
//   npm run check:consumers
//
// Each consumer is checked with its own tsconfig and its own TypeScript, found
// in the nearest node_modules at or above the checkout; one that is not
// installed is skipped.
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(here, 'packages/react/dist');
const consumers = [
  { name: 'jupyterlab-lightcone', dir: resolve(here, '../jupyterlab-lightcone') },
  { name: 'vscode-astra', dir: resolve(here, '../vscode-astra') },
  { name: 'astra-theme', dir: resolve(here, '../astra-theme2/packages/astra') },
];

function nearestTsc(dir) {
  for (let candidate = dir; ; candidate = dirname(candidate)) {
    const tsc = join(candidate, 'node_modules/typescript/bin/tsc');
    if (existsSync(tsc)) return tsc;
    if (dirname(candidate) === candidate) return undefined;
  }
}

let failed = false;
for (const { name, dir } of consumers) {
  if (!existsSync(join(dir, 'tsconfig.json'))) {
    console.log(`skip     ${name} (not checked out at ${dir})`);
    continue;
  }
  const tsc = nearestTsc(dir);
  if (!tsc) {
    console.log(`skip     ${name} (not installed)`);
    continue;
  }
  // Written beside the consumer's own tsconfig so its `types`, `include` and
  // module resolution apply unchanged; only @astra-spec/ui is redirected.
  const config = join(dir, '.astra-ui-consumer-check.tsconfig.json');
  writeFileSync(config, JSON.stringify({
    extends: './tsconfig.json',
    compilerOptions: {
      noEmit: true,
      composite: false,
      incremental: false,
      declaration: false,
      baseUrl: '.',
      paths: {
        ...Object.fromEntries(['lib', 'primitives', 'components', 'blocks', 'views', 'model'].map((layer) => [`@astra-spec/ui/${layer}`, [join(dist, layer, 'index.d.ts')]])),
        '@astra-spec/ui/*': [join(dist, '*')],
      },
    },
  }, null, 2));
  try {
    const result = spawnSync(process.execPath, [tsc, '-p', config], { stdio: 'inherit', cwd: dir });
    if (result.status === 0) console.log(`ok       ${name}`);
    else { failed = true; console.log(`FAILED   ${name}`); }
  } finally {
    rmSync(config, { force: true });
  }
}
process.exit(failed ? 1 : 0);
