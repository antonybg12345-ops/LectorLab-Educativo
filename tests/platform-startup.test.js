import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('un puerto ocupado devuelve error claro y cierra PostgreSQL sin TypeError ni proceso colgado', async t => {
  const occupied = createServer().listen(0, '127.0.0.1'); await once(occupied, 'listening');
  const directory = await mkdtemp(path.join(tmpdir(), 'lectorlab-startup-'));
  t.after(async () => { await new Promise(resolve => occupied.close(resolve)); await rm(directory, { recursive: true, force: true }); });
  const result = await new Promise(resolve => execFile(process.execPath, ['server.js'], {
    cwd: new URL('../', import.meta.url), timeout: 15_000,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(occupied.address().port),
      NODE_ENV: 'development', LECTORLAB_DATA_DIR: path.join(directory, 'postgres'), DATABASE_URL: '',
      OPENAI_API_KEY: '', OPENAI_MODEL: '', LECTORLAB_GOOGLE_CREDENTIALS_FILE: '' },
  }, (error, stdout, stderr) => resolve({ error, stdout, stderr })));
  assert.equal(result.error?.code, 1);
  assert.notEqual(result.error?.killed, true);
  assert.match(result.stderr, /No se pudo abrir el puerto/);
  assert.doesNotMatch(result.stderr, /TypeError|Cannot read properties|password|postgres:\/\//);
});
