import { readFile, mkdir, open, unlink } from 'node:fs/promises';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';

const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');

/** A single embedded process owns a persistent directory. A stale lock is recovered
 * only after confirming that its recorded process no longer exists. */
async function acquireLocalLock(dataDir) {
  const directory = path.resolve(dataDir);
  await mkdir(path.dirname(directory), { recursive: true, mode: 0o700 });
  const lockPath = `${directory}.process-lock`;
  async function attempt() {
    const handle = await open(lockPath, 'wx', 0o600);
    await handle.writeFile(String(process.pid));
    await handle.close();
    return async () => {
      const owner = await readFile(lockPath, 'utf8').catch(() => '');
      if (owner === String(process.pid)) await unlink(lockPath).catch(() => {});
    };
  }
  try { return await attempt(); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const recorded = Number(await readFile(lockPath, 'utf8').catch(() => ''));
    if (!Number.isSafeInteger(recorded) || recorded < 1) {
      throw new Error('El bloqueo local de PostgreSQL no es válido. Revisa el proceso antes de retirarlo.');
    }
    try {
      process.kill(recorded, 0);
      throw new Error('Otra instancia utiliza PostgreSQL local. Detén esa instancia o usa DATABASE_URL.');
    } catch (probe) {
      if (probe.code !== 'ESRCH') throw probe;
    }
    await unlink(lockPath);
    return attempt();
  }
}

/** Same interface for PostgreSQL and embedded PostgreSQL (PGlite).
 * Explicit databaseUrl uses the standard pg driver and its configured TLS policy.
 * Otherwise dataDir='memory://' is useful for isolated tests; production startup
 * passes an absolute private persistent directory. No credential is logged here. */
export async function openDatabase({ dataDir = 'memory://', databaseUrl } = {}) {
  let database;
  let releaseLock = async () => {};
  let closed = false;
  if (databaseUrl) {
    const pool = new pg.Pool({ connectionString: databaseUrl, max: 8 });
    database = {
      query: (sql, params = []) => pool.query(sql, params),
      exec: sql => pool.query(sql),
      async transaction(work) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await work({ query: (sql, params = []) => client.query(sql, params), exec: sql => client.query(sql) });
          await client.query('COMMIT');
          return result;
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally { client.release(); }
      },
      close: () => pool.end(),
      kind: 'postgres',
    };
  } else {
    if (dataDir !== 'memory://') releaseLock = await acquireLocalLock(dataDir);
    let engine;
    try {
      engine = new PGlite(dataDir);
      await engine.waitReady;
    } catch (error) { await releaseLock(); throw error; }
    database = {
      query: (sql, params = []) => engine.query(sql, params),
      exec: sql => engine.exec(sql),
      transaction: work => engine.transaction(tx => work({
        query: (sql, params = []) => tx.query(sql, params), exec: sql => tx.exec(sql),
      })),
      close: () => engine.close(),
      kind: 'pglite',
    };
  }
  const closeEngine = database.close;
  database.close = async () => {
    if (closed) return;
    closed = true;
    try { await closeEngine(); } finally { await releaseLock(); }
  };
  try {
    await database.transaction(tx => tx.exec(schema));
    return database;
  } catch (error) {
    await database.close();
    throw error;
  }
}
