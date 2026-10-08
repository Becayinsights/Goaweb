// Solo admin. GET: personas (alta y última actividad) e invitaciones pendientes. POST {name}: crea invitación.
// POST {reset:id}: enlace para que esa persona elija contraseña nueva.
// DELETE ?user= o ?invite=: quita a alguien o anula una invitación.
import { randomBytes } from 'node:crypto';
import { auth, readJSON, users, getUser, deleteUser, invites, saveInvite, deleteInvite, resetFor, removeBlob, newId, origin, pub, fail, bad } from './_lib.js';

export default async function handler(req, res) {
  try {
    const me = await auth(req);
    if (!me?.admin) throw bad('Solo el administrador puede hacer esto', 403);
    const base = origin(req);
    if (req.method === 'POST' && req.body?.reset) {
      const u = await getUser(req.body.reset);
      if (!u) throw bad('No existe', 404);
      return res.status(200).json({ link: `${base}/?r=${encodeURIComponent(await resetFor(u))}`, name: u.name });
    }
    if (req.method === 'POST') {
      const name = String(req.body?.name || '').trim().slice(0, 40);
      if (!name) throw bad('Pon un nombre');
      // solo letras y números: algunos chats cortan los enlaces en «-» o «_»
      const inv = { token: randomBytes(10).toString('hex'), name, created: new Date().toISOString() };
      await saveInvite(inv);
      return res.status(200).json({ ...inv, link: `${base}/?i=${inv.token}` });
    }
    if (req.method === 'DELETE') {
      if (req.query.invite) await deleteInvite(req.query.invite);
      if (req.query.user) {
        if (req.query.user === me.id) throw bad('No puedes borrarte a ti');
        const u = await getUser(req.query.user);
        if (u) { await deleteUser(u); await removeBlob(`data/${u.id}.json`).catch(() => {}); }
      }
      return res.status(200).json({ ok: true });
    }
    // cuándo se unió cada persona y cuándo usó la app por última vez
    const list = await users();
    const seen = await Promise.all(list.map(u => readJSON(`data/${u.id}.json`, {}).then(d => d._at || null)));
    res.status(200).json({
      users: list.map((u, i) => ({ ...pub(u), created: u.created || null, seen: seen[i] })),
      invites: (await invites()).map(i => ({ ...i, link: `${base}/?i=${i.token}` })),
    });
  } catch (e) { fail(res, e); }
}
