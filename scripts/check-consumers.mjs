// Type-checks the sibling consumers against THIS workspace's build of
// @lightcone-research/astra-ui (not whatever copy sits in their node_modules),
// so a breaking change here fails locally before it lands.
//
//   npm run check:consumers
//
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const here = resolve(new URL('..', import.meta.url).pathname);
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
        '@lightcone-research/astra-ui/components': [join(dist, 'components.d.ts')],
        '@lightcone-research/astra-ui/views': [join(dist, 'views.d.ts')],
        '@lightcone-research/astra-ui/ui': [join(dist, 'ui/index.d.ts')],
        '@lightcone-research/astra-ui/data': [join(dist, 'data/index.d.ts')],
        '@lightcone-research/astra-ui/records': [join(dist, 'records/index.d.ts')],
        '@lightcone-research/astra-ui/inventory': [join(dist, 'inventory/index.d.ts')],
        '@lightcone-research/astra-ui/*': [join(dist, '*')],
      },
    },
    include: include.map((pattern) => join(dir, pattern)),
  }, null, 2));
  const result = spawnSync('npx', ['tsc', '-p', config], { stdio: 'inherit', cwd: dir });
  if (result.status === 0) console.log(`ok       ${name}`);
  else { failed = true; console.log(`FAILED   ${name}`); }
}
process.exit(failed ? 1 : 0);
