# assets

## hero.jpg

La fotografía de fondo del hero. Si este fichero existe, `build.py` lo copia a
`site/hero.jpg` y define `--hero-img`, que es lo que pinta `.hero-bg::before`:
la imagen va desenfocada, desbordada un 9 % para que el desenfoque no deje
bordes claros, y cubierta por un degradado que la funde con el resto de la
página. Si no existe, el fondo se queda en las tres manchas de color de la
paleta y la página no se entera.

Qué conviene que sea:

- Horizontal y ancha, 2400 px o más de lado largo.
- Un plano con poco detalle y poco contraste: al desenfocarse solo quedan las
  masas de color, así que una foto muy cargada no aporta nada.
- Tonos que convivan con la paleta —hueso, verde quirófano, negro petróleo—.
- Sin caras reconocibles salvo que haya consentimiento firmado.

Si pesa más de ~400 KB, conviene guardarla ya desenfocada y reducida: el
desenfoque por CSS lo recalcula el navegador en cada pintado y en móvil se nota.
