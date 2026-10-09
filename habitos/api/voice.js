// Convierte una nota de voz en hábitos y tareas. Llega el audio grabado (Gemini lo escucha,
// lo transcribe y lo organiza en un solo paso) y/o texto escrito a mano.
import { auth, claude, fail } from './_lib.js';
export const config = { maxDuration: 60 };

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST' });
  const text = String(req.body?.text || '').slice(0, 4000).trim();
  const a = /^data:(audio\/[\w.+-]+)(?:;[^,;]*)*;base64,([A-Za-z0-9+/=]+)$/.exec(req.body?.audio || '');
  const today = /^\d{4}-\d{2}-\d{2}$/.test(req.body?.today) ? req.body.today : new Date().toISOString().slice(0, 10);
  if (!text && !a) return res.status(400).json({ error: 'No he oído nada' });
  const wd = DIAS[new Date(today + 'T12:00:00Z').getUTCDay()];

  const source = a
    ? `Te paso una nota de voz en español${text ? ` y además ha escrito: """${text}"""` : ''}.
Primero transcribe el audio tal cual en "transcript" (sin inventar; si no se oye nada claro, "transcript":"" e "items":[]).`
    : `Ha escrito: """${text}"""`;
  const prompt = `Hoy es ${wd} ${today}. Una persona dice lo que quiere hacer. ${source}
Separa lo que dice en elementos:
- "habit": algo que se repite (todos los días, ciertos días de la semana) o una rutina de salud/deporte/bienestar para un día concreto.
- "task": algo puntual que se hace una vez y se tacha (recados, llamadas, compras, trabajo).
Campos:
- title: corto, en español, empezando por mayúscula, con cantidades si las dijo ("5 km andando", "Llamar al dentista").
- days: para hábitos repetidos, días de la semana como números (0=domingo … 6=sábado). null si es todos los días.
- dates: lista de fechas YYYY-MM-DD si el hábito es solo para días concretos; si no, null.
- date: para tareas, fecha YYYY-MM-DD si dijo cuándo ("mañana", "el viernes" = el próximo viernes); null si no.
Si dice "hoy" para un hábito puntual, usa dates:["${today}"].
Responde SOLO con JSON: {"transcript":"","items":[{"kind":"habit","title":"","days":null,"dates":null},{"kind":"task","title":"","date":null}]}`;
  try {
    const content = a
      ? [{ type: 'audio', source: { type: 'base64', media_type: a[1], data: a[2] } }, { type: 'text', text: prompt }]
      : [{ type: 'text', text: prompt }];
    const out = await claude(await auth(req), content, 1200);
    const ok = d => /^\d{4}-\d{2}-\d{2}$/.test(d);
    const items = (out.items || []).filter(i => i && i.title).slice(0, 30).map(i => i.kind === 'task'
      ? { kind: 'task', title: String(i.title).slice(0, 120), date: ok(i.date) ? i.date : null }
      : { kind: 'habit', title: String(i.title).slice(0, 120),
          days: Array.isArray(i.days) && i.days.length && i.days.length < 7 ? [...new Set(i.days.map(Number).filter(n => n >= 0 && n <= 6))] : null,
          dates: Array.isArray(i.dates) && i.dates.filter(ok).length ? i.dates.filter(ok) : null });
    res.status(200).json({ transcript: String(out.transcript || text).slice(0, 2000), items });
  } catch (e) { fail(res, e); }
}
