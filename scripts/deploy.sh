#!/usr/bin/env bash
# Despliega FlotaControl en Coolify: extractor, backend y frontend.
# Uso:    COOLIFY_TOKEN=... ./deploy.sh [all|backend|frontend|extractor] [--force]
# Token:  Coolify > Keys & Tokens > API tokens, con permisos "deploy" y "read".
#         Tambien se puede guardar en un archivo .coolify-token junto a este script (no subirlo a git).
# Migraciones: el backend aplica "prisma db push" al arrancar. Si un cambio de esquema
#              borraria datos, el backend no arranca y este script lo informa con sus logs.

set -euo pipefail

COOLIFY_URL="https://panel.mflotacontrol.duckdns.org"
API_PUBLICA="https://api.mflotacontrol.duckdns.org/api/v1"
WEB_PUBLICA="https://mflotacontrol.duckdns.org"

declare -A UUID=(
  [extractor]="4wtvs2d2kbpf25izq5lt2cww"
  [backend]="ytntjoigd0rub19xyilpcltw"
  [frontend]="8yaxezx8gra5eovb1mzrxxdi"
)
ORDEN=(extractor backend frontend)

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -z "${COOLIFY_TOKEN:-}" && -f "$DIR/.coolify-token" ]]; then
  COOLIFY_TOKEN="$(tr -d '[:space:]' < "$DIR/.coolify-token")"
fi
if [[ -z "${COOLIFY_TOKEN:-}" ]]; then
  echo "Falta COOLIFY_TOKEN (variable de entorno o archivo .coolify-token)." >&2
  exit 1
fi

objetivo="${1:-all}"
force="false"
[[ "${2:-}" == "--force" || "${1:-}" == "--force" ]] && force="true"
[[ "$objetivo" == "--force" ]] && objetivo="all"

case "$objetivo" in
  all) apps=("${ORDEN[@]}") ;;
  extractor|backend|frontend) apps=("$objetivo") ;;
  *) echo "Uso: $0 [all|backend|frontend|extractor] [--force]" >&2; exit 1 ;;
esac

api() {
  curl -sS --fail-with-body --max-time 30 \
    -H "Authorization: Bearer $COOLIFY_TOKEN" -H "Accept: application/json" "$@"
}

campo() {
  sed -n "s/.*\"$1\":\"\([^\"]*\)\".*/\1/p" | head -1
}

esperar_deploy() {
  local dep="$1" estado=""
  for _ in $(seq 1 80); do
    estado="$(api "$COOLIFY_URL/api/v1/deployments/$dep" 2>/dev/null | campo status || true)"
    case "$estado" in
      finished) echo "  deploy terminado"; return 0 ;;
      failed|cancelled*) echo "  deploy $estado" >&2; return 1 ;;
    esac
    printf "  estado: %s\r" "${estado:-esperando}"
    sleep 15
  done
  echo "  tiempo de espera agotado (20 min)" >&2
  return 1
}

responde() {
  local url="$1" esperado="$2" codigo
  for _ in $(seq 1 12); do
    codigo="$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$url" || true)"
    [[ "$codigo" == "$esperado" ]] && return 0
    sleep 10
  done
  echo "  $url respondio $codigo (se esperaba $esperado)" >&2
  return 1
}

mostrar_logs() {
  local logs
  if logs="$(api "$COOLIFY_URL/api/v1/applications/$1/logs?lines=40" 2>/dev/null)"; then
    echo "  Ultimas lineas del contenedor:" >&2
    echo "$logs" | sed 's/\\n/\n/g; s/\\u001b\[[0-9;]*m//g' | tail -40 >&2
  else
    echo "  Revisa los logs en Coolify: $COOLIFY_URL > FlotaControl > production > $2 > Logs" >&2
  fi
}

for app in "${apps[@]}"; do
  echo "==> $app"
  if ! respuesta="$(api -X POST "$COOLIFY_URL/api/v1/deploy?uuid=${UUID[$app]}&force=$force" 2>&1)"; then
    echo "  Coolify rechazo el deploy (token invalido o sin permiso \"deploy\"): $respuesta" >&2
    exit 1
  fi
  dep="$(echo "$respuesta" | campo deployment_uuid)"
  if [[ -z "$dep" ]]; then
    echo "  Coolify no devolvio un deployment: $respuesta" >&2
    exit 1
  fi
  echo "  deployment $dep"

  if ! esperar_deploy "$dep"; then
    echo "  Revisa el log de build en Coolify: $COOLIFY_URL" >&2
    exit 1
  fi

  case "$app" in
    backend)
      if ! responde "$API_PUBLICA" 404; then
        echo "  El backend no arranco. Si hubo cambios en prisma/schema, puede que \"prisma db push\"" >&2
        echo "  haya rechazado un cambio que borra datos. Hay que ajustar el esquema o migrar los datos a mano." >&2
        mostrar_logs "${UUID[backend]}" flotacontrol-backend
        exit 1
      fi
      echo "  API arriba y esquema de base sincronizado"
      ;;
    frontend)
      responde "$WEB_PUBLICA/" 200 || exit 1
      echo "  frontend arriba"
      ;;
    extractor)
      sleep 10
      estado="$(api "$COOLIFY_URL/api/v1/applications/${UUID[extractor]}" | campo status)"
      [[ "$estado" == running* ]] || { echo "  extractor en estado $estado" >&2; mostrar_logs "${UUID[extractor]}" flotacontrol-extractor; exit 1; }
      echo "  extractor $estado"
      ;;
  esac
done

echo "Listo: ${apps[*]} desplegados."
