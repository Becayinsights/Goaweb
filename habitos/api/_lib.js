// Utilidades comunes de la API. Vercel no publica como función lo que empieza por "_".
import { get, put, del } from '@vercel/blob';

export const hasStore = () => !!process.env.BLOB_READ_WRITE_TOKEN;

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

// Usuario a partir del código que manda el móvil en la cabecera x-code.
export async function auth(req) {
  const code = String(req.headers['x-code'] || '').toUpperCase().trim();
  if (!code) return null;
  if (!hasStore()) return null;
  const u = (await users()).find(x => x.code === code);
  return u ? { ...u, admin: !!u.admin } : null;
}

export function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const b = crypto.getRandomValues(new Uint8Array(8));
  const s = [...b].map(x => A[x % A.length]).join('');
  return s.slice(0, 4) + '-' + s.slice(4);
}

// Llama a Claude. La clave del servidor solo la usan usuarios con cuenta;
// sin cuenta hace falta una clave propia en la cabecera.
export async function claude(req, user, content, maxTokens = 600) {
  const key = (user && process.env.ANTHROPIC_API_KEY) || req.headers['x-anthropic-key'];
  if (!key) {
    const e = new Error(process.env.ANTHROPIC_API_KEY ? 'Necesitas una cuenta para usar la IA' : 'Falta la API key de Anthropic (Cuenta → IA)');
    e.status = 401; throw e;
  }
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-5-5', max_tokens: maxTokens, messages: [{ role: 'user', content }] }),
  });
  const j = await r.json();
  if (!r.ok) { const e = new Error(j.error?.message || 'Error de la IA'); e.status = r.status; throw e; }
  const txt = j.content.map(c => c.text || '').join('');
  return JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
}

export const fail = (res, e) => res.status(e.status || 500).json({ error: e.status ? e.message : 'Algo ha fallado, prueba otra vez' });
