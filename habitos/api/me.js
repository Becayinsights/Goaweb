// GET: estado del servidor y de la cuenta.
// POST {code}: entrar con un código. POST {setup:nombre}: crea la primera cuenta (admin) si no hay ninguna.
import { auth, hasStore, users, saveUsers, newCode, fail } from './_lib.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'POST' && req.body?.setup) {
      if (!hasStore()) return res.status(503).json({ error: 'Activa el almacenamiento primero' });
      const list = await users();
      if (list.length) return res.status(409).json({ error: 'Ya hay un administrador' });
      const u = { code: newCode(), name: String(req.body.setup).trim().slice(0, 40) || 'Admin', admin: true, created: new Date().toISOString() };
      await saveUsers([u]);
      return res.status(200).json({ user: { name: u.name, admin: true }, code: u.code });
    }
    if (req.method === 'POST') req.headers['x-code'] = req.body?.code || '';
    const u = await auth(req);
    if (req.method === 'POST' && !u) return res.status(404).json({ error: 'Código no válido' });
    res.status(200).json({
      user: u ? { name: u.name, admin: u.admin } : null,
      store: hasStore(),
      setup: hasStore() && !u ? (await users()).length === 0 : false,
      ai: !!process.env.ANTHROPIC_API_KEY,
    });
  } catch (e) { fail(res, e); }
}
