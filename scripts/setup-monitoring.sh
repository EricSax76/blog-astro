#!/usr/bin/env bash
#
# Monitorización mínima para el-alma-de-las-flores-blog
# (PLAN-LANZAMIENTO-2026-08-04.md, Fase 1 → "Monitorización mínima y alertas").
#
# Requisito previo (una sola vez): la cuenta owner del proyecto es la de
# firebase-tools, no la activa en gcloud. Autenticarla antes de ejecutar:
#
#   gcloud auth login <cuenta-owner-del-proyecto>
#
# Crea:
#   1. Canal de notificación por email.
#   2. Alerta de errores en funciones gen1 (us-central1: provisionUserProfile,
#      cleanupOnUserDeleted) — métrica execution_count con status != "ok".
#   3. Alerta de 5xx en callables gen2 (europe-west1, corren sobre Cloud Run).
#   4. Uptime check del hosting + alerta si falla.
#
# Idempotencia: si se ejecuta dos veces crea recursos duplicados; comprobar
# antes en https://console.cloud.google.com/monitoring/alerting

set -euo pipefail

PROJECT="el-alma-de-las-flores-blog"
EMAIL="${MONITORING_EMAIL:?Define MONITORING_EMAIL con el email que recibirá las alertas}"
HOST="el-alma-de-las-flores-blog.web.app"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

gcloud services enable monitoring.googleapis.com --project="$PROJECT"

# --- 1. Canal de notificación email -----------------------------------------
CHANNEL=$(gcloud beta monitoring channels create \
  --project="$PROJECT" \
  --display-name="Email owner" \
  --type=email \
  --channel-labels="email_address=$EMAIL" \
  --format="value(name)")
echo "Canal creado: $CHANNEL"

# --- 2. Errores en funciones gen1 (triggers de Auth, us-central1) -----------
cat > "$TMP/gen1-errors.json" <<EOF
{
  "displayName": "Funciones gen1 con errores (Auth triggers)",
  "documentation": {
    "content": "provisionUserProfile / cleanupOnUserDeleted (us-central1) están fallando. Afecta al alta de perfiles y a la limpieza GDPR. Revisar: firebase functions:log --only provisionUserProfile,cleanupOnUserDeleted",
    "mimeType": "text/markdown"
  },
  "combiner": "OR",
  "conditions": [
    {
      "displayName": "execution_count con status != ok",
      "conditionThreshold": {
        "filter": "resource.type = \"cloud_function\" AND metric.type = \"cloudfunctions.googleapis.com/function/execution_count\" AND metric.labels.status != \"ok\"",
        "aggregations": [
          {
            "alignmentPeriod": "300s",
            "perSeriesAligner": "ALIGN_SUM",
            "crossSeriesReducer": "REDUCE_SUM",
            "groupByFields": ["resource.labels.function_name"]
          }
        ],
        "comparison": "COMPARISON_GT",
        "thresholdValue": 0,
        "duration": "0s",
        "trigger": {"count": 1}
      }
    }
  ]
}
EOF
gcloud alpha monitoring policies create \
  --project="$PROJECT" \
  --policy-from-file="$TMP/gen1-errors.json" \
  --notification-channels="$CHANNEL"

# --- 3. 5xx en callables gen2 (Cloud Run, europe-west1) ---------------------
cat > "$TMP/gen2-5xx.json" <<EOF
{
  "displayName": "Callables gen2 con 5xx",
  "documentation": {
    "content": "Algún callable (publishPost, addComment, deleteComment, toggleLike, upsertUserProfile, exportUserData, deleteUserData) devuelve 5xx en europe-west1. Revisar: firebase functions:log",
    "mimeType": "text/markdown"
  },
  "combiner": "OR",
  "conditions": [
    {
      "displayName": "request_count 5xx",
      "conditionThreshold": {
        "filter": "resource.type = \"cloud_run_revision\" AND metric.type = \"run.googleapis.com/request_count\" AND metric.labels.response_code_class = \"5xx\"",
        "aggregations": [
          {
            "alignmentPeriod": "300s",
            "perSeriesAligner": "ALIGN_SUM",
            "crossSeriesReducer": "REDUCE_SUM",
            "groupByFields": ["resource.labels.service_name"]
          }
        ],
        "comparison": "COMPARISON_GT",
        "thresholdValue": 0,
        "duration": "0s",
        "trigger": {"count": 1}
      }
    }
  ]
}
EOF
gcloud alpha monitoring policies create \
  --project="$PROJECT" \
  --policy-from-file="$TMP/gen2-5xx.json" \
  --notification-channels="$CHANNEL"

# --- 4. Uptime check del hosting + alerta -----------------------------------
gcloud monitoring uptime create "hosting-$HOST" \
  --project="$PROJECT" \
  --resource-type=uptime-url \
  --resource-labels="host=$HOST,project_id=$PROJECT" \
  --protocol=https \
  --path="/" \
  --period=5 \
  --timeout=10

# El check_id es el último segmento del nombre del uptime check recién creado.
CHECK_ID=$(gcloud monitoring uptime list-configs \
  --project="$PROJECT" \
  --filter="displayName=hosting-$HOST" \
  --format="value(name)" | awk -F/ '{print $NF}')

cat > "$TMP/uptime-alert.json" <<EOF
{
  "displayName": "Hosting caído ($HOST)",
  "combiner": "OR",
  "conditions": [
    {
      "displayName": "uptime check fallando",
      "conditionThreshold": {
        "filter": "resource.type = \"uptime_url\" AND metric.type = \"monitoring.googleapis.com/uptime_check/check_passed\" AND metric.labels.check_id = \"$CHECK_ID\"",
        "aggregations": [
          {
            "alignmentPeriod": "300s",
            "perSeriesAligner": "ALIGN_FRACTION_TRUE",
            "crossSeriesReducer": "REDUCE_MEAN",
            "groupByFields": ["resource.labels.host"]
          }
        ],
        "comparison": "COMPARISON_LT",
        "thresholdValue": 0.5,
        "duration": "300s",
        "trigger": {"count": 1}
      }
    }
  ]
}
EOF
gcloud alpha monitoring policies create \
  --project="$PROJECT" \
  --policy-from-file="$TMP/uptime-alert.json" \
  --notification-channels="$CHANNEL"

echo
echo "Listo. Revisar en: https://console.cloud.google.com/monitoring/alerting?project=$PROJECT"
