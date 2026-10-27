#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

expected_node="v$(cat .nvmrc)"
if [[ "$(node --version)" != "$expected_node" ]]; then
  echo "Activa Node $expected_node según .nvmrc antes de instalar." >&2
  exit 1
fi

npm ci --cache /workspace/.npm-cache
npm run check
npm test

# The cloud image already provides Chromium; no browser download is necessary.
# A developer can instead supply a Playwright installation or explicit path.
if [[ -z "${PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:-}" ]] && command -v chromium >/dev/null 2>&1; then
  export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="$(command -v chromium)"
fi
npm run test:e2e
npm run test:platform:e2e
