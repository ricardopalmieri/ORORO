#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Migração: passa do modelo "specs 3D inline no HTML + content.json único"
para "1 JSON por sala" (rooms/data/sala-XX.json), com specs 3D E textos
juntos, mais um ui.json compartilhado e um manifesto rooms.json.

Também reescreve cada rooms/sala-XX.html como um loader enxuto e injeta
alguns objetos "ousados" (plantas, palmeira, onça, cardume, poça de óleo)
em salas escolhidas, como demonstração.

Rodar uma vez:  python3 content/migrate_to_perroom.py
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)                      # .../ororo
ROOMS_DIR = os.path.join(ROOT, "rooms")
DATA_DIR = os.path.join(ROOMS_DIR, "data")
CONTENT = os.path.join(HERE, "ororo-content.json")


def extract_config(html):
    """extrai o objeto JSON passado para initRoom({...}) via casamento de chaves."""
    i = html.find("initRoom(")
    if i < 0:
        return None
    j = html.find("{", i)
    if j < 0:
        return None
    depth = 0
    in_str = False
    esc = False
    end = None
    for k in range(j, len(html)):
        c = html[k]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                in_str = False
            continue
        if c == '"':
            in_str = True
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                end = k + 1
                break
    if end is None:
        return None
    return json.loads(html[j:end])


# objetos ousados a injetar por sala (decorativos, sem "info")
BOLD_PROPS = {
    "sala-01-genese": [
        {"type": "oil-blob", "position": [-7.5, 0, -7.5], "radius": 1.1, "glow": "#0E8C86"},
        {"type": "plant", "position": [7.2, 0, -8.2], "accent": "#14603a", "glow": "#B7F03B", "count": 8, "height": 1.2},
    ],
    "sala-02a-floresta-ferida": [
        {"type": "palm", "position": [-8.0, 0, -8.5], "height": 3.4, "accent": "#14603a", "glow": "#B7F03B"},
        {"type": "palm", "position": [8.4, 0, -9.0], "height": 2.8, "accent": "#0F6F5C", "glow": "#B7F03B"},
        {"type": "plant", "position": [-6.5, 0, -3.5], "accent": "#1f7a3a", "glow": "#B7F03B", "count": 9, "height": 1.3},
        {"type": "plant", "position": [6.0, 0, -4.2], "accent": "#14603a", "glow": "#0E8C86", "count": 7, "height": 1.0},
        {"type": "lowpoly-jaguar", "position": [3.5, 0, -6.5], "rotation": [0, -2.2, 0], "base": "#070809", "glow": "#B7F03B", "bodyScale": 1.05},
    ],
    "sala-03a-animais-fantasma": [
        {"type": "lowpoly-jaguar", "position": [0, 0, -6.0], "rotation": [0, 0.5, 0], "base": "#08070b", "glow": "#B7F03B", "bodyScale": 1.15},
        {"type": "fish-school", "position": [-6.0, 0.4, -5.0], "count": 7, "glow": "#0E8C86"},
        {"type": "fish-school", "position": [6.4, 0.6, -7.0], "count": 5, "glow": "#243B8F"},
    ],
    "sala-05a-maquinas-bioma": [
        {"type": "oil-blob", "position": [-6.0, 0, -5.5], "radius": 1.3, "glow": "#4B1F68"},
        {"type": "oil-blob", "position": [5.5, 0, -8.0], "radius": 0.9, "glow": "#872D67"},
        {"type": "plant", "position": [8.0, 0, -4.0], "accent": "#0F6F5C", "glow": "#B7F03B", "count": 6, "height": 0.9},
    ],
    "sala-05c-viagem-cosmica": [
        {"type": "fish-school", "position": [0, 1.2, -6.0], "count": 8, "glow": "#243B8F"},
    ],
}

SCENE_KEYS_SKIP = {"id", "props", "central"}

HTML_TEMPLATE = """<!doctype html>
<html lang="pt-BR" data-room="{room_id}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>OROЯO</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="../style.css" />
  <script type="importmap">
    {{ "imports": {{ "three": "../assets/js/three.module.js" }} }}
  </script>
</head>
<body class="ororo-room">
  <canvas id="scene-canvas" tabindex="0"></canvas>
  <script type="module">
    import {{ initRoom }} from '../ororo-core.js';
    // Modelo novo: toda a sala (3D + textos) vive em ./data/{room_id}.json
    initRoom({{ dataPath: './data/{room_id}.json' }});
  </script>
</body>
</html>
"""


def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(CONTENT, encoding="utf-8") as f:
        content = json.load(f)
    ui = content["ui"]
    rooms_text = content["rooms"]

    # ui.json compartilhado
    with open(os.path.join(HERE, "ui.json"), "w", encoding="utf-8") as f:
        json.dump(ui, f, ensure_ascii=False, indent=2)

    room_ids = []
    for fn in sorted(os.listdir(ROOMS_DIR)):
        if not fn.endswith(".html"):
            continue
        room_id = fn[:-5]
        html = open(os.path.join(ROOMS_DIR, fn), encoding="utf-8").read()
        cfg = extract_config(html)
        if cfg is None:
            print("  ! sem config:", fn)
            continue
        rid = cfg.get("id", room_id)
        txt = rooms_text.get(rid, {})

        scene = {k: v for k, v in cfg.items() if k not in SCENE_KEYS_SKIP}

        # props com texto embutido
        props = []
        for p in cfg.get("props", []):
            p2 = dict(p)
            info = p2.get("info")
            if info and info in txt.get("objects", {}):
                p2["content"] = txt["objects"][info]
            props.append(p2)
        # injeta objetos ousados (decorativos)
        for extra in BOLD_PROPS.get(rid, []):
            props.append(dict(extra))

        # central: funde spec 3D (cfg.central) com textos (txt.central)
        central = dict(cfg.get("central", {}))
        tc = txt.get("central", {})
        for key in ("title", "body", "choices"):
            if key in tc:
                central[key] = tc[key]

        room_obj = {
            "id": rid,
            "stage": txt.get("stage", cfg.get("index", 1)),
            "name": txt.get("name", {"pt": rid, "en": rid}),
            "scene": scene,
            "props": props,
            "central": central,
        }
        out = os.path.join(DATA_DIR, rid + ".json")
        with open(out, "w", encoding="utf-8") as f:
            json.dump(room_obj, f, ensure_ascii=False, indent=2)
        room_ids.append(rid)

        # reescreve o HTML como loader enxuto
        with open(os.path.join(ROOMS_DIR, fn), "w", encoding="utf-8") as f:
            f.write(HTML_TEMPLATE.format(room_id=rid))

    # manifesto para o editor
    with open(os.path.join(DATA_DIR, "rooms.json"), "w", encoding="utf-8") as f:
        json.dump({"rooms": room_ids}, f, ensure_ascii=False, indent=2)

    print("migrado:", len(room_ids), "salas ->", DATA_DIR)


if __name__ == "__main__":
    main()
