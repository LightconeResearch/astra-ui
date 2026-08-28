// Type-checks the sibling consumers against THIS workspace's build of
// @astra-spec/ui (not whatever copy sits in their node_modules),
// so a breaking change here fails locally before it lands.
//
//   npm run check:consumers
//
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// npx is a .cmd shim on Windows, which only a shell can start.
const shell = process.platform === 'win32';
const dist = join(here, 'packages/react/dist');
const consumers = [
  { name: 'jupyterlab-astra', dir: resolve(here, '../jupyterlab-astra'), include: ['src/**/*'] },
  { name: 'astra-theme', dir: resolve(here, '../astra-theme/packages/astra'), include: ['src/**/*'] },
];

let failed = false;
for (const { name, dir, include } of consumers) {
  if (!existsSync(join(dir, 'tsconfig.json'))) {
    console.log(`skip     ${name} (not checked out at ${dir})`);
    continue;
  }
  const scratch = join(here, '.cache', 'consumers');
  mkdirSync(scratch, { recursive: true });
  const config = join(scratch, `${name}.tsconfig.json`);
  writeFileSync(config, JSON.stringify({
    extends: join(dir, 'tsconfig.json'),
    compilerOptions: {
      noEmit: true,
      baseUrl: dir,
      paths: {
        ...Object.fromEntries(['primitives', 'components', 'blocks', 'views', 'model'].map((layer) => [`@astra-spec/ui/${layer}`, [join(dist, layer, 'index.d.ts')]])),
        '@astra-spec/ui/*': [join(dist, '*')],
      },
    },
    include: include.map((pattern) => join(dir, pattern)),
  }, null, 2));
  const result = spawnSync('npx', ['tsc', '-p', config], { stdio: 'inherit', cwd: dir, shell });
  if (result.status === 0) console.log(`ok       ${name}`);
  else { failed = true; console.log(`FAILED   ${name}`); }
}
process.exit(failed ? 1 : 0);
