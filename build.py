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

DESC = ("Maqueta de diseno de la web de GOA Medical Aesthetics, por el Dr. Bengoa: "
        "medicina estetica, medicina capilar y cirugia capilar.")
ICON = ('<link rel="icon" href="data:image/svg+xml,<svg xmlns=%27http://www.w3.org/2000/svg%27 '
        'viewBox=%270 0 100 100%27><circle cx=%2750%27 cy=%2750%27 r=%2742%27 fill=%27none%27 '
        'stroke=%27%23EFEEE8%27 stroke-width=%276%27/><path fill=%27%23EFEEE8%27 '
        'd=%27M48 18 L52 18 L28 80 L22 80 Z%27/><path fill=%27%23EFEEE8%27 '
        'd=%27M46 18 L54 18 L78 80 L66 80 Z%27/></svg>">')
TEMA = ('<script>\n'
        '/* El tema se estampa antes de la primera pintura: oscuro por defecto. */\n'
        '(function(){try{var t=localStorage.getItem("goa-theme");'
        'document.documentElement.setAttribute("data-theme",t==="light"?"light":"dark");}'
        'catch(e){document.documentElement.setAttribute("data-theme","dark");}})();\n'
        '</script>')
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
.trat .lead{max-width:60ch;margin-top:22px;font-size:clamp(17px,1.6vw,19px)}
.ficha{border-top:1px solid var(--rule-2)}
.ficha-row{display:flex;flex-direction:column;gap:4px;padding:13px 0;border-bottom:1px solid var(--rule)}
.ficha-k{font-family:"IBM Plex Mono",monospace;font-size:9.5px;letter-spacing:.14em;
  text-transform:uppercase;color:var(--ink-3)}
.ficha-v{font-size:15.5px;color:var(--ink-2);line-height:1.45}
.ficha-precio .ficha-v{font-family:"Instrument Serif",serif;font-size:26px;color:var(--ink);line-height:1.1}
.pend{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0 clamp(20px,3vw,40px)}
@media (max-width:820px){.pend{grid-template-columns:1fr}}
.pend div{padding:14px 0;border-top:1px solid var(--rule);font-size:15.5px;color:var(--ink-3)}
"""


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
<meta name="theme-color" content="#0E1615">
<meta property="og:type" content="website">
<meta property="og:site_name" content="GOA Medical Aesthetics">
<meta property="og:title" content="{E(titulo)}">
<meta property="og:description" content="{E(descripcion)}">
<meta name="twitter:card" content="summary">
{ICON}
<title>{E(titulo)}</title>
{TEMA}
{FUENTES}
<link rel="stylesheet" href="/goa.css">
</head>
<body>"""


LINKS = """      <a href="/#precios">Precios</a>
      <a href="/#tratamientos">Tratamientos</a>
      <a href="/#resultados">Antes y después</a>
      <a href="/#especialidades">Especialidades</a>
      <a href="/#faq">FAQ</a>"""


def isla(volver=False):
    marca = ('<span class="mark-w"><span class="mark-go">GO</span><span class="mark-fill">'
             '<svg class="mark-a" aria-hidden="true"><use href="#goa-a"/></svg>'
             '<svg class="mark-ring" viewBox="0 0 100 100" aria-hidden="true">'
             '<circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" stroke-width="6"/>'
             '</svg></span></span>')
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
      <button class="icon-btn theme-btn" id="theme" type="button" title="Cambiar tema" aria-label="Cambiar tema">◐</button>
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
      <a href="/#precios">Precios</a>
      <a href="#">Aviso legal</a>
      <a href="#">Política de privacidad</a>
      <a href="#">Política de cookies</a>
      <a href="#">Consentimientos informados</a>
    </div>
  </div>
  <div class="pending">
    <span class="micro">Maqueta de diseño v14 · marca en reposo y menú inferior</span>
    <span class="micro">Falta: fotografía clínica y datos de contacto</span>
    <span class="micro">Nº de registro sanitario pendiente</span>
  </div>
