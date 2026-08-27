// Compare two screenshot runs pixel-by-pixel with ImageMagick and report the
// differing images with their absolute-error pixel counts.
//
//   node scripts/compare.mjs <baselineDir> <candidateDir> [diffDir]
//
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [baselineArg, candidateArg, diffDirArg] = process.argv.slice(2);
if (!baselineArg || !candidateArg) {
  console.error('usage: node scripts/compare.mjs <baselineDir> <candidateDir> [diffDir]');
  process.exit(1);
}
const baselineDir = resolve(baselineArg);
const candidateDir = resolve(candidateArg);
const diffDir = diffDirArg ? resolve(diffDirArg) : join(candidateDir, '..', 'diff');
mkdirSync(diffDir, { recursive: true });

let failures = 0;
for (const file of readdirSync(baselineDir).filter((name) => name.endsWith('.png')).sort()) {
  const candidate = join(candidateDir, file);
  if (!existsSync(candidate)) {
    console.log(`MISSING  ${file}`);
    failures += 1;
    continue;
  }
  // `compare` always prints the metric to stderr; it exits 1 when images
  // differ and 2 on size mismatch.
  const result = spawnSync('compare', ['-metric', 'AE', join(baselineDir, file), candidate, join(diffDir, file)], { encoding: 'utf8' });
  const pixels = result.status === 2 ? 'size-mismatch' : String(result.stderr).trim();
  const count = Number.parseFloat(pixels);
  if (Number.isNaN(count) || count > 0) {
    failures += 1;
    console.log(`DIFF     ${file}  ${pixels}`);
  } else {
    console.log(`same     ${file}`);
  }
}
console.log(failures ? `\n${failures} image(s) differ` : '\nall images identical');
process.exit(failures ? 1 : 0);
