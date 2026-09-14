# Imágenes

Dos ficheros, reconocidos por el nombre. `build.py` los reduce y los prepara al
generar el sitio; no hace falta tocarlos antes de subirlos.

| Fichero | Dónde sale | Qué se hace con él |
|---|---|---|
| `cierre.*` (o cualquier imagen suelta) | Fondo del hero y de la banda de «¿Quieres valorar tu caso?» | Se reduce a 1400 px y se desenfoca al generar el sitio. Desenfocar por CSS obliga al navegador a recalcularlo en cada pintado. |
| `retrato.*` | Sobre mí | Se reduce a 900 px de ancho. Mientras no exista, el hueco se queda con su trama. |

Formatos: `.jpg`, `.jpeg`, `.png` o `.webp`. Sube el original tal cual, sin
recortar ni comprimir: de eso se encarga el build.
