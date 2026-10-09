// Sincroniza los datos de cada usuario (un JSON por persona).
import { auth, hasStore, readJSON, writeJSON, fail } from './_lib.js';

export default async function handler(req, res) {
  try {
    if (!hasStore()) return res.status(503).json({ error: 'Sincronización no activada' });
    const u = await auth(req);
    if (!u) return res.status(401).json({ error: 'Inicia sesión' });
    const path = `data/${u.id}.json`;
    if (req.method === 'GET') return res.status(200).json(await readJSON(path, {}));
    if (req.method === 'PUT') {
      const { _base, ...doc } = req.body || {};
      if (!doc || typeof doc !== 'object' || JSON.stringify(doc).length > 2_000_000) return res.status(400).json({ error: 'Datos no válidos' });
      // _base: versión del servidor que este móvil tenía (null = «creía que estaba vacío»). Si otro dispositivo guardó después, 409 y el móvil fusiona antes de guardar
      if (_base !== undefined) {
        const cur = await readJSON(path, null);
        if ((cur?.updated || null) !== _base) return res.status(409).json({ error: 'Hay cambios de otro dispositivo' });
      }
      // _at: última vez que la persona usó la app (lo ve el admin en Personas)
      await writeJSON(path, { ...doc, _at: Date.now() });
      return res.status(200).json({ ok: true });
    }
    res.status(405).end();
  } catch (e) { fail(res, e); }
}
