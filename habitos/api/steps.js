// Pasos del día desde la app Salud, a través del atajo «Habitos pasos» (una web no puede leer Salud).
// GET ?k=clave&n=6240&tz=Europe/Madrid  → lo llama el atajo: guarda los pasos de hoy
// GET (con sesión)                      → { days: { 'YYYY-MM-DD': pasos }, at }
// GET ?key=1 (con sesión)               → { key } para montar el enlace que se le pasa al atajo
import { auth, fromToken, stepsKeyFor, readJSON, writeJSON, fail, bad } from './_lib.js';

const validTz = tz => { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; } };
const localDay = tz => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
// «6.240», «6240,5», «6240 pasos» → 6240
// sin pasos todavía hoy (p. ej. recién pasada la medianoche) la suma llega vacía: cuenta como 0
const toSteps = v => { const s = String(v ?? '').replace(/[.,]\d{1,2}(?!\d)/, '').replace(/\D/g, ''); return s ? Math.min(+s, 200000) : 0; };

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET' });
    const q = req.query || {};
    if (q.k) {
      const u = await fromToken(String(q.k), 'k');
      if (!u) throw bad('Clave no válida: vuelve a conectar los pasos desde la app', 401);
      const n = toSteps(q.n);
      console.log(`pasos ${u.id}: recibido «${String(q.n ?? '').slice(0, 40)}» → ${n}`);
      const day = localDay(validTz(q.tz) ? q.tz : 'Europe/Madrid');
      const cur = await readJSON(`steps/${u.id}.json`, { days: {} });
      const days = { ...cur.days, [day]: n };
      for (const d of Object.keys(days).sort().slice(0, -30)) delete days[d];   // últimos 30 días
      await writeJSON(`steps/${u.id}.json`, { days, at: Date.now() });
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      return res.status(200).send(`OK · ${n} pasos`);
    }
    const u = await auth(req);
    if (!u) throw bad('Inicia sesión', 401);
    if (q.key) return res.status(200).json({ key: await stepsKeyFor(u) });
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(await readJSON(`steps/${u.id}.json`, { days: {}, at: 0 }));
  } catch (e) { fail(res, e); }
}
