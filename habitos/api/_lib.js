// Utilidades comunes de la API. Vercel no publica como función lo que empieza por "_".
import { get, put, del, list } from '@vercel/blob';
import { scryptSync, randomBytes, createHmac, timingSafeEqual, createHash } from 'node:crypto';

// Vercel conecta el Blob con un token clásico o, en proyectos nuevos, por OIDC (BLOB_STORE_ID + token de la ejecución)
export const hasStore = () => !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

// Solo «no existe» devuelve el valor por defecto. Un fallo de red o del almacenamiento se propaga:
// si no, un corte puntual se tomaría por «no hay usuarios / no hay secreto» y se sobrescribirían.
export async function readJSON(path, fallback) {
  if (!hasStore()) return fallback;
  const r = await get(path, { access: 'private', useCache: false });
  if (!r) return fallback;
  if (r.statusCode !== 200) throw new Error(`Lectura de ${path}: ${r.statusCode}`);
  return JSON.parse(await new Response(r.stream).text());
}
export const writeJSON = (path, obj) =>
  put(path, JSON.stringify(obj), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
export const removeBlob = path => del(path);

// Cada cuenta y cada invitación va en su propio archivo: así dos cambios a la vez (dos invitaciones
// seguidas, dos personas registrándose) no se pisan, como pasaba con una sola lista.
//   users/{id}.json · emails/{hash del email}.json → {id} · invites/{token}.json
const safe = x => /^[\w-]{4,64}$/.test(String(x || ''));
const emailKey = e => createHash('sha256').update(normEmail(e)).digest('hex').slice(0, 32);
async function readAll(prefix) {
  if (!hasStore()) return [];
  const out = []; let cursor;
  do {
    const r = await list({ prefix, cursor, limit: 1000 });
    out.push(...await Promise.all(r.blobs.map(b => readJSON(b.pathname, null))));
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return out.filter(Boolean);
}
// las versiones anteriores lo guardaban todo en users.json / invites.json: se reparte una vez
let migrated = false;
async function migrate() {
  if (migrated || !hasStore()) return;
  const oldUsers = await readJSON('users.json', null), oldInv = await readJSON('invites.json', null);
  for (const u of oldUsers || []) await saveUser(u);
  for (const i of oldInv || []) await saveInvite(i);
  if (oldUsers) await del('users.json');
  if (oldInv) await del('invites.json');
  migrated = true;
}
export async function users() { await migrate(); return (await readAll('users/')).sort((a, b) => String(a.created).localeCompare(String(b.created))); }
export async function hasUsers() { await migrate(); return hasStore() && (await list({ prefix: 'users/', limit: 1 })).blobs.length > 0; }
export async function getUser(id) { await migrate(); return safe(id) ? readJSON(`users/${id}.json`, null) : null; }
export async function userByEmail(email) {
  await migrate();
  const m = await readJSON(`emails/${emailKey(email)}.json`, null);
  return m ? getUser(m.id) : null;
}
export async function saveUser(u) {
  await writeJSON(`users/${u.id}.json`, u);
  await writeJSON(`emails/${emailKey(u.email)}.json`, { id: u.id });
}
export async function deleteUser(u) {
  await del([`users/${u.id}.json`, `emails/${emailKey(u.email)}.json`]);
}
export async function invites() { await migrate(); return (await readAll('invites/')).sort((a, b) => String(a.created).localeCompare(String(b.created))); }
// las invitaciones caducan a los 14 días: un enlace olvidado en un chat no sirve para siempre
export const INVITE_DAYS = 14;
export const inviteExpired = inv => !!inv.created && Date.now() - Date.parse(inv.created) > INVITE_DAYS * 864e5;
export async function getInvite(token) {
  await migrate();
  const inv = safe(token) ? await readJSON(`invites/${token}.json`, null) : null;
  return inv && !inviteExpired(inv) ? inv : null;
}
export const saveInvite = inv => writeJSON(`invites/${inv.token}.json`, inv);
export const deleteInvite = token => safe(token) ? del(`invites/${token}.json`) : null;

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
// v cambia al cambiar la contraseña o al «cerrar sesión en todos los dispositivos» (sv): invalida sesiones y enlaces antiguos.
// Sin sv queda igual que antes, así nadie pierde la sesión al publicar esto.
const ver = u => u.hash.slice(0, 8) + (u.sv ? '.' + u.sv : '');
export const sessionFor = u => sign({ u: u.id, v: ver(u), t: 's', x: Date.now() + 180 * 864e5 });
export const resetFor = u => sign({ u: u.id, v: ver(u), t: 'r', x: Date.now() + 48 * 36e5 });
// clave para el atajo de pasos: solo sirve para apuntar los pasos de esa persona (1 año)
export const stepsKeyFor = u => sign({ u: u.id, v: ver(u), t: 'k', x: Date.now() + 365 * 864e5 });
export async function fromToken(token, type) {
  const p = await verify(token);
  if (!p || p.t !== type) return null;
  const u = await getUser(p.u);
  return u && !u.disabled && ver(u) === p.v ? u : null;
}
export async function auth(req) {
  if (!hasStore()) return null;
  const h = String(req.headers.authorization || '');
  return h.startsWith('Bearer ') ? fromToken(h.slice(7), 's') : null;
}
export const pub = u => ({ id: u.id, name: u.name, email: u.email, admin: !!u.admin });
// fecha de la última escritura de cada archivo de datos = última vez que esa persona usó la app.
// Un solo list() en vez de leer el archivo de cada persona.
export async function lastSeen() {
  const out = {}; if (!hasStore()) return out; let cursor;
  do {
    const r = await list({ prefix: 'data/', cursor, limit: 1000 });
    for (const b of r.blobs) out[b.pathname.slice(5, -5)] = new Date(b.uploadedAt).getTime();
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return out;
}
export const newId = () => randomBytes(9).toString('base64url');

// IA de la app. Usa Gemini (GEMINI_API_KEY, plan gratuito) o Claude (ANTHROPIC_API_KEY);
// si están las dos, prueba Claude y cae a Gemini si falla. `content` va en formato de Claude
// ([{type:'image'|'audio',source:{media_type,data}}, {type:'text',text}]) y se traduce para Gemini.
const unavailable = () => Object.assign(new Error('La IA no está disponible ahora mismo'), { status: 503 });
const parseJSON = txt => JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));

async function viaClaude(key, content, maxTokens) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-5-5', max_tokens: maxTokens, messages: [{ role: 'user', content }] }),
  });
  if (!r.ok) throw unavailable();
  return parseJSON((await r.json()).content.map(c => c.text || '').join(''));
}

