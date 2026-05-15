# Production: rootless Podman on EC2 (API + code-worker)

## What your logs mean

```
📴 SIGTERM — API graceful shutdown
[shutdown-audit] ... signal=SIGTERM ... GRACEFUL_SHUTDOWN
```

The **host sent SIGTERM** to the container. The app exited **0** on purpose. This is **not** fixed by more Node.js code.

`podman run --restart always` **often does not restart** exited rootless containers. Use **systemd user units** with `Restart=always` instead.

## One-time setup (each EC2)

SSH as `ubuntu`, then:

### API server

```bash
cd ~/vts-codingplatform/backend
git pull
chmod +x deploy/install-podman-api-user.sh

# build image (your usual command)
podman build --no-cache -f Dockerfile -t platform-api:latest .

./deploy/install-podman-api-user.sh
```

### Code-worker server

```bash
cd ~/vts-codingplatform/backend
git pull
chmod +x deploy/install-podman-code-worker-user.sh

podman build --no-cache -f Dockerfile.worker -t platform-code-worker:latest .

./deploy/install-podman-code-worker-user.sh
```

### Verify (both servers)

```bash
loginctl show-user ubuntu | grep Linger          # must be Linger=yes
systemctl --user status platform-api.service      # API host
systemctl --user status platform-code-worker.service   # worker host
podman ps                                           # should show Up
```

If a container exits, within **~5 seconds** systemd should start a new one (`RestartSec=5`). Check:

```bash
journalctl --user -u platform-api.service -n 50 --no-pager
```

## After code deploy

```bash
git pull
podman build ...   # rebuild image
systemctl --user restart platform-api.service    # or platform-code-worker.service
```

Do **not** run `podman rm -f` + `podman run -d` manually anymore — that bypasses systemd.

## Diagnose

```bash
./deploy/diagnose-stopped-containers.sh
```

## Redis `EAI_AGAIN`

Transient DNS to ElastiCache Serverless. Put API and worker in the **same VPC** as Redis and use the in-VPC endpoint. App retries Redis; this does not cause SIGTERM.
