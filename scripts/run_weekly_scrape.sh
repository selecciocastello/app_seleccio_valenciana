#!/bin/bash
# Script para ejecución programada del scraper FFCV
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$PROJECT_DIR/scripts/scrape.log"

echo "=================================================" >> "$LOG_FILE"
echo "⚽ Inicio Scraping Semanal: $(date)" >> "$LOG_FILE"
echo "=================================================" >> "$LOG_FILE"

cd "$PROJECT_DIR" || exit 1

# Usar Node del sistema
NODE_BIN="$(which node 2>/dev/null || echo "/usr/local/bin/node")"

"$NODE_BIN" scripts/scrape_ffcv_infantil.cjs >> "$LOG_FILE" 2>&1

echo "🏁 Finalizado Scraping: $(date)" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
