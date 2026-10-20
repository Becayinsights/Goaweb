// Feedback de la app. POST {text}: cualquiera con sesión lo envía. Solo admin: GET lista, DELETE ?id= lo archiva.
import { auth, readAll, writeJSON, removeBlob, pub, fail, bad } from './_lib.js';

export default async function handler(req, res) {
  try {
    const me = await auth(req);
    if (!me) throw bad('Inicia sesión', 401);
    if (req.method === 'POST') {
      const text = String(req.body?.text || '').trim().slice(0, 2000);
      if (text.length < 3) throw bad('Escribe un poco más');
      const id = `${Date.now()}-${me.id}`;
      await writeJSON(`feedback/${id}.json`, { id, user: pub(me), text, at: new Date().toISOString(), v: req.body?.v || null });
      return res.status(200).json({ ok: true });
    }
    if (!me.admin) throw bad('Solo el administrador puede hacer esto', 403);
    if (req.method === 'DELETE') {
      const id = String(req.query.id || '');
      if (!/^\d+-[\w-]+$/.test(id)) throw bad('No existe', 404);
      await removeBlob(`feedback/${id}.json`);
      return res.status(200).json({ ok: true });
    }
    const list = (await readAll('feedback/')).sort((a, b) => String(b.at).localeCompare(String(a.at)));
    res.status(200).json({ items: list });
  } catch (e) { fail(res, e); }
}
