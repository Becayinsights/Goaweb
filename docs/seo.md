# SEO y búsqueda agéntica

Dos públicos distintos leen esta web: personas que buscan en Google y modelos que responden por
ellas (ChatGPT, Perplexity, la vista de IA de Google, Claude). Lo que necesita el segundo no
sustituye al primero, pero casi todo se resuelve con las mismas piezas.

## 1. Base técnica

- **Renderizado en servidor** de todas las páginas públicas. Un modelo que rastrea sin ejecutar
  JavaScript tiene que ver el texto completo en el HTML.
- **Una URL por intención**: cada tratamiento su página. Nada de acordeones que esconden el
  contenido de quince tratamientos dentro de una sola URL.
- `sitemap.xml` y `robots.txt` generados por la propia app.
- Metadatos por página: `title` de 55-60 caracteres, `description` de 150-160, canónica,
  Open Graph y Twitter Card con imagen propia.
- `hreflang` solo si algún día hay versión en otro idioma. De momento, `es-ES`.
- Core Web Vitals: fuentes con `display=swap` y `preconnect`, imágenes en AVIF/WebP con tamaño
  declarado, cero layout shift. La maqueta ya evita animaciones que empujen contenido.

## 2. Datos estructurados (JSON-LD)

Lo que de verdad separa una web médica bien indexada de una normal.

| Página | Esquema |
|---|---|
| Home | `MedicalBusiness` + `Physician` (nombre, especialidad, dirección, teléfono, horario, `areaServed`) |
| Sobre mí | `Physician` con `alumniOf`, `worksFor`, `medicalSpecialty` |
| Área (estética / capilar / cirugía) | `MedicalSpecialty` + `BreadcrumbList` |
| Ficha de tratamiento | `MedicalProcedure` (`procedureType`, `preparation`, `followup`, `howPerformed`, `bodyLocation`) |
| FAQ (general y de cada ficha) | `FAQPage` con las preguntas reales |
| Testimonios | `Review` **solo** cuando sean reales y con consentimiento. Nunca `aggregateRating` inventado |
| Antes y después | `ImageObject` con `caption` y `contentUrl` |

`MedicalProcedure` es el esquema que hace que un modelo pueda responder «qué es un injerto FUE y
para quién está indicado» citando esta web en vez de una clínica cualquiera.

## 3. Cómo se escribe para que un modelo te cite

- **La respuesta va primero.** Cada ficha abre con una definición de dos frases que se sostiene
  fuera de contexto. Un modelo cita párrafos completos, no páginas.
- **Preguntas literales como encabezados**: «¿Para quién está indicado?», «¿Cuánto dura la
  recuperación?». Coinciden con cómo se pregunta en voz alta y en un chat.
- **Datos concretos**: número de sesiones, tiempo de recuperación, cuándo se ve el resultado.
  Un texto sin cifras no se puede citar.
- **Autoría visible**: firma médica, formación y fecha de última revisión en cada ficha clínica.
  Es lo que Google llama E-E-A-T y lo que un modelo usa para decidir si la fuente es fiable.
- **Sin promesas de resultado.** Además de ser exigencia legal en publicidad sanitaria, el
  lenguaje prudente es el que se cita bien.

## 4. Ficheros para agentes

- `llms.txt` en la raíz: índice en texto plano de las páginas y de qué responde cada una.
- `robots.txt` permitiendo explícitamente a los rastreadores de IA que interesen
  (`GPTBot`, `PerplexityBot`, `ClaudeBot`, `Google-Extended`) — es una decisión del cliente:
  bloquearlos protege el contenido pero te saca de las respuestas donde hoy están tus pacientes.
- Feed JSON de tratamientos (`/api/tratamientos`) para reutilizar en el futuro panel privado.

## 5. Local

Un médico se busca por ciudad. Hace falta:

- Ficha de Google Business Profile con las mismas NAP (nombre, dirección, teléfono) que la web,
  carácter por carácter.
- `LocalBusiness` en JSON-LD coherente con esa ficha.
- Página de contacto con dirección en texto, no solo dentro de un mapa embebido.

## 6. Cumplimiento (afecta al contenido, no es opcional)

- Número de registro sanitario del centro visible.
- Aviso de variabilidad de resultados junto a toda galería de antes y después.
- Consentimiento firmado para cada imagen y cada testimonio publicados.
- Aviso legal, política de privacidad y de cookies; formulario con base legal y finalidad
  declaradas (RGPD), y los datos de salud tratados como categoría especial.
