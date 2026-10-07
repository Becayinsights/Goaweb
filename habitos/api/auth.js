// Cuentas: entrar, registrarse (con invitación; la primera cuenta es admin),
// olvidé la contraseña, restablecerla, cambiarla y editar el perfil.
import { hasStore, users, saveUsers, invites, saveInvites, normEmail, hashPw, checkPw, sessionFor, resetFor,
  fromToken, auth, pub, newId, sendMail, origin, fail, bad } from './_lib.js';

const okEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const okPw = p => String(p || '').length >= 6;

export default async function handler(req, res) {
  try {
    if (!hasStore()) throw bad('Servicio no disponible', 503);
    const b = req.body || {}, list = await users();

    if (req.method === 'GET') {           // estado: ¿hay que crear la primera cuenta? ¿invitación válida?
      const out = { setup: list.length === 0 };
      if (req.query.invite) {
        const inv = (await invites()).find(i => i.token === req.query.invite);
        out.invite = inv ? { name: inv.name } : null;
      }
      const u = await auth(req);
      if (u) out.user = pub(u);
      return res.status(200).json(out);
    }

    switch (b.action) {
      case 'login': {
        const u = list.find(x => x.email === normEmail(b.email));
        if (!u || !checkPw(u, b.password)) throw bad('Email o contraseña incorrectos', 401);
        return res.status(200).json({ token: await sessionFor(u), user: pub(u) });
      }
      case 'register': {
        const email = normEmail(b.email), name = String(b.name || '').trim().slice(0, 40);
        if (!name) throw bad('Escribe tu nombre');
        if (!okEmail(email)) throw bad('Ese email no parece válido');
        if (!okPw(b.password)) throw bad('La contraseña necesita al menos 6 caracteres');
        if (list.some(x => x.email === email)) throw bad('Ya hay una cuenta con ese email');
        let invs = await invites(), inv = null;
        if (list.length) {
          inv = invs.find(i => i.token === b.invite);
          if (!inv) throw bad('Necesitas una invitación para crear la cuenta', 403);
        }
        const u = { id: newId(), name, email, admin: list.length === 0, ...hashPw(b.password), created: new Date().toISOString() };
        list.push(u); await saveUsers(list);
        if (inv) await saveInvites(invs.filter(i => i !== inv));
        return res.status(200).json({ token: await sessionFor(u), user: pub(u) });
      }
      case 'forgot': {
        const u = list.find(x => x.email === normEmail(b.email));
        let sent = false;
        if (u) {
          const link = `${origin(req)}/?r=${encodeURIComponent(await resetFor(u))}`;
          sent = await sendMail(u.email, 'Restablece tu contraseña',
            `<p>Hola ${u.name},</p><p>Para elegir una contraseña nueva entra aquí:</p><p><a href="${link}">${link}</a></p><p>El enlace caduca en 48 horas.</p>`);
        }
        // misma respuesta exista o no la cuenta
        const admin = list.find(x => x.admin);
        return res.status(200).json({ sent, admin: admin?.name || null });
      }
      case 'reset': {
        const u = await fromToken(b.token, 'r');
        if (!u) throw bad('El enlace ha caducado o ya se usó', 410);
        if (!okPw(b.password)) throw bad('La contraseña necesita al menos 6 caracteres');
        Object.assign(u, hashPw(b.password)); await saveUsers(list.map(x => x.id === u.id ? u : x));
        return res.status(200).json({ token: await sessionFor(u), user: pub(u) });
      }
      case 'password': {
        const u = await auth(req); if (!u) throw bad('Inicia sesión', 401);
        if (!checkPw(u, b.current)) throw bad('La contraseña actual no es correcta', 401);
        if (!okPw(b.password)) throw bad('La contraseña necesita al menos 6 caracteres');
        Object.assign(u, hashPw(b.password)); await saveUsers(list.map(x => x.id === u.id ? u : x));
        return res.status(200).json({ token: await sessionFor(u), user: pub(u) });
      }
      case 'profile': {
        const u = await auth(req); if (!u) throw bad('Inicia sesión', 401);
        const name = String(b.name || '').trim().slice(0, 40);
        if (name) u.name = name;
        await saveUsers(list.map(x => x.id === u.id ? u : x));
        return res.status(200).json({ user: pub(u) });
      }
    }
    throw bad('Acción no válida');
  } catch (e) { fail(res, e); }
}
