#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gerador dos loaders de sala OROЯO (MODELO NOVO: 1 JSON por sala).

A partir da versão com editor, cada sala vive num único arquivo autocontido
em rooms/data/<sala>.json (specs 3D + textos juntos). Este script apenas
(re)gera os HTMLs enxutos rooms/<sala>.html que carregam esses JSONs, além
do manifesto rooms/data/rooms.json usado pelo editor.

É idempotente e seguro: não toca no conteúdo das salas, só nos wrappers.

Fluxo de trabalho:
  - editar salas no editor (editor.html) e exportar o JSON, ou editar
    rooms/data/<sala>.json à mão;
  - rodar `python3 build_rooms.py` para (re)criar os HTMLs de qualquer sala
    nova e o manifesto.

(Os antigos build_rooms_legacy.py e content/build_content_legacy.py ficam
guardados só como referência da geometria/texto originais.)
"""
import json
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
ROOMS_DIR = os.path.join(ROOT, "rooms")
DATA_DIR = os.path.join(ROOMS_DIR, "data")

HTML_TEMPLATE = """<!doctype html>
<html lang="pt-BR" data-room="{room_id}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>OROЯO</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="../style.css?v=38" />
  <link rel="stylesheet" href="../multiplayer/style.css?v=38" />
  <script type="importmap">
    {{ "imports": {{ "three": "../assets/js/three.module.js" }} }}
  </script>
</head>
<body class="ororo-room">
  <canvas id="scene-canvas" tabindex="0"></canvas>
  <script type="module">
    import {{ initRoom }} from '../ororo-core.js?v=38';
    // Modelo novo: toda a sala (3D + textos) vive em ./data/{room_id}.json
    initRoom({{ dataPath: './data/{room_id}.json' }});
  </script>
</body>
</html>
"""


def main():
    ids = []
    for fn in sorted(os.listdir(DATA_DIR)):
        if not fn.endswith(".json") or fn == "rooms.json":
            continue
        rid = fn[:-5]
        ids.append(rid)
        with open(os.path.join(ROOMS_DIR, rid + ".html"), "w", encoding="utf-8") as f:
            f.write(HTML_TEMPLATE.format(room_id=rid))
    with open(os.path.join(DATA_DIR, "rooms.json"), "w", encoding="utf-8") as f:
        json.dump({"rooms": ids}, f, ensure_ascii=False, indent=2)
    print("gerados", len(ids), "loaders de sala + manifesto")


if __name__ == "__main__":
    main()