// Google renombra los modelos a menudo: se prueba en orden hasta que uno responda, y se recuerda
// el último que funcionó para ir directo a él (un modelo saturado tarda varios segundos en decir que no).
const GEMINI_MODELS = ['gemini-3-flash-preview', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-flash-lite-latest'];
let lastGood = null;
// razonamiento mínimo: para estimar macros o separar tareas no hace falta y es lo que más tarda
const thinking = m => /gemini-3/.test(m) ? { thinkingLevel: 'low' } : /2\.5-flash/.test(m) ? { thinkingBudget: 0 } : null;
async function geminiCall(key, model, parts, maxTokens, think) {
  const generationConfig = { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: Math.max(maxTokens * 8, 8192) };
  if (think) generationConfig.thinkingConfig = think;
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig }),
    signal: AbortSignal.timeout(15000),
  });
}
async function viaGemini(key, content, maxTokens) {
  const parts = content.map(c => c.type === 'image' || c.type === 'audio'
    ? { inline_data: { mime_type: c.source.media_type, data: c.source.data } }
    : { text: c.text });
  const models = [...new Set([process.env.GEMINI_MODEL, lastGood, ...GEMINI_MODELS].filter(Boolean))];
  let last = '';
  for (const model of models) {
    const t0 = Date.now();
    let r;
    try {
      r = await geminiCall(key, model, parts, maxTokens, thinking(model));
      // si el modelo no acepta el ajuste de razonamiento, se repite sin él
      if (r.status === 400 && thinking(model)) r = await geminiCall(key, model, parts, maxTokens, null);
    } catch (e) { console.error(`gemini ${model} sin respuesta (${e.name}) ${Date.now() - t0}ms`); last = 'tiempo'; continue; }
    if (!r.ok) {
      // se registra el motivo (nunca la clave) y se prueba el siguiente modelo
      const msg = (await r.text().catch(() => '')).slice(0, 200).replace(/\s+/g, ' ');
      console.error(`gemini ${model} ${r.status} ${Date.now() - t0}ms ${msg}`);
      if (lastGood === model) lastGood = null;
      last = String(r.status);
      continue;
    }
    const j = await r.json();
    const cand = j.candidates?.[0];
    const txt = (cand?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('');
    if (txt) {
      try { const out = parseJSON(txt); lastGood = model; console.log(`gemini ok ${model} ${Date.now() - t0}ms`); return out; }
      catch { console.error(`gemini ${model} JSON roto: ${txt.slice(0, 200)}`); last = 'json'; continue; }
    }
    console.error(`gemini ${model} sin texto: ${cand?.finishReason || j.promptFeedback?.blockReason || 'desconocido'}`);
    last = cand?.finishReason || 'vacío';
  }
  throw Object.assign(new Error(`La IA no está disponible ahora mismo (${last || 'sin modelos'})`), { status: 503 });
}

export async function claude(user, content, maxTokens = 600) {
  if (!user) throw Object.assign(new Error('Inicia sesión'), { status: 401 });
  const anthropic = process.env.ANTHROPIC_API_KEY, gemini = process.env.GEMINI_API_KEY;
  // Claude no escucha audio: las notas de voz van directas a Gemini
  const hasAudio = content.some(c => c.type === 'audio');
  if (anthropic && !(hasAudio && gemini)) {
    try { return await viaClaude(anthropic, content, maxTokens); }
    catch (e) { if (!gemini) throw e; }
  }
  if (gemini) return viaGemini(gemini, content, maxTokens);
  throw unavailable();
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
