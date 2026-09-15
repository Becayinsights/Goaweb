#!/usr/bin/env python3
"""Importa fotografías de antes y después recién subidas.

    python3 herramientas/importar_casos.py

Busca en assets/ (y en la raíz) los ficheros que llegan de la clínica con el
nombre que les pone el doctor:

    fotos-Antesydespues-<area>-antes<id>.png
    fotos-Antesydespues-<area>-despues<id>.png

y por cada pareja completa: la recodifica a WebP a 750 px, la deja en
assets/casos/ y la añade a content/casos.json con su número de caso, su
tratamiento y sus filtros. Los originales se borran: pesan veinte veces más y
git ya guarda una copia.

Un <id> con punto —4.1 y 4.2— son dos vistas del mismo paciente y comparten
número de caso: es el mismo caso mirado desde otro sitio, no dos casos.
"""
import json, os, pathlib, re, sys
from PIL import Image

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ANCHO = 750          # cada mitad del hueco se ve a unos 350 px; esto cubre el doble

# Qué es cada área: cómo se llama el prefijo de sus ficheros, en qué filtros
# entra, qué se lee bajo la foto y a qué fichas se enlaza.
AREAS = {
    "capilar":   dict(id="capilar",   cats=["capilar"],              texto="",                      fichas=[]),
    "labio":     dict(id="labios",    cats=["estetica", "labios"],   texto="Labios",                fichas=["labios"]),
    "marcacion": dict(id="mandibula", cats=["estetica", "mandibula"], texto="Marcación mandibular", fichas=["marcacion-mandibular"]),
    "menton":    dict(id="menton",    cats=["estetica", "menton"],   texto="Aumento de mentón",     fichas=["aumento-menton"]),
    "ojeras":    dict(id="ojeras",    cats=["estetica", "ojeras"],   texto="Tratamiento de ojeras", fichas=["ojeras"]),
    "rino":      dict(id="rino",      cats=["estetica", "rino"],     texto="Rinomodelación",        fichas=["rinomodelacion"]),
    "pomulo":    dict(id="pomulo",    cats=["estetica", "pomulo"],   texto="Reposicionamiento de pómulo", fichas=["reposicionamiento-pomulo"]),
    "armonizacion": dict(id="armonizacion", cats=["estetica"],       texto="Armonización facial",   fichas=["armonizacion-facial"]),
    "piel":      dict(id="piel",      cats=["estetica"],             texto="Bioestimulación",       fichas=["bioestimulacion-calidad-piel"]),
}

# La extensión se acepta repetida y con puntos de más: de la clínica llegan
# nombres como «...despues3.png..png» y no tiene sentido devolverlos para que
# los renombren.
PATRON = re.compile(
    r"fotos-Antesydespues-([a-zA-Z]+)-(antes|despues)([\d.]*?\d)"
    r"(?:\.+(?:png|jpe?g|webp))+$", re.I)


def main():
    casos_dir = RAIZ / "assets" / "casos"
    casos_dir.mkdir(parents=True, exist_ok=True)

    # Las parejas que haya sueltas, vengan de assets/ o de la raíz
    sueltas = {}
    for f in list((RAIZ / "assets").glob("fotos-Antesydespues-*")) + list(RAIZ.glob("fotos-Antesydespues-*")):
        m = PATRON.fullmatch(f.name)
        if not m:
            print(f"  no entiendo el nombre, lo dejo: {f.name}")
            continue
        area, lado, ident = m.group(1).lower(), m.group(2).lower(), m.group(3)
        if area not in AREAS:
            print(f"  área desconocida «{area}»: añádela a AREAS en este script")
            continue
        sueltas.setdefault((area, ident), {})[lado] = f

    completas = {k: v for k, v in sueltas.items() if len(v) == 2}
    for k, v in sueltas.items():
        if len(v) != 2:
            print(f"  {k[0]} {k[1]}: falta el «{'después' if 'antes' in v else 'antes'}», no se importa")
    if not completas:
        print("Nada nuevo que importar.")
        return

    fichero = RAIZ / "content" / "casos.json"
    datos = json.loads(fichero.read_text(encoding="utf-8"))
    ya = {c["id"] for c in datos["casos"]}

    # El número de caso sigue donde lo dejó el último, y los pacientes con dos
    # vistas comparten número.
    usados = [int(re.search(r"(\d+)", c["titulo"]).group(1)) for c in datos["casos"]
              if re.search(r"(\d+)", c["titulo"])]
    siguiente = max(usados, default=0) + 1
    numero_de = {}

    pesado = ligero = 0
    nuevos = 0
    for (area, ident), lados in sorted(completas.items()):
        cfg = AREAS[area]
        cid = f'{cfg["id"]}-{ident}'
        if cid in ya:
            print(f"  {cid} ya estaba, lo salto")
            continue
        paciente = (area, ident.split(".")[0])
        if paciente not in numero_de:
            numero_de[paciente] = siguiente
            siguiente += 1

        for lado, origen in lados.items():
            im = Image.open(origen).convert("RGB")
            im = im.resize((ANCHO, round(im.height * ANCHO / im.width)), Image.LANCZOS)
            destino = casos_dir / f"{cid}-{lado}.webp"
            im.save(destino, format="WEBP", quality=80, method=6)
            pesado += os.path.getsize(origen)
            ligero += os.path.getsize(destino)
            os.remove(origen)

        datos["casos"].append({
            "id": cid, "titulo": f"Caso {numero_de[paciente]:02d}", "vista": "",
            "cats": cfg["cats"], "tratamiento": cfg["texto"], "tratamientos": cfg["fichas"],
        })
        nuevos += 1
        print(f"  {cid:<22} Caso {numero_de[paciente]:02d}")

    fichero.write_text(json.dumps(datos, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\n{nuevos} casos nuevos · {pesado/1e6:.1f} MB -> {ligero/1e6:.2f} MB")
    print("Ahora: python3 build.py")


if __name__ == "__main__":
    main()
