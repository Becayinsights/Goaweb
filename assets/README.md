# Imágenes

Dos ficheros, reconocidos por el nombre. `build.py` los reduce y los prepara al
generar el sitio; no hace falta tocarlos antes de subirlos.

| Fichero | Dónde sale | Qué se hace con él |
|---|---|---|
| `cierre.*` (o cualquier imagen suelta) | Fondo del hero y de la banda de «¿Quieres valorar tu caso?» | Se reduce a 1400 px y se desenfoca al generar el sitio. Desenfocar por CSS obliga al navegador a recalcularlo en cada pintado. |
| `retrato.*` | Sobre mí | Se reduce a 900 px de ancho. Mientras no exista, el hueco se queda con su trama. |

Formatos: `.jpg`, `.jpeg`, `.png` o `.webp`. Sube el original tal cual, sin
recortar ni comprimir: de eso se encarga el build.

## Antes y después

Sube las parejas tal cual, con el nombre que les pone la clínica, aquí o en la
raíz del repositorio:

    fotos-Antesydespues-<área>-antes<n>.png
    fotos-Antesydespues-<área>-despues<n>.png

Y ejecuta:

    python3 herramientas/importar_casos.py
    python3 build.py

El importador las recodifica a WebP, las coloca en `assets/casos/` y las añade
a `content/casos.json` con su número de caso y su tratamiento. Los originales se
borran: pesan veinte veces más y git ya guarda una copia.

Un número con punto —`4.1` y `4.2`— son dos vistas del mismo paciente y
comparten número de caso. Una pareja incompleta no se importa: un antes sin
después no es un caso.

Las áreas reconocidas están en `AREAS`, dentro del propio script. Para una
nueva, se añade ahí una línea.
