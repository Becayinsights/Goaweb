// Estima macros de una foto de comida con Claude (visión).
import { auth, claude, fail } from './_lib.js';
export const config = { maxDuration: 60 };

const PROMPT = `Eres nutricionista. Mira la foto del plato, identifica los alimentos y estima la ración visible.
Responde SOLO con JSON, sin texto alrededor:
{"name":"nombre corto del plato en español","kcal":0,"protein":0,"carbs":0,"fat":0,"note":"ración estimada en una frase"}
Valores numéricos en kcal y gramos para la ración completa. Si no es comida: {"error":"No veo comida en la foto"}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST' });
  const m = /^data:(image\/\w+);base64,(.+)$/.exec(req.body?.image || '');
  if (!m) return res.status(400).json({ error: 'Imagen no válida' });
  try {
    const out = await claude(req, await auth(req), [
      { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } },
      { type: 'text', text: PROMPT },
    ], 400);
    if (out.error) return res.status(422).json(out);
    for (const k of ['kcal', 'protein', 'carbs', 'fat']) out[k] = Number(out[k]) || 0;
    res.status(200).json(out);
  } catch (e) { fail(res, e); }
}
