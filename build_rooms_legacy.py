#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gerador das salas OROЯO (matriz de 7 etapas / 3 linhas).

Cada sala é descrita como um dicionário Python com a especificação 3D
(paleta, luz, piso, objetos, relíquia central). TODO O TEXTO (nome da sala,
descrições dos objetos clicáveis, título/corpo da relíquia e verbos de
escolha) vive em content/ororo-content.json — ver content/build_content.py.

Aespec de cada objeto pode receber `info="<id>"`, que precisa existir em
content.json -> rooms[<room-id>].objects[<id>]. Isso faz o objeto ficar
clicável: ao clicar, o painel inferior mostra título + corpo daquele id.

Estrutura da travessia (sempre 7 salas, sem repetição):

  sala-01-genese (comum)
    -> sala-02a-floresta-ferida | sala-02b-invasores | sala-02c-espelhos-dagua
       -> sala-03a-animais-fantasma | sala-03b-vila-ocupada | sala-03c-corpo-fragmentado
          -> sala-04a-elementos | sala-04b-vozes-dissidentes | sala-04c-vozes-ancestrais
             -> sala-05a-maquinas-bioma | sala-05b-fogo-cruzado | sala-05c-viagem-cosmica
                -> sala-06a-ritual-sangue | sala-06b-insurreicao | sala-06c-ritual-fusao
                   -> sala-07-final (comum)

