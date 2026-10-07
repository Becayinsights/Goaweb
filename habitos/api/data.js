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
      const doc = req.body;
      if (!doc || typeof doc !== 'object' || JSON.stringify(doc).length > 2_000_000) return res.status(400).json({ error: 'Datos no válidos' });
      await writeJSON(path, doc);
      return res.status(200).json({ ok: true });
    }
    res.status(405).end();
  } catch (e) { fail(res, e); }
}
