import express from 'express';
import { GoogleAuth } from 'google-auth-library';
import { fail } from './activities.js';

const header = ['attempt_id', 'seudonimo', 'grupo', 'actividad', 'entrega_utc', 'estado', 'aciertos_objetivos', 'items_objetivos', 'rubrica_docente', 'version_resultado'];

/** Uses only an explicitly configured project credential, never machine ambient credentials. */
export function createSheetsClient({ credentialsFile } = {}) {
  if (!credentialsFile) return null;
  const auth = new GoogleAuth({ keyFile: credentialsFile, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  async function request(url, method = 'GET', data) {
    const client = await auth.getClient();
    const result = await client.request({ url, method, data, timeout: 15_000, retry: false });
    return result.data;
  }
  return {
    async verify(id) {
      await request(`https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=spreadsheetId`);
    },
    async upsert(id, values) {
      const base = `https://sheets.googleapis.com/v4/spreadsheets/${id}`;
      const metadata = await request(`${base}?fields=sheets.properties`);
      if (!metadata.sheets?.some(s => s.properties.title === 'LectorLab')) {
        await request(`${base}:batchUpdate`, 'POST', { requests: [{ addSheet: { properties: { title: 'LectorLab' } } }] });
      }
      const range = encodeURIComponent('LectorLab!A1:J10001');
      const snapshot = await request(`${base}/values/${range}`);
      const rows = snapshot.values || [];
      if (rows.length && JSON.stringify(rows[0]) !== JSON.stringify(header)) fail(409, 'La pestaña LectorLab tiene columnas distintas. Usa una hoja dedicada o restaura sus encabezados.');
      if (!rows.length) await request(`${base}/values/${encodeURIComponent('LectorLab!A1:J1')}?valueInputOption=RAW`, 'PUT', { values: [header] });
      if (rows.length >= 10001) fail(409, 'La hoja llegó al límite de esta versión. Exporta Excel o prepara otro destino.');
      const matches = rows.map((row, index) => row[0] === values[0] ? index : -1).filter(index => index >= 1);
      if (matches.length > 1) fail(409, 'Hay claves de intento duplicadas en Sheets; revisa el destino antes de sincronizar.');
      if (matches.length) {
        const row = matches[0] + 1;
        await request(`${base}/values/${encodeURIComponent(`LectorLab!A${row}:J${row}`)}?valueInputOption=RAW`, 'PUT', { values: [values] });
      } else {
        await request(`${base}/values/${encodeURIComponent('LectorLab!A:J')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, 'POST', { values: [values] });
      }
    },
  };
}

export async function initSheetsSchema(db) {
  await db.exec(`CREATE TABLE IF NOT EXISTS sheets_connections (
    owner_id TEXT PRIMARY KEY REFERENCES users(id), spreadsheet_id TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    INSERT INTO schema_migrations(version) VALUES(2) ON CONFLICT(version) DO NOTHING;`);
}

export function createSheetsRouter({ db, client = null }) {
  const router = express.Router();
  const busy = new Set(); // Embedded preview has one process; external multiworker needs DB leases.
  const teacher = (req, _res, next) => { if (req.user.role !== 'teacher') return next(Object.assign(new Error('Solo el docente puede configurar Sheets.'), { status: 403 })); next(); };
  async function metadata(owner) {
    const { rows } = await db.query('SELECT spreadsheet_id FROM sheets_connections WHERE owner_id=$1', [owner]);
    const count = await db.query("SELECT COUNT(*)::int AS n FROM sync_outbox WHERE owner_id=$1 AND state<>'synced'", [owner]);
    return { configured: Boolean(client), connected: Boolean(rows[0]), spreadsheetId: rows[0]?.spreadsheet_id || null, pendingCount: count.rows[0].n };
  }
  router.get('/integrations/sheets', teacher, async (req, res) => res.json(await metadata(req.user.id)));
  router.put('/integrations/sheets', teacher, async (req, res) => {
    if (!client) fail(503, 'Google Sheets no está configurado. Puedes seguir usando Excel; la conexión requiere una credencial del proyecto en el servidor.');
    const id = req.body?.spreadsheetId;
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{20,150}$/.test(id)) fail(400, 'Indica el identificador de una hoja de Google válida.');
    if (busy.has(req.user.id)) fail(409, 'Espera a que termine la sincronización antes de cambiar el destino.');
    try { await client.verify(id); } catch { fail(502, 'No se pudo acceder a esa hoja. Comprueba que la cuenta de servicio del proyecto tiene permiso sobre ese archivo.'); }
    await db.transaction(async tx => {
      // One credential is shared by this installation; prevent two teachers adopting the same destination.
      await tx.exec('LOCK TABLE sheets_connections IN EXCLUSIVE MODE');
      const other = await tx.query('SELECT owner_id FROM sheets_connections WHERE spreadsheet_id=$1 AND owner_id<>$2', [id, req.user.id]);
      if (other.rows.length) fail(409, 'Este destino ya está vinculado a otro docente de esta instalación.');
      await tx.query(`INSERT INTO sheets_connections(owner_id,spreadsheet_id) VALUES($1,$2)
        ON CONFLICT(owner_id) DO UPDATE SET spreadsheet_id=EXCLUDED.spreadsheet_id,updated_at=NOW()`, [req.user.id, id]);
      await tx.query("UPDATE sync_outbox SET state='pending',last_error=NULL WHERE owner_id=$1", [req.user.id]);
    });
    res.json(await metadata(req.user.id));
  });
  router.delete('/integrations/sheets', teacher, async (req, res) => {
    if (busy.has(req.user.id)) fail(409, 'Espera a que termine la sincronización.');
    await db.query('DELETE FROM sheets_connections WHERE owner_id=$1', [req.user.id]);
    res.json(await metadata(req.user.id));
  });
  router.post('/integrations/sheets/sync', teacher, async (req, res) => {
    if (!client) fail(503, 'Google Sheets no está configurado. Los resultados permanecen guardados y puedes exportar Excel.');
    if (busy.has(req.user.id)) fail(409, 'Ya hay una sincronización en curso.');
    busy.add(req.user.id);
    try {
      const settings = await metadata(req.user.id);
      if (!settings.connected) fail(409, 'Selecciona una hoja autorizada antes de sincronizar.');
      const { rows } = await db.query(`SELECT o.id,o.result_version,t.id AS attempt_id,t.submitted_at,t.status,t.objective_score,t.max_objective,
        u.name,g.name AS group_name,c.title,s.rubric FROM sync_outbox o JOIN attempts t ON t.id=o.attempt_id
        JOIN users u ON u.id=t.student_id JOIN assignments a ON a.id=t.assignment_id JOIN groups g ON g.id=a.group_id
        JOIN activities c ON c.id=a.activity_id LEFT JOIN assessments s ON s.attempt_id=t.id
        WHERE o.owner_id=$1 AND o.state<>'synced' ORDER BY o.result_version,o.created_at,o.id LIMIT 100`, [req.user.id]);
      let synced = 0;
      for (const row of rows) {
        try {
          await client.upsert(settings.spreadsheetId, [row.attempt_id, row.name, row.group_name, row.title,
            row.submitted_at ? new Date(row.submitted_at).toISOString() : '', row.status, row.objective_score ?? '', row.max_objective ?? '',
            row.rubric ? JSON.stringify(row.rubric) : 'Pendiente de revisión', row.result_version]);
          await db.query("UPDATE sync_outbox SET state='synced',attempts=attempts+1,last_error=NULL WHERE id=$1", [row.id]);
          synced++;
        } catch {
          await db.query("UPDATE sync_outbox SET state='error',attempts=attempts+1,last_error=$2 WHERE id=$1", [row.id, 'No se pudo confirmar escritura. Reintenta para reconciliar por ID; revisa permisos y encabezados.']);
          break; // Do not flood a revoked or malformed destination.
        }
      }
      const result = await metadata(req.user.id);
      res.json({ synced, pending: result.pendingCount, ...result });
    } finally { busy.delete(req.user.id); }
  });
  return router;
}
