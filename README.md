# GOΛ Medical Aesthetics — web

Web pública del Dr. Bengoa: medicina estética, medicina capilar y cirugía capilar.
Proyecto independiente. **No comparte código, datos ni despliegue con Becay Rentabilidad.**

## Estado

| Fase | Estado |
|---|---|
| Diseño (home + sistema visual) | v1 publicada para revisión |
| Contenido real (fotos, testimonios, datos de contacto) | pendiente del cliente |
| Implementación Next.js | no empezada |
| Área privada (fichas médicas, usuarios) | fuera de alcance en esta fase |

## Maquetas v1

- Home: https://claude.ai/code/artifact/c712173e-2492-44ea-a81a-39d80f49a903
- Sistema visual: https://claude.ai/code/artifact/6a9c460d-0b21-4a93-88a0-55312eacb5a3

Los dos ficheros fuente están en `design/`. Se abren en cualquier navegador sin build.

## Decisiones tomadas

**Stack previsto**: Next.js (App Router) + React, JavaScript, CSS con variables — sin framework de
estilos. El sistema visual está escrito ya como CSS de producción, así que la maqueta se porta
sin reescribir. Despliegue en Vercel.

**Identidad**: papel crema, tinta gris azulada y bronce, los tres tomados del logo.
Tipografía Jost (geométrica del logo) para titulares y navegación, Newsreader para texto corrido,
IBM Plex Mono para metadatos clínicos. El logo GOΛ se ha redibujado en SVG (`design/`) para que
escale limpio en cabecera, favicon y Open Graph.

**Contenido**: todo el copy sale del esquema del cliente. Donde no hay material real —fotografía
clínica, testimonios, teléfono— hay un hueco tramado y etiquetado, nunca contenido inventado.

## Estructura de la web

```
/                         Inicio
/sobre-mi                 Sobre mí
/medicina-estetica        Área + 6 tratamientos
/medicina-capilar         Área + 4 tratamientos
/cirugia-capilar          Área + 5 tratamientos
/antes-y-despues          Galería con filtros
/opiniones                Testimonios
/faq                      Preguntas frecuentes
/contacto                 Reserva de cita
/aviso-legal /privacidad /cookies
```

15 fichas de tratamiento, todas con la misma plantilla: qué es · para quién está indicado ·
cómo se realiza · beneficios · duración y recuperación · resultados · FAQ · CTA.

## SEO y búsqueda agéntica

Ver `docs/seo.md`.

## Pendiente del cliente

- Fotografía clínica de antes y después, con consentimiento firmado por paciente
- Retrato del doctor y fotos de consulta
- Testimonios reales (texto o vídeo) con autorización
- Teléfono, WhatsApp, dirección y sistema de reserva de cita
- Número de registro sanitario del centro (obligatorio en publicidad sanitaria)
- Dominio definitivo