Rodar:  python3 build_rooms.py
"""
import json
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
ROOMS_DIR = os.path.join(ROOT, 'rooms')

# ---------------------------------------------------------------------------
# helpers de objetos de cena
# spec.info, quando presente, torna o objeto clicável/inspecionável e deve
# corresponder a um id em content.json -> rooms[<id>].objects
# ---------------------------------------------------------------------------

def vitrine(x, z, accent, item_tint, size=(0.9, 1.3, 0.9), item_scale=0.42, ry=0.0, displace=0.06, info=None):
    d = {"type": "vitrine", "position": [x, 0, z], "rotation": [0, ry, 0],
         "size": list(size), "accent": accent, "itemTint": item_tint,
         "itemScale": item_scale, "displace": displace}
    if info: d["info"] = info
    return d


def totem(x, z, accent, height=2.8, segments=4, info=None):
    d = {"type": "totem", "position": [x, 0, z], "accent": accent,
         "height": height, "segments": segments}
    if info: d["info"] = info
    return d


def cable(frm, to, sag, glow, color=None):
    d = {"type": "cable", "from": list(frm), "to": list(to), "sag": sag, "glow": glow}
    if color:
        d["color"] = color
    return d


def shard(x, y, z, tint, glow, scale=0.4, displace=0.06, info=None):
    d = {"type": "shard", "position": [x, y, z], "tint": tint, "glow": glow,
         "itemScale": scale, "displace": displace}
    if info: d["info"] = info
    return d


def mirror_shard(x, y, z, ry, tint, size=(0.9, 1.6), distort=0.05, rx=0.0, info=None):
    d = {"type": "mirror-shard", "position": [x, y, z], "rotation": [rx, ry, 0],
         "tint": tint, "size": list(size), "distort": distort}
    if info: d["info"] = info
    return d


def panel(x, y, z, ry, accent=None, line=None, size=(1.1, 1.6), opacity=0.85, info=None):
    d = {"type": "panel", "position": [x, y, z], "rotation": [0, ry, 0], "size": list(size), "opacity": opacity}
    if accent: d["accent"] = accent
    if line: d["line"] = line
    if info: d["info"] = info
    return d


def pedestal(x, z, accent, height=0.9, radius=0.32, item=None, light=6, info=None):
    d = {"type": "pedestal", "position": [x, 0, z], "accent": accent, "height": height,
         "radius": radius, "lightIntensity": light}
    if item: d["item"] = item
    if info: d["info"] = info
    return d


def bones(x, z, accent, count=8, color=None, info=None):
    d = {"type": "bones", "position": [x, 0, z], "accent": accent, "count": count}
    if color: d["color"] = color
    if info: d["info"] = info
    return d


def root_prop(x, z, accent, branches=3, ry=0.0, color=None, info=None):
    d = {"type": "root", "position": [x, 0, z], "rotation": [0, ry, 0], "accent": accent, "branches": branches}
    if color: d["color"] = color
    if info: d["info"] = info
    return d


def banner(x, z, ry, color, size=(0.8, 1.6), emissive=None, emissive_intensity=0.0, info=None):
    d = {"type": "banner", "position": [x, 0, z], "rotation": [0, ry, 0], "color": color, "size": list(size)}
    if emissive:
        d["emissive"] = emissive
        d["emissiveIntensity"] = emissive_intensity
    if info: d["info"] = info
    return d


def table_prop(x, z, size=(2.4, 0.9), height=0.78, color=None, info=None):
    d = {"type": "table", "position": [x, 0, z], "size": list(size), "height": height}
    if color: d["color"] = color
    if info: d["info"] = info
    return d


def chair_ghost(x, z, ry, accent, info=None):
    d = {"type": "chair-ghost", "position": [x, 0, z], "rotation": [0, ry, 0], "accent": accent}
    if info: d["info"] = info
    return d


def tank(x, z, radius=0.42, height=1.5, color_a=None, color_b=None, glow=None, color_deep=None, info=None):
    d = {"type": "tank", "position": [x, 0, z], "radius": radius, "height": height}
    if color_a: d["colorA"] = color_a
    if color_b: d["colorB"] = color_b
    if glow: d["glow"] = glow
    if color_deep: d["colorDeep"] = color_deep
    if info: d["info"] = info
    return d


def speaker(x, z, accent, info=None):
    d = {"type": "speaker", "position": [x, 0, z], "accent": accent}
    if info: d["info"] = info
    return d


def rock(x, y, z, radius=0.4, color=None, glow=None, info=None):
    d = {"type": "rock", "position": [x, y, z], "radius": radius}
    if color: d["color"] = color
    if glow: d["glow"] = glow
    if info: d["info"] = info
    return d


SPAWN = {"position": [0, 1.65, 8.5], "yaw": 0, "pitch": -0.04}

# ---------------------------------------------------------------------------
# salas
# ---------------------------------------------------------------------------
ROOMS = []

# ============================================================================
# 01 · GÊNESE (comum, ponto de partida)
# ============================================================================
ROOMS.append({
    "file": "sala-01-genese.html",
    "id": "sala-01-genese",
    "accent": "#0E8C86", "accent2": "#243B8F", "fog": "#03070a", "fogDensity": 0.052,
    "ambient": {"color": "#16222a", "intensity": 0.85},
    "keyLight": {"color": "#0E8C86", "intensity": 5, "position": [0, 5.5, 1]},
    "floor": {"colorDeep": "#020608", "colorA": "#0E8C86", "colorB": "#243B8F", "glow": "#B7F03B",
              "liquid": 0.78, "veins": 0.0, "crack": 0.0, "grid": 0.22, "gridScale": 0.42, "scale": 0.16},
    "fireflies": {"color": "#B7F03B", "count": 110, "drift": 0.5},
    "boundary": {"radius": 13, "glow": "#0E8C86", "height": 6.5},
    "props": [
        vitrine(-3.6, -2.0, "#0E8C86", "#0a1f1c", item_scale=0.42, info="g1"),
        vitrine(3.6, -2.6, "#4B1F68", "#160c1c", item_scale=0.4, info="g2"),
        vitrine(-5.4, -6.4, "#C9A24A", "#1a1306", size=(0.85, 1.4, 0.85), item_scale=0.46, info="g3"),
        tank(5.4, -6.4, radius=0.42, height=1.5, color_a="#0E8C86", color_b="#4B1F68", glow="#B7F03B", info="g4"),
        bones(0, -9.2, "#B7F03B", count=10, info="g5"),
        totem(-2, -3.6, "#243B8F", height=3.0, segments=4, info="g6"),
        totem(8.2, -8.6, "#0F6F5C", height=2.9, segments=4),
        cable((-6.5, 4.6, -1.5), (-2.0, 3.6, -3.4), 1.0, "#243B8F"),
        cable((2.2, 4.8, -4.4), (6.4, 3.8, -7.4), 1.2, "#4B1F68"),
        mirror_shard(6.6, 1.35, -3.2, -0.6, "#243B8F", size=(0.9, 1.6)),
        mirror_shard(-6.8, 1.15, -4.6, 0.55, "#0E8C86", size=(0.7, 1.3), rx=0.05),
    ],
    "central": {"type": "egg", "position": [0, 0, -5.2]},
    "audio": {"root": 36.7, "intensity": 0.5},
    "spawn": SPAWN,
    "showControls": True,
})

# ============================================================================
# 02a · FLORESTA FERIDA (linha A)
# ============================================================================
ROOMS.append({
    "file": "sala-02a-floresta-ferida.html",
    "id": "sala-02a-floresta-ferida",
    "accent": "#0F6F5C", "accent2": "#4B1F68", "fog": "#05080a", "fogDensity": 0.055,
    "ambient": {"color": "#10241a", "intensity": 0.85},
    "keyLight": {"color": "#B7F03B", "intensity": 4, "position": [0, 5.5, 1]},
    "floor": {"colorDeep": "#040806", "colorA": "#0F6F5C", "colorB": "#4B1F68", "glow": "#B7F03B",
              "liquid": 0.4, "veins": 0.5, "crack": 0.15, "grid": 0.2, "gridScale": 0.4, "scale": 0.18},
    "fireflies": {"color": "#B7F03B", "count": 130, "drift": 0.4},
    "boundary": {"radius": 13, "glow": "#0F6F5C", "height": 7},
    "props": [
        vitrine(-3.6, -2.2, "#0F6F5C", "#0a1408", info="fa1"),
        vitrine(3.6, -2.6, "#C9A24A", "#1a1306", info="fa2"),
        rock(-2, 0.3, -6.4, color="#1c1f1a", glow="#B7F03B", info="fa3"),
        rock(5, 0.3, -7.0, color="#1c1f1a", glow="#0F6F5C", info="fa4"),
        shard(6.4, 1.2, -3.4, "#150d08", "#C1121F", scale=0.34, info="fa5"),
        panel(-5.6, 1.7, -5.0, 0.4, accent="#B7F03B", line="#0F6F5C", info="fa6"),
        totem(-7, -3, "#B7F03B", height=3.6, segments=5),
        totem(7, -3.5, "#0F6F5C", height=4.0, segments=6),
        totem(-8, -8.6, "#0F6F5C", height=3.0, segments=4),
        totem(8, -8.8, "#B7F03B", height=3.4, segments=5),
        root_prop(-3, -2.4, "#B7F03B", branches=4),
        root_prop(0, -8.2, "#B7F03B", branches=4, ry=2.4),
        bones(2, -3.4, "#B7F03B", count=6),
    ],
    "central": {"type": "core", "position": [0, 0, -5.2]},
    "audio": {"root": 38.9, "intensity": 0.52},
    "spawn": SPAWN,
})

# ============================================================================
# 02b · INVASORES (linha B)
# ============================================================================
ROOMS.append({
    "file": "sala-02b-invasores.html",
    "id": "sala-02b-invasores",
    "accent": "#806321", "accent2": "#8A0303", "fog": "#070504", "fogDensity": 0.058,
    "ambient": {"color": "#241a10", "intensity": 0.85},
    "keyLight": {"color": "#C9A24A", "intensity": 4.5, "position": [0, 5.5, 1]},
    "floor": {"colorDeep": "#070503", "colorA": "#806321", "colorB": "#8A0303", "glow": "#C9A24A",
              "liquid": 0.3, "veins": 0.1, "crack": 0.4, "grid": 0.3, "gridScale": 0.5, "scale": 0.16},
    "fireflies": {"color": "#C9A24A", "count": 90, "drift": 0.3},
    "boundary": {"radius": 13, "glow": "#806321", "height": 6.5},
    "props": [
        vitrine(-3.6, -2.2, "#8A0303", "#160808", info="ia1"),
        vitrine(3.6, -2.6, "#C9A24A", "#1a1306", info="ia2"),
        bones(0, -3.4, "#C9A24A", count=10, info="ia3"),
        panel(5.6, 1.6, -3.6, -0.5, accent="#C9A24A", line="#8A0303", info="ia4"),
        speaker(-5.6, -3.6, "#8A0303", info="ia5"),
        banner(-6.4, -6, 0.4, "#3a2410", emissive="#C9A24A", emissive_intensity=0.12, info="ia6"),
        totem(-7.5, -3, "#8A0303", height=4.2, segments=6),
        totem(7.5, -3.4, "#8A0303", height=3.8, segments=6),
        banner(6.4, -6.4, -0.4, "#2a1c10", emissive="#8A0303", emissive_intensity=0.12),
        shard(-2, 1.2, -7.2, "#1a1006", "#C1121F", scale=0.3),
        shard(2.4, 1.0, -7.6, "#120a06", "#806321", scale=0.32),
    ],
    "central": {"type": "drill", "position": [0, 0, -5.2]},
    "audio": {"root": 34.6, "intensity": 0.55},
    "spawn": SPAWN,
})

# ============================================================================
# 02c · ESPELHOS D'ÁGUA (linha C)
# ============================================================================
ROOMS.append({
    "file": "sala-02c-espelhos-dagua.html",
    "id": "sala-02c-espelhos-dagua",
    "accent": "#243B8F", "accent2": "#4B1F68", "fog": "#03050b", "fogDensity": 0.045,
    "ambient": {"color": "#10182c", "intensity": 0.85},
    "keyLight": {"color": "#E8E1D2", "intensity": 3.2, "position": [0, 5.5, 1]},
    "floor": {"colorDeep": "#02040a", "colorA": "#243B8F", "colorB": "#4B1F68", "glow": "#E8E1D2",
              "liquid": 0.85, "veins": 0.0, "crack": 0.0, "grid": 0.18, "gridScale": 0.5, "scale": 0.12},
    "fireflies": {"color": "#E8E1D2", "count": 100, "drift": 0.5, "size": 34},
    "boundary": {"radius": 13, "glow": "#243B8F", "height": 6.5},
    "props": [
        mirror_shard(-6.6, 1.3, -4.0, 0.55, "#243B8F", info="ea1"),
        vitrine(-3.6, -2.2, "#243B8F", "#0a0e1c", info="ea2"),
        vitrine(3.6, -2.6, "#4B1F68", "#120a18", info="ea3"),
        shard(-2, 2.0, -6.4, "#0a0a12", "#E8E1D2", scale=0.22, info="ea4"),
        tank(0, -9.0, radius=0.5, height=0.5, color_a="#03050c", color_b="#243B8F", glow="#E8E1D2", info="ea5"),
        mirror_shard(6.6, 1.3, -4.4, -0.55, "#0E8C86", info="ea6"),
        mirror_shard(-5.4, 1.1, -7.4, 0.3, "#872D67", size=(0.7, 1.3)),
        mirror_shard(5.4, 1.1, -7.8, -0.3, "#4B1F68", size=(0.7, 1.3)),
        shard(1.6, 2.3, -7.2, "#0a0a12", "#E8E1D2", scale=0.2),
        shard(0, 1.8, -8.6, "#0a0a12", "#E8E1D2", scale=0.24),
    ],
    "central": {"type": "mirror", "position": [0, 0, -5.4]},
    "audio": {"root": 46.2, "intensity": 0.42},
    "spawn": SPAWN,
})

# ============================================================================
# 03a · ANIMAIS FANTASMA (linha A)
# ============================================================================
ROOMS.append({
    "file": "sala-03a-animais-fantasma.html",
    "id": "sala-03a-animais-fantasma",
    "accent": "#243B8F", "accent2": "#0E8C86", "fog": "#03070c", "fogDensity": 0.06,
    "ambient": {"color": "#121c2e", "intensity": 0.85},
    "keyLight": {"color": "#0E8C86", "intensity": 4, "position": [0, 5.5, 1]},
    "floor": {"colorDeep": "#02050a", "colorA": "#243B8F", "colorB": "#0E8C86", "glow": "#243B8F",
              "liquid": 0.5, "veins": 0.0, "crack": 0.0, "grid": 0.3, "gridScale": 0.5, "scale": 0.14},
    "fireflies": {"color": "#E8E1D2", "count": 100, "drift": 0.7, "size": 36},
    "boundary": {"radius": 13.5, "glow": "#243B8F", "height": 6},
    "props": [
        vitrine(-3.6, -2.2, "#E8E1D2", "#11141B", info="xa1"),
        vitrine(3.6, -2.6, "#0E8C86", "#0a1418", info="xa2"),
        speaker(0, -9.2, "#243B8F", info="xa3"),
        bones(0, -3.4, "#E8E1D2", count=8, info="xa4"),
        shard(-2, 1.6, -6.0, "#0a1018", "#0E8C86", scale=0.3, info="xa5"),
        panel(-6, 1.7, -5.0, 0.5, accent="#9fe7ef", line="#243B8F", info="xa6"),
        panel(6, 1.7, -5.2, -0.5, accent="#9fe7ef", line="#0E8C86"),
        mirror_shard(6.6, 1.3, -3.4, -0.6, "#243B8F"),
        mirror_shard(-6.8, 1.1, -4.6, 0.55, "#0E8C86"),
        shard(1.6, 2.0, -7.6, "#0a1018", "#243B8F", scale=0.34),
        shard(4.2, 1.4, -5.6, "#0a1018", "#E8E1D2", scale=0.28),
        totem(-8, -9, "#0E8C86", height=2.8, segments=4),
        totem(8, -8.6, "#243B8F", height=3.1, segments=4),
    ],
    "central": {"type": "jaguar", "position": [0, 0, -5.2]},
    "audio": {"root": 36.0, "intensity": 0.48},
    "spawn": SPAWN,
})

# ============================================================================
# 03b · VILA OCUPADA (linha B)
# ============================================================================
ROOMS.append({
    "file": "sala-03b-vila-ocupada.html",
    "id": "sala-03b-vila-ocupada",
    "accent": "#858B94", "accent2": "#243B8F", "fog": "#06070a", "fogDensity": 0.05,
    "ambient": {"color": "#1a1d24", "intensity": 0.85},
    "keyLight": {"color": "#858B94", "intensity": 3.6, "position": [0, 5.5, 1]},
    "floor": {"colorDeep": "#05060a", "colorA": "#858B94", "colorB": "#243B8F", "glow": "#C9A24A",
              "liquid": 0.35, "veins": 0.08, "crack": 0.25, "grid": 0.3, "gridScale": 0.4, "scale": 0.14},
    "fireflies": {"color": "#C9A24A", "count": 80, "drift": 0.3},
    "boundary": {"radius": 13, "glow": "#243B8F", "height": 6},
    "props": [
        banner(-6.4, -3, 0.3, "#3a0d12", emissive="#8A0303", emissive_intensity=0.1, info="va1"),
        chair_ghost(-2, -6.4, 0.4, "#243B8F", info="va2"),
        speaker(-5.6, -7, "#858B94", info="va3"),
        vitrine(3.6, -2.4, "#806321", "#1a1612", info="va4"),
        vitrine(-3.6, -2.2, "#0E8C86", "#0a1410", info="va5"),
        shard(0, 0.4, -3.6, "#11141b", "#858B94", scale=0.2, info="va6"),
        chair_ghost(1.2, -7.4, -0.3, "#243B8F"),
        chair_ghost(4, -5.8, 1.0, "#243B8F"),
        banner(6.4, -3.4, -0.3, "#1c1f2a", emissive="#243B8F", emissive_intensity=0.08),
        shard(5.6, 1.6, -4.4, "#120e0a", "#806321", scale=0.32),
        shard(-5.8, 1.5, -5.0, "#0c1018", "#243B8F", scale=0.3),
        panel(0, 1.6, -9.0, 0.0, accent="#858B94", line="#243B8F"),
    ],
    "central": {"type": "villa-table", "position": [0, 0, -5.0]},
    "audio": {"root": 39.0, "intensity": 0.45},
    "spawn": SPAWN,
})

# ============================================================================
# 03c · CORPO FRAGMENTADO (linha C)
# ============================================================================
ROOMS.append({
    "file": "sala-03c-corpo-fragmentado.html",
    "id": "sala-03c-corpo-fragmentado",
    "accent": "#C1121F", "accent2": "#0E8C86", "fog": "#07040a", "fogDensity": 0.05,
    "ambient": {"color": "#240e10", "intensity": 0.85},
    "keyLight": {"color": "#C1121F", "intensity": 4, "position": [0, 5.5, 1]},
    "floor": {"colorDeep": "#070306", "colorA": "#C1121F", "colorB": "#0E8C86", "glow": "#8A0303",
              "liquid": 0.5, "veins": 0.18, "crack": 0.1, "grid": 0.2, "gridScale": 0.4, "scale": 0.15},
    "fireflies": {"color": "#C1121F", "count": 90, "drift": 0.4},
    "boundary": {"radius": 12.5, "glow": "#C1121F", "height": 6},
    "props": [
        vitrine(-3.6, -2.2, "#C1121F", "#160808", info="ca1"),
        vitrine(3.6, -2.6, "#0E8C86", "#08120e", info="ca2"),
        vitrine(0, -3.6, "#872D67", "#120a14", size=(0.8, 1.2, 0.8), item_scale=0.36, info="ca3"),
        shard(-5.6, 1.4, -5.6, "#140608", "#C1121F", scale=0.34, info="ca4"),
        tank(-6, -7.6, radius=0.4, height=1.3, color_a="#1a0306", color_b="#0E8C86", glow="#C1121F", info="ca5"),
        panel(-5.6, 1.6, -3.0, 0.45, accent="#C1121F", line="#0E8C86", info="ca6"),
        shard(5.8, 1.6, -6.2, "#140608", "#0E8C86", scale=0.36),
        shard(0, 1.8, -8.6, "#140608", "#C1121F", scale=0.3),
        panel(5.8, 1.6, -3.4, -0.45, accent="#0E8C86", line="#C1121F"),
        bones(0, -9.4, "#C1121F", count=8),
    ],
    "central": {"type": "heart", "position": [0, 0, -5.2]},
    "audio": {"root": 38.0, "intensity": 0.5},
    "spawn": SPAWN,
})

# ============================================================================
# 04a · ELEMENTOS EM DESEQUILÍBRIO (linha A)
# ============================================================================
ROOMS.append({
    "file": "sala-04a-elementos.html",
    "id": "sala-04a-elementos",
    "accent": "#C9A24A", "accent2": "#4B1F68", "fog": "#06050a", "fogDensity": 0.05,
    "ambient": {"color": "#241c14", "intensity": 0.85},
    "keyLight": {"color": "#C9A24A", "intensity": 4.5, "position": [0, 5.5, 1]},
    "floor": {"colorDeep": "#06050a", "colorA": "#C9A24A", "colorB": "#4B1F68", "glow": "#C1121F",
              "liquid": 0.45, "veins": 0.2, "crack": 0.35, "grid": 0.25, "gridScale": 0.45, "scale": 0.15},
    "fireflies": {"color": "#C9A24A", "count": 110, "drift": 0.45},
    "boundary": {"radius": 13, "glow": "#C9A24A", "height": 6.5},
    "props": [
        tank(-5, -3.2, radius=0.5, height=0.6, color_a="#03070a", color_b="#243B8F", glow="#0E8C86", info="ela1"),
        pedestal(5, -3.2, "#C1121F", height=0.7, item={"tint": "#1a0808", "scale": 0.3}, info="ela2"),
        rock(-6, 1.0, -7.0, color="#2a2014", glow="#C9A24A", info="ela3"),
        rock(-2, 0.25, -6.0, color="#2a2014", glow="#C9A24A", info="ela4"),
        vitrine(3.6, -2.2, "#4B1F68", "#120a18", info="ela5"),
        vitrine(-3.6, -2.6, "#0E8C86", "#0a1418", info="ela6"),
        shard(-6.6, 1.4, -7.6, "#11141B", "#858B94", scale=0.28),
        shard(6, 1.0, -7.0, "#11141B", "#858B94", scale=0.36),
        rock(0, 0.25, -8.4, color="#2a2014", glow="#806321"),
        totem(-8, -9, "#806321", height=3.0, segments=4),
        totem(8, -8.6, "#806321", height=3.4, segments=5),
    ],
    "central": {"type": "astrolabe", "position": [0, 0, -5.2]},
    "audio": {"root": 41.2, "intensity": 0.5},
    "spawn": SPAWN,
})

# ============================================================================
# 04b · VOZES DISSIDENTES (linha B)
# ============================================================================
ROOMS.append({
    "file": "sala-04b-vozes-dissidentes.html",
    "id": "sala-04b-vozes-dissidentes",
    "accent": "#872D67", "accent2": "#8A0303", "fog": "#07050a", "fogDensity": 0.052,
    "ambient": {"color": "#220f1c", "intensity": 0.85},
    "keyLight": {"color": "#872D67", "intensity": 4.2, "position": [0, 5.5, 1]},
    "floor": {"colorDeep": "#070409", "colorA": "#872D67", "colorB": "#8A0303", "glow": "#C1121F",
              "liquid": 0.4, "veins": 0.12, "crack": 0.2, "grid": 0.22, "gridScale": 0.42, "scale": 0.15},
    "fireflies": {"color": "#C1121F", "count": 90, "drift": 0.35},
    "boundary": {"radius": 12.5, "glow": "#872D67", "height": 6},
    "props": [
        speaker(-5, -3, "#872D67", info="vd1"),
        speaker(5, -3.4, "#872D67", info="vd2"),
        vitrine(-3.6, -2.2, "#872D67", "#160a14", info="vd3"),
        vitrine(3.6, -2.6, "#C1121F", "#180808", info="vd4"),
        panel(-5.6, 1.6, -4.6, 0.5, accent="#872D67", line="#8A0303", info="vd5"),
        shard(2, 1.2, -8.0, "#100810", "#B7F03B", scale=0.28, info="vd6"),
        speaker(0, -9.0, "#8A0303"),
        banner(-6.4, -6, 0.35, "#3a0508", emissive="#8A0303", emissive_intensity=0.15),
        banner(6.4, -6.4, -0.35, "#2a0a18", emissive="#872D67", emissive_intensity=0.12),
        panel(5.8, 1.6, -5.2, -0.5, accent="#C1121F", line="#243B8F"),
        shard(-2.4, 1.0, -8.4, "#0c0a14", "#872D67", scale=0.3),
    ],
    "central": {"type": "radio", "position": [0, 0, -5.2]},
    "audio": {"root": 43.7, "intensity": 0.5},
    "spawn": SPAWN,
})

# ============================================================================
# 04c · VOZES ANCESTRAIS (linha C)
# ============================================================================
ROOMS.append({
    "file": "sala-04c-vozes-ancestrais.html",
    "id": "sala-04c-vozes-ancestrais",
    "accent": "#806321", "accent2": "#0F6F5C", "fog": "#06050a", "fogDensity": 0.052,
    "ambient": {"color": "#221c10", "intensity": 0.85},
    "keyLight": {"color": "#C9A24A", "intensity": 4, "position": [0, 5.5, 1]},
    "floor": {"colorDeep": "#060503", "colorA": "#806321", "colorB": "#0F6F5C", "glow": "#C9A24A",
              "liquid": 0.35, "veins": 0.15, "crack": 0.2, "grid": 0.25, "gridScale": 0.42, "scale": 0.15},
    "fireflies": {"color": "#C9A24A", "count": 100, "drift": 0.35},
    "boundary": {"radius": 13, "glow": "#806321", "height": 6.5},
    "props": [
        vitrine(-3.6, -2.2, "#0F6F5C", "#0a1208", info="an1"),
        vitrine(3.6, -2.6, "#C9A24A", "#1a1306", info="an2"),
        rock(-2, 0.3, -6.4, color="#241c10", glow="#0F6F5C", info="an3"),
        rock(2.4, 0.3, -7.0, color="#241c10", glow="#C9A24A", info="an4"),
        shard(5.8, 1.2, -5.4, "#120e08", "#806321", scale=0.3, info="an5"),
        speaker(0, -9.0, "#0F6F5C", info="an6"),
        totem(-7, -3, "#C9A24A", height=3.4, segments=5),
        totem(7, -3.4, "#0F6F5C", height=3.8, segments=6),
        totem(-7.6, -8, "#0F6F5C", height=3.0, segments=4),
        totem(7.6, -8.4, "#C9A24A", height=3.6, segments=5),
        speaker(0, -3.6, "#806321"),
    ],
    "central": {"type": "shell", "position": [0, 0, -5.2]},
    "audio": {"root": 36.0, "intensity": 0.46},
    "spawn": SPAWN,
})

# ============================================================================
# 05a · MÁQUINAS NO BIOMA (linha A, nova)
# ============================================================================
ROOMS.append({
    "file": "sala-05a-maquinas-bioma.html",
    "id": "sala-05a-maquinas-bioma",
    "accent": "#B06A1E", "accent2": "#0F6F5C", "fog": "#06040a", "fogDensity": 0.054,
    "ambient": {"color": "#221c10", "intensity": 0.85},
    "keyLight": {"color": "#B06A1E", "intensity": 4.4, "position": [0, 5.5, 1]},
    "floor": {"colorDeep": "#06040a", "colorA": "#B06A1E", "colorB": "#0F6F5C", "glow": "#C9A24A",
              "liquid": 0.32, "veins": 0.18, "crack": 0.32, "grid": 0.25, "gridScale": 0.45, "scale": 0.16},
    "fireflies": {"color": "#C9A24A", "count": 90, "drift": 0.3},
    "boundary": {"radius": 13, "glow": "#B06A1E", "height": 6.5},
    "props": [
        shard(-3.6, 1.6, -3.0, "#1a1006", "#B06A1E", scale=0.34, info="mb1"),
        tank(5, -3.2, radius=0.42, height=1.0, color_a="#1a0e02", color_b="#0F6F5C", glow="#B06A1E", info="mb2"),
        panel(-5.6, 1.6, -4.6, 0.5, accent="#B06A1E", line="#0F6F5C", info="mb3"),
        root_prop(2, -7.6, "#0F6F5C", branches=3, info="mb4"),
        vitrine(3.6, -2.2, "#0F6F5C", "#0a1208", info="mb5"),
        bones(0, -3.4, "#B06A1E", count=9, info="mb6"),
        totem(-7.5, -3, "#B06A1E", height=4.0, segments=6),
        totem(7.5, -8.6, "#0F6F5C", height=3.4, segments=5),
        root_prop(-2, -8.2, "#0F6F5C", branches=3, ry=2.0),
        shard(6.4, 1.2, -7.0, "#1a1006", "#806321", scale=0.3),
    ],
    "central": {"type": "core", "position": [0, 0, -5.2], "glow": "#B06A1E"},
    "audio": {"root": 32.4, "intensity": 0.55},
    "spawn": SPAWN,
})

# ============================================================================
# 05b · FOGO CRUZADO (linha B, nova)
# ============================================================================
ROOMS.append({
    "file": "sala-05b-fogo-cruzado.html",
    "id": "sala-05b-fogo-cruzado",
    "accent": "#C1121F", "accent2": "#243B8F", "fog": "#06050a", "fogDensity": 0.054,
    "ambient": {"color": "#220a0a", "intensity": 0.85},
    "keyLight": {"color": "#C1121F", "intensity": 4.4, "position": [0, 5.5, 1]},
    "floor": {"colorDeep": "#06050a", "colorA": "#C1121F", "colorB": "#243B8F", "glow": "#B7F03B",
              "liquid": 0.35, "veins": 0.2, "crack": 0.3, "grid": 0.22, "gridScale": 0.42, "scale": 0.15},
    "fireflies": {"color": "#B7F03B", "count": 100, "drift": 0.5},
    "boundary": {"radius": 13, "glow": "#C1121F", "height": 6.5},
    "props": [
        vitrine(-3.6, -2.2, "#C1121F", "#160808", info="fc1"),
        vitrine(3.6, -2.6, "#243B8F", "#0a0e1c", info="fc2"),
        shard(0, 1.8, -7.0, "#1a0608", "#B7F03B", scale=0.26, info="fc3"),
        speaker(-5.6, -3.6, "#243B8F", info="fc4"),
        banner(-6.4, -6.0, 0.35, "#3a0508", emissive="#C1121F", emissive_intensity=0.16, info="fc5"),
        bones(5.6, -7.0, "#C1121F", count=8, info="fc6"),
        banner(6.4, -6.4, -0.35, "#1c1f2a", emissive="#243B8F", emissive_intensity=0.12),
        totem(-7.5, -3, "#C1121F", height=3.8, segments=5),
        totem(7.5, -3.4, "#243B8F", height=3.6, segments=5),
        shard(-2, 0.8, -8.4, "#1a0608", "#C1121F", scale=0.24),
        shard(2.2, 0.9, -8.6, "#1a0608", "#243B8F", scale=0.26),
    ],
    "central": {"type": "astrolabe", "position": [0, 0, -5.2], "glow": "#C1121F"},
    "audio": {"root": 30.9, "intensity": 0.6},
    "spawn": SPAWN,
})

# ============================================================================
# 05c · VIAGEM CÓSMICA (linha C)
# ============================================================================
ROOMS.append({
    "file": "sala-05c-viagem-cosmica.html",
    "id": "sala-05c-viagem-cosmica",
    "accent": "#4B1F68", "accent2": "#C9A24A", "fog": "#04030a", "fogDensity": 0.04,
    "ambient": {"color": "#1a1228", "intensity": 0.85},
    "keyLight": {"color": "#C9A24A", "intensity": 3.6, "position": [0, 5.5, 1]},
    "floor": {"colorDeep": "#03020a", "colorA": "#4B1F68", "colorB": "#243B8F", "glow": "#C9A24A",
              "liquid": 0.7, "veins": 0.05, "crack": 0.0, "grid": 0.12, "gridScale": 0.35, "scale": 0.1},
    "fireflies": {"color": "#C9A24A", "count": 140, "drift": 0.6, "height": 4.5},
    "boundary": {"radius": 14, "glow": "#4B1F68", "height": 7},
    "props": [
        vitrine(-3.6, -2.2, "#4B1F68", "#100a1c", info="vc1"),
        vitrine(3.6, -2.6, "#C9A24A", "#1a1306", info="vc2"),
        rock(-4, 1.4, -4.0, radius=0.36, color="#1c1430", glow="#C9A24A", info="vc3"),
        rock(4.4, 1.8, -5.0, radius=0.4, color="#1c1430", glow="#0F6F5C", info="vc4"),
        shard(-5.6, 1.6, -6.4, "#0a0a16", "#0F6F5C", scale=0.26, info="vc5"),
        shard(5.8, 1.9, -6.8, "#0a0a16", "#C9A24A", scale=0.28, info="vc6"),
        rock(0, 2.2, -8.4, radius=0.34, color="#1c1430", glow="#C9A24A"),
        shard(-2.4, 2.4, -8.6, "#0a0a16", "#4B1F68", scale=0.24),
        shard(2.6, 2.6, -8.8, "#0a0a16", "#0E8C86", scale=0.22),
        cable((-6, 4.6, -3), (-2, 5.4, -6), -0.6, "#4B1F68"),
        cable((6, 4.8, -3.4), (2, 5.6, -6.4), -0.6, "#0E8C86"),
    ],
    "central": {"type": "constellation", "position": [0, 0, -5.4]},
    "audio": {"root": 49.0, "intensity": 0.4},
    "spawn": SPAWN,
})

# ============================================================================
# 06a · RITUAL DE ÁGUA E SANGUE (linha A)
# ============================================================================
ROOMS.append({
    "file": "sala-06a-ritual-sangue.html",
    "id": "sala-06a-ritual-sangue",
    "accent": "#8A0303", "accent2": "#0E8C86", "fog": "#080305", "fogDensity": 0.055,
    "ambient": {"color": "#240a0c", "intensity": 0.85},
    "keyLight": {"color": "#C1121F", "intensity": 4, "position": [0, 5.5, 1]},
    "floor": {"colorDeep": "#070205", "colorA": "#8A0303", "colorB": "#0E8C86", "glow": "#C1121F",
              "liquid": 0.55, "veins": 0.3, "crack": 0.05, "grid": 0.18, "gridScale": 0.4, "scale": 0.14},
    "fireflies": {"color": "#C1121F", "count": 80, "drift": 0.3},
    "boundary": {"radius": 12, "glow": "#8A0303", "height": 6},
    "props": [
        pedestal(-4.4, -3.4, "#C1121F", height=0.5, item={"tint": "#150406", "scale": 0.28}, info="rs1"),
        pedestal(4.4, -3.6, "#0E8C86", height=0.5, item={"tint": "#06120e", "scale": 0.28}, info="rs2"),
        vitrine(0, -2.4, "#E8E1D2", "#160a0c", size=(0.8, 1.0, 0.8), item_scale=0.32, info="rs3"),
        tank(-6, -7, radius=0.4, height=1.2, color_a="#04060a", color_b="#8A0303", glow="#0E8C86", info="rs4"),
        rock(-2, 0.2, -8.6, radius=0.22, color="#1a0508", glow="#C1121F", info="rs5"),
        rock(2.2, 0.2, -8.8, radius=0.22, color="#1a0508", glow="#C1121F", info="rs6"),
        tank(6, -7.4, radius=0.4, height=1.2, color_a="#04060a", color_b="#8A0303", glow="#0E8C86"),
        shard(-2.2, 0.4, -7.0, "#1a0608", "#C1121F", scale=0.24),
        shard(2.2, 0.5, -7.4, "#1a0608", "#C1121F", scale=0.26),
        cable((-3, 4.4, -1.5), (-1, 3.6, -3), 0.5, "#C1121F"),
        cable((3, 4.4, -1.5), (1, 3.6, -3), 0.5, "#C1121F"),
    ],
    "central": {"type": "bowl", "position": [0, 0, -5.0]},
    "audio": {"root": 32.7, "intensity": 0.55},
    "spawn": SPAWN,
})

# ============================================================================
# 06b · INSURREIÇÃO (linha B)
# ============================================================================
ROOMS.append({
    "file": "sala-06b-insurreicao.html",
    "id": "sala-06b-insurreicao",
    "accent": "#C1121F", "accent2": "#0F6F5C", "fog": "#06050a", "fogDensity": 0.052,
    "ambient": {"color": "#220a0a", "intensity": 0.85},
    "keyLight": {"color": "#C1121F", "intensity": 4.4, "position": [0, 5.5, 1]},
    "floor": {"colorDeep": "#050406", "colorA": "#C1121F", "colorB": "#0F6F5C", "glow": "#B7F03B",
              "liquid": 0.4, "veins": 0.22, "crack": 0.35, "grid": 0.22, "gridScale": 0.42, "scale": 0.15},
    "fireflies": {"color": "#B7F03B", "count": 120, "drift": 0.55},
    "boundary": {"radius": 13, "glow": "#C1121F", "height": 6.5},
    "props": [
        banner(-6.4, -3, 0.35, "#3a0508", emissive="#8A0303", emissive_intensity=0.18, info="ins1"),
        banner(6.4, -3.4, -0.35, "#0a1f14", emissive="#0F6F5C", emissive_intensity=0.16, info="ins2"),
        speaker(-5, -3.6, "#C1121F", info="ins3"),
        shard(-2, 0.6, -7.0, "#100808", "#0F6F5C", scale=0.3, info="ins4"),
        vitrine(0, -3.4, "#B7F03B", "#0a1206", size=(0.85, 1.1, 0.85), item_scale=0.4, info="ins5"),
        panel(5.8, 1.6, -6.4, -0.4, accent="#0F6F5C", line="#C1121F", info="ins6"),
        speaker(5, -3.8, "#0F6F5C"),
        banner(-6.8, -7.6, 0.6, "#3a0508", emissive="#C1121F", emissive_intensity=0.14),
        banner(6.8, -8, -0.6, "#0a1f14", emissive="#B7F03B", emissive_intensity=0.14),
        shard(2.2, 0.7, -7.4, "#100808", "#C1121F", scale=0.32),
        panel(-5.8, 1.6, -6.0, 0.4, accent="#C1121F", line="#0F6F5C"),
    ],
    "central": {"type": "mask", "position": [0, 0, -5.2]},
    "audio": {"root": 30.9, "intensity": 0.6},
    "spawn": SPAWN,
})

# ============================================================================
# 06c · RITUAL DE FUSÃO (linha C)
# ============================================================================
ROOMS.append({
    "file": "sala-06c-ritual-fusao.html",
    "id": "sala-06c-ritual-fusao",
    "accent": "#C9A24A", "accent2": "#872D67", "fog": "#05040a", "fogDensity": 0.045,
    "ambient": {"color": "#241a18", "intensity": 0.85},
    "keyLight": {"color": "#C9A24A", "intensity": 4.2, "position": [0, 5.5, 1]},
    "floor": {"colorDeep": "#040308", "colorA": "#C9A24A", "colorB": "#872D67", "glow": "#0E8C86",
              "liquid": 0.6, "veins": 0.15, "crack": 0.15, "grid": 0.15, "gridScale": 0.4, "scale": 0.12},
    "fireflies": {"color": "#E8E1D2", "count": 130, "drift": 0.5},
    "boundary": {"radius": 13.5, "glow": "#C9A24A", "height": 7},
    "props": [
        vitrine(-3.6, -2.2, "#0E8C86", "#0a1f1c", info="fu1"),
        vitrine(3.6, -2.6, "#C9A24A", "#1a1306", info="fu2"),
        mirror_shard(-6.6, 1.3, -4.6, 0.55, "#243B8F", info="fu3"),
        root_prop(-2, -7.2, "#0F6F5C", branches=2, info="fu4"),
        tank(0, -8.6, radius=0.45, height=1.3, color_a="#1a0306", color_b="#8A0303", glow="#C1121F", info="fu5"),
        speaker(5.6, -7, "#872D67", info="fu6"),
        shard(5.8, 1.2, -4.8, "#0c1208", "#B7F03B", scale=0.32),
        root_prop(2, -7.6, "#0F6F5C", branches=2, ry=2.0),
        totem(-8, -9, "#806321", height=3.0, segments=4),
        totem(8, -8.6, "#806321", height=3.4, segments=5),
    ],
    "central": {"type": "fusion", "position": [0, 0, -5.2]},
    "audio": {"root": 35.0, "intensity": 0.55},
    "spawn": SPAWN,
})

# ============================================================================
# 07 · LIMIAR (final, comum)
# ============================================================================
ROOMS.append({
    "file": "sala-07-final.html",
    "id": "sala-07-final",
    "accent": "#C9A24A", "accent2": "#0E8C86", "fog": "#04050a", "fogDensity": 0.042,
    "ambient": {"color": "#1c1a20", "intensity": 0.9},
    "keyLight": {"color": "#C9A24A", "intensity": 4.4, "position": [0, 5.5, 1]},
    "floor": {"colorDeep": "#04050a", "colorA": "#C9A24A", "colorB": "#243B8F", "glow": "#E8E1D2",
              "liquid": 0.65, "veins": 0.12, "crack": 0.1, "grid": 0.15, "gridScale": 0.4, "scale": 0.12},
    "fireflies": {"color": "#E8E1D2", "count": 140, "drift": 0.5},
    "boundary": {"radius": 14, "glow": "#C9A24A", "height": 7.5},
    "props": [
        vitrine(-3.6, -2.2, "#0E8C86", "#0a1f1c", info="fi1"),
        vitrine(3.6, -2.6, "#C9A24A", "#1a1306", info="fi2"),
        mirror_shard(-6.6, 1.3, -4.6, 0.55, "#243B8F", info="fi3"),
        root_prop(2, -7.6, "#0F6F5C", branches=3, info="fi4"),
        tank(0, -8.6, radius=0.45, height=1.3, color_a="#1a0306", color_b="#8A0303", glow="#C1121F", info="fi5"),
        speaker(-5.6, -7, "#872D67", info="fi6"),
        totem(-8, -9, "#806321", height=3.2, segments=5),
        totem(8, -8.6, "#0F6F5C", height=3.4, segments=5),
        mirror_shard(6.6, 1.3, -4.8, -0.55, "#0E8C86"),
    ],
    "central": {"type": "fusion", "position": [0, 0, -5.2], "scale": 1.05},
    "audio": {"root": 35.0, "intensity": 0.5},
    "spawn": SPAWN,
})


# ---------------------------------------------------------------------------
# template / escrita dos arquivos
# ---------------------------------------------------------------------------
TEMPLATE = """<!doctype html>
<html lang="pt-BR" data-room="{room_id}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>OROЯO</title>
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

    initRoom({config_json});
  </script>
</body>
</html>
"""


def write_room(data):
    config = {k: v for k, v in data.items() if k != 'file'}
    html = TEMPLATE.format(
        room_id=data['id'],
        config_json=json.dumps(config, ensure_ascii=False, indent=2),
    )
    path = os.path.join(ROOMS_DIR, data['file'])
    with open(path, 'w', encoding='utf-8') as f:
        f.write(html)
    print('wrote', path)


if __name__ == '__main__':
    os.makedirs(ROOMS_DIR, exist_ok=True)
    for r in ROOMS:
        write_room(r)
    print(f'{len(ROOMS)} salas geradas.')
