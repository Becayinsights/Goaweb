// Convierte una nota de voz (ya transcrita) en hábitos y tareas.
import { auth, claude, fail } from './_lib.js';
export const config = { maxDuration: 60 };

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST' });
  const text = String(req.body?.text || '').slice(0, 4000).trim();
  const today = /^\d{4}-\d{2}-\d{2}$/.test(req.body?.today) ? req.body.today : new Date().toISOString().slice(0, 10);
  if (!text) return res.status(400).json({ error: 'No he oído nada' });
  const wd = DIAS[new Date(today + 'T12:00:00Z').getUTCDay()];

  const prompt = `Hoy es ${wd} ${today}. Una persona ha dictado lo que quiere hacer. Sepáralo en elementos:
- "habit": algo que se repite (todos los días, ciertos días de la semana) o una rutina de salud/deporte/bienestar para un día concreto.
- "task": algo puntual que se hace una vez y se tacha (recados, llamadas, compras, trabajo).
Campos:
- title: corto, en español, empezando por mayúscula, con cantidades si las dijo ("5 km andando", "Llamar al dentista").
- days: para hábitos repetidos, días de la semana como números (0=domingo … 6=sábado). null si es todos los días.
- dates: lista de fechas YYYY-MM-DD si el hábito es solo para días concretos; si no, null.
- date: para tareas, fecha YYYY-MM-DD si dijo cuándo ("mañana", "el viernes" = el próximo viernes); null si no.
Si dice "hoy" para un hábito puntual, usa dates:["${today}"].
Responde SOLO con JSON: {"items":[{"kind":"habit","title":"","days":null,"dates":null},{"kind":"task","title":"","date":null}]}

Dictado: """${text}"""`;
  try {
    const out = await claude(req, await auth(req), [{ type: 'text', text: prompt }], 800);
    const ok = d => /^\d{4}-\d{2}-\d{2}$/.test(d);
    const items = (out.items || []).filter(i => i && i.title).slice(0, 30).map(i => i.kind === 'task'
      ? { kind: 'task', title: String(i.title).slice(0, 120), date: ok(i.date) ? i.date : null }
      : { kind: 'habit', title: String(i.title).slice(0, 120),
          days: Array.isArray(i.days) && i.days.length && i.days.length < 7 ? [...new Set(i.days.map(Number).filter(n => n >= 0 && n <= 6))] : null,
          dates: Array.isArray(i.dates) && i.dates.filter(ok).length ? i.dates.filter(ok) : null });
    res.status(200).json({ items });
  } catch (e) { fail(res, e); }
}
