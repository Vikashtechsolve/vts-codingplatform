#!/usr/bin/env bash
# Run on EC2 when containers show Exited (0). Prints why restart policy may not work.
set -uo pipefail

echo "=== User / linger (rootless Podman needs Linger=yes) ==="
loginctl show-user "$(whoami)" 2>/dev/null | grep -E 'Linger|State' || true

echo ""
echo "=== systemd user units (should be active if you ran install-*.sh) ==="
systemctl --user is-active platform-api.service 2>/dev/null && echo "platform-api.service: active" || echo "platform-api.service: NOT active (run install-podman-api-user.sh)"
systemctl --user is-active platform-code-worker.service 2>/dev/null && echo "platform-code-worker.service: active" || echo "platform-code-worker.service: NOT active (run install-podman-code-worker-user.sh)"

echo ""
echo "=== Stopped containers ==="
podman ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.ExitedAt}}' 2>/dev/null || docker ps -a

echo ""
echo "=== Last SIGTERM / shutdown in API logs (if container exists) ==="
podman logs api 2>&1 | tail -30 | grep -E 'SIGTERM|shutdown-audit|GRACEFUL' || true
podman cp api:/app/logs/shutdown-audit.log /tmp/shutdown-audit.log 2>/dev/null && cat /tmp/shutdown-audit.log || echo "(no shutdown-audit.log — container removed or old image)"

echo ""
echo "=== Fix: do NOT use manual podman run -d --restart always ==="
echo "  API:    cd ~/vts-codingplatform/backend && ./deploy/install-podman-api-user.sh"
echo "  Worker: cd ~/vts-codingplatform/backend && ./deploy/install-podman-code-worker-user.sh"
