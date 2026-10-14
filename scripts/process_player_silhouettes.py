/**
 * Script para procesar las fotos de jugadores:
 * 1. Siluetea al jugador quitando el fondo con rembg (IA)
 * 2. Genera un fondo blanco nítido
 * 3. Coloca el escudo del club del jugador grande y semitransparente (38% de opacidad)
 * 4. Coloca la silueta del jugador en primer plano
 * 5. Guarda el resultado optimizado
 */

import os
import sys
import json
import re
from PIL import Image
import rembg

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    players_dir = os.path.join(base_dir, 'public', 'players')
    crests_dir = os.path.join(base_dir, 'public', 'crests_clean')
    teams_file = os.path.join(base_dir, 'src', 'data', 'scraped_teams.json')
    scraped_players_file = os.path.join(base_dir, 'src', 'data', 'scraped_players.js')
    default_crest_path = os.path.join(base_dir, 'public', 'logo_seleccio.png')

    print("Cargando información de equipos y jugadores...")
    teams = json.load(open(teams_file, 'r', encoding='utf-8'))
    # Mapeo por ID y por Nombre de equipo
    team_crests = {}
    for t in teams:
        cid = t.get('id')
        crest_path = os.path.join(crests_dir, f"{cid}.png")
        if os.path.exists(crest_path):
            team_crests[cid] = crest_path
            team_crests[t.get('name')] = crest_path

    # Leer scraped_players.js para saber qué equipo corresponde a cada foto
    with open(scraped_players_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Extraer mapeo de ffcv_player_id / foto -> team_id
    player_to_team = {}
    matches = re.finditer(r'\"photo_url\":\s*\"/players/([a-zA-Z0-9_-]+)\.jpg\"[^\}]*?\"team_id\":\s*\"([^\"]+)\"', content)
    for m in matches:
        player_to_team[m.group(1)] = m.group(2)

    # También por bloques si el orden de claves varía
    blocks = content.split('{"id":')
    for b in blocks[1:]:
        p_match = re.search(r'\"photo_url\":\s*\"/players/([a-zA-Z0-9_-]+)\.jpg\"', b)
        t_match = re.search(r'\"team_id\":\s*\"([^\"]+)\"', b)
        if p_match and t_match:
            player_to_team[p_match.group(1)] = t_match.group(1)

    print(f"Mapeados {len(player_to_team)} jugadores a sus equipos.")

    # Cargar crest por defecto (Selecció)
    default_crest = None
    if os.path.exists(default_crest_path):
        default_crest = Image.open(default_crest_path).convert('RGBA')
        bbox = default_crest.getbbox()
        if bbox:
            default_crest = default_crest.crop(bbox)

    # Preparar sesión rembg
    print("Inicializando modelo de silueta IA (u2net)...")
    session = rembg.new_session('u2net')

    # Backup original si no existe
    originals_dir = os.path.join(players_dir, 'originals')
    os.makedirs(originals_dir, exist_ok=True)

    files = [f for f in os.listdir(players_dir) if f.endswith('.jpg') and not f.startswith('sample_')]
    total = len(files)
    print(f"Total fotos a procesar: {total}")

    # Caché de escudos ya recortados y con opacidad para máxima velocidad
    prepared_crests = {}

    CW, CH = 300, 390

    def get_prepared_crest(team_id):
        if team_id in prepared_crests:
            return prepared_crests[team_id]

        crest_path = team_crests.get(team_id)
        crest_img = None
        if crest_path and os.path.exists(crest_path):
            crest_img = Image.open(crest_path).convert('RGBA')
            bbox = crest_img.getbbox()
            if bbox:
                crest_img = crest_img.crop(bbox)
        elif default_crest:
            crest_img = default_crest.copy()

        if not crest_img:
            prepared_crests[team_id] = None
            return None

        # Redimensionar al 85% de ancho del canvas
        crest_w = int(CW * 0.85)
        crest_h = int(crest_img.height * (crest_w / max(1, crest_img.width)))
        crest_resized = crest_img.resize((crest_w, crest_h), Image.Resampling.LANCZOS)

        # Aplicar 38% de opacidad para que se vea claro y elegante sobre el fondo blanco
        r, g, b, a = crest_resized.split()
        a = a.point(lambda p: int(p * 0.38))
        crest_semi = Image.merge('RGBA', (r, g, b, a))

        cx = (CW - crest_w) // 2
        cy = (CH - crest_h) // 2 - 20
        prepared_crests[team_id] = (crest_semi, (cx, cy))
        return prepared_crests[team_id]

    processed = 0
    for idx, f in enumerate(files, 1):
        player_id = f.replace('.jpg', '')
        src_path = os.path.join(players_dir, f)
        backup_path = os.path.join(originals_dir, f)

        # Si aún no tiene copia original, guardarla
        if not os.path.exists(backup_path):
            import shutil
            shutil.copyfile(src_path, backup_path)
            raw_to_process = backup_path
        else:
            raw_to_process = backup_path

        try:
            raw_img = Image.open(raw_to_process)
            nobg = rembg.remove(raw_img, session=session)

            # Fondo blanco puro
            card = Image.new('RGBA', (CW, CH), (255, 255, 255, 255))

            # Escudo de fondo
            team_id = player_to_team.get(player_id)
            crest_info = get_prepared_crest(team_id)
            if crest_info:
                crest_semi, pos = crest_info
                card.paste(crest_semi, pos, crest_semi)

            # Silueta del jugador en primer plano
            nobg_resized = nobg.resize((CW, CH), Image.Resampling.LANCZOS)
            card.paste(nobg_resized, (0, 0), nobg_resized)

            # Guardar en jpg con alta calidad
            card.convert('RGB').save(src_path, quality=94, optimize=True)
            processed += 1

            if idx % 25 == 0 or idx == total:
                print(f"Progreso: {idx}/{total} fotos procesadas ({idx*100//total}%)")

        except Exception as e:
            print(f"Error procesando {f}: {e}")

    print(f"\n¡Listo! Se han procesado {processed} fotos correctamente con fondo blanco y escudo.")

if __name__ == '__main__':
    main()
