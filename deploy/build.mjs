/* Puente de despliegue mientras el repositorio no está en GitHub.

   La herramienta de despliegue de Vercel solo admite el árbol en línea y no
   caben los tres ficheros en una sola llamada, así que cada despliegue envía
   los que cambian y este script recupera el resto del sitio ya publicado.
   Se retira en cuanto Vercel despliegue por git desde Becayinsights/goa-web. */
import { mkdir, writeFile, copyFile, access } from 'node:fs/promises';

const VIVO = 'https://goa-maqueta-becay.vercel.app';
const PAGINAS = ['index.html', 'tratamiento.html', 'goa.css'];

await mkdir('public', { recursive: true });

for (const nombre of PAGINAS) {
  try {
    await access(nombre);
    await copyFile(nombre, `public/${nombre}`);
    console.log(`local  ${nombre}`);
    continue;
  } catch { /* no viaja en este árbol: se recupera del sitio vivo */ }

  const r = await fetch(`${VIVO}/${nombre}`);
  if (!r.ok) { console.log(`falta  ${nombre} (${r.status})`); continue; }
  await writeFile(`public/${nombre}`, await r.text());
  console.log(`vivo   ${nombre}`);
}
