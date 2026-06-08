#!/usr/bin/env bash
# ============================================================================
# generate-sri.sh
# Gera os hashes SRI (Subresource Integrity) para os scripts externos do
# index.html. Execute uma vez e cole os valores no index.html.
#
# Pré-requisito: curl e openssl instalados (padrão em macOS e Linux).
# Uso: bash generate-sri.sh
# ============================================================================

set -e

sri() {
  local url="$1"
  local name="$2"
  echo -n "  $name: "
  curl -sL "$url" | openssl dgst -sha384 -binary | openssl base64 -A
  echo ""
}

echo ""
echo "=== Hashes SRI para index.html ==="
echo ""

sri "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js" \
    "chart.js@4.4.0"

sri "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js" \
    "@supabase/supabase-js@2 (UMD)"

sri "https://unpkg.com/lucide@0.383.0/dist/umd/lucide.min.js" \
    "lucide@0.383.0"

echo ""
echo "=== Como usar no index.html ==="
echo ""
echo 'Substitua cada <script src="..."> pela versão com integrity + crossorigin, ex.:'
echo ""
echo '  <script'
echo '    src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"'
echo '    integrity="sha384-COLE_O_HASH_AQUI"'
echo '    crossorigin="anonymous"></script>'
echo ""
echo 'Faça o mesmo para supabase-js e lucide.'
echo ""
