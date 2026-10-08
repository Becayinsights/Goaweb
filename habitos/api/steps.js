// Pasos del día desde la app Salud, a través del atajo «Habitos pasos» (una web no puede leer Salud).
// GET ?k=clave&n=6240&tz=Europe/Madrid  → lo llama el atajo: guarda los pasos de hoy
// GET (con sesión)                      → { days: { 'YYYY-MM-DD': pasos }, at }
// GET ?key=1 (con sesión)               → { key } para montar el enlace que se le pasa al atajo
import { auth, fromToken, stepsKeyFor, readJSON, writeJSON, fail, bad } from './_lib.js';

const validTz = tz => { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; } };
const localDay = tz => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
// «6.240», «6240,5», «6240 pasos» → 6240
// Lo que llega del atajo puede ser «58», «6.240», «58 recuento», «6240,5» o una lista de valores
// (uno por línea si no se agrupó por día): se leen todos los números y se suman. Vacío = 0.
function toSteps(v) {
  const nums = String(v ?? '').match(/\d+(?:[.,]\d+)*/g) || [];
  const total = nums.reduce((sum, t) => {
    // 6.240 / 12,345 → miles; 6240,5 / 58.0 → decimales
    const n = /^\d{1,3}(?:[.,]\d{3})+$/.test(t) ? +t.replace(/[.,]/g, '') : parseFloat(t.replace(',', '.'));
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
  return Math.min(Math.round(total), 200000);
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET' });
    const q = req.query || {};
    if (q.k) {
      const u = await fromToken(String(q.k), 'k');
      if (!u) throw bad('Clave no válida: vuelve a conectar los pasos desde la app', 401);
      const n = toSteps(q.n);
      // diagnóstico: el enlace tal cual llega (sin la clave)
      console.log(`pasos ${u.id}: recibido «${String(q.n ?? '').slice(0, 80)}» → ${n} · url ${String(req.url).replace(/k=[^&]+/, 'k=…').slice(0, 300)}`);
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
