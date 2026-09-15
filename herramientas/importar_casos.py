#!/usr/bin/env python3
"""Importa fotografías de antes y después recién subidas.

    python3 herramientas/importar_casos.py

Busca en assets/ y en la raíz los ficheros que llegan de la clínica:

    fotos-Antesydespues-<algo>-antes<n>.png
    fotos-Antesydespues-<algo>-despues<n>.png

y por cada pareja completa la recodifica a WebP a 750 px, la deja en
assets/casos/ y la añade a content/casos.json con su número de caso, su
tratamiento y sus filtros. Los originales se borran: pesan veinte veces más y
git ya guarda una copia.

Dos cosas del <n>. Un número con punto —4.1 y 4.2— son dos vistas del mismo
paciente y comparten número de caso. Y cuando el área se fotografía por zonas
—el anti arrugas, por entrecejo, frente y patas de gallo—, las tres zonas del
mismo número son el mismo paciente y también comparten caso.
"""
import json, os, pathlib, re
from PIL import Image

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ANCHO = 750          # cada mitad del hueco se ve a unos 350 px; esto cubre el doble

# Qué es cada palabra que puede aparecer en el nombre: a qué tratamiento
# pertenece, en qué filtros entra, qué se lee bajo la foto y a qué ficha enlaza.
AREAS = {
    "capilar":   dict(id="capilar",   cats=["capilar"],               texto="",                            fichas=[]),
    "labio":     dict(id="labios",    cats=["estetica", "labios"],    texto="Labios",                      fichas=["labios"]),
    "marcacion": dict(id="mandibula", cats=["estetica", "mandibula"], texto="Marcación mandibular",        fichas=["marcacion-mandibular"]),
    "menton":    dict(id="menton",    cats=["estetica", "menton"],    texto="Aumento de mentón",           fichas=["aumento-menton"]),
    "ojeras":    dict(id="ojeras",    cats=["estetica", "ojeras"],    texto="Tratamiento de ojeras",       fichas=["ojeras"]),
    "rino":      dict(id="rino",      cats=["estetica", "rino"],      texto="Rinomodelación",              fichas=["rinomodelacion"]),
    "pomulo":    dict(id="pomulo",    cats=["estetica", "pomulo"],    texto="Reposicionamiento de pómulo", fichas=["reposicionamiento-pomulo"]),
    "armonizacion": dict(id="armonizacion", cats=["estetica"],        texto="Armonización facial",         fichas=["armonizacion-facial"]),
    "piel":      dict(id="piel",      cats=["estetica"],              texto="Bioestimulación",             fichas=["bioestimulacion-calidad-piel"]),
    # Anti arrugas: llega por zonas de la cara
    "entrecejo": dict(id="antiarrugas", zona="entrecejo", vista="Entrecejo",      cats=["estetica", "antiarrugas"], texto="Anti arrugas", fichas=["tratamiento-anti-arrugas"]),
    "frente":    dict(id="antiarrugas", zona="frente",    vista="Frente",         cats=["estetica", "antiarrugas"], texto="Anti arrugas", fichas=["tratamiento-anti-arrugas"]),
    "pdgallo":   dict(id="antiarrugas", zona="pdgallo",   vista="Patas de gallo", cats=["estetica", "antiarrugas"], texto="Anti arrugas", fichas=["tratamiento-anti-arrugas"]),
}

# Lo mismo escrito de otra manera. De la clínica llegan erratas —«pdegallo» y
# «pdgallo» en la misma pareja— y palabras de relleno como «botox». Entenderlas
# aquí cuesta menos que pedir que renombren doce ficheros.
ALIAS = {
    "pdegallo": "pdgallo", "patasdegallo": "pdgallo", "patas": "pdgallo",
    "labios": "labio", "mandibula": "marcacion", "mandibular": "marcacion",
    "ojera": "ojeras", "rinomodelacion": "rino", "nariz": "rino",
    "neuromoduladores": None, "botox": None, "toxina": None,
}

# La extensión se acepta repetida, con puntos de más y sin punto: llegan
# nombres como «despues3.png..png» y «antes2png.png». Devolverlos para que los
# renombren es hacerles perder el tiempo a ellos para ahorrármelo yo.
PATRON = re.compile(
    r"fotos-Antesydespues-(.+?)-(antes|despues)([\d.]*?\d)"
    r"(?:\.*(?:png|jpe?g|webp))+$", re.I)


def leer(nombre):
    """Del nombre saca (área, lado, número). El área puede venir sola —«labio»—
    o entre palabras de relleno —«botox-entrecejo»—, así que se buscan todas las
    palabras conocidas en vez de exigir una forma exacta."""
    m = PATRON.fullmatch(nombre)
    if not m:
        return None
    crudo, lado, ident = m.group(1), m.group(2).lower(), m.group(3)
    for palabra in re.split(r"[-_ ]+", crudo.lower()):
        palabra = ALIAS.get(palabra, palabra)
        if palabra in AREAS:
            return palabra, lado, ident
    return None


def main():
    casos_dir = RAIZ / "assets" / "casos"
    casos_dir.mkdir(parents=True, exist_ok=True)

    sueltas, sin_entender = {}, []
    for f in list((RAIZ / "assets").glob("fotos-Antesydespues-*")) + list(RAIZ.glob("fotos-Antesydespues-*")):
        leido = leer(f.name)
        if not leido:
            sin_entender.append(f.name)
            continue
        area, lado, ident = leido
        sueltas.setdefault((area, ident), {})[lado] = f

    for n in sorted(sin_entender):
        print(f"  no sé de qué área es, lo dejo: {n}")

    completas = {k: v for k, v in sueltas.items() if len(v) == 2}
    for k, v in sorted(sueltas.items()):
        if len(v) != 2:
            falta = "después" if "antes" in v else "antes"
            print(f"  {k[0]} {k[1]}: falta el «{falta}», no se importa")
    if not completas:
        print("Nada nuevo que importar.")
        return

    fichero = RAIZ / "content" / "casos.json"
    datos = json.loads(fichero.read_text(encoding="utf-8"))
    ya = {c["id"] for c in datos["casos"]}
    usados = [int(re.search(r"(\d+)", c["titulo"]).group(1)) for c in datos["casos"]
              if re.search(r"(\d+)", c["titulo"])]
    siguiente = max(usados, default=0) + 1
    numero_de = {}

    pesado = ligero = nuevos = 0
    for (area, ident), lados in sorted(completas.items()):
        cfg = AREAS[area]
        zona = cfg.get("zona")
        cid = f'{cfg["id"]}-{ident}-{zona}' if zona else f'{cfg["id"]}-{ident}'
        if cid in ya:
            print(f"  {cid} ya estaba, lo salto")
            continue

        # El paciente es el número antes del punto. Con zonas, el área entera
        # comparte paciente: entrecejo-1, frente-1 y pdgallo-1 son la misma cara.
        paciente = (cfg["id"], ident.split(".")[0])
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
            "id": cid, "titulo": f"Caso {numero_de[paciente]:02d}",
            "vista": cfg.get("vista", ""), "cats": cfg["cats"],
            "tratamiento": cfg["texto"], "tratamientos": cfg["fichas"],
        })
        nuevos += 1
        print(f'  {cid:<28} Caso {numero_de[paciente]:02d}  {cfg.get("vista", "")}')

    fichero.write_text(json.dumps(datos, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\n{nuevos} casos nuevos · {pesado/1e6:.1f} MB -> {ligero/1e6:.2f} MB")
    print("Ahora: python3 build.py")


if __name__ == "__main__":
    main()
