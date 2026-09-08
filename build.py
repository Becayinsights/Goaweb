#!/usr/bin/env python3
"""Genera el sitio estático de site/ a partir de la maqueta y del contenido.

    python3 build.py

- design/goa-home.html es la fuente de la home (y del sistema visual).
- content/tratamientos.json alimenta el índice, los precios y las 15 landings.
- Las landings son una sola plantilla, tratamiento.html, que resuelve el
  tratamiento por la ruta. vercel.json reescribe /tratamientos/<slug> hacia
  ella, así que las URLs son las definitivas desde ya.
"""
import json, html, pathlib, re

RAIZ = pathlib.Path(__file__).parent
SITE = RAIZ / "site"
E = html.escape

# Lo que se ve al compartir el enlace. Sigue con noindex hasta que sea la web
# definitiva, pero el texto ya es el del doctor, no el de una maqueta.
DESC = ("Dr. Manuel Bengoa. Medicina estetica, medicina capilar y cirugia capilar "
        "con enfoque medico y resultados naturales.")
ICON = ('<link rel="icon" href="data:image/svg+xml,<svg xmlns=%27http://www.w3.org/2000/svg%27 '
        'viewBox=%270 0 100 100%27><circle cx=%2750%27 cy=%2750%27 r=%2742%27 fill=%27none%27 '
        'stroke=%27%23ECE8DE%27 stroke-width=%276%27/><path fill=%27%23ECE8DE%27 '
        'd=%27M48 18 L52 18 L28 80 L22 80 Z%27/><path fill=%27%23ECE8DE%27 '
        'd=%27M46 18 L54 18 L78 80 L66 80 Z%27/></svg>">')
FUENTES = ('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
           '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
           'family=Instrument+Serif:ital@0;1&family=Instrument+Sans:wght@400;500;600&'
           'family=IBM+Plex+Mono:wght@400;500&display=swap">')

EXTRA_CSS = """
/* Reglas que antes ponía el envoltorio del visor de artifacts y ahora son nuestras */
img{max-width:100%}
[hidden]{display:none!important}   /* sin esto, .case{display:flex} gana al hidden */

/* ═══════════ FICHA DE TRATAMIENTO ═══════════ */
.crumbs{display:flex;gap:10px;align-items:center;font-family:"IBM Plex Mono",monospace;
  font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3)}
.crumbs a{text-decoration:none}
.crumbs a:hover{color:var(--ink)}
.trat{padding-top:clamp(40px,6vw,80px);padding-bottom:clamp(40px,6vw,72px)}
.trat-in{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:clamp(28px,5vw,64px);align-items:start}
@media (max-width:900px){.trat-in{grid-template-columns:1fr;gap:30px}}
.trat h1{font-size:clamp(34px,5.2vw,62px);margin:18px 0 0}
/* Hueco de la foto del tratamiento: encabeza la columna de datos */
.trat-foto{
  aspect-ratio:3/4;border:1px solid var(--rule);margin-bottom:24px;
  background:repeating-linear-gradient(-45deg,var(--hatch) 0 1px,transparent 1px 9px);
}
.trat-foto img{width:100%;height:100%;object-fit:cover;display:block}
@media (max-width:900px){.trat-foto{aspect-ratio:4/3;margin-bottom:20px}}
.trat .lead{max-width:60ch;margin-top:22px;font-size:clamp(17px,1.6vw,19px)}
.ficha{border-top:1px solid var(--rule-2)}
.ficha-row{display:flex;flex-direction:column;gap:4px;padding:13px 0;border-bottom:1px solid var(--rule)}
.ficha-k{font-family:"IBM Plex Mono",monospace;font-size:9.5px;letter-spacing:.14em;
  text-transform:uppercase;color:var(--ink-3)}
.ficha-v{font-size:15.5px;color:var(--ink-2);line-height:1.45}
.ficha-precio .ficha-v{font-family:"Instrument Serif",serif;font-size:26px;color:var(--ink);line-height:1.1}
.inc{border-top:1px solid var(--rule-2);margin-top:30px}
.inc-b{padding:20px 0;border-bottom:1px solid var(--rule)}
.inc-b h3{font-size:20px;margin:0 0 7px}
.inc-b p{margin:0;color:var(--ink-2);font-size:15.5px;line-height:1.6;max-width:62ch}
"""


