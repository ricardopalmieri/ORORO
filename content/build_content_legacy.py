#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gera content/ororo-content.json: TODO o texto da experiência OROЯO,
em português e inglês, em um único arquivo editável.

Estrutura:
{
  "ui": { "pt": {...}, "en": {...} },
  "rooms": {
    "<room-id>": {
      "stage": 1..7,
      "name": {"pt": "...", "en": "..."},
      "objects": { "<info-id>": {"title": {pt,en}, "body": {pt,en}} },
      "central": {
        "title": {pt,en}, "body": {pt,en},
        "choices": [ {"verb": {pt,en}, "detail": {pt,en}, "rastro": {...}, "next": "...", "reset": bool} ]
      }
    }
  }
}

Rodar: python3 build_content.py  (gera ./ororo-content.json)
"""
import json
import os

ROOT = os.path.dirname(os.path.abspath(__file__))


def t(pt, en):
    return {"pt": pt, "en": en}


def obj(title_pt, title_en, body_pt, body_en):
    return {"title": t(title_pt, title_en), "body": t(body_pt, body_en)}


def choice(verb_pt, verb_en, detail_pt, detail_en, rastro, next_room, reset=False):
    d = {"verb": t(verb_pt, verb_en), "detail": t(detail_pt, detail_en), "rastro": rastro, "next": next_room}
    if reset:
        d["reset"] = True
    return d


# ---------------------------------------------------------------------------
# UI / sistema
# ---------------------------------------------------------------------------
UI = {
    "pt": {
        "brand": "OROЯO",
        "start_tagline": "GALERIA DIGITAL · TERRITÓRIO CONTAMINADO",
        "start_enter": "ENTRAR",
        "start_lang": "IDIOMA",
        "start_sound_on": "SOM ATIVADO",
        "start_sound_off": "SOM DESATIVADO",
        "enter_prompt": "TOQUE PARA ENTRAR",
        "controls": "WASD MOVER · ARRASTAR OLHAR · TOQUE INSPECIONAR",
        "mute": "SILENCIAR SOM",
        "unmute": "ATIVAR SOM",
        "close": "FECHAR",
        "reset_label": "APAGAR RASTROS",
        "rastros_title": "RASTROS",
        "stage_of": "DE",
        "exit_label": "SAIR",
        "a11y_title": "ACESSIBILIDADE",
        "choices_label": "ESCOLHA UM VERBO",
        "rastros": {
            "oleo": "ÓLEO", "sangue": "SANGUE", "raiz": "RAIZ", "ouro": "OURO",
            "espelho": "ESPELHO", "voz": "VOZ", "cinza": "CINZA",
        },
    },
    "en": {
        "brand": "OROЯO",
        "start_tagline": "DIGITAL GALLERY · CONTAMINATED TERRITORY",
        "start_enter": "ENTER",
        "start_lang": "LANGUAGE",
        "start_sound_on": "SOUND ON",
        "start_sound_off": "SOUND OFF",
        "enter_prompt": "TAP TO ENTER",
        "controls": "WASD MOVE · DRAG LOOK · TAP INSPECT",
        "mute": "MUTE SOUND",
        "unmute": "UNMUTE SOUND",
        "close": "CLOSE",
        "reset_label": "CLEAR TRACES",
        "rastros_title": "TRACES",
        "stage_of": "OF",
        "exit_label": "EXIT",
        "a11y_title": "ACCESSIBILITY",
        "choices_label": "CHOOSE A VERB",
        "rastros": {
            "oleo": "OIL", "sangue": "BLOOD", "raiz": "ROOT", "ouro": "GOLD",
            "espelho": "MIRROR", "voz": "VOICE", "cinza": "ASH",
        },
    },
}

# ---------------------------------------------------------------------------
# salas
# ---------------------------------------------------------------------------
ROOMS = {}

# ---- 01 · GÊNESE (comum, ponto de partida) --------------------------------
ROOMS["sala-01-genese"] = {
    "stage": 1,
    "name": t("GÊNESE", "GENESIS"),
    "objects": {
        "g1": obj("ESCAMA", "SCALE",
                  "Fragmento de escama preso em resina. Contaminação registrada, origem não localizada. "
                  "Sob a luz certa muda de cor, como óleo sobre a água. A ficha do sistema termina numa palavra riscada.",
                  "Scale fragment held in resin. Contamination logged, origin unlocated. "
                  "Under the right light it shifts color, like oil on water. The system's label ends on a crossed-out word."),
        "g2": obj("PELO", "FUR",
                  "Pelo de onça em resina industrial. A espécie está ausente do registro atual, dada como extinta em três arquivos e viva em um. "
                  "A textura guarda calor que a sala não tem.",
                  "Jaguar fur in industrial resin. The species is absent from the current record, listed extinct in three archives and alive in one. "
                  "The texture holds a warmth the room does not have."),
        "g3": obj("METAL", "METAL",
                  "Liga dourada corroída. O peso está acima do esperado para o tamanho, como se guardasse algo dentro. "
                  "Foi minério antes de ser objeto, e território antes de ser minério.",
                  "Corroded gold alloy. Its weight exceeds what its size suggests, as if it held something inside. "
                  "It was ore before it was object, and territory before it was ore."),
        "g4": obj("ÁGUA", "WATER",
                  "Água do rio, selada numa coluna de vidro. O reflexo não corresponde ao ambiente ao redor. "
                  "Quem se aproxima demais aparece atrasado na superfície, um segundo depois do corpo.",
                  "River water, sealed in a glass column. Its reflection does not match the room around it. "
                  "Whoever leans too close appears late on the surface, a second behind the body."),
        "g5": obj("ARQUIVO", "ARCHIVE",
                  "Ossos de peixe soldados a um circuito ativo. Sinal fraco e contínuo, sempre a mesma frase curta. "
                  "É memória de um bioma gravada em hardware, um arquivo que ninguém sabe abrir.",
                  "Fish bones fused to a live circuit. Faint, continuous signal, always the same short phrase. "
                  "It is a biome's memory recorded onto hardware, an archive no one knows how to open."),
        "g6": obj("CABO", "CABLE",
                  "Cabo descendo do teto até a água. Não conduz eletricidade, conduz som. "
                  "Encoste o ouvido perto e a sala inteira parece passar por ali, filtrada e grave.",
                  "Cable hanging from ceiling to water. It carries no current, only sound. "
                  "Bring your ear close and the whole room seems to pass through it, filtered and low."),
    },
    "central": {
        "title": t("OVO OLEOSO", "OILY EGG"),
        "body": t("Coberto de óleo, gira devagar sobre a água parada e devolve, distorcido, o nome OROЯO. "
                  "É o começo de tudo e já está contaminado. Cada volta oferece uma abertura diferente para o mesmo território.",
                  "Coated in oil, it turns slowly over still water and returns the name OROЯO, distorted. "
                  "It is the beginning of everything and already contaminated. Each turn offers a different opening into the same territory."),
        "choices": [
            choice("ABSORVER", "ABSORB", "o óleo entra pela pele", "the oil enters the skin",
                   {"oleo": 2}, "sala-02a-floresta-ferida.html"),
            choice("SEGUIR O REFLEXO", "FOLLOW THE REFLECTION", "a imagem se move primeiro", "the image moves first",
                   {"espelho": 2}, "sala-02c-espelhos-dagua.html"),
            choice("DESCER", "DESCEND", "o fundo guarda outra temperatura", "the riverbed holds another temperature",
                   {"cinza": 1, "oleo": 1}, "sala-02b-invasores.html"),
        ],
    },
}

# ---- 02a · FLORESTA FERIDA (linha A) ---------------------------------------
ROOMS["sala-02a-floresta-ferida"] = {
    "stage": 2,
    "name": t("FLORESTA FERIDA", "WOUNDED FOREST"),
    "objects": {
        "fa1": obj("RAIZ", "ROOT",
                   "Raiz encapsulada em acrílico. Pulso elétrico contínuo, função desconhecida. "
                   "Cresceu para dentro do sensor que deveria medi-la, e agora os dois pulsam juntos.",
                   "Root encased in acrylic. Continuous electric pulse, function unknown. "
                   "It grew into the sensor meant to measure it, and now the two pulse together."),
        "fa2": obj("FOLHA", "LEAF",
                   "Folha queimada com veios dourados. Combustão controlada em laboratório, segundo a etiqueta. "
                   "A borda ainda solta um cheiro fino de fumaça quando a sala esquenta.",
                   "Burnt leaf with golden veins. Controlled combustion in a lab, per the label. "
                   "Its edge still gives off a thin smell of smoke when the room warms."),
        "fa3": obj("INSCRIÇÃO A", "INSCRIPTION A",
                   "Pedra com símbolos recentes. A tradução foi recusada pelo sistema três vezes. "
                   "Parece escrita à mão sobre uma escrita mais antiga, uma memória por cima da outra.",
                   "Stone with recent symbols. Translation refused by the system three times. "
                   "It looks handwritten over an older writing, one memory laid across another."),
        "fa4": obj("INSCRIÇÃO B", "INSCRIPTION B",
                   "Segunda pedra, mesma família de símbolos, sinal mais fraco. "
                   "O padrão continua a inscrição anterior, mas falta um pedaço no meio, como fala interrompida.",
                   "Second stone, same family of symbols, weaker signal. "
                   "The pattern continues the first inscription, but a piece is missing in the middle, like speech cut off."),
        "fa5": obj("ESPÉCIME", "SPECIMEN",
                   "Restos de animal com circuito interno, bateria ainda ativa. "
                   "Metade corpo, metade máquina, e nenhuma das metades sabe que a outra parou.",
                   "Animal remains with an internal circuit, battery still active. "
                   "Half body, half machine, and neither half knows the other has stopped."),
        "fa6": obj("TELA", "SCREEN",
                   "Tela vertical mostra raízes pulsando como cabos de fibra óptica. "
                   "A imagem é ao vivo. Em algum lugar abaixo do piso, isso está acontecendo agora.",
                   "Vertical screen shows roots pulsing like fiber optic cables. "
                   "The image is live. Somewhere below the floor, this is happening now."),
    },
    "central": {
        "title": t("NÚCLEO DO TRONCO", "TRUNK CORE"),
        "body": t("Um tronco oco abriga uma luz vermelha pulsante. Parece coração, forno e servidor ao mesmo tempo. "
                  "A floresta virou infraestrutura, a natureza virou sistema. O que pulsa aqui ainda não decidiu se está vivo.",
                  "A hollow trunk holds a pulsing red light. Part heart, part furnace, part server. "
                  "The forest became infrastructure, nature became system. What pulses here has not yet decided whether it is alive."),
        "choices": [
            choice("OUVIR A RAIZ", "LISTEN TO THE ROOT", "o som sobe antes da imagem", "sound rises before image",
                   {"raiz": 2, "voz": 1}, "sala-03a-animais-fantasma.html"),
            choice("TOCAR A CINZA", "TOUCH THE ASH", "ainda está morna", "still warm",
                   {"cinza": 2}, "sala-03c-corpo-fragmentado.html"),
            choice("ALIMENTAR O FUNGO", "FEED THE FUNGUS", "o brilho muda de tom", "the glow shifts tone",
                   {"raiz": 1, "oleo": 1}, "sala-03b-vila-ocupada.html"),
        ],
    },
}

# ---- 02b · INVASORES (linha B) --------------------------------------------
ROOMS["sala-02b-invasores"] = {
    "stage": 2,
    "name": t("INVASORES", "INVADERS"),
    "objects": {
        "ia1": obj("ARMAS", "WEAPONS",
                   "Armas desmontadas, sem número de série, procedência apagada. "
                   "Foram limpas com cuidado antes de virarem peça de museu. Alguém quis que continuassem prontas.",
                   "Disassembled weapons, no serial number, provenance erased. "
                   "They were cleaned with care before becoming museum pieces. Someone wanted them kept ready."),
        "ia2": obj("MAPA", "MAP",
                   "Pepitas de réplica e um mapa de rotas. A escala não confere com o terreno. "
                   "As linhas vão todas para o mesmo ponto, e esse ponto está desenhado por cima de uma aldeia.",
                   "Replica nuggets and a route map. The scale does not match the terrain. "
                   "The lines all lead to one point, and that point is drawn over a village."),
        "ia3": obj("OSSOS", "BONES",
                   "Ossos misturados a fragmentos de ouro, datações divergentes. "
                   "O sistema não consegue dizer o que veio antes, o corpo ou o metal que o cercou.",
                   "Bones mixed with gold fragments, conflicting datings. "
                   "The system cannot say which came first, the body or the metal that surrounded it."),
        "ia4": obj("DOCUMENTO", "DOCUMENT",
                   "Contrato ilegível, três assinaturas, nenhuma identificável. "
                   "O papel foi dobrado e desdobrado tantas vezes que o texto sumiu justo nas cláusulas.",
                   "Illegible contract, three signatures, none identifiable. "
                   "The paper was folded and unfolded so many times that the text vanished right at the clauses."),
        "ia5": obj("MÁQUINA", "MACHINE",
                   "Perfuratriz desligada, vibração residual ainda registrada. "
                   "O chão em volta guarda a marca circular de anos de trabalho. A máquina parou, o buraco não.",
                   "Drill switched off, residual vibration still recorded. "
                   "The floor around it holds the circular mark of years of work. The machine stopped, the hole did not."),
        "ia6": obj("BANDEIRA", "FLAG",
                   "Tecido marcado por fumaça, símbolo parcialmente apagado. "
                   "Sobrou o suficiente para saber que era uma bandeira, não o bastante para saber de quem.",
                   "Fabric marked by smoke, symbol partially erased. "
                   "Enough survived to know it was a flag, not enough to know whose."),
    },
    "central": {
        "title": t("BROCA DOURADA", "GOLDEN DRILL"),
        "body": t("Suspensa por uma corrente, gira devagar, coberta por sangue seco e óleo. "
                  "É ferramenta e troféu ao mesmo tempo. Abriu o território, e agora está exposta como se fosse a obra e não a ferida.",
                  "Hanging from a chain, it turns slowly, covered in dried blood and oil. "
                  "It is tool and trophy at once. It opened the territory, and now it hangs on display as if it were the artwork and not the wound."),
        "choices": [
            choice("SABOTAR", "SABOTAGE", "uma peça sai do lugar", "a part comes loose",
                   {"cinza": 1, "sangue": 1}, "sala-03b-vila-ocupada.html"),
            choice("INFILTRAR", "INFILTRATE", "você veste o silêncio do lugar", "you wear the place's silence",
                   {"espelho": 1, "ouro": 1}, "sala-03a-animais-fantasma.html"),
            choice("ESPELHAR O INIMIGO", "MIRROR THE ENEMY", "a broca reflete seu rosto", "the drill reflects your face",
                   {"espelho": 2, "ouro": 1}, "sala-03c-corpo-fragmentado.html"),
        ],
    },
}

# ---- 02c · ESPELHOS D'ÁGUA (linha C) --------------------------------------
ROOMS["sala-02c-espelhos-dagua"] = {
    "stage": 2,
    "name": t("ESPELHOS D'ÁGUA", "WATER MIRRORS"),
    "objects": {
        "ea1": obj("ESPELHO CÔNCAVO", "CONCAVE MIRROR",
                   "Distorce a imagem para dentro, calibração desconhecida. "
                   "Quem se olha aqui aparece menor e mais fundo, puxado para o centro do vidro.",
                   "Distorts the image inward, calibration unknown. "
                   "Whoever looks appears smaller and deeper, pulled toward the center of the glass."),
        "ea2": obj("FOTOGRAFIA", "PHOTOGRAPH",
                   "Imagem borrada, três sobreposições visíveis. "
                   "São três momentos do mesmo lugar impressos juntos, e nenhum deles combina com este.",
                   "Blurred image, three overlays visible. "
                   "Three moments of the same place printed together, and none of them matches this one."),
        "ea3": obj("PELE TRANSLÚCIDA", "TRANSLUCENT SKIN",
                   "Material com padrão de escama, toque não recomendado. "
                   "Deixa passar a luz e um pouco da imagem de quem está atrás, como um corpo meio presente.",
                   "Material with a scale pattern, touch not advised. "
                   "It lets through light and a little of the image behind it, like a body half present."),
        "ea4": obj("FRAGMENTO Я", "Я FRAGMENT",
                   "Caractere isolado, origem tipográfica não registrada. "
                   "É a letra virada do nome OROЯO. Sozinha, aponta para o lado errado, como um reflexo que escapou da palavra.",
                   "Isolated character, typographic origin unrecorded. "
                   "It is the reversed letter from the name OROЯO. Alone, it points the wrong way, like a reflection that escaped the word."),
        "ea5": obj("BACIA", "BASIN",
                   "Água parada, superfície plana, o reflexo chega atrasado. "
                   "Mexa a mão sobre ela e a imagem responde depois, no seu próprio tempo.",
                   "Still water, flat surface, the reflection arrives late. "
                   "Move a hand over it and the image answers afterward, in its own time."),
        "ea6": obj("CACO", "SHARD",
                   "Vidro rachado, reflexo incompleto. "
                   "Cada pedaço mostra uma parte de quem olha, e as partes não fecham num rosto só.",
                   "Cracked glass, incomplete reflection. "
                   "Each piece shows part of whoever looks, and the parts do not close into a single face."),
    },
    "central": {
        "title": t("ESPELHO LÍQUIDO", "LIQUID MIRROR"),
        "body": t("Vertical, deforma o nome OROЯO a cada pulso. Nenhuma versão se repete. "
                  "É água de pé, uma parede que reflete e escorre ao mesmo tempo. Quem atravessa não volta idêntico ao que era.",
                  "Vertical, it warps the name OROЯO with every pulse. No version repeats. "
                  "It is standing water, a wall that reflects and runs at once. Whoever crosses does not return identical to what they were."),
        "choices": [
            choice("ATRAVESSAR", "CROSS THROUGH", "a superfície cede como água espessa", "the surface yields like thick water",
                   {"espelho": 2}, "sala-03c-corpo-fragmentado.html"),
            choice("QUEBRAR", "BREAK", "a rachadura se espalha sem som", "the crack spreads in silence",
                   {"espelho": 1, "sangue": 1}, "sala-03b-vila-ocupada.html"),
            choice("OLHAR", "KEEP LOOKING", "a imagem demora e já chega outra", "the image is slow, and arrives changed",
                   {"espelho": 1, "cinza": 1}, "sala-03a-animais-fantasma.html"),
        ],
    },
}

# ---- 03a · ANIMAIS FANTASMA (linha A) -------------------------------------
ROOMS["sala-03a-animais-fantasma"] = {
    "stage": 3,
    "name": t("ANIMAIS FANTASMA", "GHOST ANIMALS"),
    "objects": {
        "xa1": obj("CRÂNIO 7", "SKULL 7",
                   "Crânio suspenso, espécie não catalogada. "
                   "O número foi escrito à mão sobre o osso. Antes dele havia outro número, ainda visível por baixo.",
                   "Suspended skull, species not catalogued. "
                   "The number was handwritten onto the bone. Before it there was another number, still visible beneath."),
        "xa2": obj("CRÂNIO 12", "SKULL 12",
                   "Segundo crânio, fratura compatível com captura. "
                   "É parente do primeiro, marcado do mesmo jeito. Foram guardados juntos e catalogados como coisas separadas.",
                   "Second skull, fracture consistent with capture. "
                   "It is kin to the first, marked the same way. They were kept together and catalogued as separate things."),
        "xa3": obj("REGISTRO", "RECORDING",
                   "Arquivo sonoro de espécie ausente, em loop. "
                   "É a única coisa que restou viva do bicho, um som repetindo num aparelho que não sabe o que guarda.",
                   "Sound archive of an absent species, looping. "
                   "It is the only thing left alive of the animal, a sound repeating in a device that does not know what it holds."),
        "xa4": obj("RASTRO", "TRACK",
                   "Marca de garra em metal, profundidade incomum. "
                   "Algo com muita força passou por uma parede que deveria ser dura demais para guardar rastros.",
                   "Claw mark in metal, unusual depth. "
                   "Something with great strength crossed a wall that should have been too hard to hold tracks."),
        "xa5": obj("MEMBRANA", "MEMBRANE",
                   "Fragmento translúcido, reage à luz direta. "
                   "Quando iluminado, mostra por dentro um desenho de veias que continua se movendo devagar.",
                   "Translucent fragment, reacts to direct light. "
                   "When lit, it reveals inside a pattern of veins that keeps moving slowly."),
        "xa6": obj("TELA", "SCREEN",
                   "Projeções de cardumes cruzam a parede. "
                   "Os peixes nadam contra o canto e desaparecem, e outro cardume nasce do mesmo ponto, sem parar.",
                   "Projections of fish swarms cross the wall. "
                   "The fish swim into the corner and vanish, and another swarm is born from the same point, without stopping."),
    },
    "central": {
        "title": t("ONÇA DE FUMAÇA", "SMOKE JAGUAR"),
        "body": t("Feita de fumaça e pixels, não ataca. Observa, e a sala gira devagar ao redor dela. "
                  "É o animal que sumiu do território voltando como imagem. Presença sem corpo, memória que aprendeu a andar.",
                  "Made of smoke and pixels, it does not attack. It watches, and the room turns slowly around it. "
                  "It is the animal that vanished from the territory, returning as image. Presence without a body, memory that learned to walk."),
        "choices": [
            choice("SEGUIR", "FOLLOW", "ela anda sem deixar marca", "it walks leaving no trace",
                   {"espelho": 1, "voz": 1}, "sala-04a-elementos.html"),
            choice("LIBERTAR O CARDUME", "RELEASE THE SHOAL", "as projeções se espalham pelas paredes", "the projections spread across the walls",
                   {"raiz": 1, "espelho": 1}, "sala-04c-vozes-ancestrais.html"),
            choice("VESTIR A PELE", "WEAR THE SKIN", "seu contorno fica translúcido", "your outline turns translucent",
                   {"espelho": 2, "cinza": 1}, "sala-04b-vozes-dissidentes.html"),
        ],
    },
}

# ---- 03b · VILA OCUPADA (linha B) ------------------------------------------
ROOMS["sala-03b-vila-ocupada"] = {
    "stage": 3,
    "name": t("VILA OCUPADA", "OCCUPIED VILLAGE"),
    "objects": {
        "va1": obj("BANDEIRA", "FLAG",
                   "Tecido rasgado, símbolo parcial. "
                   "Foi feita à mão, com linha de outra cor nas emendas. Quem costurou sabia que ela ia durar pouco.",
                   "Torn fabric, partial symbol. "
                   "It was made by hand, with thread of another color at the seams. Whoever sewed it knew it would not last long."),
        "va2": obj("CADEIRA", "CHAIR",
                   "Lugar vazio à mesa. O assento ainda guarda a forma de um peso. "
                   "A madeira está gasta só de um lado, o lado por onde a pessoa se levantava todo dia.",
                   "Empty seat at the table. It still holds the shape of a weight. "
                   "The wood is worn on one side only, the side the person rose from every day."),
        "va3": obj("RÁDIO", "RADIO",
                   "Sintonia perdida, ruído constante, talvez intencional. "
                   "De vez em quando, dentro da estática, uma voz quase forma uma palavra, e some antes de terminar.",
                   "Lost frequency, constant noise, perhaps intentional. "
                   "Now and then, inside the static, a voice almost forms a word, and fades before it finishes."),
        "va4": obj("RETRATO", "PORTRAIT",
                   "Moldura vazia, verso parcialmente queimado. "
                   "A foto não está aqui. Restou o retângulo mais claro na parede, onde ela protegeu a tinta do tempo.",
                   "Empty frame, back partially burnt. "
                   "The photo is not here. What remains is the lighter rectangle on the wall, where it shielded the paint from time."),
        "va5": obj("TECIDO", "FABRIC",
                   "Bordado com coordenadas. O ponto marcado não existe em nenhum mapa. "
                   "Alguém guardou um lugar dentro de um pano, um endereço que só o corpo de quem bordou sabia chegar.",
                   "Embroidered with coordinates. The marked point exists on no map. "
                   "Someone kept a place inside a cloth, an address only the body that stitched it knew how to reach."),
        "va6": obj("MARCA", "MARK",
                   "Vestígio de corrente no chão, função não confirmada. "
                   "O desenho no piso repete a distância exata de um passo curto, o passo de quem andava preso a algo.",
                   "Trace of a chain on the floor, function unconfirmed. "
                   "The pattern on the floor repeats the exact length of a short step, the step of someone bound to something."),
    },
    "central": {
        "title": t("MESA DOS AUSENTES", "TABLE OF THE ABSENT"),
        "body": t("Três lugares vazios. Sobre a mesa, uma concha, uma garra e um documento queimado. "
                  "O jantar foi posto e ninguém veio, ou vieram e foram levados. A ausência aqui tem forma, peso e lugar reservado.",
                  "Three empty seats. On the table, a shell, a claw, and a burnt document. "
                  "The meal was set and no one came, or they came and were taken. Absence here has shape, weight, and a seat reserved."),
        "choices": [
            choice("SENTAR", "SIT", "a cadeira aceita seu peso", "the chair accepts your weight",
                   {"voz": 1, "cinza": 1}, "sala-04b-vozes-dissidentes.html"),
            choice("ROUBAR O DOCUMENTO", "TAKE THE DOCUMENT", "o papel queimado resiste", "the burnt paper resists",
                   {"ouro": 2}, "sala-04a-elementos.html"),
            choice("CHAMAR OS AUSENTES", "CALL THE ABSENT", "o ar muda de densidade", "the air changes density",
                   {"voz": 2, "espelho": 1}, "sala-04c-vozes-ancestrais.html"),
        ],
    },
}

# ---- 03c · CORPO FRAGMENTADO (linha C) ------------------------------------
ROOMS["sala-03c-corpo-fragmentado"] = {
    "stage": 3,
    "name": t("CORPO FRAGMENTADO", "FRAGMENTED BODY"),
    "objects": {
        "ca1": obj("PRÓTESE", "PROSTHESIS",
                   "Peça articulada, compatível com membro ausente. "
                   "Foi feita para um corpo específico. As dobras já estão gastas no lugar exato onde ele usava mais.",
                   "Articulated piece, compatible with a missing limb. "
                   "It was made for one specific body. The joints are already worn in the exact place it was used most."),
        "ca2": obj("GARRA", "CLAW",
                   "Réplica em escala real, microfraturas na superfície. "
                   "Não é osso nem metal. É uma terceira coisa, feita para lembrar as duas ao mesmo tempo.",
                   "Full scale replica, microfractures on the surface. "
                   "It is neither bone nor metal. It is a third thing, made to recall both at once."),
        "ca3": obj("ÓRGÃO", "ORGAN",
                   "Estrutura sem correspondência anatômica conhecida. "
                   "Tem entradas e saídas, mas nenhum manual. Pulsa como se ainda esperasse ser ligada a um corpo.",
                   "Structure with no known anatomical match. "
                   "It has inputs and outputs, but no manual. It pulses as if still waiting to be joined to a body."),
        "ca4": obj("TECIDO", "TISSUE",
                   "Amostra muscular com luz própria, pulso constante. "
                   "A luz acompanha o pulso e o pulso não para. Foi separada do corpo e não recebeu o aviso.",
                   "Muscle sample with its own light, constant pulse. "
                   "The light follows the pulse and the pulse does not stop. It was cut from the body and never got the message."),
        "ca5": obj("GEL", "GEL",
                   "Cultura em suspensão, crescimento lento e contínuo. "
                   "Toma devagar a forma do frasco. Se trocarem o frasco, ela recomeça sem se lembrar da forma anterior.",
                   "Culture in suspension, slow, continuous growth. "
                   "It slowly takes the shape of its jar. Change the jar and it starts over, with no memory of the earlier shape."),
        "ca6": obj("DIAGRAMA", "DIAGRAM",
                   "Mapa corporal com órgãos fora de posição. "
                   "As setas ligam partes que não deviam se ligar. Talvez seja um erro, talvez seja outro corpo.",
                   "Body map with organs out of position. "
                   "The arrows connect parts that should not connect. Maybe it is a mistake, maybe it is another body."),
    },
    "central": {
        "title": t("CORAÇÃO HÍBRIDO", "HYBRID HEART"),
        "body": t("Metade músculo, metade concha, pulsa dentro de uma cápsula. O ritmo muda perto de alguém. "
                  "Bate mais rápido quando há corpo por perto, como se reconhecesse. É montagem de restos, e mesmo assim reage.",
                  "Half muscle, half shell, it beats inside a capsule. The rhythm shifts when someone is near. "
                  "It quickens when a body approaches, as if it recognized. It is an assembly of remains, and still it responds."),
        "choices": [
            choice("RECOMPOR", "RECOMPOSE", "as peças se aproximam sem encaixar de vez", "the pieces come close without fully fitting",
                   {"raiz": 1, "ouro": 1}, "sala-04c-vozes-ancestrais.html"),
            choice("AMPUTAR", "AMPUTATE", "uma parte segue pulsando, separada", "one part keeps beating, separate",
                   {"sangue": 2}, "sala-04b-vozes-dissidentes.html"),
            choice("MULTIPLICAR", "MULTIPLY", "o coração se divide em quatro imagens", "the heart divides into four images",
                   {"espelho": 2, "sangue": 1}, "sala-04a-elementos.html"),
        ],
    },
}

# ---- 04a · ELEMENTOS EM DESEQUILÍBRIO (linha A) ---------------------------
ROOMS["sala-04a-elementos"] = {
    "stage": 4,
    "name": t("ELEMENTOS EM DESEQUILÍBRIO", "ELEMENTS OUT OF BALANCE"),
    "objects": {
        "ela1": obj("ÁGUA NEGRA", "BLACK WATER",
                    "Bacia de água preta, temperatura abaixo do esperado. "
                    "Não reflete o teto. Olha de volta como se o fundo fosse mais profundo do que a sala permite.",
                    "Basin of black water, temperature below expectation. "
                    "It does not reflect the ceiling. It looks back as if its bottom were deeper than the room allows."),
        "ela2": obj("FOGO CONTIDO", "CONTAINED FIRE",
                    "Chama sob vidro, consumo de oxigênio monitorado. "
                    "Queima sem fumaça e sem diminuir. Alguém calculou exatamente o quanto de ar dar para que nunca acabe.",
                    "Flame under glass, oxygen consumption monitored. "
                    "It burns without smoke and without shrinking. Someone calculated exactly how much air to give so it never ends."),
        "ela3": obj("VENTO", "WIND",
                    "Sensores de corrente de ar, direção muda sem padrão. "
                    "Há vento numa sala fechada. Vem de lugar nenhum e insiste, como se fugisse de algo lá dentro.",
                    "Airflow sensors, direction shifts without pattern. "
                    "There is wind in a sealed room. It comes from nowhere and insists, as if fleeing something inside."),
        "ela4": obj("TERRA", "EARTH",
                    "Areia sob vibração constante, origem do sinal desconhecida. "
                    "Os grãos se organizam em linhas e desmancham. A terra desenha e apaga um mapa que ninguém pediu.",
                    "Sand under constant vibration, signal origin unknown. "
                    "The grains arrange into lines and collapse. The earth draws and erases a map no one asked for."),
        "ela5": obj("MONITOR", "MONITOR",
                    "Dados de um clima que não corresponde a este lugar. "
                    "Marca chuva quando está seco, calor quando está frio. Mede um território que talvez ainda vá existir.",
                    "Climate data that does not match this place. "
                    "It reads rain when it is dry, heat when it is cold. It measures a territory that maybe is yet to exist."),
        "ela6": obj("AMOSTRA", "SAMPLE",
                    "Pó dourado, peso instável na balança. "
                    "O número sobe e desce sozinho. O ouro aqui não decide quanto pesa, e a balança já desistiu de brigar.",
                    "Golden dust, unstable weight on the scale. "
                    "The number rises and falls on its own. The gold here will not decide how much it weighs, and the scale has given up arguing."),
    },
    "central": {
        "title": t("ASTROLÁBIO ORGÂNICO", "ORGANIC ASTROLABE"),
        "body": t("Meio máquina, meio concha, muda de cor a cada escolha feita aqui. "
                  "Foi feito para ler o céu e acabou lendo quem chega. Aponta sempre para o próximo desequilíbrio, nunca para o repouso.",
                  "Half machine, half shell, it changes color with every choice made here. "
                  "It was built to read the sky and ended up reading whoever arrives. It always points to the next imbalance, never to rest."),
        "choices": [
            choice("QUEIMAR", "BURN", "o calor sobe rápido e desce devagar", "heat rises fast and falls slowly",
                   {"cinza": 2}, "sala-05b-fogo-cruzado.html"),
            choice("INUNDAR", "FLOOD", "a água preta cobre os símbolos", "black water covers the symbols",
                   {"oleo": 2}, "sala-05c-viagem-cosmica.html"),
            choice("RESPIRAR", "BREATHE", "o ar muda de direção ao redor", "the air changes direction around you",
                   {"voz": 1, "raiz": 1}, "sala-05a-maquinas-bioma.html"),
        ],
    },
}

# ---- 04b · VOZES DISSIDENTES (linha B) ------------------------------------
ROOMS["sala-04b-vozes-dissidentes"] = {
    "stage": 4,
    "name": t("VOZES DISSIDENTES", "DISSIDENT VOICES"),
    "objects": {
        "vd1": obj("ALTO-FALANTE A", "SPEAKER A",
                   "Emite estática em intervalos regulares. "
                   "Dentro do ruído há um ritmo, sempre o mesmo. Não é falha do aparelho, é alguém batendo do outro lado.",
                   "Emits static at regular intervals. "
                   "Inside the noise there is a rhythm, always the same. It is not a fault in the device, it is someone knocking from the other side."),
        "vd2": obj("ALTO-FALANTE B", "SPEAKER B",
                   "Segunda unidade, fora de sincronia com a primeira. "
                   "As duas quase se encontram e nunca fecham. O desencontro entre elas produz uma terceira frase que nenhuma diz sozinha.",
                   "Second unit, out of sync with the first. "
                   "The two almost meet and never close. The gap between them makes a third phrase that neither says alone."),
        "vd3": obj("MÁSCARA", "MASK",
                   "Material misto, ajuste para múltiplos rostos. "
                   "Serve em qualquer um e não guarda ninguém. Foi feita para que a voz importasse mais que a cara.",
                   "Mixed material, fitted for multiple faces. "
                   "It fits anyone and holds no one. It was made so the voice would matter more than the face."),
        "vd4": obj("KIT DE SUTURA", "SUTURE KIT",
                   "Agulhas, linhas e prótese parcial, uso recorrente. "
                   "Consertaram o mesmo ponto muitas vezes. O reparo virou parte do corpo, mais firme que o original.",
                   "Needles, thread, partial prosthesis, recurring use. "
                   "The same spot was mended many times. The repair became part of the body, firmer than the original."),
        "vd5": obj("CARTAZ", "POSTER",
                   "Sem slogan legível, camadas de cola sugerem reuso. "
                   "Por baixo do último cartaz há dezenas de outros. A parede virou arquivo de tudo que já foi gritado ali.",
                   "No legible slogan, layers of glue suggest reuse. "
                   "Under the last poster there are dozens more. The wall became an archive of everything already shouted there."),
        "vd6": obj("AMULETO", "AMULET",
                   "Componente costurado ao tecido, pulso intermitente. "
                   "É metade reza, metade circuito. Foi feito para proteger de algo que só aparece quando ele acende.",
                   "Component stitched into the fabric, intermittent pulse. "
                   "It is half prayer, half circuit. It was made to protect against something that only appears when it lights up."),
    },
    "central": {
        "title": t("RÁDIO-ORÁCULO", "ORACLE RADIO"),
        "body": t("Transmite vozes fragmentadas, sobrepostas, numa língua que muda antes de se fixar. "
                  "Fala em muitas bocas ao mesmo tempo e não repete. Quem escuta reconhece uma palavra e a perde no momento em que entende.",
                  "Transmits fragmented, overlapping voices, in a language that shifts before it settles. "
                  "It speaks in many mouths at once and never repeats. Whoever listens catches a word and loses it the moment they understand."),
        "choices": [
            choice("TRANSMITIR", "TRANSMIT", "sua voz se mistura às outras", "your voice blends with the others",
                   {"voz": 2}, "sala-05b-fogo-cruzado.html"),
            choice("COSTURAR", "STITCH", "a linha atravessa o tecido", "the thread crosses the fabric",
                   {"sangue": 1, "raiz": 1}, "sala-05a-maquinas-bioma.html"),
            choice("ORGANIZAR", "ORGANIZE", "os objetos formam outra ordem", "the objects form another order",
                   {"voz": 1, "ouro": 1}, "sala-05c-viagem-cosmica.html"),
        ],
    },
}

# ---- 04c · VOZES ANCESTRAIS (linha C) -------------------------------------
ROOMS["sala-04c-vozes-ancestrais"] = {
    "stage": 4,
    "name": t("VOZES ANCESTRAIS", "ANCESTRAL VOICES"),
    "objects": {
        "an1": obj("FITA", "TAPE",
                   "Fita magnética deformada, trecho recuperável, sentido incerto. "
                   "O calor entortou o plástico e a voz junto. O que sobra é a entonação, sem as palavras que a sustentavam.",
                   "Warped magnetic tape, recoverable segment, uncertain meaning. "
                   "Heat bent the plastic and the voice with it. What remains is the intonation, without the words that held it up."),
        "an2": obj("CONCHA", "SHELL",
                   "Concha com captação interna, ressonância acima do esperado. "
                   "Guardou o som de uma água que secou. Encostada ao ouvido, devolve um mar que não existe mais aqui.",
                   "Shell with internal pickup, resonance above expectation. "
                   "It kept the sound of a water that dried up. Held to the ear, it gives back a sea that no longer exists here."),
        "an3": obj("INSCRIÇÃO C", "INSCRIPTION C",
                   "Símbolos gravados, padrão repetido em outros lugares. "
                   "A mesma marca aparece em salas distantes. É assinatura ou aviso, deixado por quem passou antes por todo o percurso.",
                   "Engraved symbols, pattern repeated elsewhere. "
                   "The same mark appears in distant rooms. It is a signature or a warning, left by whoever passed through the whole path before."),
        "an4": obj("INSCRIÇÃO D", "INSCRIPTION D",
                   "Variante do mesmo símbolo, profundidade maior. "
                   "Foi cavada com mais força, ou com mais tempo. A pressa da primeira inscrição virou insistência nesta.",
                   "Variant of the same symbol, greater depth. "
                   "It was cut with more force, or more time. The haste of the first inscription became insistence in this one."),
        "an5": obj("NÓ DE TECIDO", "FABRIC KNOT",
                   "Tecido amarrado em padrão específico, função mnemônica provável. "
                   "Cada nó guarda um dado que só o corpo lê, passando o dedo. É um arquivo que não precisa de tela.",
                   "Fabric tied in a specific pattern, likely mnemonic function. "
                   "Each knot holds a piece of data only the body reads, running a finger over it. It is an archive with no need for a screen."),
        "an6": obj("ALTO-FALANTE", "SPEAKER",
                   "Emite pulsos graves em intervalos irregulares. "
                   "O grave é sentido antes de ser ouvido, no peito. Chega como batida de tambor que perdeu a pele.",
                   "Emits low pulses at irregular intervals. "
                   "The low end is felt before it is heard, in the chest. It arrives like a drumbeat that lost its skin."),
    },
    "central": {
        "title": t("CONCHA-AMPLIFICADOR", "AMPLIFIER SHELL"),
        "body": t("Suspensa, emite pulsos baixos. Cada um carrega uma sílaba que nunca termina. "
                  "É a escuta feita objeto, uma boca de pedra que só sabe começar a falar. O sentido fica sempre a uma sílaba de distância.",
                  "Suspended, it emits low pulses. Each one carries a syllable that never ends. "
                  "It is listening made object, a mouth of stone that only knows how to begin. Meaning stays always one syllable away."),
        "choices": [
            choice("ESCUTAR", "LISTEN", "o som entra antes do sentido", "sound enters before meaning",
                   {"voz": 2, "raiz": 1}, "sala-05c-viagem-cosmica.html"),
            choice("GRAVAR", "RECORD", "o pulso muda a cada repetição", "the pulse changes with each repetition",
                   {"voz": 1, "ouro": 1}, "sala-05a-maquinas-bioma.html"),
            choice("SILENCIAR", "SILENCE", "o que sobra tem peso", "what remains has weight",
                   {"cinza": 2}, "sala-05b-fogo-cruzado.html"),
        ],
    },
}

# ---- 05a · MÁQUINAS NO BIOMA (linha A, nova) -------------------------------
ROOMS["sala-05a-maquinas-bioma"] = {
    "stage": 5,
    "name": t("MÁQUINAS NO BIOMA", "MACHINES IN THE BIOME"),
    "objects": {
        "mb1": obj("MOTOSSERRA", "CHAINSAW",
                   "Suspensa por um cabo, lâmina parada a meio corte. "
                   "O tronco em volta continua a marca do dente. Faltou um segundo para terminar, e esse segundo virou exposição.",
                   "Hung from a cable, blade frozen mid cut. "
                   "The trunk around it still shows the tooth's mark. It was one second short of finishing, and that second became display."),
        "mb2": obj("DIESEL", "DIESEL",
                   "Tambor furado. O líquido escuro ainda escorre devagar. "
                   "A poça no chão não seca nem cresce. Fica do mesmo tamanho, alimentada por um vazamento sem fim.",
                   "Punctured drum. The dark liquid still drips slowly. "
                   "The pool on the floor neither dries nor grows. It stays the same size, fed by a leak without end."),
        "mb3": obj("PAINEL", "PANEL",
                   "Painel de controle da extração, indicadores piscam sem padrão. "
                   "Ninguém opera e mesmo assim ele decide. As luzes obedecem a uma lógica que já não precisa de mão humana.",
                   "Extraction control panel, indicators blink without pattern. "
                   "No one operates it and still it decides. The lights obey a logic that no longer needs a human hand."),
        "mb4": obj("RAIZ ARRANCADA", "TORN ROOT",
                   "Raiz cortada, ainda emite um pulso fraco. "
                   "Foi separada da terra e não parou de mandar sinal. Chama por uma árvore que já não está ali para responder.",
                   "Severed root, still emitting a faint pulse. "
                   "It was torn from the ground and never stopped sending signal. It calls for a tree that is no longer there to answer."),
        "mb5": obj("ESTEIRA", "CONVEYOR",
                   "Trecho de esteira parado, coberto por lama escura. "
                   "Levava o território embora aos pedaços, um por vez. Parou cheia, com a última carga ainda no lugar.",
                   "Section of conveyor belt at rest, covered in dark mud. "
                   "It carried the territory away in pieces, one at a time. It stopped full, with the last load still in place."),
        "mb6": obj("RESTOS", "REMAINS",
                   "Pequenos ossos misturados a parafusos e fios. "
                   "O bicho e a máquina foram triturados juntos. Agora é impossível dizer onde termina um e começa o outro.",
                   "Small bones mixed with bolts and wires. "
                   "The animal and the machine were ground together. Now it is impossible to say where one ends and the other begins."),
    },
    "central": {
        "title": t("MOTOR-TRONCO", "ENGINE TRUNK"),
        "body": t("Um tronco oco abriga um motor ainda quente. Bate como um coração que aprendeu a queimar combustível. "
                  "A floresta foi refeita como máquina, e a máquina imita a floresta. Nenhuma das duas sabe mais qual era a original.",
                  "A hollow trunk holds a still warm engine. It beats like a heart that learned to burn fuel. "
                  "The forest was remade as machine, and the machine mimics the forest. Neither one still knows which was the original."),
        "choices": [
            choice("DESLIGAR", "SHUT DOWN", "o silêncio chega devagar", "silence arrives slowly",
                   {"raiz": 2, "cinza": 1}, "sala-06a-ritual-sangue.html"),
            choice("INCENDIAR", "SET ALIGHT", "o calor se espalha sem chama visível", "heat spreads with no visible flame",
                   {"cinza": 2, "sangue": 1}, "sala-06b-insurreicao.html"),
            choice("ENRAIZAR", "RE-ROOT", "o metal aceita a raiz de volta", "the metal accepts the root again",
                   {"raiz": 2, "oleo": 1}, "sala-06c-ritual-fusao.html"),
        ],
    },
}

# ---- 05b · FOGO CRUZADO (linha B, nova) ------------------------------------
ROOMS["sala-05b-fogo-cruzado"] = {
    "stage": 5,
    "name": t("FOGO CRUZADO", "CROSSFIRE"),
    "objects": {
        "fc1": obj("TOCHA", "TORCH",
                   "Chama presa no ar, combustível ainda gotejando. "
                   "O fogo foi congelado no meio de um gesto. Ainda dá para ver a mão que o carregava, ausente logo atrás.",
                   "Flame frozen in the air, fuel still dripping. "
                   "The fire was frozen mid gesture. You can still make out the hand that carried it, absent just behind."),
        "fc2": obj("ESCUDO", "SHIELD",
                   "Placa de metal amassada, marcas de impacto recentes. "
                   "Cada amassado é de um lado diferente. Foi usado por muitas mãos, contra muitas direções, no mesmo dia.",
                   "Dented metal plate, recent impact marks. "
                   "Each dent comes from a different side. It was held by many hands, against many directions, on the same day."),
        "fc3": obj("PROJÉTIL", "PROJECTILE",
                   "Suspenso a meio caminho, trajetória interrompida. "
                   "Parou entre quem atirou e quem levaria. O meio do caminho virou o lugar mais quieto da sala.",
                   "Suspended mid flight, trajectory interrupted. "
                   "It stopped between the one who fired and the one who would be hit. The middle of its path became the quietest place in the room."),
        "fc4": obj("RÁDIO TÁTICO", "TACTICAL RADIO",
                   "Transmite ordens cruzadas, dois lados na mesma frequência. "
                   "As vozes se contradizem sem se ouvir. Cada lado acha que fala sozinho, e os dois mandam avançar.",
                   "Transmits crossed orders, both sides on the same frequency. "
                   "The voices contradict each other without listening. Each side thinks it speaks alone, and both order the advance."),
        "fc5": obj("BARRICADA", "BARRICADE",
                   "Estrutura improvisada, ainda fumegando. "
                   "Feita de móveis, portas e o que tinha por perto. Uma casa desmontada às pressas para virar parede.",
                   "Improvised structure, still smoking. "
                   "Made of furniture, doors, and whatever was near. A home taken apart in haste to become a wall."),
        "fc6": obj("CAPACETE", "HELMET",
                   "Capacete amassado, sem identificação. "
                   "Protegeu uma cabeça e perdeu o dono no mesmo instante. Serve para os dois lados, e por isso não diz de qual era.",
                   "Dented helmet, no identification. "
                   "It shielded a head and lost its owner in the same instant. It fits both sides, and so it will not say which it was."),
    },
    "central": {
        "title": t("ESFERA DE TRÉGUA", "TRUCE SPHERE"),
        "body": t("Uma esfera de vidro guarda fumaça presa no centro. Gira devagar entre os dois lados. "
                  "É a pausa feita objeto, o instante em que ninguém atira. Frágil como vidro, e por enquanto ninguém a quebrou.",
                  "A glass sphere holds smoke trapped at its center. It turns slowly between both sides. "
                  "It is the pause made object, the instant when no one fires. Fragile as glass, and for now no one has broken it."),
        "choices": [
            choice("ATIRAR", "FIRE", "o som chega antes do gesto", "the sound arrives before the gesture",
                   {"sangue": 2}, "sala-06b-insurreicao.html"),
            choice("ABAIXAR AS ARMAS", "LOWER WEAPONS", "as mãos pesam mais que o metal", "hands weigh more than metal",
                   {"voz": 1, "raiz": 1}, "sala-06a-ritual-sangue.html"),
            choice("FUGIR", "FLEE", "o caminho se abre na fumaça", "a path opens in the smoke",
                   {"cinza": 1, "espelho": 1}, "sala-06c-ritual-fusao.html"),
        ],
    },
}

# ---- 05c · VIAGEM CÓSMICA (linha C) ----------------------------------------
ROOMS["sala-05c-viagem-cosmica"] = {
    "stage": 5,
    "name": t("VIAGEM CÓSMICA", "COSMIC VOYAGE"),
    "objects": {
        "vc1": obj("MAPA CELESTE", "STAR MAP",
                   "Mapa rasurado à mão. As constelações não correspondem ao céu atual. "
                   "Alguém redesenhou as estrelas para caberem outra história. As linhas antigas ainda aparecem por baixo.",
                   "Hand marked map. The constellations do not match the current sky. "
                   "Someone redrew the stars to fit another story. The old lines still show underneath."),
        "vc2": obj("ASTRO LÍQUIDO", "LIQUID STAR",
                   "Esfera em suspensão, núcleo móvel, comportamento de fluido. "
                   "É uma estrela que esqueceu de ser sólida. Muda de forma devagar, procurando um centro que não fica quieto.",
                   "Suspended sphere, moving core, fluid behaviour. "
                   "It is a star that forgot to be solid. It shifts shape slowly, seeking a center that will not stay still."),
        "vc3": obj("FRAGMENTO ORBITAL", "ORBITAL FRAGMENT",
                   "Peça de satélite coberta por musgo, órbita decadente. "
                   "Foi lançada para vigiar a Terra e a Terra a cobriu de volta. O verde tomou a máquina que a olhava de cima.",
                   "Satellite piece covered in moss, decaying orbit. "
                   "It was launched to watch the Earth and the Earth grew back over it. Green took the machine that watched from above."),
        "vc4": obj("CORAL ESPACIAL", "SPACE CORAL",
                   "Estrutura mineral com crescimento orgânico. "
                   "Cresce como coral e brilha como circuito. Não se sabe se é fóssil do futuro ou semente de outro planeta.",
                   "Mineral structure with organic growth. "
                   "It grows like coral and glows like a circuit. No one knows if it is a fossil of the future or a seed from another planet."),
        "vc5": obj("CABO FLUTUANTE", "FLOATING CABLE",
                   "Sem ponto de ancoragem visível, tensão constante. "
                   "As duas pontas somem no escuro. Está esticado como se segurasse algo pesado que a sala não mostra.",
                   "No visible anchor point, constant tension. "
                   "Both ends vanish into the dark. It is pulled taut as if it held something heavy the room does not show."),
        "vc6": obj("POEIRA", "DUST",
                   "Partículas suspensas, brilho intermitente. "
                   "Cada grão acende e apaga fora de tempo com os outros. Junto, formam devagar o desenho de um bicho, e desmancham.",
                   "Suspended particles, intermittent glow. "
                   "Each grain lights and fades out of time with the rest. Together they slowly form the shape of an animal, and scatter."),
    },
    "central": {
        "title": t("CONSTELAÇÃO ONÇA-SEREIA", "JAGUAR-MERMAID CONSTELLATION"),
        "body": t("Móvel e instável, desenha e desfaz a silhueta de uma onça-sereia, sem nunca completar a forma. "
                  "É o bicho que junta floresta e água, projetado no escuro como se fosse céu. Fica sempre a um traço de existir.",
                  "Mobile and unstable, it draws and undoes the shape of a jaguar-mermaid, never complete. "
                  "It is the animal that joins forest and water, cast on the dark as if it were sky. It stays always one stroke short of existing."),
        "choices": [
            choice("DISSOLVER", "DISSOLVE", "sua silhueta se mistura à constelação", "your silhouette blends into the constellation",
                   {"espelho": 1, "cinza": 1}, "sala-06c-ritual-fusao.html"),
            choice("ORBITAR", "ORBIT", "você gira sem se aproximar", "you circle without getting closer",
                   {"oleo": 1, "espelho": 1}, "sala-06a-ritual-sangue.html"),
            choice("CAIR", "FALL BACK", "o chão, quando chega, parece outro", "the ground, when it arrives, feels different",
                   {"raiz": 1, "sangue": 1}, "sala-06b-insurreicao.html"),
        ],
    },
}

# ---- 06a · RITUAL DE ÁGUA E SANGUE (linha A) -------------------------------
ROOMS["sala-06a-ritual-sangue"] = {
    "stage": 6,
    "name": t("RITUAL DE ÁGUA E SANGUE", "RITUAL OF WATER AND BLOOD"),
    "objects": {
        "rs1": obj("TIGELA A", "BOWL A",
                   "Tigela rasa, resíduo escuro no fundo. "
                   "O que ficou secou em anéis, um por vez. Cada anel marca uma vez em que ela foi usada e esvaziada.",
                   "Shallow bowl, dark residue at the bottom. "
                   "What was left dried in rings, one at a time. Each ring marks a time it was used and emptied."),
        "rs2": obj("TIGELA B", "BOWL B",
                   "Segunda tigela, líquido diferente, temperatura elevada. "
                   "Está morna sem fonte de calor. Guarda o calor de um corpo que encostou aqui há pouco tempo.",
                   "Second bowl, different liquid, elevated temperature. "
                   "It is warm with no source of heat. It holds the warmth of a body that touched here not long ago."),
        "rs3": obj("TECIDO", "CLOTH",
                   "Tecido molhado com mancha irregular, não foi limpo de propósito. "
                   "A mancha é a única escrita que sobrou do ato. Lavar seria apagar, e alguém escolheu guardar.",
                   "Wet cloth with an irregular stain, left unclean on purpose. "
                   "The stain is the only writing the act left behind. To wash it would be to erase, and someone chose to keep it."),
        "rs4": obj("VASO", "VESSEL",
                   "Água escura, superfície parada, reflexo não condiz com a sala. "
                   "Mostra um teto que não é este. Talvez o teto do lugar onde a água foi tirada, guardado dentro dela.",
                   "Dark water, still surface, reflection does not match the room. "
                   "It shows a ceiling that is not this one. Maybe the ceiling of the place the water was drawn from, kept inside it."),
        "rs5": obj("MARCA CIRCULAR", "CIRCULAR MARK",
                   "Marca no chão, diâmetro constante, repetida em outros pontos. "
                   "Os círculos se alinham numa rota pela sala. Quem os fez andava sempre o mesmo caminho, sempre parando nos mesmos lugares.",
                   "Mark on the floor, constant diameter, repeated elsewhere. "
                   "The circles line up into a route through the room. Whoever made them walked the same path, always stopping at the same places."),
        "rs6": obj("PEDRA VERMELHA", "RED STONE",
                   "Pedra lisa, quente ao toque. "
                   "Foi gasta de tanto ser segurada. A cor não é tinta, é o que ela absorveu de tudo que passou pela mão de quem a usava.",
                   "Smooth stone, warm to the touch. "
                   "It was worn smooth from being held. The color is not paint, it is what it soaked up from all that passed through the hand that used it."),
    },
    "central": {
        "title": t("BACIA NEGRA", "BLACK BASIN"),
        "body": t("Uma gota vermelha cai em loop e se transforma em iridescência antes de sumir. "
                  "Sangue vira óleo vira ouro, e recomeça. É o ritual reduzido ao mínimo gesto, repetido até virar imagem que não pede explicação.",
                  "A red drop falls in a loop, turning iridescent before it disappears. "
                  "Blood becomes oil becomes gold, and starts again. It is ritual reduced to the smallest gesture, repeated until it becomes an image that asks for no explanation."),
        "choices": [
            choice("SANGRAR", "BLEED", "escrever com o corpo", "writing with the body",
                   {"sangue": 2}, "sala-07-final.html"),
            choice("LAVAR", "WASH", "limpa e mancha ao mesmo tempo", "it cleans and stains at once",
                   {"oleo": 1, "espelho": 1}, "sala-07-final.html"),
            choice("BEBER", "DRINK", "o gosto muda depois de engolir", "the taste changes after swallowing",
                   {"sangue": 1, "raiz": 1}, "sala-07-final.html"),
        ],
    },
}

# ---- 06b · INSURREIÇÃO (linha B) -------------------------------------------
ROOMS["sala-06b-insurreicao"] = {
    "stage": 6,
    "name": t("INSURREIÇÃO", "INSURRECTION"),
    "objects": {
        "ins1": obj("BANDEIRA A", "FLAG A",
                    "Tecido rasgado, símbolo parcialmente visível. "
                    "O rasgo não é do tempo, é de uso. Foi puxada de muitas mãos ao mesmo tempo e resistiu.",
                    "Torn fabric, symbol partly visible. "
                    "The tear is not from time, it is from use. It was pulled by many hands at once and held."),
        "ins2": obj("BANDEIRA B", "FLAG B",
                    "Segunda bandeira, cor diferente, mesmo rasgo. "
                    "Foi feita depois da primeira, copiando até o dano. O gesto virou modelo, o modelo virou movimento.",
                    "Second flag, different color, same tear. "
                    "It was made after the first, copying even the damage. The gesture became a template, the template became a movement."),
        "ins3": obj("TAMBOR", "DRUM",
                    "Membrana de metal, vibração ainda perceptível. "
                    "Encoste a mão e sente o último toque, ainda vivo no material. O ritmo não terminou, só ficou baixo demais para ouvir.",
                    "Metal membrane, vibration still perceptible. "
                    "Touch it and feel the last beat, still alive in the material. The rhythm did not end, it only dropped too low to hear."),
        "ins4": obj("BARRICADA", "BARRICADE",
                    "Pedaço de estrutura, marcas de impacto recentes. "
                    "Foi feita para segurar e segurou. As marcas contam de que lado veio a força, e de que lado ela parou.",
                    "Piece of structure, recent impact marks. "
                    "It was made to hold and it held. The marks tell which side the force came from, and which side it stopped."),
        "ins5": obj("OBJETOS", "OBJECTS",
                    "Conjunto de pequenos itens, nenhum identificado. "
                    "São coisas de bolso, deixadas juntas às pressas. Cada uma pertenceu a um corpo que precisou ter as mãos livres.",
                    "Set of small items, none identified. "
                    "They are pocket things, left together in haste. Each one belonged to a body that needed its hands free."),
        "ins6": obj("PROJEÇÃO", "PROJECTION",
                    "Sombra de corpo em movimento, sem fonte aparente. "
                    "A sombra anda sem quem a faça. Repete o mesmo gesto de erguer algo, de novo e de novo, sem cansar.",
                    "Shadow of a moving body, no apparent source. "
                    "The shadow walks with no one to cast it. It repeats the same gesture of raising something, again and again, without tiring."),
    },
    "central": {
        "title": t("MÁSCARA COLETIVA", "COLLECTIVE MASK"),
        "body": t("Muitas faces se sobrepõem nesta máscara enorme. Nenhuma é a principal, e todas se movem juntas. "
                  "É o rosto que a multidão faz quando decide ter um só. Cabe em qualquer um e não devolve nenhuma cara sozinha.",
                  "Many faces overlap in this enormous mask. None is the main one, and all move together. "
                  "It is the face a crowd makes when it decides to have just one. It fits anyone and gives back no single face alone."),
        "choices": [
            choice("ERGUER", "RAISE", "a sala parece responder ao gesto", "the room seems to answer the gesture",
                   {"ouro": 1, "voz": 1}, "sala-07-final.html"),
            choice("INCENDIAR", "SET ALIGHT", "o ar fica mais pesado", "the air grows heavier",
                   {"cinza": 2, "sangue": 1}, "sala-07-final.html"),
            choice("DESAPARECER", "DISAPPEAR", "seu contorno se perde nas sombras", "your outline is lost in the shadows",
                   {"espelho": 2, "voz": 1}, "sala-07-final.html"),
        ],
    },
}

# ---- 06c · RITUAL DE FUSÃO (linha C) ---------------------------------------
ROOMS["sala-06c-ritual-fusao"] = {
    "stage": 6,
    "name": t("RITUAL DE FUSÃO", "RITUAL OF FUSION"),
    "objects": {
        "fu1": obj("FRAGMENTO ÓLEO", "OIL FRAGMENT",
                   "Resíduo da primeira sala, ainda muda de cor. "
                   "Atravessou todo o percurso sem secar. Guarda, em pequena escala, o brilho de onde tudo começou.",
                   "Residue from the first room, still changing color. "
                   "It crossed the whole path without drying. It keeps, in small scale, the shine of where everything began."),
        "fu2": obj("FRAGMENTO OURO", "GOLD FRAGMENT",
                   "Liga corroída, peso inalterado. "
                   "Perdeu o brilho e não perdeu a gravidade. Continua puxando para baixo com a mesma força de sempre.",
                   "Corroded alloy, weight unchanged. "
                   "It lost its shine and not its gravity. It keeps pulling down with the same force as always."),
        "fu3": obj("FRAGMENTO ESPELHO", "MIRROR FRAGMENT",
                   "Vidro rachado, reflexo incompleto. "
                   "Mostra só um pedaço de quem olha, sempre o mesmo pedaço. Escolheu qual parte de você vai lembrar.",
                   "Cracked glass, incomplete reflection. "
                   "It shows only a piece of whoever looks, always the same piece. It chose which part of you it will remember."),
        "fu4": obj("FRAGMENTO RAIZ", "ROOT FRAGMENT",
                   "Estrutura orgânica com circuito ativo. "
                   "Continua crescendo mesmo cortada em pedaço. Procura terra dentro de uma vitrine, e não desiste.",
                   "Organic structure with an active circuit. "
                   "It keeps growing even cut to a fragment. It searches for soil inside a display case, and does not give up."),
        "fu5": obj("FRAGMENTO SANGUE", "BLOOD FRAGMENT",
                   "Líquido em suspensão, cor instável. "
                   "Muda de tom conforme quem chega. Reconhece corpo e responde, guardando a memória de cada aproximação.",
                   "Liquid in suspension, unstable color. "
                   "It shifts tone with whoever arrives. It recognizes a body and answers, keeping the memory of each approach."),
        "fu6": obj("FRAGMENTO VOZ", "VOICE FRAGMENT",
                   "Pequeno alto-falante repete uma sílaba. "
                   "É o resto de uma palavra que se perdeu pelo caminho. Insiste na única parte dela que sobreviveu à travessia.",
                   "Small speaker repeats a single syllable. "
                   "It is the remainder of a word lost along the way. It insists on the only part of it that survived the crossing."),
    },
    "central": {
        "title": t("OROЯO INCOMPLETA", "INCOMPLETE OROЯO"),
        "body": t("Formada por partículas de todas as salas, gira devagar, incompleta por escolha. "
                  "Junta óleo, ouro, raiz, sangue, espelho e voz numa silhueta que se recusa a fechar. Estar inteira seria parar, e ela ainda se move.",
                  "Formed from particles of every room, it turns slowly, incomplete by choice. "
                  "It gathers oil, gold, root, blood, mirror, and voice into a silhouette that refuses to close. To be whole would be to stop, and it is still moving."),
        "choices": [
            choice("FUNDIR", "MERGE", "os fragmentos encontram um encaixe possível", "the fragments find a possible fit",
                   {"raiz": 1, "ouro": 1}, "sala-07-final.html"),
            choice("DIVIDIR", "DIVIDE", "a silhueta se multiplica", "the silhouette multiplies",
                   {"espelho": 1, "voz": 1}, "sala-07-final.html"),
            choice("RENASCER", "BE REBORN", "tudo recua até um ponto anterior", "everything recedes to an earlier point",
                   {"cinza": 1, "oleo": 1}, "sala-07-final.html"),
        ],
    },
}

# ---- 07 · LIMIAR (final, comum) --------------------------------------------
ROOMS["sala-07-final"] = {
    "stage": 7,
    "name": t("LIMIAR", "THRESHOLD"),
    "objects": {
        "fi1": obj("ÓLEO", "OIL",
                   "O primeiro brilho ainda está aqui, sob a poeira. "
                   "É o mesmo óleo do ovo da gênese, mais velho e mais quieto. Reconhece quem chegou até aqui.",
                   "The first shine is still here, under the dust. "
                   "It is the same oil from the egg of the genesis, older and quieter. It recognizes whoever made it this far."),
        "fi2": obj("OURO", "GOLD",
                   "O peso não diminuiu. "
                   "Carregou o percurso inteiro e continua pesando o mesmo. O que ele guarda dentro não se gasta com a viagem.",
                   "The weight has not lessened. "
                   "It bore the whole journey and still weighs the same. What it holds inside does not wear down with the crossing."),
        "fi3": obj("ESPELHO", "MIRROR",
                   "Cada caco mostra uma versão diferente do mesmo rosto. "
                   "São todas as escolhas feitas no caminho, guardadas em pedaços de vidro. Juntas, ainda não fecham numa cara só.",
                   "Each shard shows a different version of the same face. "
                   "They are all the choices made along the way, kept in pieces of glass. Together, they still do not close into one face."),
        "fi4": obj("RAIZ", "ROOT",
                   "Continua crescendo, mesmo aqui. "
                   "Chegou ao fim do percurso e não parou. Procura, no limiar, uma terra que talvez esteja do outro lado.",
                   "Still growing, even here. "
                   "It reached the end of the path and did not stop. At the threshold, it searches for a soil that maybe lies on the other side."),
        "fi5": obj("SANGUE", "BLOOD",
                   "A cor muda conforme alguém se aproxima. "
                   "Guardou a memória de cada corpo que passou pelas salas. Diante de você, escolhe um tom que só você viu.",
                   "The color shifts as someone approaches. "
                   "It kept the memory of every body that passed through the rooms. Before you, it picks a tone only you have seen."),
        "fi6": obj("VOZ", "VOICE",
                   "Repete, baixinho, tudo o que foi dito nas salas anteriores. "
                   "É o arquivo do percurso inteiro, falado sem parar. Reconhece as suas escolhas entre todas as outras.",
                   "Quietly repeats everything said in the rooms before. "
                   "It is the archive of the whole crossing, spoken without pause. It knows your choices among all the others."),
    },
    "central": {
        "title": t("OROЯO", "OROЯO"),
        "body": t("Uma silhueta incompleta, feita de tudo o que foi absorvido, recusado e transformado até aqui. "
                  "Ela tem a sua forma, montada com os rastros que você deixou. No limiar, decide se o percurso recomeça ou se dissolve em outro.",
                  "An incomplete silhouette, made of everything absorbed, refused, and transformed so far. "
                  "It has your shape, assembled from the traces you left. At the threshold, it decides whether the crossing starts over or dissolves into another."),
        "choices": [
            choice("RECOMEÇAR", "START OVER", "a água volta a ficar lisa", "the water turns smooth again",
                   {}, "sala-01-genese.html", reset=True),
            choice("DISSOLVER", "DISSOLVE", "você se torna parte de outro percurso", "you become part of another crossing",
                   {"espelho": 1}, "../index.html"),
        ],
    },
}

# ---------------------------------------------------------------------------
DATA = {"ui": UI, "rooms": ROOMS}

if __name__ == "__main__":
    out_path = os.path.join(ROOT, "ororo-content.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(DATA, f, ensure_ascii=False, indent=2)
    print("wrote", out_path, "-", len(ROOMS), "rooms")
