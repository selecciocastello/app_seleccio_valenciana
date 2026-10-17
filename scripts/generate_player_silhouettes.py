#!/usr/bin/env python3
"""
Genera siluetas transparentes (PNG sin fondo) para todas las fotos de jugadores en public/players/.
Usa el modelo u2netp de rembg para un recorte rápido y nítido de la silueta del jugador.
"""

import os
import glob
import time
from PIL import Image
import rembg

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    players_dir = os.path.join(base_dir, 'public', 'players')

    files = [f for f in glob.glob(os.path.join(players_dir, '*.jpg')) if not os.path.basename(f).startswith('sample_')]
    to_process = [f for f in files if not os.path.exists(f[:-4] + '.png')]

    print(f"Total fotos: {len(files)} | Pendientes de siluetear: {len(to_process)}")
    if not to_process:
        print("Todas las fotos ya tienen su silueta transparente (.png) generada.")
        return

    print("Inicializando modelo rembg (u2netp)...")
    session = rembg.new_session('u2netp')
    t0 = time.time()
    count = 0

    for i, jpg_path in enumerate(to_process, 1):
        png_path = jpg_path[:-4] + '.png'
        try:
            img = Image.open(jpg_path)
            # Quitar fondo preservando transparencia
            nobg = rembg.remove(img, session=session)
            nobg.save(png_path, 'PNG', optimize=True)
            count += 1
        except Exception as e:
            print(f"Error procesando {jpg_path}: {e}")

        if i % 50 == 0 or i == len(to_process):
            elapsed = time.time() - t0
            speed = count / max(1, elapsed)
            remaining = (len(to_process) - count) / max(0.1, speed)
            print(f"Progreso: {i}/{len(to_process)} ({i*100//len(to_process)}%) - {speed:.1f} fotos/s - Restante estimado: {remaining:.0f}s")

    print(f"\n¡Completado! {count} siluetas generadas en {time.time()-t0:.1f}s.")

if __name__ == '__main__':
    main()
