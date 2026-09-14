import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(projectRoot, 'dist');

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

for (const entry of ['index.html', 'styles.css', 'src']) {
  await cp(path.join(projectRoot, entry), path.join(distDir, entry), { recursive: true });
}

console.log(`Build complete: ${distDir}`);
