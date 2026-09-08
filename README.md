# GOΛ Medical Aesthetics — web

Web pública del Dr. Bengoa: medicina estética, medicina capilar y cirugía capilar.
Proyecto independiente. **No comparte código, datos ni despliegue con Becay Rentabilidad.**

## Estado

| Fase | Estado |
|---|---|
| Diseño (home + fichas) | v19 publicada para revisión |
| Contenido real (fotos, testimonios, datos de contacto) | pendiente del cliente |
| Implementación Next.js | no empezada |
| Área privada (fichas médicas, usuarios) | fuera de alcance en esta fase |

## Sistema visual

**Paleta v4, un solo tema.** El claro. El hueso mineral es la marca y en
oscuro la web parecía otra; mantener los dos obligaba además a validar dos
veces cada foto, cada velo y cada sombra, y de ahí salieron la mitad de los
saltos visuales que fuimos corrigiendo. El verde va hondo: en piezas pequeñas
—filetes, chips, el estado activo— uno claro se lee como decoración y uno
oscuro se lee como marca. Ningún color literal fuera del bloque de tokens al
principio de `design/goa-home.html`.

**Dos escalas tipográficas y ninguna medida suelta.** La de texto tiene seis
escalones (`--fs-1` a `--fs-6`) y la de la serif, que hace de display, dos
(`--fs-d3`, `--fs-d4`) más los `clamp()` de h1 y h2. Antes había veintidós
cuerpos distintos puestos a ojo y el conjunto bailaba. La única excepción es
la marca, que conserva su propio tamaño.

## Maqueta alojada (la que se envía al cliente)

**https://goa-bengoa.vercel.app** — Vercel, equipo BECAY, proyecto `goa-bengoa`,
conectado a este repositorio: cada push a `main` publica `site/`. Sin protección SSO,
para que se pueda abrir sin cuenta.

El enlace anterior, `goa-maqueta-becay.vercel.app`, sigue vivo como redirección 307
que conserva la ruta: lo que ya se compartió no se queda muerto. Ver `deploy/README.md`.

`site/` lo genera `build.py`: la home desde `design/goa-home.html`, las trece fichas
desde `content/tratamientos.json`, y las dos reglas que antes ponía el envoltorio del
visor de artifacts —`img{max-width:100%}` y `[hidden]{display:none!important}`; sin la
segunda, `.case{display:flex}` gana al atributo `hidden` y los filtros de la galería no
ocultan nada.

Lleva `noindex, nofollow`: es una maqueta, no debe indexarse como la web del doctor.

Para actualizarla:

    python3 build.py
    git add -A && git commit && git push

## Maquetas en artifact (histórico de revisiones)

- Home, enlace de trabajo (se actualiza en cada versión): https://claude.ai/code/artifact/c712173e-2492-44ea-a81a-39d80f49a903
- Home v11, enlace limpio para enviar al cliente: https://claude.ai/code/artifact/3630d750-ac82-4f8f-b228-accdf8dcfb5a
  (enviadas antes: v9 `4b7968b8`, v10 `ea07fafa` — ambas con el fallo de pintado en iOS)

WhatsApp y las redes cachean la vista previa por URL: para enviar una versión nueva a alguien que
ya recibió el enlace, se publica una copia con otro nombre de fichero (`design/goa-home-vN.html`),
que genera una URL nueva. El enlace de trabajo se sigue actualizando en el mismo sitio.
- Sistema visual (v1, pendiente de actualizar a la paleta v2): https://claude.ai/code/artifact/6a9c460d-0b21-4a93-88a0-55312eacb5a3

Los dos ficheros fuente están en `design/`. Se abren en cualquier navegador sin build.

## Decisiones tomadas

**Stack previsto**: Next.js (App Router) + React, JavaScript, CSS con variables — sin framework de
estilos. El sistema visual está escrito ya como CSS de producción, así que la maqueta se porta
sin reescribir. Despliegue en Vercel.

**Identidad (v2)**: hueso mineral `#EFEEE8`, negro petróleo `#12201F` y verde quirófano `#1F5A4E`.
Se descarta el crema con dorado del logo original: es el uniforme de casi toda la medicina estética
y escora a femenino cuando media consulta es cirugía capilar masculina.
Tipografía Instrument Serif para titulares, Instrument Sans para texto y UI, IBM Plex Mono para
metadatos clínicos.

**Marca (propuesta)**: dos piezas y un solo dibujo, ambas en SVG (`<symbol>` reutilizado).
- **Isologo** — la A dentro del círculo. Avatar, favicon, sello, bordado. Única pieza con círculo.
- **Logo** — solo el nombre, `GOΛ`, sin círculo, con esa misma A como tercera letra.
La A tiene asta fina y asta gruesa cortadas en horizontal, como la de una serif de alto contraste,
para que junto a la G y la O se lea como letra y no como icono pegado.
El logo original (texto muy fino y muy espaciado) se descarta porque se rompe en favicon y avatar.

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
- Decisión sobre la marca: se aprueba el símbolo nuevo o se mantiene el logo actual

## Notas para la implementación

- La barra fija de contacto del móvil se retiró de la maqueta: dentro del iframe del
  visor de artifacts en iOS flotaba sobre el contenido. En el sitio propio, con dominio
  y sin iframe, se puede recuperar.
- El tema se estampa antes de la primera pintura y arranca en claro salvo que el
  visitante haya elegido oscuro. Así la web se ve igual la abra quien la abra.
- Nada de `100vw` para bloques a sangre: la sección va a ancho completo con su
  contenedor dentro. `100vw` obliga a recortar el eje horizontal y eso rompe el
  `position:sticky` de la cabecera.
- Nada de `overflow-x:clip` en `html` ni en `body`: no hace falta (comprobado a
  360, 390, 430, 768 y 1280) y rompe el sticky en iOS.
- `backdrop-filter` solo por encima de 980px. En móvil, la cabecera lleva fondo
  opaco: el difuminado de fondo sobre un documento de ~13.000px hace que iOS
  Safari deje de pintar a partir de cierto punto y el resto salga en blanco.
- Sin `mask-image`: mismo motivo, es otra capa compuesta cara dentro de un iframe.
- El progreso de lectura se actualiza una vez por fotograma (`requestAnimationFrame`),
  no en cada evento de scroll.
