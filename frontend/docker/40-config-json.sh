#!/bin/sh
# Runs at container start (nginx image entrypoint): the same image serves every environment.
set -eu
esc() { printf '%s' "$1" | sed -e 's/[\\"]/\\&/g'; }
cat > /tmp/config.json <<JSON
{
  "apiUrl": "$(esc "${API_URL:-/api}")",
  "env": "$(esc "${APP_ENV:-dev}")",
  "release": "$(esc "${APP_RELEASE:-dev}")"
}
JSON