def fondo():
    """Prepara la fotografía de fondo de la banda de cierre.

    Vale cualquier imagen que haya en assets/ y no hace falta renombrarla. Se
    guarda ya desenfocada y reducida: el desenfoque por CSS lo recalcula el
    navegador en cada pintado y en un móvil se nota, y una foto de cinco mil
    píxeles para verse borrosa es peso tirado. De 1,2 MB a unos 30 KB.
    """
    fotos = sorted(f for f in (RAIZ / "assets").glob("*")
                   if f.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp"))
    if not fotos:
        return ""
    foto = next((f for f in fotos if f.stem.lower() == "cierre"), fotos[0])
    destino = SITE / "cierre.jpg"
    try:
        from PIL import Image, ImageFilter
        im = Image.open(foto).convert("RGB")
        ancho = 1400
        im = im.resize((ancho, round(im.height * ancho / im.width)), Image.LANCZOS)
        im.filter(ImageFilter.GaussianBlur(22)).save(
            destino, quality=76, optimize=True, progressive=True)
        print(f"{'fondo de cierre':20} {foto.name} -> {destino.stat().st_size:>7,} bytes")
    except ImportError:
        destino.write_bytes(foto.read_bytes())
        print(f"{'fondo de cierre':20} {foto.name} sin procesar (falta Pillow: pip install Pillow)")
    return '\n:root{--band-img:url("/cierre.jpg")}\n'


def cargar():
    d = json.loads((RAIZ / "content" / "tratamientos.json").read_text(encoding="utf-8"))
    todos = [(a, t) for a in d["areas"] for t in a["tratamientos"]]
    return d, todos


def partir_home():
    """Devuelve (css, cuerpo) de la maqueta de diseño."""
    src = (RAIZ / "design" / "goa-home.html").read_text(encoding="utf-8")
    css = src[src.index("<style>") + len("<style>"): src.index("</style>")]
    cuerpo = src[src.index("</style>") + len("</style>"):]
    return css, cuerpo


def cabeza(titulo, descripcion, canonica=None):
    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="description" content="{E(descripcion)}">
<meta name="theme-color" content="#F3F1EA">
<meta property="og:type" content="website">
<meta property="og:site_name" content="GOA Medical Aesthetics">
<meta property="og:title" content="{E(titulo)}">
<meta property="og:description" content="{E(descripcion)}">
<meta name="twitter:card" content="summary">
{ICON}
<title>{E(titulo)}</title>
{FUENTES}
<link rel="stylesheet" href="/goa.css">
</head>
<body>"""


LINKS = """      <a href="/#resultados">Antes y después</a>
      <a href="/#especialidades">Especialidades</a>
      <button class="drop" type="button" aria-expanded="false" aria-controls="mega">Tratamientos <span class="caret" aria-hidden="true">›</span></button>
      <a href="/#sobre-mi">Sobre mí</a>
      <a href="/#faq">FAQ</a>"""


def isla(volver=False):
    marca = ('<span class="mark-w"><span class="mark-go">GO</span><span class="mark-fill">'
             '<svg class="mark-a" aria-hidden="true"><use href="#goa-a"/></svg>'
             '</span></span>')
    return f"""<div class="hbar">
  <header class="island intro" id="island">
    <a class="mark" href="/" aria-label="GOA Medical Aesthetics — inicio">
      {marca}
      <span class="mark-sub">Medical Aesthetics<br>Dr. Bengoa</span>
    </a>
    <nav class="nav" id="nav" aria-label="Secciones de la página">
{LINKS}
    </nav>
    <div class="hact">
      <a class="btn btn-solid btn-sm cta-top" href="/#contacto">Pedir valoración</a>
    </div>
  </header>
</div>"""


def dock():
    """La navegación de móvil vive abajo, flotante, fuera de la cabecera."""
    return f"""<div class="dock" id="dock">
  <nav class="nav" id="navd" aria-label="Secciones de la página">
{LINKS}
  </nav>
  <button class="navx navx-r" id="navx-r" type="button" aria-label="Más secciones">›</button>
</div>"""


def mega(d):
    """El desplegable del header, con la misma lista que la sección."""
    return f"""<div class="mega" id="mega" hidden>
  <div class="mega-in">
    <div class="index">
{indice(d)}
      </div>
    <a class="link mega-todos" href="/#tratamientos">Ver todos los tratamientos y precios <span class="arw" aria-hidden="true">→</span></a>
  </div>
</div>"""


def menu_js():
    """El comportamiento del header, común a todas las páginas que no son la
    home: tema, isla, tira de secciones, desplegable y marca en reposo."""
    return """
  var island=document.getElementById("island"), navd=document.getElementById("navd");
  addEventListener("scroll",function(){ island.classList.toggle("on", scrollY>12); },{passive:true});
  var xr=document.getElementById("navx-r");
  function edges(){ var m=navd.scrollWidth-navd.clientWidth; xr.classList.toggle("on", m>4 && navd.scrollLeft<m-4); }
  navd.addEventListener("scroll",edges,{passive:true});
  addEventListener("resize",edges); edges();
  xr.addEventListener("click",function(){ navd.scrollBy({left:150,behavior:"smooth"}); });

  var mega=document.getElementById("mega");
  var drops=Array.prototype.slice.call(document.querySelectorAll(".drop"));
  function colocar(){
    if(innerWidth > 980){
      var r=island.getBoundingClientRect();
      mega.style.top=(r.bottom + 8) + "px";
      mega.style.left=r.left + "px";
      mega.style.width=r.width + "px";
      mega.style.maxHeight=(innerHeight - r.bottom - 32) + "px";
    } else {
      mega.style.top=mega.style.left=mega.style.width=mega.style.maxHeight="";
    }
  }
  function abrir(v){
    if(v) colocar();
    mega.hidden=!v;
    drops.forEach(function(b){ b.setAttribute("aria-expanded", String(v)); });
  }
  drops.forEach(function(b){ b.addEventListener("click",function(e){ e.stopPropagation(); abrir(mega.hidden); }); });
  document.addEventListener("click",function(e){ if(!mega.hidden && !mega.contains(e.target)) abrir(false); });
  mega.addEventListener("click",function(e){ if(e.target.closest("a")) abrir(false); });
  addEventListener("keydown",function(e){ if(e.key==="Escape" && !mega.hidden) abrir(false); });
  addEventListener("resize",function(){ if(!mega.hidden) colocar(); });
  addEventListener("scroll",function(){ if(!mega.hidden) colocar(); },{passive:true});

  /* La marca en reposo se pliega en A y vuelve a GOA */
  var reduce=matchMedia("(prefers-reduced-motion: reduce)"), ultimo=Date.now();
  ["scroll","pointerdown","keydown","touchstart"].forEach(function(ev){
    addEventListener(ev,function(){ ultimo=Date.now(); },{passive:true});
  });
  setInterval(function(){
    if(reduce.matches || document.hidden || Date.now()-ultimo < 2000) return;
    ultimo=Date.now();
    island.classList.remove("intro"); void island.offsetWidth; island.classList.add("intro");
  }, 1000);
"""


def sprite(cuerpo):
    ini = cuerpo.index('<svg aria-hidden="true" style="position:absolute')
    fin = cuerpo.index("</svg>", cuerpo.index("goa-iso")) + len("</svg>")
    return cuerpo[ini:fin]


def pie():
    return """<footer class="shell foot">
  <div class="foot-in">
    <div>
      <span class="mark" style="pointer-events:none">
        <span class="mark-w" style="font-size:22px">GO<svg class="mark-a" aria-hidden="true"><use href="#goa-a"/></svg></span>
      </span>
      <p class="micro" style="margin-top:12px;max-width:44ch">Medicina estética · Medicina capilar · Cirugía capilar<br>by Dr. Bengoa</p>
    </div>
    <div class="foot-links">
      <a href="/#tratamientos">Tratamientos</a>
      <a href="/aviso-legal">Aviso legal</a>
      <a href="/privacidad">Política de privacidad</a>
      <a href="/cookies">Política de cookies</a>
      <a href="/consentimientos">Consentimientos informados</a>
    </div>
  </div>
</footer>"""


def indice(d):
    """El índice de tratamientos con su precio: una sola lista para las dos cosas."""
    cols = []
    for a in d["areas"]:
        filas = "\n".join(
            f'            <li><a href="/tratamientos/{t["slug"]}">{E(t["nombre"])} '
            f'<span class="tprice">{E(t["precio_corto"])}</span></a></li>'
            for t in a["tratamientos"])
        cols.append(f'''        <div>
          <h4>{E(a["nombre"])}</h4>
          <ul class="tlist">
{filas}
          </ul>
        </div>''')
    return "\n".join(cols)


def perfiles():
    """Cada reseña se presenta como un perfil: retrato, nombre y tratamiento.

    Nombre y foto salen del JSON y hoy están vacíos: son mensajes reales de
    pacientes y no se inventa quién los firma. Sin ellos, el círculo enseña la
    marca y el nombre queda en «Paciente».
    """
    fichas = []
    for i, t in enumerate(json.loads(
            (RAIZ / "content" / "testimonios.json").read_text(encoding="utf-8"))):
        oculto = " hidden" if i >= 6 else ""
        nombre = t.get("nombre") or "Paciente"
        foto = (f'<img src="{E(t["foto"])}" alt="{E(nombre)}" width="38" height="38">'
                if t.get("foto") else
                '<svg aria-hidden="true"><use href="#goa-a"/></svg>')
        sub = (f'\n            <div class="perfil-t">{E(t["tratamiento"])}</div>'
               if t.get("tratamiento") else "")
        fichas.append(f'''        <figure class="quote"{oculto}>
          <div class="quote-perfil">
            <span class="avatar">{foto}</span>
            <span>
            <div class="perfil-n">{E(nombre)}</div>{sub}
            </span>
          </div>
          <blockquote class="quote-body">{E(t["texto"])}</blockquote>
        </figure>''')
    return "\n".join(fichas)


def galeria():
    """Tres huecos de antes y después. Van numerados: el nombre del tratamiento
    ya está en el título de la página y repetirlo tres veces no dice nada."""
    return "\n".join(
        '        <figure class="case seen">\n'
        '          <div class="slot"><div class="slot-half"><span class="slot-lbl">Antes</span></div>'
        '<div class="slot-half"><span class="slot-lbl">Después</span></div></div>\n'
        f'          <figcaption class="case-meta"><span class="case-name">Caso {n:02d}</span></figcaption>\n'
        '        </figure>'
        for n in (1, 2, 3))


LEGALES = [
    ("aviso-legal", "Aviso legal"),
    ("privacidad", "Política de privacidad"),
    ("cookies", "Política de cookies"),
    ("consentimientos", "Consentimientos informados"),
]


def legal(slug, titulo, cuerpo, d):
    """Una página por documento legal. El texto lo redacta quien corresponda;
    la página existe desde ya para que ningún enlace del pie caiga en vacío."""
    return f"""{cabeza(titulo + " · GOA Medical Aesthetics", DESC)}

{sprite(cuerpo)}

{isla()}

<main id="top">
<section class="shell trat">
  <nav class="crumbs" aria-label="Migas"><a href="/">Inicio</a> · <span>{E(titulo)}</span></nav>
  <h1>{E(titulo)}</h1>
  <p class="lead">Por completar.</p>
</section>
</main>

{mega(d)}

{dock()}

{pie()}

<script>
(function(){{
  "use strict";
{menu_js()}
}})();
</script>

</body>
</html>
"""


def landing(d, todos, cuerpo):
    """Una plantilla para todas las fichas; la ruta decide cuál se pinta."""
    datos = {t["slug"]: {**t, "area": a["nombre"], "tag": a["tag"]} for a, t in todos}
    js_datos = json.dumps(datos, ensure_ascii=False)
    return f"""{cabeza("Tratamiento · GOA Medical Aesthetics", DESC)}

{sprite(cuerpo)}

{isla()}

<main id="top">
<section class="shell trat" id="ficha">
  <div class="trat-in">
    <div>
      <nav class="crumbs" aria-label="Migas"><a href="/">Inicio</a> · <a href="/#tratamientos">Tratamientos</a> · <span id="crumb-area"></span></nav>
      <h1 id="t-nombre"></h1>
      <p class="lead" id="t-texto"></p>
      <div class="actions">
        <a class="btn btn-solid" href="/#contacto">Pedir valoración</a>
        <a class="btn btn-line" href="/#tratamientos">Ver todos los tratamientos</a>
      </div>
    </div>
    <aside>
      <div class="trat-foto"></div>
      <div class="ficha" id="t-ficha"></div>
    </aside>
  </div>
</section>

<!-- Lo que va dentro del tratamiento y no se cobra aparte: el diseño previo y
     el seguimiento no son productos sueltos. Solo aparece si la ficha lo trae. -->
<section class="shell band" id="incluye" hidden>
  <div class="grid">
    <div class="rail">
      <svg class="rail-mark" aria-hidden="true"><use href="#goa-a"/></svg>
      <div class="rail-k">Incluido</div>
      <div class="rail-v">Sin coste aparte</div>
    </div>
    <div class="flow">
      <h2>Incluido en el tratamiento</h2>
      <div class="inc" id="t-incluye"></div>
    </div>
  </div>
</section>

<section class="shell band" id="resultados-t">
  <div class="grid">
    <div class="rail">
      <svg class="rail-mark" aria-hidden="true"><use href="#goa-a"/></svg>
      <div class="rail-k">Resultados</div>
      <div class="rail-v">Antes y después</div>
    </div>
    <div class="flow">
      <h2>Antes y después</h2>
      <p class="copy">Cada paciente parte de una anatomía distinta, por eso cada tratamiento se adapta de forma personalizada. Los resultados deben interpretarse según el punto de partida, el tratamiento realizado y el seguimiento.</p>
      <div class="cases">
{galeria()}
      </div>
      <p class="notice">Las imágenes muestran resultados reales, pero cada caso requiere una valoración individual y no todos los pacientes obtienen exactamente la misma evolución.</p>
    </div>
  </div>
</section>

</main>

{mega(d)}

{dock()}

{pie()}

<script>
(function(){{
  "use strict";
  var DATOS = {js_datos};
  var slug = decodeURIComponent(location.pathname.replace(/\\/$/,"").split("/").pop() || "");
  if(!DATOS[slug]){{
    var q = new URLSearchParams(location.search).get("t");
    if(q && DATOS[q]) slug = q;
  }}
  var t = DATOS[slug];
  if(!t){{ location.replace("/#tratamientos"); return; }}

  document.title = t.nombre + " · GOA Medical Aesthetics";
  document.getElementById("crumb-area").textContent = t.area;
  document.getElementById("t-nombre").textContent = t.nombre;
  document.getElementById("t-texto").textContent = t.texto;

  var ficha = document.getElementById("t-ficha");
  (t.datos || []).forEach(function(par){{
    var row = document.createElement("div");
    row.className = "ficha-row";
    row.innerHTML = '<span class="ficha-k"></span><span class="ficha-v"></span>';
    row.children[0].textContent = par[0];
    row.children[1].textContent = par[1];
    ficha.appendChild(row);
  }});
  var precio = document.createElement("div");
  precio.className = "ficha-row ficha-precio";
  precio.innerHTML = '<span class="ficha-k">Precio</span><span class="ficha-v"></span>';
  precio.children[1].textContent = t.precio;
  ficha.appendChild(precio);

  var inc = t.incluye || [];
  if(inc.length){{
    var caja = document.getElementById("t-incluye");
    inc.forEach(function(x){{
      var b = document.createElement("div");
      b.className = "inc-b";
      b.innerHTML = "<h3></h3><p></p>";
      b.children[0].textContent = x.titulo;
      b.children[1].textContent = x.texto;
      caja.appendChild(b);
    }});
    document.getElementById("incluye").hidden = false;
  }}

{menu_js()}
}})();
</script>

</body>
</html>
"""


def main():
    d, todos = cargar()
    css, cuerpo = partir_home()
    SITE.mkdir(exist_ok=True)

    cuerpo = cuerpo.replace(
        '<div class="index" id="index-tratamientos"></div>',
        '<div class="index" id="index-tratamientos">\n' + indice(d) + '\n      </div>')
    cuerpo = cuerpo.replace(
        '<div class="index" id="index-mega"></div>',
        '<div class="index" id="index-mega">\n' + indice(d) + '\n      </div>')
    cuerpo = cuerpo.replace(
        '<div class="quotes" id="quotes"></div>',
        '<div class="quotes" id="quotes">\n' + perfiles() + '\n      </div>')

    css += fondo()

    (SITE / "goa.css").write_text(css + EXTRA_CSS, encoding="utf-8")
    (SITE / "index.html").write_text(
        cabeza("GOA Medical Aesthetics", DESC) + "\n" + cuerpo.rstrip() + "\n\n</body>\n</html>\n",
        encoding="utf-8")
    (SITE / "tratamiento.html").write_text(landing(d, todos, cuerpo), encoding="utf-8")
    for slug, titulo in LEGALES:
        (SITE / f"{slug}.html").write_text(legal(slug, titulo, cuerpo, d), encoding="utf-8")
    (SITE / "vercel.json").write_text(json.dumps({
        "cleanUrls": True,
        # Con cleanUrls, /tratamiento.html redirige a /tratamiento: el destino de la
        # reescritura tiene que ser ya la URL limpia o la ruta acaba en 404.
        "rewrites": [{"source": "/tratamientos/:slug", "destination": "/tratamiento"}],
    }, indent=2) + "\n", encoding="utf-8")

    for f in ["goa.css", "index.html", "tratamiento.html", "vercel.json"] + \
             [f"{slug}.html" for slug, _ in LEGALES]:
        print(f"{f:20} {len((SITE/f).read_bytes()):>7,} bytes")
    print(f"{len(todos)} tratamientos con ficha propia")


if __name__ == "__main__":
    main()
