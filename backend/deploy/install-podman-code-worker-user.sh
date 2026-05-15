#!/usr/bin/env bash
# Code-worker EC2 (rootless Podman). Run as user ubuntu after building platform-code-worker:latest.
set -euo pipefail

REPO_HOME="${REPO_HOME:-$HOME/vts-codingplatform/backend}"
UNIT_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/systemd/platform-code-worker.user.service"
UNIT_DST="$HOME/.config/systemd/user/platform-code-worker.service"

if ! command -v podman >/dev/null 2>&1; then
  echo "podman not found in PATH" >&2
  exit 1
fi

echo "==> Enabling linger for $(whoami)"
sudo loginctl enable-linger "$(whoami)"

if systemctl --user cat podman-restart.service >/dev/null 2>&1; then
  systemctl --user enable --now podman-restart.service || true
fi

mkdir -p "$HOME/.config/systemd/user"
ENV_FILE="${REPO_HOME%/}/codeworker.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

sed "s|--env-file %h/vts-codingplatform/backend/codeworker.env|--env-file ${ENV_FILE}|g" "$UNIT_SRC" >"$UNIT_DST"
echo "==> Wrote $UNIT_DST"

podman stop code-worker 2>/dev/null || true
podman rm -f code-worker 2>/dev/null || true

systemctl --user daemon-reload
systemctl --user enable --now platform-code-worker.service
systemctl --user --no-pager status platform-code-worker.service || true

echo ""
echo "Done. Logs: journalctl --user -u platform-code-worker.service -f"
