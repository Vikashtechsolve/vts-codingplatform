#!/usr/bin/env bash
# One-shot setup: linger + podman-restart + systemd user unit so the API always comes back
# after exit (including Exited 0 / SIGTERM). Run on the API EC2 as user ubuntu.
set -euo pipefail

REPO_HOME="${REPO_HOME:-$HOME/vts-codingplatform/backend}"
UNIT_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/systemd/platform-api.user.service"
UNIT_DST="$HOME/.config/systemd/user/platform-api.service"

if ! command -v podman >/dev/null 2>&1; then
  echo "podman not found in PATH" >&2
  exit 1
fi

echo "==> Enabling linger for $(whoami) (keeps user services after SSH logout)"
sudo loginctl enable-linger "$(whoami)"

if systemctl --user cat podman-restart.service >/dev/null 2>&1; then
  echo "==> Enabling podman-restart.service (helps Podman restart policies on reboot)"
  systemctl --user enable --now podman-restart.service || true
else
  echo "==> podman-restart.service not installed (optional). Relying on platform-api.service Restart=always."
fi

mkdir -p "$HOME/.config/systemd/user"
if [[ ! -f "$UNIT_SRC" ]]; then
  echo "Missing unit file: $UNIT_SRC" >&2
  exit 1
fi

ENV_FILE="${REPO_HOME%/}/.env.production"
sed "s|--env-file %h/vts-codingplatform/backend/.env.production|--env-file ${ENV_FILE}|g" "$UNIT_SRC" >"$UNIT_DST"
echo "==> Wrote $UNIT_DST (env file: ${ENV_FILE})"

echo "==> Stopping ad-hoc container name 'api' if present"
podman stop api 2>/dev/null || true
podman rm -f api 2>/dev/null || true

systemctl --user daemon-reload
systemctl --user enable --now platform-api.service
systemctl --user --no-pager status platform-api.service || true

echo ""
echo "Done. Check: systemctl --user status platform-api.service"
echo "Logs:   journalctl --user -u platform-api.service -f"
echo "Rebuild image then: systemctl --user restart platform-api.service"
