// Estima macros de una foto de comida (visión) o solo de lo que la persona escribe.
import { auth, claude, fail } from './_lib.js';
export const config = { maxDuration: 60 };

const PROMPT = `Eres nutricionista. Mira la foto del plato, identifica los alimentos y estima la ración visible.
Responde SOLO con JSON, sin texto alrededor:
{"name":"nombre corto del plato en español","kcal":0,"protein":0,"carbs":0,"fat":0,"note":"ración estimada en una frase"}
Valores numéricos en kcal y gramos para la ración completa. Si no es comida: {"error":"No veo comida en la foto"}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST' });
  const m = /^data:(image\/\w+);base64,(.+)$/.exec(req.body?.image || '');
  const note = String(req.body?.note || '').trim().slice(0, 300);
  if (!m && !note) return res.status(400).json({ error: 'Haz una foto o escribe qué has comido' });
  try {
    // sin foto: solo lo escrito; si no dice cantidades, una ración normal en España
    if (!m) {
      const out = await claude(await auth(req), [{ type: 'text', text: `Eres nutricionista. La persona ha comido: «${note}».
Estima las calorías y macros. Si no da cantidades, asume una ración normal en España y dilo en "note".
Responde SOLO con JSON: {"name":"nombre corto en español","kcal":0,"protein":0,"carbs":0,"fat":0,"note":"ración estimada en una frase"}
Valores en kcal y gramos para todo lo que ha comido. Si no es comida: {"error":"Eso no parece comida"}` }], 400);
      if (out.error) return res.status(422).json(out);
      for (const k of ['kcal', 'protein', 'carbs', 'fat']) out[k] = Number(out[k]) || 0;
      return res.status(200).json(out);
    }
    // la nota del usuario («3 huevos, 150 g de arroz») manda sobre lo que se intuye en la foto
    const text = note
      ? `${PROMPT}\n\nLa persona añade: «${note}». Trátalo como dato fiable: úsalo para identificar los alimentos y fijar cantidades, y estima con la foto solo lo que no diga.`
      : PROMPT;
    const out = await claude(await auth(req), [
      { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } },
      { type: 'text', text },
    ], 400);
    if (out.error) return res.status(422).json(out);
    for (const k of ['kcal', 'protein', 'carbs', 'fat']) out[k] = Number(out[k]) || 0;
    res.status(200).json(out);
  } catch (e) { fail(res, e); }
}
