// Solo admin. GET: lista de usuarios. POST {name}: crea invitación. DELETE ?code=: la revoca.
import { auth, hasStore, users, saveUsers, newCode, removeBlob, fail } from './_lib.js';

export default async function handler(req, res) {
  try {
    const u = await auth(req);
    if (!u?.admin) return res.status(403).json({ error: 'Solo el administrador puede invitar' });
    if (!hasStore()) return res.status(503).json({ error: 'Activa el almacenamiento para invitar' });
    let list = await users();
    if (req.method === 'POST') {
      const name = String(req.body?.name || '').trim().slice(0, 40);
      if (!name) return res.status(400).json({ error: 'Pon un nombre' });
      const nu = { code: newCode(), name, created: new Date().toISOString() };
      list.push(nu); await saveUsers(list);
      return res.status(200).json(nu);
    }
    if (req.method === 'DELETE') {
      const code = String(req.query.code || '');
      if (code === u.code) return res.status(400).json({ error: 'No puedes borrarte a ti' });
      list = list.filter(x => x.code !== code); await saveUsers(list);
      await removeBlob(`data/${code}.json`).catch(() => {});
      return res.status(200).json({ ok: true });
    }
    res.status(200).json(list);
  } catch (e) { fail(res, e); }
}
