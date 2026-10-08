// Utilidades comunes de la API. Vercel no publica como función lo que empieza por "_".
import { get, put, del } from '@vercel/blob';
import { scryptSync, randomBytes, createHmac, timingSafeEqual } from 'node:crypto';

// Vercel conecta el Blob con un token clásico o, en proyectos nuevos, por OIDC (BLOB_STORE_ID + token de la ejecución)
export const hasStore = () => !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

export async function readJSON(path, fallback) {
  if (!hasStore()) return fallback;
  try {
    const r = await get(path, { access: 'private', useCache: false });
    if (r?.statusCode !== 200) return fallback;
    return JSON.parse(await new Response(r.stream).text());
  } catch { return fallback; }
}
export const writeJSON = (path, obj) =>
  put(path, JSON.stringify(obj), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
export const removeBlob = path => del(path);

export const users = () => readJSON('users.json', []);
export const saveUsers = list => writeJSON('users.json', list);
export const invites = () => readJSON('invites.json', []);
export const saveInvites = list => writeJSON('invites.json', list);

// Secreto para firmar sesiones: se crea solo la primera vez y vive en el almacenamiento.
let secret;
async function getSecret() {
  if (secret) return secret;
  let s = await readJSON('secret.json', null);
  if (!s) { s = { k: randomBytes(32).toString('hex') }; await writeJSON('secret.json', s); }
  return (secret = s.k);
}
const b64 = s => Buffer.from(s).toString('base64url');
async function sign(payload) {
  const body = b64(JSON.stringify(payload));
  return body + '.' + createHmac('sha256', await getSecret()).update(body).digest('base64url');
}
async function verify(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const good = createHmac('sha256', await getSecret()).update(body).digest();
  const got = Buffer.from(sig, 'base64url');
  if (got.length !== good.length || !timingSafeEqual(got, good)) return null;
  const p = JSON.parse(Buffer.from(body, 'base64url').toString());
  return p.x > Date.now() ? p : null;
}

export const normEmail = e => String(e || '').trim().toLowerCase();
export function hashPw(pw) {
  const salt = randomBytes(16).toString('hex');
  return { salt, hash: scryptSync(String(pw), salt, 32).toString('hex') };
}
export const checkPw = (u, pw) => timingSafeEqual(Buffer.from(u.hash, 'hex'), scryptSync(String(pw), u.salt, 32));
// v cambia al cambiar la contraseña: invalida sesiones y enlaces de restablecimiento antiguos
const ver = u => u.hash.slice(0, 8);
export const sessionFor = u => sign({ u: u.id, v: ver(u), t: 's', x: Date.now() + 180 * 864e5 });
export const resetFor = u => sign({ u: u.id, v: ver(u), t: 'r', x: Date.now() + 48 * 36e5 });
export async function fromToken(token, type) {
  const p = await verify(token);
  if (!p || p.t !== type) return null;
  const u = (await users()).find(x => x.id === p.u);
  return u && ver(u) === p.v ? u : null;
}
export async function auth(req) {
  if (!hasStore()) return null;
  const h = String(req.headers.authorization || '');
  return h.startsWith('Bearer ') ? fromToken(h.slice(7), 's') : null;
}
export const pub = u => ({ id: u.id, name: u.name, email: u.email, admin: !!u.admin });
export const newId = () => randomBytes(9).toString('base64url');

export async function claude(user, content, maxTokens = 600) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!user || !key) { const e = new Error(user ? 'La IA no está disponible ahora mismo' : 'Inicia sesión'); e.status = user ? 503 : 401; throw e; }
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-5-5', max_tokens: maxTokens, messages: [{ role: 'user', content }] }),
  });
  const j = await r.json();
  if (!r.ok) { const e = new Error('La IA no está disponible ahora mismo'); e.status = 502; throw e; }
  const txt = j.content.map(c => c.text || '').join('');
  return JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
}

// Email opcional con Resend (RESEND_API_KEY y, si hay dominio propio, MAIL_FROM).
export async function sendMail(to, subject, html) {
  if (!process.env.RESEND_API_KEY) return false;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM || 'Hábitos <onboarding@resend.dev>', to, subject, html }),
  });
  return r.ok;
}

export const origin = req => `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
export const fail = (res, e) => res.status(e.status || 500).json({ error: e.status ? e.message : 'Algo ha fallado, prueba otra vez' });
export const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });
