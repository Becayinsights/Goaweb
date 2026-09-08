# assets

Aquí va la fotografía de fondo de la banda de cierre —«¿Quieres valorar tu
caso?»—, en su tamaño original. Vale cualquier imagen que haya en esta carpeta
y no hace falta renombrarla; si hubiera varias, manda la que se llame `cierre`.

`build.py` no la copia tal cual: la reduce a 1400 px, la desenfoca y la guarda
como `site/cierre.jpg`. De 1,2 MB a unos 30 KB. Se guarda ya desenfocada a
propósito: el desenfoque por CSS lo recalcula el navegador en cada pintado y en
un móvil se nota, y mandar cinco mil píxeles para verlos borrosos es peso
tirado. Requiere Pillow (`pip install Pillow`); sin él se copia sin procesar y
el build avisa.

Qué conviene que sea:

- Horizontal, 2000 px o más de lado largo.
- Un plano con poco detalle: al desenfocarse solo quedan las masas de color.
- Tonos que convivan con la paleta —hueso, verde quirófano, negro petróleo—.
- Sin caras reconocibles salvo que haya consentimiento firmado.