</footer>"""


def landing(d, todos, cuerpo):
    """Una plantilla para las quince fichas; la ruta decide cuál se pinta."""
    datos = {t["slug"]: {**t, "area": a["nombre"], "tag": a["tag"]} for a, t in todos}
    pendiente = d["pendiente_landing"]
    js_datos = json.dumps(datos, ensure_ascii=False)
    js_pend = json.dumps(pendiente, ensure_ascii=False)
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
      <div class="actions" style="margin-top:30px">
        <a class="btn btn-solid" href="/#contacto">Pedir valoración</a>
        <a class="btn btn-line" href="/#tratamientos">Ver todos los tratamientos</a>
      </div>
    </div>
    <aside>
      <div class="ficha" id="t-ficha"></div>
    </aside>
  </div>
</section>

<section class="shell band" id="estructura">
  <div class="grid">
    <div class="rail">
      <svg class="rail-mark" aria-hidden="true"><use href="#goa-a"/></svg>
      <div class="rail-k">Ficha</div>
      <div class="rail-v">Estructura común</div>
    </div>
    <div class="flow">
      <h2>Lo que falta en esta ficha</h2>
      <p class="copy">La estructura de cada tratamiento es siempre la misma. Arriba está lo que el doctor ya ha redactado; estos apartados quedan pendientes de escribir con él, porque son contenido clínico y no se inventan.</p>
      <div class="pend" id="t-pend"></div>
    </div>
  </div>
</section>
</main>

{dock()}

{pie()}

<script>
(function(){{
  "use strict";
  var DATOS = {js_datos};
  var PEND = {js_pend};
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

  var pend = document.getElementById("t-pend");
  PEND.forEach(function(x){{
    var d = document.createElement("div");
    d.textContent = x;
    pend.appendChild(d);
  }});

  /* Tema e isla, igual que en la home */
  var root=document.documentElement, btn=document.getElementById("theme");
  function current(){{ var s=root.getAttribute("data-theme"); return s || (matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"); }}
  function label(){{ var d=current()==="dark"; btn.textContent=d?"◐":"◑"; btn.title=d?"Ver en claro":"Ver en oscuro"; btn.setAttribute("aria-label",btn.title); }}
  label();
  btn.addEventListener("click",function(){{
    var next=current()==="dark"?"light":"dark";
    root.setAttribute("data-theme",next);
    try{{ localStorage.setItem("goa-theme",next); }}catch(e){{}}
    label();
  }});
  var island=document.getElementById("island"), navd=document.getElementById("navd");
  addEventListener("scroll",function(){{ island.classList.toggle("on", scrollY>12); }},{{passive:true}});
  var xr=document.getElementById("navx-r");
  function edges(){{ var m=navd.scrollWidth-navd.clientWidth; xr.classList.toggle("on", m>4 && navd.scrollLeft<m-4); }}
  navd.addEventListener("scroll",edges,{{passive:true}});
  addEventListener("resize",edges); edges();
  xr.addEventListener("click",function(){{ navd.scrollBy({{left:150,behavior:"smooth"}}); }});

  /* La marca también respira aquí: en reposo se pliega en A y vuelve a GOA */
  var reduce=matchMedia("(prefers-reduced-motion: reduce)"), ultimo=Date.now();
  ["scroll","pointerdown","pointermove","keydown","touchstart"].forEach(function(ev){{
    addEventListener(ev,function(){{ ultimo=Date.now(); }},{{passive:true}});
  }});
  setInterval(function(){{
    if(reduce.matches || document.hidden || Date.now()-ultimo < 12000) return;
    ultimo=Date.now();
    island.classList.remove("intro"); void island.offsetWidth; island.classList.add("intro");
  }}, 1000);
}})();
</script>

</body>
</html>
"""


def main():
    d, todos = cargar()
    css, cuerpo = partir_home()
    SITE.mkdir(exist_ok=True)

    (SITE / "goa.css").write_text(css + EXTRA_CSS, encoding="utf-8")
    (SITE / "index.html").write_text(
        cabeza("GOA Medical Aesthetics", DESC) + "\n" + cuerpo.rstrip() + "\n\n</body>\n</html>\n",
        encoding="utf-8")
    (SITE / "tratamiento.html").write_text(landing(d, todos, cuerpo), encoding="utf-8")
    (SITE / "vercel.json").write_text(json.dumps({
        "cleanUrls": True,
        "rewrites": [{"source": "/tratamientos/:slug", "destination": "/tratamiento.html"}],
    }, indent=2) + "\n", encoding="utf-8")

    for f in ("goa.css", "index.html", "tratamiento.html", "vercel.json"):
        print(f"{f:20} {len((SITE/f).read_bytes()):>7,} bytes")
    print(f"{len(todos)} tratamientos con ficha propia")


if __name__ == "__main__":
    main()
