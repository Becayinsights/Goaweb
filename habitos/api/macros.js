// Estima macros de una foto de comida con Claude (visión).
// Clave: variable de entorno ANTHROPIC_API_KEY o cabecera x-anthropic-key.
export const config = { maxDuration: 60 };

const PROMPT = `Eres nutricionista. Mira la foto del plato, identifica los alimentos y estima la ración visible.
Responde SOLO con JSON, sin texto alrededor:
{"name":"nombre corto del plato en español","kcal":0,"protein":0,"carbs":0,"fat":0,"note":"ración estimada en una frase"}
Valores numéricos en kcal y gramos para la ración completa. Si no es comida: {"error":"No veo comida en la foto"}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST' });
  const key = process.env.ANTHROPIC_API_KEY || req.headers['x-anthropic-key'];
  if (!key) return res.status(401).json({ error: 'Falta la API key (pégala abajo)' });

  const m = /^data:(image\/\w+);base64,(.+)$/.exec(req.body?.image || '');
  if (!m) return res.status(400).json({ error: 'Imagen no válida' });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-5-5',
        max_tokens: 400,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } },
          { type: 'text', text: PROMPT },
        ] }],
      }),
    });
    const j = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: j.error?.message || 'Error de la API' });
    const txt = j.content.map(c => c.text || '').join('');
    const out = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
    if (out.error) return res.status(422).json(out);
    for (const k of ['kcal', 'protein', 'carbs', 'fat']) out[k] = Number(out[k]) || 0;
    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({ error: 'No se pudo analizar la foto' });
  }
}
