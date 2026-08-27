// Compare two screenshot runs pixel-by-pixel with ImageMagick and report the
// differing images with their absolute-error pixel counts.
//
//   node scripts/compare.mjs <baselineDir> <candidateDir> [diffDir]
//
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [baselineDir, candidateDir, diffDirArg] = process.argv.slice(2).map((value) => resolve(value));
const diffDir = diffDirArg ?? join(candidateDir, '..', 'diff');
mkdirSync(diffDir, { recursive: true });

let failures = 0;
for (const file of readdirSync(baselineDir).filter((name) => name.endsWith('.png')).sort()) {
  const candidate = join(candidateDir, file);
  if (!existsSync(candidate)) {
    console.log(`MISSING  ${file}`);
    failures += 1;
    continue;
  }
  let pixels = '0';
  try {
    pixels = execFileSync('compare', ['-metric', 'AE', join(baselineDir, file), candidate, join(diffDir, file)], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    // `compare` exits 1 when images differ and 2 on size mismatch; stderr carries the metric.
    pixels = String(error.stderr ?? '').trim() || 'size-mismatch';
  }
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
