# Despliegue

El sitio vive en https://goa-maqueta-becay.vercel.app (proyecto `goa-maqueta-becay`).

Hoy se despliega a mano: la herramienta de Vercel recibe el árbol de ficheros
en línea y los tres del sitio (`index.html`, `goa.css`, `tratamiento.html`, unos
98 KB) no caben en una sola llamada. Por eso el proyecto lleva un paso de build,
`build.mjs`, que compone `public/` con lo que viaja en cada despliegue y
recupera del sitio ya publicado lo que no.

Ajustes del proyecto en Vercel:

    buildCommand     node build.mjs
    outputDirectory  public
    installCommand   echo sin-dependencias

**Esto es un puente, no la solución.** En cuanto exista `Becayinsights/goa-web`
en GitHub, se conecta el repositorio al proyecto de Vercel y cada `git push`
despliega el árbol entero: se borra `build.mjs`, se quita el buildCommand y
`site/` pasa a ser la raíz publicada.
