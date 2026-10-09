// Cuentas: entrar, registrarse (con invitación; la primera cuenta es admin),
// olvidé la contraseña, restablecerla, cambiarla y editar el perfil.
import { hasStore, users, hasUsers, userByEmail, saveUser, getInvite, deleteInvite, normEmail, hashPw, checkPw, sessionFor, resetFor,
  fromToken, auth, pub, newId, sendMail, origin, fail, bad } from './_lib.js';

const okEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const okPw = p => String(p || '').length >= 8;
const PW_MSG = 'La contraseña necesita al menos 8 caracteres';
// tras 5 intentos fallidos seguidos la cuenta se bloquea 15 min (frena a quien prueba contraseñas)
const MAX_FAILS = 5, LOCK_MS = 15 * 6e4;

export default async function handler(req, res) {
  try {
    if (!hasStore()) throw bad('Servicio no disponible', 503);
    const b = req.body || {};

    if (req.method === 'GET') {           // estado: ¿hay que crear la primera cuenta? ¿invitación válida?
      // con sesión válida no hace falta comprobar si existe alguna cuenta (ahorra una operación en cada arranque)
      const u = await auth(req);
      const out = { setup: u ? false : !(await hasUsers()) };
      if (req.query.invite) {
        const inv = await getInvite(req.query.invite);
        out.invite = inv ? { name: inv.name } : null;
      }
      if (u) out.user = pub(u);
      return res.status(200).json(out);
    }

    switch (b.action) {
      case 'login': {
        const u = await userByEmail(b.email);
        if (!u) throw bad('Email o contraseña incorrectos', 401);
        if (u.lockUntil > Date.now()) throw bad(`Demasiados intentos. Prueba otra vez en ${Math.ceil((u.lockUntil - Date.now()) / 6e4)} min`, 429);
        if (!checkPw(u, b.password)) {
          u.fails = (u.fails || 0) + 1;
          if (u.fails >= MAX_FAILS) { u.fails = 0; u.lockUntil = Date.now() + LOCK_MS; }
          await saveUser(u);
          throw bad(u.lockUntil > Date.now() ? 'Demasiados intentos. Prueba otra vez en 15 min' : 'Email o contraseña incorrectos', u.lockUntil > Date.now() ? 429 : 401);
        }
        if (u.disabled) throw bad('Tu acceso está pausado. Habla con quien te invitó', 403);
        if (u.fails || u.lockUntil) { delete u.fails; delete u.lockUntil; await saveUser(u); }
        return res.status(200).json({ token: await sessionFor(u), user: pub(u) });
      }
      case 'register': {
        const email = normEmail(b.email), name = String(b.name || '').trim().slice(0, 40);
        if (!name) throw bad('Escribe tu nombre');
        if (!okEmail(email)) throw bad('Ese email no parece válido');
        if (!okPw(b.password)) throw bad(PW_MSG);
        if (await userByEmail(email)) throw bad('Ya hay una cuenta con ese email');
        const first = !(await hasUsers());
        const inv = first ? null : await getInvite(b.invite);
        if (!first && !inv) throw bad('Necesitas una invitación para crear la cuenta', 403);
        const u = { id: newId(), name, email, admin: first, ...hashPw(b.password), created: new Date().toISOString(), via: inv?.name || null };
        await saveUser(u);
        if (inv) await deleteInvite(inv.token);
        return res.status(200).json({ token: await sessionFor(u), user: pub(u) });
      }
      case 'forgot': {
        const u = await userByEmail(b.email);
        let sent = false;
        if (u) {
          const link = `${origin(req)}/?r=${encodeURIComponent(await resetFor(u))}`;
          sent = await sendMail(u.email, 'Restablece tu contraseña',
            `<p>Hola ${u.name},</p><p>Para elegir una contraseña nueva entra aquí:</p><p><a href="${link}">${link}</a></p><p>El enlace caduca en 48 horas.</p>`);
        }
        // misma respuesta exista o no la cuenta
        const admin = (await users()).find(x => x.admin);
        return res.status(200).json({ sent, admin: admin?.name || null });
      }
      case 'reset': {
        const u = await fromToken(b.token, 'r');
        if (!u) throw bad('El enlace ha caducado o ya se usó', 410);
        if (!okPw(b.password)) throw bad(PW_MSG);
        Object.assign(u, hashPw(b.password)); delete u.fails; delete u.lockUntil; await saveUser(u);
        return res.status(200).json({ token: await sessionFor(u), user: pub(u) });
      }
      case 'logoutAll': {               // cierra la sesión en todos los dispositivos y deja este dentro
        const u = await auth(req); if (!u) throw bad('Inicia sesión', 401);
        u.sv = (u.sv || 0) + 1; await saveUser(u);
        return res.status(200).json({ token: await sessionFor(u), user: pub(u) });
      }
      case 'password': {
        const u = await auth(req); if (!u) throw bad('Inicia sesión', 401);
        if (!checkPw(u, b.current)) throw bad('La contraseña actual no es correcta', 401);
        if (!okPw(b.password)) throw bad(PW_MSG);
        Object.assign(u, hashPw(b.password)); await saveUser(u);
        return res.status(200).json({ token: await sessionFor(u), user: pub(u) });
      }
      case 'profile': {
        const u = await auth(req); if (!u) throw bad('Inicia sesión', 401);
        const name = String(b.name || '').trim().slice(0, 40);
        if (name) u.name = name;
        await saveUser(u);
        return res.status(200).json({ user: pub(u) });
      }
    }
    throw bad('Acción no válida');
  } catch (e) { fail(res, e); }
}
