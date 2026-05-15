#!/usr/bin/env bash
set -euo pipefail
sudo loginctl enable-linger "$(whoami)"
echo "Linger enabled for $(whoami). Verify: loginctl show-user $(whoami) | grep Linger"
