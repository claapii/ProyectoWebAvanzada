#!/usr/bin/env bash
# Despliega una version de LISTOCO en el servidor de staging y vuelve a la
# version anterior si la nueva no queda sana.
#
# Uso (en el servidor, dentro de /opt/listoco):  ./deploy.sh <IMAGE_TAG>
# Archivos que debe haber en la misma carpeta:   docker-compose.staging.yml,
# Caddyfile y .env (lo genera el workflow de CD; contiene los secretos).
set -Eeuo pipefail

cd "$(dirname "$0")"

NEW_TAG="${1:?Uso: ./deploy.sh <IMAGE_TAG>}"
TAG_FILE=".deployed_tag"
PREV_TAG="$(cat "$TAG_FILE" 2>/dev/null || true)"
COMPOSE=(docker compose -f docker-compose.staging.yml)

# Comando que aplica las migraciones de Prisma dentro de la imagen del backend.
# Vacio ("MIGRATE_CMD=") lo desactiva.
MIGRATE_CMD="${MIGRATE_CMD-npx prisma migrate deploy}"

# Compose necesita IMAGE_TAG definido en todos sus comandos.
export IMAGE_TAG="$NEW_TAG"

# El backend se consulta desde dentro de la red de Docker (a traves del contenedor
# de Caddy, que trae wget), asi la decision de revertir no depende del certificado
# HTTPS ni del DNS.
backend_sano() {
  "${COMPOSE[@]}" exec -T caddy wget -q -O /dev/null http://backend:3000/health
}

esperar_backend() {
  local intentos="$1" i
  for ((i = 1; i <= intentos; i++)); do
    if backend_sano 2>/dev/null; then
      echo "Health check correcto (intento ${i}/${intentos})."
      return 0
    fi
    echo "Esperando al backend... intento ${i}/${intentos}"
    sleep 5
  done
  return 1
}

revertir() {
  if [[ -n "$PREV_TAG" && "$PREV_TAG" != "$NEW_TAG" ]]; then
    echo "Rollback: restaurando la version ${PREV_TAG}"
    export IMAGE_TAG="$PREV_TAG"
    if "${COMPOSE[@]}" up -d --remove-orphans && esperar_backend 12; then
      echo "Rollback completado: el servidor quedo en ${PREV_TAG}."
    else
      echo "ATENCION: el rollback tambien fallo. Revisar con: docker compose -f docker-compose.staging.yml logs"
    fi
  else
    echo "No hay una version previa que restaurar (primer despliegue)."
  fi
}

echo "== Version nueva: ${NEW_TAG} | version actual: ${PREV_TAG:-ninguna}"

echo "== 1/4 Descargando imagenes"
"${COMPOSE[@]}" pull --quiet

echo "== 2/4 Base de datos"
"${COMPOSE[@]}" up -d --wait --wait-timeout 120 db

echo "== 3/4 Migraciones"
if [[ -n "$MIGRATE_CMD" ]]; then
  # Se aplican antes de cambiar los contenedores: si fallan, la version actual sigue intacta.
  if ! "${COMPOSE[@]}" run --rm --no-deps backend sh -c "$MIGRATE_CMD"; then
    echo "Las migraciones fallaron; no se cambio ningun contenedor."
    exit 1
  fi
else
  echo "Migraciones desactivadas (MIGRATE_CMD vacio)."
fi

echo "== 4/4 Levantando servicios"
if "${COMPOSE[@]}" up -d --remove-orphans --wait --wait-timeout 180 && esperar_backend 24; then
  echo "$NEW_TAG" >"$TAG_FILE"
  docker image prune -f >/dev/null
  "${COMPOSE[@]}" ps
  echo "Despliegue de ${NEW_TAG} correcto."
else
  echo "Health check fallido con ${NEW_TAG}."
  "${COMPOSE[@]}" logs --tail 40 backend python-service || true
  revertir
  exit 1
fi