import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const projectRoot = new URL('../', import.meta.url);

async function exists(url) {
  try {
    await stat(url);
    return true;
  } catch {
    return false;
  }
}

test('package scripts use Node-only dev and build commands', async () => {
  const packageJson = JSON.parse(await readFile(new URL('package.json', projectRoot), 'utf8'));
  assert.equal(packageJson.scripts.dev, 'node tools/dev-server.mjs');
  assert.equal(packageJson.scripts.build, 'node tools/build.mjs');
  assert.equal(packageJson.scripts.preview, 'node tools/dev-server.mjs --root dist');
});

test('npm run build creates a deployable dist directory', async () => {
  const distUrl = new URL('dist/', projectRoot);
  await rm(distUrl, { recursive: true, force: true });

  const result = spawnSync('npm', ['run', 'build'], {
    cwd: projectRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.equal(await exists(new URL('index.html', distUrl)), true);
  assert.equal(await exists(new URL('styles.css', distUrl)), true);
  assert.equal(await exists(new URL('src/app.js', distUrl)), true);
});
