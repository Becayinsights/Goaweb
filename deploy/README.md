# Despliegue

El sitio vive en Vercel y se despliega desde este repositorio: cada push a
`main` publica `site/`, que es lo que genera `build.py`.

Ajustes del proyecto en Vercel:

    Root Directory    site
    Framework         Other
    Build Command     (ninguno)
    Output Directory  (ninguno: se sirve site/ tal cual)

`site/vercel.json` se lee desde ese directorio raíz y es quien pone `cleanUrls`
y la reescritura de `/tratamientos/<slug>` hacia `tratamiento.html`.

Para publicar un cambio:

    python3 build.py        # regenera site/ desde design/ y content/
    git add -A && git commit && git push

Hasta que el repositorio existió, los despliegues se hacían a mano enviando el
árbol de ficheros en línea, con un `build.mjs` que recomponía el sitio a partir
de lo ya publicado porque los tres ficheros no caben en una sola llamada. Ese
puente ya no hace falta y se ha retirado.
